"""Real-estate analyst agent.

Two layers:
1. Rule-based `generate_insights(db)` — runs against the live DB on every
   dashboard load and produces deterministic, data-driven alerts. This is the
   primary input to /api/dashboard.
2. `draft_renewal_letter(tenant_id, db)` — calls Gemini via the Google
   Generative AI SDK to draft a professional lease renewal letter.
   Returns a dict with `letter_text`, `suggested_rent`, and `market_context`.
   Gracefully returns a 503-style error dict when GOOGLE_API_KEY is absent.
3. `extract_document_data(storage_path)` — calls Gemini Vision to extract
   structured fields from a receipt or invoice image/PDF.
4. `analyze_maintenance_health(db)` — scans trailing-12-month transactions
   for spending anomalies and returns structured alerts with AI-generated
   human-readable descriptions.
"""

import os
import base64
import datetime
from typing import List, Dict, Any, Optional
from collections import defaultdict

from sqlalchemy.orm import Session

from models import Property, Tenant, Transaction, Mortgage


# ---------------------------------------------------------------------------
# Google Gemini SDK — imported lazily so the app still starts without the key.
# ---------------------------------------------------------------------------

def _get_gemini_model(system_instruction: str = None, model_name: str = "gemini-1.5-flash"):
    """Return a configured Gemini GenerativeModel or raise a clear RuntimeError."""
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GOOGLE_API_KEY is not set. "
            "Set the environment variable and restart the server."
        )
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        return genai.GenerativeModel(model_name, system_instruction=system_instruction)
    except ImportError:
        raise RuntimeError(
            "The 'google-generativeai' package is not installed. "
            "Run: pip install google-generativeai"
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
    """Draft a professional lease renewal letter using Gemini.

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

    if market_rent and market_rent > 0:
        suggested_rent = round(market_rent / 50) * 50
        market_context = f"Based on current market data, comparable units rent for ~${market_rent:,.0f}/month."
    else:
        suggested_rent = round(current_rent * 1.03 / 25) * 25
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
        model = _get_gemini_model(
            system_instruction=(
                "You are an experienced property manager drafting clear, professional "
                "lease renewal letters. Write only the letter text — no preamble, "
                "no explanation, no markdown formatting."
            )
        )
        response = model.generate_content(
            prompt,
            generation_config={"max_output_tokens": 600},
        )
        letter_text = response.text.strip()
    except RuntimeError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"AI generation failed: {str(e)}"}

    return {
        "letter_text": letter_text,
        "suggested_rent": suggested_rent,
        "market_context": market_context,
    }


def get_portfolio_advice(db: Session) -> Dict[str, Any]:
    """Provide high-level strategic advice for the entire portfolio using Gemini."""
    properties = db.query(Property).all()
    tenants = db.query(Tenant).all()
    transactions = db.query(Transaction).all()

    total_value = sum(p.purchase_price or 0 for p in properties)
    total_units = len(properties)
    occupied_units = len([t for t in tenants if t.property_id])
    occupancy_rate = (occupied_units / total_units * 100) if total_units > 0 else 0

    today = datetime.date.today()
    thirty_days_ago = today - datetime.timedelta(days=30)
    monthly_income = sum(
        t.amount for t in transactions
        if (t.type or "").lower() == "income"
        and t.transaction_date and t.transaction_date >= thirty_days_ago
    )
    monthly_expense = sum(
        t.amount for t in transactions
        if (t.type or "").lower() == "expense"
        and t.transaction_date and t.transaction_date >= thirty_days_ago
    )

    prompt = f"""You are a senior real estate investment advisor. Analyze the following portfolio summary and provide 3-4 strategic recommendations.

Portfolio Summary:
- Total Units: {total_units}
- Total Portfolio Value: ${total_value:,.2f}
- Current Occupancy: {occupancy_rate:.1f}%
- Last 30 Days Income: ${monthly_income:,.2f}
- Last 30 Days Expenses: ${monthly_expense:,.2f}

Recent Alerts:
{chr(10).join([f"- {a['title']}: {a['description']}" for a in generate_insights(db)[:5]])}

Requirements:
- Professional, data-driven tone.
- Focused on ROI, risk mitigation, and growth.
- Keep the response under 250 words.
- Format as a list of clear, actionable points.
"""

    try:
        model = _get_gemini_model(
            system_instruction="You are a brilliant real estate strategist. Provide only the strategic advice text."
        )
        response = model.generate_content(
            prompt,
            generation_config={"max_output_tokens": 800},
        )
        advice_text = response.text.strip()
    except RuntimeError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"AI advice generation failed: {str(e)}"}

    return {
        "advice": advice_text,
        "generated_at": datetime.datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# AI: Document intelligence — extract structured data from receipts / invoices
# ---------------------------------------------------------------------------

# MIME types that Gemini's vision API supports natively
_GEMINI_VISION_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
}

_EXT_TO_MIME: Dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}

_DOCUMENT_EXTRACTION_SYSTEM = (
    "You are a document parser that extracts structured financial data from "
    "receipts, invoices, and bills. Always reply with a single JSON object and "
    "nothing else — no markdown, no explanation."
)

_DOCUMENT_EXTRACTION_PROMPT = """Extract the following fields from this document:
- amount: the total monetary amount as a float (e.g. 125.50). Use null if not found.
- date: the transaction/invoice date as an ISO 8601 string (YYYY-MM-DD). Use null if not found.
- vendor: the merchant or vendor name as a string. Use null if not found.
- category: one of [Rent, Maintenance, Utilities, Insurance, Taxes, Management, Mortgage, Other]. Choose the best match.
- confidence: your confidence in the extraction as a float between 0 and 1.

Reply with ONLY a JSON object like:
{"amount": 125.50, "date": "2024-03-15", "vendor": "Home Depot", "category": "Maintenance", "confidence": 0.92}"""


def extract_document_data(storage_path: str) -> Dict[str, Any]:
    """Read a file from disk and use Gemini Vision to extract structured fields.

    Args:
        storage_path: Filename under backend/uploads/ (not a full path).

    Returns:
        Dict with keys: amount, date, vendor, category, confidence.
        On failure or unsupported file, returns a dict with confidence=0 and
        the remaining fields as None.
    """
    _empty = {
        "amount": None,
        "date": None,
        "vendor": None,
        "category": None,
        "confidence": 0.0,
    }

    upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
    full_path = os.path.join(upload_dir, storage_path)

    if not os.path.exists(full_path):
        raise RuntimeError(f"File not found: {full_path}")

    _, ext = os.path.splitext(storage_path)
    mime_type = _EXT_TO_MIME.get(ext.lower())

    if not mime_type or mime_type not in _GEMINI_VISION_MIME_TYPES:
        return _empty

    if not os.environ.get("GOOGLE_API_KEY"):
        return {**_empty, "confidence": None}

    try:
        with open(full_path, "rb") as fh:
            file_bytes = fh.read()
    except OSError as e:
        raise RuntimeError(f"Could not read file: {e}") from e

    try:
        import google.generativeai as genai

        model = _get_gemini_model(system_instruction=_DOCUMENT_EXTRACTION_SYSTEM)
        part = genai.types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
        response = model.generate_content(
            [part, _DOCUMENT_EXTRACTION_PROMPT],
            generation_config={"max_output_tokens": 300},
        )
        raw_text = response.text.strip()

        import json
        extracted = json.loads(raw_text)

        amount = extracted.get("amount")
        if amount is not None:
            try:
                amount = float(amount)
            except (TypeError, ValueError):
                amount = None

        date_val = extracted.get("date")
        if date_val is not None:
            date_val = str(date_val)

        vendor = extracted.get("vendor")
        if vendor is not None:
            vendor = str(vendor)[:255]

        category = extracted.get("category")
        if category is not None:
            category = str(category)[:100]

        confidence = extracted.get("confidence", 0.0)
        try:
            confidence = float(confidence)
            confidence = max(0.0, min(1.0, confidence))
        except (TypeError, ValueError):
            confidence = 0.0

        return {
            "amount": amount,
            "date": date_val,
            "vendor": vendor,
            "category": category,
            "confidence": confidence,
        }

    except (RuntimeError, Exception):
        return _empty


# ---------------------------------------------------------------------------
# AI: Maintenance health analysis
# ---------------------------------------------------------------------------

_MAINTENANCE_ALERT_SYSTEM = (
    "You are a real estate analyst. Write a single concise sentence (under 20 words) "
    "explaining a financial risk to a property owner. Do not use markdown or bullet points."
)


def _generate_alert_text(
    prop_address: str,
    category: str,
    category_expenses: float,
    gross_income: float,
    pct: float,
) -> str:
    """Call Gemini to generate a human-readable alert for a flagged expense category.

    Falls back to a template string if GOOGLE_API_KEY is not set.
    """
    fallback = (
        f"{category} expenses at {prop_address} are {pct:.0%} of gross income, "
        f"exceeding the 15% threshold."
    )

    if not os.environ.get("GOOGLE_API_KEY"):
        return fallback

    prompt = (
        f"Property: {prop_address}\n"
        f"Expense category: {category}\n"
        f"Trailing 12-month {category} expenses: ${category_expenses:,.0f}\n"
        f"Trailing 12-month gross income: ${gross_income:,.0f}\n"
        f"Expense as % of income: {pct:.1%}\n\n"
        "Write one sentence alerting the property owner to this risk."
    )

    try:
        model = _get_gemini_model(system_instruction=_MAINTENANCE_ALERT_SYSTEM)
        response = model.generate_content(
            prompt,
            generation_config={"max_output_tokens": 80},
        )
        return response.text.strip()
    except Exception:
        return fallback


def analyze_maintenance_health(db: Session) -> List[Dict[str, Any]]:
    """Scan trailing-12-month transactions for spending anomalies per property.

    Flags any expense category where (category_expenses / gross_income) > 0.15.
    Uses Gemini to generate a human-readable alert message for each flagged item.

    Returns:
        List of alert dicts:
        [{"property": str, "category": str, "alert": str,
          "severity": "warning"|"danger", "amount": float, "pct_of_income": float}]
    """
    today = datetime.date.today()
    twelve_months_ago = today - datetime.timedelta(days=365)

    properties = db.query(Property).all()
    transactions = (
        db.query(Transaction)
        .filter(
            Transaction.transaction_date >= twelve_months_ago,
            Transaction.status == "Paid",
        )
        .all()
    )

    income_by_prop: Dict[int, float] = defaultdict(float)
    expenses_by_prop_cat: Dict[int, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for tx in transactions:
        if not tx.transaction_date or not tx.property_id:
            continue
        tx_type = (tx.type or "").strip().lower()
        if tx_type == "income":
            income_by_prop[tx.property_id] += tx.amount
        elif tx_type == "expense":
            cat = (tx.category or "Other").strip()
            expenses_by_prop_cat[tx.property_id][cat] += tx.amount

    prop_map = {p.id: p for p in properties}
    alerts: List[Dict[str, Any]] = []

    for prop_id, cat_expenses in expenses_by_prop_cat.items():
        gross_income = income_by_prop.get(prop_id, 0.0)
        if gross_income <= 0:
            continue

        prop = prop_map.get(prop_id)
        prop_address = prop.address if prop else f"Property {prop_id}"

        for category, amount in cat_expenses.items():
            pct = amount / gross_income
            if pct <= 0.15:
                continue

            severity = "danger" if pct > 0.30 else "warning"

            alert_text = _generate_alert_text(
                prop_address, category, amount, gross_income, pct
            )

            alerts.append({
                "property": prop_address,
                "category": category,
                "alert": alert_text,
                "severity": severity,
                "amount": round(amount, 2),
                "pct_of_income": round(pct, 4),
            })

    alerts.sort(key=lambda a: a["pct_of_income"], reverse=True)
    return alerts
