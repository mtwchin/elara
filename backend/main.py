from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db
from models import Property, Tenant, Transaction, User, Mortgage, Document, MaintenanceRequest
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List
from collections import defaultdict
import datetime
import httpx
import time
import os
from dotenv import load_dotenv
load_dotenv()
import asyncio
import uuid
import csv
import io

from agent import (
    generate_insights,
    draft_renewal_letter,
    extract_document_data,
    analyze_maintenance_health,
    get_portfolio_advice,
    orchestrator,
)
from auth import (
    create_token,
    get_current_user,
    hash_password,
    verify_password,
)

app = FastAPI(title="Elara API")

# Per-request debug logging — opt-in via DEBUG_HTTP to avoid noisy/leaky logs
# in production. Set DEBUG_HTTP=1 locally to trace requests.
if os.environ.get("DEBUG_HTTP"):
    @app.middleware("http")
    async def debug_logging(request, call_next):
        print(f"DEBUG: {request.method} {request.url}")
        try:
            response = await call_next(request)
            print(f"DEBUG: Response {response.status_code}")
            return response
        except Exception as e:
            print(f"DEBUG: Exception: {e}")
            raise

# CORS — configurable allowlist. Set CORS_ORIGINS to a comma-separated list of
# origins (e.g. "https://app.example.com,https://example.com"). Defaults to the
# local dev origins. Using an explicit allowlist (not "*") keeps
# allow_credentials valid and avoids exposing the API to arbitrary origins.
_default_origins = "http://localhost:5173,http://localhost,http://127.0.0.1:5173,http://localhost:8000"
CORS_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ORIGINS", _default_origins).split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _log_env_diagnostics():
    """Log which optional integrations are configured (warn, never crash)."""
    ai = "enabled" if os.environ.get("GOOGLE_API_KEY") else "DISABLED (set GOOGLE_API_KEY)"
    market = "enabled" if os.environ.get("RAPIDAPI_KEY") else "DISABLED (set RAPIDAPI_KEY)"
    print(f"[startup] Elara API ready — AI: {ai}; Market data: {market}")
    print(f"[startup] CORS origins: {CORS_ORIGINS}")


@app.get("/api/health")
async def health_check():
    """Unauthenticated liveness/readiness probe for deploy + uptime checks."""
    return {
        "status": "ok",
        "ai_enabled": bool(os.environ.get("GOOGLE_API_KEY")),
        "market_data_enabled": bool(os.environ.get("RAPIDAPI_KEY")),
        "time": datetime.datetime.utcnow().isoformat() + "Z",
    }

# ---------------------------------------------------------------------------
# Upload directory
# ---------------------------------------------------------------------------

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/heic",
    "image/heif",
}
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".heic"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    account_type: Optional[str] = "admin"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
    account_type: str = "admin"


@app.post("/api/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(email=req.email, hashed_password=hash_password(req.password), account_type=req.account_type)
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_token(user), email=user.email, account_type=user.account_type)


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return TokenResponse(access_token=create_token(user), email=user.email, account_type=user.account_type)


@app.post("/api/auth/login-json", response_model=TokenResponse)
async def login_json(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return TokenResponse(access_token=create_token(user), email=user.email, account_type=user.account_type)


@app.get("/api/auth/me")
async def me(current: User = Depends(get_current_user)):
    return {"id": current.id, "email": current.email}


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def parse_city_from_address(address: str) -> str:
    if not address:
        return "Miami"
    parts = address.split(",")
    if len(parts) >= 2:
        return parts[1].strip()
    return address.strip()


# Global market data cache
MARKET_DATA_CACHE: Dict[str, tuple[Dict[str, Any], float]] = {}
MARKET_DATA_CACHE_TTL = 24 * 3600  # 24 hours

DEFAULT_FALLBACK_DATA = {
    "cityAveragePrice": 850000.0,
    "cityAverageRent": 3200.0,
    "listings": [
        {"address": "123 Ocean Drive, Miami FL", "price": 920000.0, "beds": 3, "baths": 2.0},
        {"address": "456 Brickell Ave, Miami FL", "price": 780000.0, "beds": 2, "baths": 2.0},
    ],
}


def sanitize_market_data(data: Dict[str, Any]) -> Dict[str, Any]:
    city_price = data.get("cityAveragePrice")
    if city_price is None or city_price < 0:
        city_price = 0.0
    else:
        try:
            city_price = float(city_price)
        except Exception:
            city_price = 0.0

    city_rent = data.get("cityAverageRent")
    if city_rent is None or city_rent < 0:
        city_rent = 0.0
    else:
        try:
            city_rent = float(city_rent)
        except Exception:
            city_rent = 0.0

    sanitized_listings = []
    for item in data.get("listings", []):
        address = item.get("address")
        if not address:
            address = "Unknown Address"
        else:
            address = str(address)
            if len(address) > 255:
                address = address[:255]
        price = item.get("price")
        if price is None:
            price = 0.0
        else:
            try:
                price = float(price)
                if price < 0:
                    price = 0.0
            except Exception:
                price = 0.0
        beds = item.get("beds")
        if beds is None:
            beds = 0
        else:
            try:
                beds = int(beds)
                if beds < 0:
                    beds = 0
            except Exception:
                beds = 0
        baths = item.get("baths")
        if baths is None:
            baths = 0.0
        else:
            try:
                baths = float(baths)
                if baths < 0:
                    baths = 0.0
            except Exception:
                baths = 0.0
        sanitized_listings.append({"address": address, "price": price, "beds": beds, "baths": baths})

    return {"cityAveragePrice": city_price, "cityAverageRent": city_rent, "listings": sanitized_listings}


_last_seen_test = None


def check_and_clear_cache_for_testing():
    global _last_seen_test, MARKET_DATA_CACHE
    current_test = os.environ.get("PYTEST_CURRENT_TEST")
    if current_test and current_test != _last_seen_test:
        MARKET_DATA_CACHE.clear()
        _last_seen_test = current_test


async def fetch_zillow_market_data(city: str, alerts: list) -> Dict[str, Any]:
    global MARKET_DATA_CACHE
    check_and_clear_cache_for_testing()

    city_key = city.strip().lower()
    now = time.time()

    if city_key in MARKET_DATA_CACHE:
        cached_data, timestamp = MARKET_DATA_CACHE[city_key]
        if now - timestamp < MARKET_DATA_CACHE_TTL:
            return cached_data

    rapidapi_key = os.environ.get("RAPIDAPI_KEY")
    rapidapi_host = os.environ.get("RAPIDAPI_HOST", "zillow-com1.p.rapidapi.com")
    base_url = os.environ.get("ZILLOW_API_BASE_URL") or "https://zillow-com1.p.rapidapi.com"

    if not rapidapi_key:
        if not any("api key" in a.get("description", "").lower() for a in alerts):
            alerts.append({
                "id": len(alerts) + 900,
                "type": "warning",
                "title": "Missing API Key",
                "description": "Missing RAPIDAPI_KEY configuration. Serving fallback data.",
                "time": "Just now",
            })
        fallback_res = MARKET_DATA_CACHE[city_key][0] if city_key in MARKET_DATA_CACHE else DEFAULT_FALLBACK_DATA
        return fallback_res

    url = f"{base_url}/market-data"
    headers = {
        "X-RapidAPI-Key": rapidapi_key,
        "X-RapidAPI-Host": rapidapi_host,
    }

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            response = await client.get(url, params={"city": city}, headers=headers)
            if response.status_code == 200:
                raw_data = response.json()
                sanitized = sanitize_market_data(raw_data)
                MARKET_DATA_CACHE[city_key] = (sanitized, now)
                return sanitized
            elif response.status_code == 429:
                if not any("rate limit" in a.get("description", "").lower() for a in alerts):
                    alerts.append({
                        "id": len(alerts) + 900,
                        "type": "danger",
                        "title": "Rate Limit Exceeded",
                        "description": "Zillow API rate limit hit. Serving cached/fallback data.",
                        "time": "Just now",
                    })
                return MARKET_DATA_CACHE[city_key][0] if city_key in MARKET_DATA_CACHE else DEFAULT_FALLBACK_DATA
            else:
                print(f"Zillow API error: {response.status_code} - {response.text}")
                return MARKET_DATA_CACHE[city_key][0] if city_key in MARKET_DATA_CACHE else DEFAULT_FALLBACK_DATA
        except Exception as e:
            print(f"Zillow fetch exception: {e}")
            return MARKET_DATA_CACHE[city_key][0] if city_key in MARKET_DATA_CACHE else DEFAULT_FALLBACK_DATA


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

async def _compute_dashboard_metrics(db: Session, alerts: list) -> dict:
    today = datetime.date.today()
    properties = db.query(Property).order_by(Property.id).all()
    tenants = db.query(Tenant).all()
    transactions = db.query(Transaction).all()

    total_portfolio_value = sum(p.purchase_price or 0 for p in properties)

    occupied_ids = {
        t.property_id
        for t in tenants
        if t.lease_start and t.lease_end and t.lease_start <= today <= t.lease_end
    }
    occupancy_rate = (len(occupied_ids) / len(properties)) * 100 if properties else 0.0

    month_start = today.replace(day=1)
    monthly_revenue = sum(
        t.amount
        for t in transactions
        if t.status == "Paid"
        and (t.type or "").lower() == "income"
        and t.transaction_date
        and t.transaction_date >= month_start
    )

    total_annual_rent = 0.0
    for p in properties:
        active_tenant = None
        for t in tenants:
            if t.property_id == p.id and t.lease_start and t.lease_end and t.lease_start <= today <= t.lease_end:
                active_tenant = t
                break
        if active_tenant:
            rent_val = active_tenant.rent_amount or 0.0
        else:
            p_city = parse_city_from_address(p.address)
            p_market_data = await fetch_zillow_market_data(p_city, alerts)
            rent_val = p_market_data.get("cityAverageRent", 0.0) or 0.0
        total_annual_rent += rent_val * 12

    avg_roi = (total_annual_rent / total_portfolio_value) * 100 if total_portfolio_value else 0.0

    monthly_buckets = defaultdict(lambda: {"revenue": 0.0, "expenses": 0.0})
    for t in transactions:
        if t.status != "Paid" or not t.transaction_date:
            continue
        key = (t.transaction_date.year, t.transaction_date.month)
        if (t.type or "").lower() == "income":
            monthly_buckets[key]["revenue"] += t.amount
        else:
            monthly_buckets[key]["expenses"] += t.amount

    cursor = today.replace(day=1)
    months = []
    for _ in range(6):
        months.append((cursor.year, cursor.month))
        if cursor.month == 1:
            cursor = cursor.replace(year=cursor.year - 1, month=12)
        else:
            cursor = cursor.replace(month=cursor.month - 1)
    months.reverse()

    max_val = max(
        (max(monthly_buckets[m]["revenue"], monthly_buckets[m]["expenses"]) for m in months),
        default=0,
    )
    scale = (95.0 / max_val) if max_val else 0.0
    chart_data = []
    for year, month in months:
        bucket = monthly_buckets[(year, month)]
        chart_data.append({
            "month": _MONTH_LABELS[month - 1],
            "revenue": round(bucket["revenue"] * scale) if scale else 0,
            "expenses": round(bucket["expenses"] * scale) if scale else 0,
        })

    primary_city = "Miami"
    if properties:
        primary_city = parse_city_from_address(properties[0].address)
    primary_market_data = await fetch_zillow_market_data(primary_city, alerts)

    # Compute MoM comparison for metrics
    prev_month_start = (today.replace(day=1) - datetime.timedelta(days=1)).replace(day=1)
    prev_month_end = today.replace(day=1) - datetime.timedelta(days=1)
    prev_monthly_revenue = sum(
        t.amount
        for t in transactions
        if t.status == "Paid"
        and (t.type or "").lower() == "income"
        and t.transaction_date
        and prev_month_start <= t.transaction_date <= prev_month_end
    )
    revenue_mom_pct: Optional[float] = None
    if prev_monthly_revenue > 0:
        revenue_mom_pct = round(((monthly_revenue - prev_monthly_revenue) / prev_monthly_revenue) * 100, 1)

    return {
        "metrics": {
            "totalPortfolioValue": total_portfolio_value,
            "monthlyRevenue": monthly_revenue,
            "avgRoi": round(avg_roi, 1),
            "occupancyRate": round(occupancy_rate, 1),
            "revenueMomPct": revenue_mom_pct,  # null when no prior month data
        },
        "chartData": chart_data,
        "marketData": primary_market_data,
    }


@app.get("/api/dashboard")
async def get_dashboard(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    alerts = []
    base = await _compute_dashboard_metrics(db, alerts)
    db_alerts = generate_insights(db)
    base["alerts"] = db_alerts + alerts
    return base


# ---------------------------------------------------------------------------
# Market data
# ---------------------------------------------------------------------------

@app.get("/api/market-data")
async def get_market_data(
    city: str,
    _user: User = Depends(get_current_user),
):
    dummy_alerts = []
    data = await fetch_zillow_market_data(city, dummy_alerts)
    return data


# ---------------------------------------------------------------------------
# Properties CRUD
# ---------------------------------------------------------------------------

class PropertyCreate(BaseModel):
    address: str
    propertyType: str
    purchasePrice: float
    purchaseDate: datetime.date
    status: Optional[str] = "Active"


class PropertyUpdate(BaseModel):
    address: Optional[str] = None
    propertyType: Optional[str] = None
    purchasePrice: Optional[float] = None
    purchaseDate: Optional[datetime.date] = None
    status: Optional[str] = None


def _property_status(prop: Property, db: Session) -> str:
    today = datetime.date.today()
    active_tenant = (
        db.query(Tenant)
        .filter(Tenant.property_id == prop.id)
        .filter(Tenant.lease_start <= today)
        .filter(Tenant.lease_end >= today)
        .first()
    )
    if active_tenant:
        return "Occupied"
    return prop.status or "Vacant"


def _serialize_property(p: Property, db: Session) -> dict:
    return {
        "id": p.id,
        "address": p.address,
        "propertyType": p.property_type,
        "purchasePrice": p.purchase_price,
        "purchaseDate": p.purchase_date.isoformat() if p.purchase_date else None,
        "status": _property_status(p, db),
    }


@app.get("/api/properties")
async def get_properties(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    properties = db.query(Property).all()
    return [_serialize_property(p, db) for p in properties]


@app.get("/api/properties/{property_id}")
async def get_property(
    property_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return _serialize_property(prop, db)


@app.post("/api/properties", status_code=201)
async def create_property(
    prop: PropertyCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    db_prop = Property(
        address=prop.address,
        property_type=prop.propertyType,
        purchase_price=prop.purchasePrice,
        purchase_date=prop.purchaseDate,
        status=prop.status,
    )
    db.add(db_prop)
    db.commit()
    db.refresh(db_prop)
    return _serialize_property(db_prop, db)


@app.put("/api/properties/{property_id}")
async def update_property(
    property_id: int,
    body: PropertyUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if body.address is not None:
        prop.address = body.address
    if body.propertyType is not None:
        prop.property_type = body.propertyType
    if body.purchasePrice is not None:
        prop.purchase_price = body.purchasePrice
    if body.purchaseDate is not None:
        prop.purchase_date = body.purchaseDate
    if body.status is not None:
        prop.status = body.status
    db.commit()
    db.refresh(prop)
    return _serialize_property(prop, db)


@app.delete("/api/properties/{property_id}", status_code=204)
async def delete_property(
    property_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    db.delete(prop)
    db.commit()


# ---------------------------------------------------------------------------
# Mortgage CRUD  (F1)
# ---------------------------------------------------------------------------

class MortgageCreate(BaseModel):
    principal: float
    interest_rate: float
    term_months: int
    lender: Optional[str] = None
    monthly_pi: float
    monthly_escrow: Optional[float] = 0.0
    origination_date: Optional[datetime.date] = None


class MortgageUpdate(BaseModel):
    principal: Optional[float] = None
    interest_rate: Optional[float] = None
    term_months: Optional[int] = None
    lender: Optional[str] = None
    monthly_pi: Optional[float] = None
    monthly_escrow: Optional[float] = None
    origination_date: Optional[datetime.date] = None


def _serialize_mortgage(m: Mortgage) -> dict:
    return {
        "id": m.id,
        "propertyId": m.property_id,
        "principal": m.principal,
        "interestRate": m.interest_rate,
        "termMonths": m.term_months,
        "lender": m.lender,
        "monthlyPi": m.monthly_pi,
        "monthlyEscrow": m.monthly_escrow or 0.0,
        "originationDate": m.origination_date.isoformat() if m.origination_date else None,
        "monthlyTotal": (m.monthly_pi or 0.0) + (m.monthly_escrow or 0.0),
    }


@app.get("/api/properties/{property_id}/mortgage")
async def get_mortgage(
    property_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    m = db.query(Mortgage).filter(Mortgage.property_id == property_id).first()
    if not m:
        return None
    return _serialize_mortgage(m)


@app.post("/api/properties/{property_id}/mortgage", status_code=201)
async def create_mortgage(
    property_id: int,
    body: MortgageCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    existing = db.query(Mortgage).filter(Mortgage.property_id == property_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Mortgage already exists. Use PUT to update.")
    m = Mortgage(
        property_id=property_id,
        principal=body.principal,
        interest_rate=body.interest_rate,
        term_months=body.term_months,
        lender=body.lender,
        monthly_pi=body.monthly_pi,
        monthly_escrow=body.monthly_escrow or 0.0,
        origination_date=body.origination_date,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _serialize_mortgage(m)


@app.put("/api/properties/{property_id}/mortgage")
async def update_mortgage(
    property_id: int,
    body: MortgageUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    m = db.query(Mortgage).filter(Mortgage.property_id == property_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="No mortgage found for this property")
    if body.principal is not None:
        m.principal = body.principal
    if body.interest_rate is not None:
        m.interest_rate = body.interest_rate
    if body.term_months is not None:
        m.term_months = body.term_months
    if body.lender is not None:
        m.lender = body.lender
    if body.monthly_pi is not None:
        m.monthly_pi = body.monthly_pi
    if body.monthly_escrow is not None:
        m.monthly_escrow = body.monthly_escrow
    if body.origination_date is not None:
        m.origination_date = body.origination_date
    db.commit()
    db.refresh(m)
    return _serialize_mortgage(m)


@app.delete("/api/properties/{property_id}/mortgage", status_code=204)
async def delete_mortgage(
    property_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    m = db.query(Mortgage).filter(Mortgage.property_id == property_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="No mortgage found for this property")
    db.delete(m)
    db.commit()


# ---------------------------------------------------------------------------
# Tenants CRUD  (F5 + F2 support)
# ---------------------------------------------------------------------------

def _serialize_tenant(t: Tenant, db: Session) -> dict:
    prop = db.query(Property).filter(Property.id == t.property_id).first()
    today = datetime.date.today()
    days_remaining: Optional[int] = None
    if t.lease_end:
        days_remaining = (t.lease_end - today).days
    return {
        "id": t.id,
        "name": t.name,
        "email": t.email,
        "phone": t.phone,
        "propertyId": t.property_id,
        "userId": t.user_id,
        "propertyAssigned": prop.address if prop else "Unassigned",
        "leaseStart": t.lease_start.isoformat() if t.lease_start else None,
        "leaseEnd": t.lease_end.isoformat() if t.lease_end else None,
        "rentAmount": t.rent_amount,
        "intent": t.intent or "Undecided",
        "daysUntilLeaseEnd": days_remaining,
        "creditScore": t.credit_score,
        "backgroundCheckStatus": t.background_check_status,
    }


@app.get("/api/tenants")
async def get_tenants(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    tenants = db.query(Tenant).all()
    return [_serialize_tenant(t, db) for t in tenants]


@app.get("/api/tenants/{tenant_id}")
async def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _serialize_tenant(t, db)


class TenantCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    property_id: int
    user_id: Optional[int] = None
    lease_start: Optional[datetime.date] = None
    lease_end: Optional[datetime.date] = None
    rent_amount: Optional[float] = None
    intent: Optional[str] = "Undecided"


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    property_id: Optional[int] = None
    user_id: Optional[int] = None
    lease_start: Optional[datetime.date] = None
    lease_end: Optional[datetime.date] = None
    rent_amount: Optional[float] = None
    intent: Optional[str] = None


@app.post("/api/tenants", status_code=201)
async def create_tenant(
    body: TenantCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.id == body.property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    t = Tenant(
        name=body.name,
        email=body.email,
        phone=body.phone,
        property_id=body.property_id,
        user_id=body.user_id,
        lease_start=body.lease_start,
        lease_end=body.lease_end,
        rent_amount=body.rent_amount,
        intent=body.intent or "Undecided",
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _serialize_tenant(t, db)


@app.put("/api/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: int,
    body: TenantUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if body.name is not None:
        t.name = body.name
    if body.email is not None:
        t.email = body.email
    if body.phone is not None:
        t.phone = body.phone
    if body.property_id is not None:
        prop = db.query(Property).filter(Property.id == body.property_id).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")
        t.property_id = body.property_id
    if body.user_id is not None:
        t.user_id = body.user_id
    if body.lease_start is not None:
        t.lease_start = body.lease_start
    if body.lease_end is not None:
        t.lease_end = body.lease_end
    if body.rent_amount is not None:
        t.rent_amount = body.rent_amount
    if body.intent is not None:
        t.intent = body.intent
    db.commit()
    db.refresh(t)
    return _serialize_tenant(t, db)


@app.delete("/api/tenants/{tenant_id}", status_code=204)
async def delete_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    db.delete(t)
    db.commit()


# ---------------------------------------------------------------------------
# Tenant Screening
# ---------------------------------------------------------------------------

@app.post("/api/tenants/{tenant_id}/screen")
async def screen_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    import random
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    await asyncio.sleep(1) # simulate latency
    score = random.randint(600, 800)
    t.credit_score = score
    t.background_check_status = "Passed"
    db.commit()
    db.refresh(t)
    return _serialize_tenant(t, db)


# ---------------------------------------------------------------------------
# Maintenance Requests CRUD
# ---------------------------------------------------------------------------

class MaintenanceRequestCreate(BaseModel):
    property_id: int
    tenant_id: Optional[int] = None
    title: str
    description: str
    status: Optional[str] = "Open"
    priority: Optional[str] = "Normal"


class MaintenanceRequestUpdate(BaseModel):
    property_id: Optional[int] = None
    tenant_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None


def _serialize_maintenance(m: MaintenanceRequest) -> dict:
    return {
        "id": m.id,
        "propertyId": m.property_id,
        "tenantId": m.tenant_id,
        "title": m.title,
        "description": m.description,
        "status": m.status,
        "priority": m.priority,
        "createdAt": m.created_at.isoformat() if m.created_at else None,
    }


@app.get("/api/maintenance")
async def get_maintenance_requests(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    requests = db.query(MaintenanceRequest).all()
    return [_serialize_maintenance(r) for r in requests]


@app.post("/api/maintenance", status_code=201)
async def create_maintenance_request(
    body: MaintenanceRequestCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    req = MaintenanceRequest(
        property_id=body.property_id,
        tenant_id=body.tenant_id,
        title=body.title,
        description=body.description,
        status=body.status or "Open",
        priority=body.priority or "Normal",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _serialize_maintenance(req)


@app.put("/api/maintenance/{request_id}")
async def update_maintenance_request(
    request_id: int,
    body: MaintenanceRequestUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    if body.property_id is not None:
        req.property_id = body.property_id
    if body.tenant_id is not None:
        req.tenant_id = body.tenant_id
    if body.title is not None:
        req.title = body.title
    if body.description is not None:
        req.description = body.description
    if body.status is not None:
        req.status = body.status
    if body.priority is not None:
        req.priority = body.priority
    db.commit()
    db.refresh(req)
    return _serialize_maintenance(req)


# ---------------------------------------------------------------------------
# Bank Sync
# ---------------------------------------------------------------------------

@app.post("/api/bank/sync")
async def sync_bank(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    properties = db.query(Property).all()
    if not properties:
        return {"synced": 0, "message": "No properties found to sync rent"}
    
    import random
    synced_count = 0
    today = datetime.date.today()
    for _ in range(random.randint(1, 3)):
        prop = random.choice(properties)
        tx = Transaction(
            property_id=prop.id,
            transaction_date=today,
            amount=random.choice([1200.0, 1500.0, 2500.0, 3200.0]),
            category="Rent",
            type="income",
            description="Mock Bank Sync - Rent Payment",
            status="Paid"
        )
        db.add(tx)
        synced_count += 1
    db.commit()
    return {"synced": synced_count, "message": f"Successfully synced {synced_count} mock transactions"}


# ---------------------------------------------------------------------------
# Agents (AI endpoints)
# ---------------------------------------------------------------------------

@app.get("/agents")
async def get_agents(_user: User = Depends(get_current_user)):
    return {"agents": []}


class RenewalLetterRequest(BaseModel):
    tenant_id: int


def _ai_error_to_http(result: dict) -> None:
    """Translate an agent error dict into an HTTPException.

    Missing/uninstalled AI credentials are a configuration issue (503,
    service unavailable); anything else is treated as a server error (500).
    """
    msg = result.get("error", "AI request failed")
    if "GOOGLE_API_KEY" in msg or "not installed" in msg or "not set" in msg:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI service unavailable: " + msg +
                " Set GOOGLE_API_KEY and restart the server to enable this feature."
            ),
        )
    raise HTTPException(status_code=500, detail=msg)


@app.post("/api/agents/renewal-letter")
async def renewal_letter(
    body: RenewalLetterRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Draft a lease renewal letter using Gemini.

    Fetches market rent from Zillow for the property city (falls back to
    current rent +3% if Zillow is unavailable or RAPIDAPI_KEY is unset).
    Returns 503 when GOOGLE_API_KEY is missing.
    """
    tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant {body.tenant_id} not found")

    # Try to get market rent from Zillow
    market_rent: Optional[float] = None
    prop = db.query(Property).filter(Property.id == tenant.property_id).first()
    if prop:
        dummy_alerts: list = []
        city = parse_city_from_address(prop.address)
        market_data = await fetch_zillow_market_data(city, dummy_alerts)
        zillow_rent = market_data.get("cityAverageRent")
        if zillow_rent and zillow_rent > 0:
            market_rent = float(zillow_rent)

    result = draft_renewal_letter(body.tenant_id, db, market_rent=market_rent)

    if "error" in result:
        _ai_error_to_http(result)

    return result


@app.get("/api/agents/portfolio-advice")
async def portfolio_advice(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get high-level portfolio strategic advice from Gemini."""
    result = get_portfolio_advice(db)

    if "error" in result:
        _ai_error_to_http(result)

    return result


# ---------------------------------------------------------------------------
# Transactions CRUD
# ---------------------------------------------------------------------------

class TransactionCreate(BaseModel):
    property_id: int
    date: datetime.date
    amount: float
    category: str
    type: str
    description: Optional[str] = None
    status: Optional[str] = "Paid"


class TransactionUpdate(BaseModel):
    property_id: Optional[int] = None
    date: Optional[datetime.date] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


def _normalize_type(value: str) -> str:
    return (value or "").strip().lower()


def _display_type(value: str) -> str:
    v = _normalize_type(value)
    return "Income" if v == "income" else "Expense" if v == "expense" else (value or "")


def _serialize_transaction(t: Transaction, db: Session) -> dict:
    p = db.query(Property).filter(Property.id == t.property_id).first()
    doc_count = db.query(Document).filter(Document.transaction_id == t.id).count()
    return {
        "id": t.id,
        "propertyId": t.property_id,
        "property": p.address if p else "Unknown Property",
        "date": t.transaction_date.isoformat() if t.transaction_date else None,
        "amount": t.amount,
        "category": t.category,
        "type": _display_type(t.type),
        "description": t.description,
        "status": t.status,
        "documentCount": doc_count,
    }


@app.get("/api/transactions")
async def get_transactions(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    transactions = db.query(Transaction).all()
    return [_serialize_transaction(t, db) for t in transactions]


@app.get("/api/transactions/{transaction_id}")
async def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    t = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _serialize_transaction(t, db)


@app.post("/api/transactions")
async def create_transaction(
    tx: TransactionCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    new_tx = Transaction(
        property_id=tx.property_id,
        transaction_date=tx.date,
        amount=tx.amount,
        category=tx.category,
        type=_normalize_type(tx.type),
        description=tx.description,
        status=tx.status,
    )
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)
    return _serialize_transaction(new_tx, db)


@app.put("/api/transactions/{transaction_id}")
async def update_transaction(
    transaction_id: int,
    body: TransactionUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if body.property_id is not None:
        prop = db.query(Property).filter(Property.id == body.property_id).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")
        tx.property_id = body.property_id
    if body.date is not None:
        tx.transaction_date = body.date
    if body.amount is not None:
        tx.amount = body.amount
    if body.category is not None:
        tx.category = body.category
    if body.type is not None:
        tx.type = _normalize_type(body.type)
    if body.description is not None:
        tx.description = body.description
    if body.status is not None:
        tx.status = body.status
    db.commit()
    db.refresh(tx)
    return _serialize_transaction(tx, db)


@app.delete("/api/transactions/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()


# ---------------------------------------------------------------------------
# Documents (F3)
# ---------------------------------------------------------------------------

def _serialize_document(d: Document) -> dict:
    return {
        "id": d.id,
        "transactionId": d.transaction_id,
        "propertyId": d.property_id,
        "filename": d.filename,
        "mimeType": d.mime_type,
        "sizeBytes": d.size_bytes,
        "uploadedAt": d.uploaded_at.isoformat() if d.uploaded_at else None,
        # AI extraction fields (null when not yet extracted)
        "extractedAmount": d.extracted_amount,
        "extractedDate": d.extracted_date,
        "extractedVendor": d.extracted_vendor,
        "extractedCategory": d.extracted_category,
        "extractionConfidence": d.extraction_confidence,
    }


@app.post("/api/transactions/{transaction_id}/documents", status_code=201)
async def upload_transaction_document(
    transaction_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Extension check
    _, ext = os.path.splitext(file.filename or "")
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read and size check
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    # Determine MIME type
    mime_type = file.content_type or "application/octet-stream"
    # Normalise heic
    if ext.lower() in (".heic", ".heif"):
        mime_type = "image/heic"

    # Save with UUID prefix
    safe_filename = f"{uuid.uuid4().hex}{ext.lower()}"
    dest_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(dest_path, "wb") as f:
        f.write(contents)

    doc = Document(
        transaction_id=transaction_id,
        property_id=tx.property_id,
        filename=file.filename or safe_filename,
        storage_path=safe_filename,
        mime_type=mime_type,
        size_bytes=len(contents),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Attempt AI extraction — non-fatal if it fails
    try:
        extraction = extract_document_data(safe_filename)
        doc.extracted_amount = extraction.get("amount")
        doc.extracted_date = extraction.get("date")
        doc.extracted_vendor = extraction.get("vendor")
        doc.extracted_category = extraction.get("category")
        doc.extraction_confidence = extraction.get("confidence")
        db.commit()
        db.refresh(doc)
    except Exception:
        pass  # Extraction failure must never block a successful upload

    return _serialize_document(doc)


@app.post("/api/transactions/{transaction_id}/documents/{document_id}/sync")
async def sync_document_to_transaction(
    transaction_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Apply extracted document data back to the parent Transaction.

    Only updates fields where extraction_confidence > 0.7 and the extracted
    value is present. Returns the updated Transaction.
    """
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.transaction_id == transaction_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found for this transaction")

    confidence = doc.extraction_confidence
    if confidence is None or confidence <= 0.7:
        return _serialize_transaction(tx, db)  # nothing to apply

    if doc.extracted_amount is not None:
        tx.amount = doc.extracted_amount
    if doc.extracted_date is not None:
        try:
            tx.transaction_date = datetime.date.fromisoformat(doc.extracted_date)
        except ValueError:
            pass  # Bad date string — skip
    if doc.extracted_category is not None:
        tx.category = doc.extracted_category

    db.commit()
    db.refresh(tx)
    return _serialize_transaction(tx, db)


@app.get("/api/transactions/{transaction_id}/documents")
async def list_transaction_documents(
    transaction_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    docs = db.query(Document).filter(Document.transaction_id == transaction_id).all()
    return [_serialize_document(d) for d in docs]


@app.post("/api/properties/{property_id}/documents", status_code=201)
async def upload_property_document(
    property_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Extension check
    _, ext = os.path.splitext(file.filename or "")
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read and size check
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    # Determine MIME type
    mime_type = file.content_type or "application/octet-stream"
    # Normalise heic
    if ext.lower() in (".heic", ".heif"):
        mime_type = "image/heic"

    # Save with UUID prefix
    safe_filename = f"{uuid.uuid4().hex}{ext.lower()}"
    dest_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(dest_path, "wb") as f:
        f.write(contents)

    doc = Document(
        property_id=property_id,
        filename=file.filename or safe_filename,
        storage_path=safe_filename,
        mime_type=mime_type,
        size_bytes=len(contents),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _serialize_document(doc)


@app.get("/api/properties/{property_id}/documents")
async def list_property_documents(
    property_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    docs = db.query(Document).filter(Document.property_id == property_id).all()
    return [_serialize_document(d) for d in docs]


@app.get("/api/documents/{document_id}")
async def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    file_path = os.path.join(UPLOAD_DIR, doc.storage_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    def file_iterator():
        with open(file_path, "rb") as f:
            yield from iter(lambda: f.read(65536), b"")

    return StreamingResponse(
        file_iterator(),
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.filename}"'},
    )


@app.delete("/api/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    file_path = os.path.join(UPLOAD_DIR, doc.storage_path)
    if os.path.exists(file_path):
        os.remove(file_path)
    db.delete(doc)
    db.commit()


# ---------------------------------------------------------------------------
# Reports (F1 + F4)
# ---------------------------------------------------------------------------

def _normalize_type_check(value: str) -> str:
    return (value or "").strip().lower()


@app.get("/api/reports/cashflow")
async def get_cashflow_report(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    today = datetime.date.today()
    current_year = today.year
    current_month = today.month

    transactions = db.query(Transaction).all()
    properties = db.query(Property).all()

    report = {
        "portfolio": {
            "monthlyIncome": 0.0,
            "monthlyExpense": 0.0,
            "monthlyCashFlow": 0.0,
            "ytdIncome": 0.0,
            "ytdExpense": 0.0,
            "ytdCashFlow": 0.0,
        },
        "properties": [],
    }

    prop_stats: Dict[int, dict] = {}
    for p in properties:
        mortgage = db.query(Mortgage).filter(Mortgage.property_id == p.id).first()
        monthly_debt_service = 0.0
        if mortgage:
            monthly_debt_service = (mortgage.monthly_pi or 0.0) + (mortgage.monthly_escrow or 0.0)
        prop_stats[p.id] = {
            "id": p.id,
            "address": p.address,
            "purchasePrice": p.purchase_price or 0.0,
            "monthlyIncome": 0.0,
            "monthlyExpense": 0.0,
            "monthlyCashFlow": 0.0,
            "ytdIncome": 0.0,
            "ytdExpense": 0.0,
            "ytdCashFlow": 0.0,
            # For NOI / cap rate / CoC
            "annualIncome": 0.0,
            "annualOperatingExpense": 0.0,  # excludes debt service
            "monthlyDebtService": monthly_debt_service,
            "hasMortgage": mortgage is not None,
            # down payment = purchase_price - principal
            "downPayment": (
                (p.purchase_price or 0.0) - (mortgage.principal or 0.0)
                if mortgage else (p.purchase_price or 0.0)
            ),
        }

    for t in transactions:
        if t.status != "Paid":
            continue
        if not t.transaction_date:
            continue
        t_year = t.transaction_date.year
        t_month = t.transaction_date.month
        is_income = _normalize_type_check(t.type) == "income"

        if t_year != current_year:
            continue

        ytd_field = "ytdIncome" if is_income else "ytdExpense"
        report["portfolio"][ytd_field] += t.amount
        if t.property_id in prop_stats:
            prop_stats[t.property_id][ytd_field] += t.amount
            if is_income:
                prop_stats[t.property_id]["annualIncome"] += t.amount
            else:
                # Exclude mortgage category from operating expenses for NOI
                cat = (t.category or "").lower()
                if cat not in ("mortgage", "debt service"):
                    prop_stats[t.property_id]["annualOperatingExpense"] += t.amount

        if t_month == current_month:
            monthly_field = "monthlyIncome" if is_income else "monthlyExpense"
            report["portfolio"][monthly_field] += t.amount
            if t.property_id in prop_stats:
                prop_stats[t.property_id][monthly_field] += t.amount

    report["portfolio"]["monthlyCashFlow"] = (
        report["portfolio"]["monthlyIncome"] - report["portfolio"]["monthlyExpense"]
    )
    report["portfolio"]["ytdCashFlow"] = (
        report["portfolio"]["ytdIncome"] - report["portfolio"]["ytdExpense"]
    )

    for stats in prop_stats.values():
        stats["monthlyCashFlow"] = stats["monthlyIncome"] - stats["monthlyExpense"]
        stats["ytdCashFlow"] = stats["ytdIncome"] - stats["ytdExpense"]

        purchase_price = stats["purchasePrice"]
        annual_income = stats["annualIncome"]
        annual_op_expense = stats["annualOperatingExpense"]
        noi = annual_income - annual_op_expense
        cap_rate: Optional[float] = None
        if purchase_price and purchase_price > 0:
            cap_rate = round((noi / purchase_price) * 100, 2)

        # Cash-on-cash: annual cash flow after debt service / down payment
        annual_debt_service = stats["monthlyDebtService"] * 12
        annual_cash_flow_after_debt = noi - annual_debt_service
        coc_return: Optional[float] = None
        down_payment = stats["downPayment"]
        if down_payment and down_payment > 0:
            coc_return = round((annual_cash_flow_after_debt / down_payment) * 100, 2)

        stats["noi"] = round(noi, 2)
        stats["capRate"] = cap_rate
        stats["cocReturn"] = coc_return
        stats["annualDebtService"] = round(annual_debt_service, 2)

        # Clean up internal fields
        del stats["annualIncome"]
        del stats["annualOperatingExpense"]
        del stats["monthlyDebtService"]
        del stats["hasMortgage"]
        del stats["downPayment"]
        del stats["purchasePrice"]

        report["properties"].append(stats)

    return report


@app.get("/api/reports/rent-roll")
async def get_rent_roll(
    format: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Rent roll report. ?format=csv returns a downloadable CSV."""
    today = datetime.date.today()
    current_year = today.year

    properties = db.query(Property).all()
    tenants = db.query(Tenant).all()
    transactions = db.query(Transaction).filter(
        Transaction.status == "Paid"
    ).all()

    # Index tenants by property
    tenants_by_prop: Dict[int, List[Tenant]] = defaultdict(list)
    for t in tenants:
        tenants_by_prop[t.property_id].append(t)

    # YTD income/expense per property
    ytd_income: Dict[int, float] = defaultdict(float)
    ytd_expense: Dict[int, float] = defaultdict(float)
    for tx in transactions:
        if tx.transaction_date and tx.transaction_date.year == current_year:
            if _normalize_type_check(tx.type) == "income":
                ytd_income[tx.property_id] += tx.amount
            else:
                ytd_expense[tx.property_id] += tx.amount

    rows = []
    for prop in properties:
        prop_tenants = tenants_by_prop.get(prop.id, [])
        if prop_tenants:
            for t in prop_tenants:
                rows.append({
                    "property_address": prop.address,
                    "tenant_name": t.name,
                    "lease_start": t.lease_start.isoformat() if t.lease_start else "",
                    "lease_end": t.lease_end.isoformat() if t.lease_end else "",
                    "monthly_rent": t.rent_amount or 0.0,
                    "intent": t.intent or "Undecided",
                    "ytd_collected": round(ytd_income[prop.id], 2),
                    "ytd_expenses": round(ytd_expense[prop.id], 2),
                    "ytd_net": round(ytd_income[prop.id] - ytd_expense[prop.id], 2),
                })
        else:
            rows.append({
                "property_address": prop.address,
                "tenant_name": "Vacant",
                "lease_start": "",
                "lease_end": "",
                "monthly_rent": 0.0,
                "intent": "",
                "ytd_collected": round(ytd_income[prop.id], 2),
                "ytd_expenses": round(ytd_expense[prop.id], 2),
                "ytd_net": round(ytd_income[prop.id] - ytd_expense[prop.id], 2),
            })

    if format == "csv":
        output = io.StringIO()
        fieldnames = [
            "property_address", "tenant_name", "lease_start", "lease_end",
            "monthly_rent", "intent", "ytd_collected", "ytd_expenses", "ytd_net",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        csv_content = output.getvalue()
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=rent_roll_{current_year}.csv"},
        )

    return rows


# Schedule E category mapping: transaction category → Schedule E line
_SCHEDULE_E_CATEGORY_MAP = {
    "advertising": "advertising",
    "auto": "auto_travel",
    "travel": "auto_travel",
    "cleaning": "cleaning_maintenance",
    "maintenance": "cleaning_maintenance",
    "repairs": "repairs",
    "repair": "repairs",
    "commission": "commissions",
    "commissions": "commissions",
    "insurance": "insurance",
    "legal": "legal_professional",
    "professional": "legal_professional",
    "management": "management_fees",
    "property management": "management_fees",
    "mortgage interest": "mortgage_interest",
    "mortgage": "mortgage_interest",
    "supplies": "supplies",
    "taxes": "taxes",
    "utilities": "utilities",
    "utility": "utilities",
    "depreciation": "depreciation",
}

_SCHEDULE_E_COLUMNS = [
    "advertising", "auto_travel", "cleaning_maintenance", "commissions",
    "insurance", "legal_professional", "management_fees", "mortgage_interest",
    "repairs", "supplies", "taxes", "utilities", "depreciation", "other",
]


@app.get("/api/reports/schedule-e")
async def get_schedule_e(
    year: Optional[int] = Query(None),
    format: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Schedule E formatted expense/income breakdown per property.
    Defaults to current year. ?format=csv returns downloadable CSV.
    """
    target_year = year or datetime.date.today().year

    properties = db.query(Property).all()
    transactions = db.query(Transaction).filter(
        Transaction.status == "Paid"
    ).all()

    tenants = db.query(Tenant).all()
    # Determine fair rental days per property (active lease days in target_year)
    year_start = datetime.date(target_year, 1, 1)
    year_end = datetime.date(target_year, 12, 31)

    def fair_rental_days(prop_id: int) -> int:
        prop_tenants = [t for t in tenants if t.property_id == prop_id]
        total = 0
        for t in prop_tenants:
            if not t.lease_start or not t.lease_end:
                continue
            overlap_start = max(t.lease_start, year_start)
            overlap_end = min(t.lease_end, year_end)
            if overlap_end >= overlap_start:
                total += (overlap_end - overlap_start).days + 1
        return min(total, 365)

    prop_data: Dict[int, dict] = {}
    for p in properties:
        entry = {col: 0.0 for col in _SCHEDULE_E_COLUMNS}
        entry["rents_received"] = 0.0
        entry["property_address"] = p.address
        entry["fair_rental_days"] = fair_rental_days(p.id)
        prop_data[p.id] = entry

    for tx in transactions:
        if not tx.transaction_date or tx.transaction_date.year != target_year:
            continue
        if tx.property_id not in prop_data:
            continue
        entry = prop_data[tx.property_id]
        is_income = _normalize_type_check(tx.type) == "income"
        if is_income:
            entry["rents_received"] += tx.amount
        else:
            cat = (tx.category or "").strip().lower()
            mapped = _SCHEDULE_E_CATEGORY_MAP.get(cat, "other")
            entry[mapped] += tx.amount

    rows = []
    for entry in prop_data.values():
        total_expenses = sum(entry[col] for col in _SCHEDULE_E_COLUMNS)
        net_income = entry["rents_received"] - total_expenses
        row = {
            "property_address": entry["property_address"],
            "fair_rental_days": entry["fair_rental_days"],
            "rents_received": round(entry["rents_received"], 2),
        }
        for col in _SCHEDULE_E_COLUMNS:
            row[col] = round(entry[col], 2) if entry[col] else ""
        row["total_expenses"] = round(total_expenses, 2)
        row["net_income"] = round(net_income, 2)
        rows.append(row)

    if format == "csv":
        output = io.StringIO()
        fieldnames = (
            ["property_address", "fair_rental_days", "rents_received"]
            + _SCHEDULE_E_COLUMNS
            + ["total_expenses", "net_income"]
        )
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        csv_content = output.getvalue()
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=schedule_e_{target_year}.csv"},
        )

    return rows


# ---------------------------------------------------------------------------
# Task 2 — Lender-view metrics: DSCR & LTV
# ---------------------------------------------------------------------------

def _dscr_status(dscr: Optional[float]) -> str:
    if dscr is None:
        return "unknown"
    if dscr >= 1.25:
        return "good"
    if dscr >= 1.0:
        return "warning"
    return "danger"


def _ltv_status(ltv: Optional[float]) -> str:
    if ltv is None:
        return "unknown"
    if ltv <= 0.80:
        return "good"
    if ltv <= 0.90:
        return "warning"
    return "danger"


@app.get("/api/reports/lender-metrics")
async def get_lender_metrics(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Return DSCR and LTV for each property from a lender's perspective.

    DSCR = NOI / Annual Debt Service
      NOI = trailing-12-month income - trailing-12-month operating expenses
            (mortgage P&I and escrow are excluded from operating expenses)
    LTV  = mortgage principal / purchase price
      Note: we use the *original* mortgage principal as a proxy for current
      balance because amortization tracking is not yet implemented (v1).
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

    # Aggregate income and operating expenses per property (trailing 12 months)
    # Mortgage / debt service category is excluded from operating expenses
    _DEBT_SERVICE_CATS = {"mortgage", "debt service", "mortgage interest"}

    income_by_prop: Dict[int, float] = defaultdict(float)
    op_expense_by_prop: Dict[int, float] = defaultdict(float)

    for tx in transactions:
        if not tx.transaction_date or not tx.property_id:
            continue
        tx_type = (tx.type or "").strip().lower()
        cat = (tx.category or "").strip().lower()
        if tx_type == "income":
            income_by_prop[tx.property_id] += tx.amount
        elif tx_type == "expense" and cat not in _DEBT_SERVICE_CATS:
            op_expense_by_prop[tx.property_id] += tx.amount

    property_rows = []
    dscr_values: List[float] = []
    ltv_values: List[float] = []
    at_risk_count = 0

    for prop in properties:
        mortgage = db.query(Mortgage).filter(Mortgage.property_id == prop.id).first()

        annual_income = income_by_prop.get(prop.id, 0.0)
        annual_op_expense = op_expense_by_prop.get(prop.id, 0.0)
        annual_noi = annual_income - annual_op_expense

        # DSCR
        dscr: Optional[float] = None
        annual_debt_service: Optional[float] = None
        if mortgage and mortgage.monthly_pi:
            annual_debt_service = mortgage.monthly_pi * 12
            if annual_debt_service > 0 and annual_income > 0:
                dscr = round(annual_noi / annual_debt_service, 3)

        # LTV — using original principal as current balance proxy
        ltv: Optional[float] = None
        mortgage_principal: Optional[float] = None
        if mortgage:
            mortgage_principal = mortgage.principal
            if mortgage_principal and prop.purchase_price and prop.purchase_price > 0:
                ltv = round(mortgage_principal / prop.purchase_price, 4)

        dscr_s = _dscr_status(dscr)
        ltv_s = _ltv_status(ltv)

        if dscr_s in ("warning", "danger") or ltv_s in ("warning", "danger"):
            at_risk_count += 1

        if dscr is not None:
            dscr_values.append(dscr)
        if ltv is not None:
            ltv_values.append(ltv)

        property_rows.append({
            "id": prop.id,
            "address": prop.address,
            "purchasePrice": prop.purchase_price,
            "mortgagePrincipal": mortgage_principal,
            "annualNOI": round(annual_noi, 2),
            "annualDebtService": round(annual_debt_service, 2) if annual_debt_service is not None else None,
            "dscr": dscr,
            "ltv": ltv,
            "dscrStatus": dscr_s,
            "ltvStatus": ltv_s,
        })

    avg_dscr = round(sum(dscr_values) / len(dscr_values), 3) if dscr_values else None
    avg_ltv = round(sum(ltv_values) / len(ltv_values), 4) if ltv_values else None

    return {
        "properties": property_rows,
        "summary": {
            "avgDscr": avg_dscr,
            "avgLtv": avg_ltv,
            "propertiesAtRisk": at_risk_count,
        },
    }


# ---------------------------------------------------------------------------
# Task 3 — Server-Side Amortization Engine
# ---------------------------------------------------------------------------

def generate_amortization_schedule(
    principal: float,
    annual_rate: float,
    term_months: int,
    extra_monthly_payment: float = 0.0,
) -> List[Dict[str, Any]]:
    """Generate a standard amortization schedule with optional extra payment.

    Args:
        principal: Original loan balance.
        annual_rate: Annual interest rate as a decimal (e.g. 0.065 for 6.5%).
        term_months: Loan term in months.
        extra_monthly_payment: Optional additional principal per month (default 0).

    Returns:
        List of dicts, one per payment period:
        {"month": int, "payment": float, "principal": float,
         "interest": float, "balance": float}
        Stops early if balance reaches zero (relevant when extra payments are made).
    """
    if principal <= 0 or annual_rate < 0 or term_months <= 0:
        return []

    monthly_rate = annual_rate / 1200.0  # annual_rate is decimal e.g. 0.065 → 0.065/12

    # PMT formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    if monthly_rate == 0:
        base_payment = principal / term_months
    else:
        r_n = (1 + monthly_rate) ** term_months
        base_payment = principal * (monthly_rate * r_n) / (r_n - 1)

    base_payment = round(base_payment, 2)

    schedule = []
    balance = principal

    for month in range(1, term_months + 1):
        if balance <= 0:
            break

        interest_charge = round(balance * monthly_rate, 2)
        scheduled_principal = round(base_payment - interest_charge, 2)
        total_principal = round(scheduled_principal + extra_monthly_payment, 2)

        # Last payment: never overpay — clear the exact remaining balance.
        # Also handle the final scheduled month where rounding accumulates a
        # small residual (rounding base_payment to 2 decimals means the loan
        # may not reach exactly zero in term_months — pay it off on the last month).
        is_last_scheduled = month == term_months
        if total_principal >= balance or is_last_scheduled:
            total_principal = balance
            payment = round(total_principal + interest_charge, 2)
            balance = 0.0
        else:
            payment = round(base_payment + extra_monthly_payment, 2)
            balance = round(balance - total_principal, 2)

        schedule.append({
            "month": month,
            "payment": payment,
            "principal": round(total_principal, 2),
            "interest": interest_charge,
            "balance": balance,
        })

        if balance == 0:
            break

    return schedule


@app.get("/api/properties/{property_id}/amortization")
async def get_amortization(
    property_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Return the full amortization schedule for a property's mortgage."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    mortgage = db.query(Mortgage).filter(Mortgage.property_id == property_id).first()
    if not mortgage:
        raise HTTPException(status_code=404, detail="No mortgage found for this property")

    schedule = generate_amortization_schedule(
        principal=mortgage.principal,
        annual_rate=mortgage.interest_rate,
        term_months=mortgage.term_months,
    )

    return {
        "mortgage": _serialize_mortgage(mortgage),
        "schedule": schedule,
    }


class WhatIfRequest(BaseModel):
    extra_monthly_payment: float


@app.post("/api/properties/{property_id}/amortization/what-if")
async def amortization_what_if(
    property_id: int,
    body: WhatIfRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Compare standard vs. accelerated payoff with an extra monthly payment."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    mortgage = db.query(Mortgage).filter(Mortgage.property_id == property_id).first()
    if not mortgage:
        raise HTTPException(status_code=404, detail="No mortgage found for this property")

    if body.extra_monthly_payment < 0:
        raise HTTPException(status_code=400, detail="extra_monthly_payment must be non-negative")

    standard_schedule = generate_amortization_schedule(
        principal=mortgage.principal,
        annual_rate=mortgage.interest_rate,
        term_months=mortgage.term_months,
    )
    extra_schedule = generate_amortization_schedule(
        principal=mortgage.principal,
        annual_rate=mortgage.interest_rate,
        term_months=mortgage.term_months,
        extra_monthly_payment=body.extra_monthly_payment,
    )

    std_total_interest = round(sum(row["interest"] for row in standard_schedule), 2)
    extra_total_interest = round(sum(row["interest"] for row in extra_schedule), 2)

    std_payoff_months = len(standard_schedule)
    extra_payoff_months = len(extra_schedule)

    interest_saved = round(std_total_interest - extra_total_interest, 2)
    months_saved = std_payoff_months - extra_payoff_months

    return {
        "standard": {
            "totalInterest": std_total_interest,
            "payoffMonths": std_payoff_months,
        },
        "withExtra": {
            "totalInterest": extra_total_interest,
            "payoffMonths": extra_payoff_months,
            "extraPayment": body.extra_monthly_payment,
        },
        "savings": {
            "interestSaved": interest_saved,
            "monthsSaved": months_saved,
        },
    }


# ---------------------------------------------------------------------------
# Task 4 — Maintenance health agent endpoint
# ---------------------------------------------------------------------------

@app.get("/api/agents/maintenance-health")
async def maintenance_health(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Scan trailing-12-month transactions for spending anomalies.

    Returns a list of alerts for expense categories that exceed 15% of
    gross income at the property level. Alert messages are generated by
    Gemini when GOOGLE_API_KEY is set; otherwise a template is used.
    """
    alerts = analyze_maintenance_health(db)
    return {"alerts": alerts, "count": len(alerts)}


# ---------------------------------------------------------------------------
# Orchestrated agent endpoints
# ---------------------------------------------------------------------------

class CategorizeTxRequest(BaseModel):
    description: str
    amount: Optional[float] = 0.0
    property_id: Optional[int] = None


@app.post("/api/agents/categorize-transaction")
async def categorize_transaction(
    body: CategorizeTxRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Use AI to classify a transaction description into a standard category."""
    property_address = ""
    if body.property_id:
        prop = db.query(Property).filter(Property.id == body.property_id).first()
        if prop:
            property_address = prop.address or ""

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: orchestrator.categorize_transaction(
            description=body.description,
            amount=body.amount or 0.0,
            property_address=property_address,
        ),
    )
    return result


class DealScoreRequest(BaseModel):
    purchase_price: float
    cap_rate: float
    coc_return: float
    annual_cash_flow: float
    break_even_occupancy: float
    noi: float
    grm: float
    down_payment: Optional[float] = None
    loan_amount: Optional[float] = None


@app.post("/api/agents/score-deal")
async def score_deal(
    body: DealScoreRequest,
    _user: User = Depends(get_current_user),
):
    """Grade a real estate deal A–D with AI narrative analysis."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: orchestrator.score_deal(body.model_dump()),
    )
    if "error" in result and result.get("grade") not in ("A", "B", "C", "D", "N/A"):
        _ai_error_to_http(result)
    return result


@app.get("/api/agents/health-check")
async def portfolio_health_check(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Full portfolio health check: chains maintenance + portfolio advice + lease alerts."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: orchestrator.run_portfolio_health_check(db=db),
    )
    return result


class LeaseRenewalWorkflowRequest(BaseModel):
    market_rent: Optional[float] = None


@app.post("/api/agents/lease-renewal-workflow/{tenant_id}")
async def lease_renewal_workflow(
    tenant_id: int,
    body: LeaseRenewalWorkflowRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Full lease renewal workflow: market data + letter + pricing timeline."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant {tenant_id} not found")

    market_rent = body.market_rent
    if not market_rent and tenant.property_id:
        prop = db.query(Property).filter(Property.id == tenant.property_id).first()
        if prop:
            city = parse_city_from_address(prop.address)
            dummy_alerts: list = []
            market_data = await fetch_zillow_market_data(city, dummy_alerts)
            zillow_rent = market_data.get("cityAverageRent")
            if zillow_rent and zillow_rent > 0:
                market_rent = float(zillow_rent)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: orchestrator.run_lease_renewal_workflow(
            tenant_id=tenant_id, db=db, market_rent=market_rent
        ),
    )
    if "error" in result:
        _ai_error_to_http(result)
    return result


class SuggestPriorityRequest(BaseModel):
    title: str
    description: str


@app.post("/api/agents/suggest-priority")
async def suggest_maintenance_priority(
    body: SuggestPriorityRequest,
    _user: User = Depends(get_current_user),
):
    """Use AI to suggest a priority level for a maintenance request."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: orchestrator.suggest_maintenance_priority(
            title=body.title, description=body.description
        ),
    )
    return result


# ---------------------------------------------------------------------------
# Tenant Portal
# ---------------------------------------------------------------------------

@app.get("/api/tenant-portal/me")
async def tenant_portal_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated tenant's lease summary and maintenance requests."""
    tenant = db.query(Tenant).filter(Tenant.user_id == current_user.id).first()
    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="No tenant record is linked to this account. Contact your property manager.",
        )
    maintenance = (
        db.query(MaintenanceRequest)
        .filter(MaintenanceRequest.tenant_id == tenant.id)
        .order_by(MaintenanceRequest.created_at.desc())
        .all()
    )
    return {
        "tenant": _serialize_tenant(tenant, db),
        "maintenanceRequests": [_serialize_maintenance(m) for m in maintenance],
    }
