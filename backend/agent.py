"""Real-estate analyst agent.

Two layers:
1. Rule-based `generate_insights(db)` — runs against the live DB on every
   dashboard load and produces deterministic, data-driven alerts. This is the
   primary input to /api/dashboard.
2. An optional `get_real_estate_analyst_agent()` LLM agent (via the Google
   Antigravity SDK) that can be invoked from an /api/agent/* endpoint when a
   narrative, free-form analysis is wanted. It is not on the request hot path.
"""

import datetime
from typing import List, Dict, Any
from collections import defaultdict

from sqlalchemy.orm import Session

from models import Property, Tenant, Transaction


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

    # 3. Maintenance-spike detection: any property whose maintenance
    #    expense in the trailing 30 days is more than 2x its average monthly
    #    maintenance spend over the prior 6 months.
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

    # 4. Rent-yield optimization: occupied properties whose monthly rent is
    #    below 0.6% of purchase price (a rough threshold under the 1% rule).
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


def get_real_estate_analyst_agent():
    """Return a Google Antigravity Agent configured as a Real Estate Analyst.

    This is an opt-in path; importing the SDK and calling it requires
    credentials. Keep it isolated from request-time code.
    """
    from google.antigravity import Agent, LocalAgentConfig

    system_instruction = (
        "You are a Real Estate Analyst. Given a JSON payload of properties, "
        "tenants, and transactions, produce concise, actionable insights about "
        "yield, occupancy risk, and maintenance trends. Return at most 5 "
        "bullet points."
    )
    config = LocalAgentConfig(system_instructions=system_instruction)
    return Agent(config)
