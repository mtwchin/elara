"""Real-estate analyst agent.

Two layers:
1. Rule-based `generate_insights(db)` — runs against the live DB on every
   dashboard load and produces deterministic, data-driven alerts. This is the
   primary input to /api/dashboard.
2. `draft_renewal_letter(tenant_id, db)` — calls Claude (claude-sonnet-4-6)
   via the Anthropic SDK to draft a professional lease renewal letter.
   Returns a dict with `letter_text`, `suggested_rent`, and `market_context`.
   Gracefully returns a 503-style error dict when ANTHROPIC_API_KEY is absent.
"""

import os
import datetime
from typing import List, Dict, Any, Optional
from collections import defaultdict

from sqlalchemy.orm import Session

from models import Property, Tenant, Transaction, Mortgage


# ---------------------------------------------------------------------------
# Anthropic SDK — imported lazily so the app still starts without the key.
# ---------------------------------------------------------------------------

def _get_anthropic_client():
    """Return an Anthropic client or raise a clear RuntimeError."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. "
            "Set the environment variable and restart the server."
        )
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        raise RuntimeError(
            "The 'anthropic' package is not installed. "
            "Run: pip install anthropic"
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _humanize_delta(target: datetime.date) -> str:
    today = datetime.date.today()
    delta = (today - target).days
    if delta <= 0:
        return "Just now"
    if delta == 1:
        return "1 day ago"
    if delta < 7:
        return f"{delta} days ago"
    if delta < 30:
        return f"{delta // 7} week{'s' if delta // 7 > 1 else ''} ago"
    return f"{delta // 30} month{'s' if delta // 30 > 1 else ''} ago"


# ---------------------------------------------------------------------------
# Rule-based insights (dashboard alerts)
# ---------------------------------------------------------------------------

def generate_insights(db: Session) -> List[Dict[str, Any]]:
    """Build the agent-alert feed from the live DB."""
    today = datetime.date.today()
    sixty_days = today + datetime.timedelta(days=60)

    alerts: List[Dict[str, Any]] = []
    next_id = 1

    properties = db.query(Property).all()
    tenants = db.query(Tenant).all()
    transactions = db.query(Transaction).all()

    # 1. Lease-expiration warnings.
    for t in tenants:
        if not t.lease_end:
            continue
        if today <= t.lease_end <= sixty_days:
            days_left = (t.lease_end - today).days
            prop = next((p for p in properties if p.id == t.property_id), None)
            addr = prop.address if prop else "Unknown Property"
            alerts.append({
                "id": next_id,
                "type": "warning",
                "title": "Lease Renewal Risk",
                "description": (
                    f"Tenant {t.name} at {addr} has {days_left} day"
                    f"{'s' if days_left != 1 else ''} left on their lease."
                ),
                "time": "Just now",
            })
            next_id += 1

    # 2. Vacant property alerts.
    occupied_ids = {
        t.property_id
        for t in tenants
        if t.lease_start and t.lease_end and t.lease_start <= today <= t.lease_end
    }
    for prop in properties:
        if prop.id not in occupied_ids:
            alerts.append({
                "id": next_id,
                "type": "info",
                "title": "Vacant Property",
                "description": (
                    f"{prop.address} has no active lease. Consider listing or "
                    f"reviewing pricing to fill the unit."
                ),
                "time": "Just now",
            })
            next_id += 1

    # 3. Maintenance-spike detection.
    thirty_days_ago = today - datetime.timedelta(days=30)
    six_months_ago = today - datetime.timedelta(days=210)

    recent_by_prop: Dict[int, float] = defaultdict(float)
    historical_by_prop: Dict[int, List[float]] = defaultdict(list)
    for t in transactions:
        if (t.category or "").lower() != "maintenance":
            continue
        if (t.type or "").lower() != "expense":
            continue
        if not t.transaction_date:
            continue
        if t.transaction_date >= thirty_days_ago:
            recent_by_prop[t.property_id] += t.amount
        elif six_months_ago <= t.transaction_date < thirty_days_ago:
            historical_by_prop[t.property_id].append(t.amount)

    for prop_id, recent in recent_by_prop.items():
        history = historical_by_prop.get(prop_id, [])
        if not history:
            continue
        avg = sum(history) / max(1, len(history))
        if avg > 0 and recent > 2 * avg:
            prop = next((p for p in properties if p.id == prop_id), None)
            addr = prop.address if prop else "Unknown Property"
            alerts.append({
                "id": next_id,
                "type": "danger",
                "title": "Maintenance Spike",
                "description": (
                    f"Maintenance spend at {addr} in the last 30 days "
                    f"(${recent:,.0f}) is {(recent / avg):.1f}x its historical "
                    f"average (${avg:,.0f}/event)."
                ),
                "time": _humanize_delta(thirty_days_ago),
            })
            next_id += 1

    # 4. Rent-yield optimization.
    rent_by_prop = {
        t.property_id: t.rent_amount
        for t in tenants
        if t.rent_amount
        and t.lease_start and t.lease_end
        and t.lease_start <= today <= t.lease_end
    }
    for prop in properties:
        rent = rent_by_prop.get(prop.id)
        if not rent or not prop.purchase_price:
            continue
        yield_ratio = rent / prop.purchase_price
        if yield_ratio < 0.006:
            suggested = round(prop.purchase_price * 0.008 / 50) * 50
            uplift = max(0, suggested - rent)
            if uplift >= 50:
                alerts.append({
                    "id": next_id,
                    "type": "success",
                    "title": "Optimal Pricing",
                    "description": (
                        f"Rent at {prop.address} (${rent:,.0f}) is below "
                        f"market. Consider raising by ~${uplift:,.0f} to "
                        f"improve yield."
                    ),
                    "time": "Just now",
                })
                next_id += 1

    return alerts


# ---------------------------------------------------------------------------
# AI: Lease renewal letter
# ---------------------------------------------------------------------------

def draft_renewal_letter(
    tenant_id: int,
    db: Session,
    market_rent: Optional[float] = None,
) -> Dict[str, Any]:
    """Draft a professional lease renewal letter using Claude.

    Returns a dict:
      {
        "letter_text": str,
        "suggested_rent": float,
        "market_context": str,
      }

    On missing API key or package, returns an error dict with key "error".
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        return {"error": f"Tenant {tenant_id} not found."}

    prop = db.query(Property).filter(Property.id == tenant.property_id).first()
    prop_address = prop.address if prop else "the property"

    today = datetime.date.today()
    current_rent = tenant.rent_amount or 0.0

    # Determine suggested rent: use passed market_rent or fall back to +3%
    if market_rent and market_rent > 0:
        suggested_rent = round(market_rent / 50) * 50  # round to nearest $50
        market_context = f"Based on current market data, comparable units rent for ~${market_rent:,.0f}/month."
    else:
        suggested_rent = round(current_rent * 1.03 / 25) * 25  # +3%, round to $25
        market_context = "Market data unavailable; suggested rent is based on a standard 3% annual adjustment."

    lease_end_str = tenant.lease_end.strftime("%B %d, %Y") if tenant.lease_end else "your current lease end date"
    days_remaining = (tenant.lease_end - today).days if tenant.lease_end else 0

    prompt = f"""Draft a professional, warm lease renewal letter from a property manager to a tenant.

Tenant name: {tenant.name}
Property address: {prop_address}
Current monthly rent: ${current_rent:,.2f}
Proposed new monthly rent: ${suggested_rent:,.2f}
Current lease end date: {lease_end_str}
Days remaining on lease: {days_remaining}
Tenant's renewal intent: {tenant.intent or 'Undecided'}

Requirements:
- Address the tenant by first name
- Thank them for being a tenant
- Clearly state the proposed new rent
- Propose a new 12-month lease starting from the current end date
- Include a response deadline of 30 days before lease expiration
- Keep it under 300 words
- Professional but friendly tone
- Do NOT include a signature block placeholder — end with a closing line only
"""

    try:
        client = _get_anthropic_client()
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=(
                "You are an experienced property manager drafting clear, professional "
                "lease renewal letters. Write only the letter text — no preamble, "
                "no explanation, no markdown formatting."
            ),
            messages=[{"role": "user", "content": prompt}],
        )
        letter_text = response.content[0].text.strip()
    except RuntimeError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"AI generation failed: {str(e)}"}

    return {
        "letter_text": letter_text,
        "suggested_rent": suggested_rent,
        "market_context": market_context,
    }
