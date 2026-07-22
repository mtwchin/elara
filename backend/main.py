from fastapi import FastAPI, Depends, HTTPException, Request, status, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import Base, engine, get_db
from models import (
    Property,
    Tenant,
    Transaction,
    User,
    Mortgage,
    Document,
    MaintenanceRequest,
    Organization,
    UserRole,
    PasswordResetToken,
)
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List
from collections import defaultdict, OrderedDict
from contextlib import asynccontextmanager
import datetime
import httpx
import time
import os
import logging
from dotenv import load_dotenv
load_dotenv()
import asyncio
import uuid
import csv
import io
import sentry_sdk
from urllib.parse import quote

logger = logging.getLogger("elara.api")


APP_ENV = os.environ.get("APP_ENV", os.environ.get("ENVIRONMENT", "development")).lower()
DEBUG_REQUEST_LOGS = os.environ.get("DEBUG_REQUEST_LOGS", "false").lower() == "true"
RATE_LIMIT_ENABLED = os.environ.get("RATE_LIMIT_ENABLED", "true").lower() not in {"0", "false", "no"}
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_AUTH_MAX = int(os.environ.get("RATE_LIMIT_AUTH_MAX", "20"))
RATE_LIMIT_AI_MAX = int(os.environ.get("RATE_LIMIT_AI_MAX", "60"))
RATE_LIMIT_UPLOAD_MAX = int(os.environ.get("RATE_LIMIT_UPLOAD_MAX", "60"))
RATE_LIMIT_MARKET_MAX = int(os.environ.get("RATE_LIMIT_MARKET_MAX", "180"))
RATE_LIMIT_DEFAULT_MAX = int(os.environ.get("RATE_LIMIT_DEFAULT_MAX", "600"))
MIN_PASSWORD_LENGTH = int(os.environ.get("MIN_PASSWORD_LENGTH", "10"))


def _parse_csv_env(name: str, default: List[str]) -> List[str]:
    raw = os.environ.get(name)
    if not raw:
        return default
    return [value.strip() for value in raw.split(",") if value.strip()]


DEFAULT_CORS_ORIGINS = [
    "http://localhost",
    "http://localhost:5173",
    "http://127.0.0.1",
    "http://127.0.0.1:5173",
]
CORS_ORIGINS = _parse_csv_env("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "http://localhost")


def _is_local_origin(value: str) -> bool:
    lowered = value.lower()
    return "localhost" in lowered or "127.0.0.1" in lowered or "[::1]" in lowered


def _validate_production_config() -> None:
    if APP_ENV not in {"production", "prod"}:
        return

    errors: List[str] = []
    database_url = os.environ.get("DATABASE_URL", "")
    jwt_secret = os.environ.get("RE_PORTFOLIO_JWT_SECRET", "")

    if not database_url or database_url.startswith("sqlite"):
        errors.append("DATABASE_URL must point to a production database")
    if not os.environ.get("CORS_ORIGINS"):
        errors.append("CORS_ORIGINS must be explicitly set")
    if any(_is_local_origin(origin) for origin in CORS_ORIGINS):
        errors.append("CORS_ORIGINS cannot include localhost in production")
    if not PUBLIC_APP_URL or _is_local_origin(PUBLIC_APP_URL):
        errors.append("PUBLIC_APP_URL must be a production URL")
    if len(jwt_secret) < 32 or jwt_secret.startswith("change_me"):
        errors.append("RE_PORTFOLIO_JWT_SECRET must be a strong production secret")

    if errors:
        raise RuntimeError("Invalid production configuration: " + "; ".join(errors))


_validate_production_config()

sentry_dsn = os.environ.get("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        profiles_sample_rate=float(os.environ.get("SENTRY_PROFILES_SAMPLE_RATE", "0.0")),
        environment=APP_ENV,
    )

from agent import (
    generate_insights,
    draft_renewal_letter,
    extract_document_data,
    analyze_maintenance_health,
    get_portfolio_advice,
    portfolio_chat,
    score_deal,
    lease_renewal_workflow,
)
from auth import (
    create_token,
    verify_token,
    get_current_user,
    hash_password,
    verify_password,
)

def _sync_sqlite_dev_schema() -> None:
    """Keep older local SQLite databases usable while Alembic handles deploys."""
    if engine.url.get_backend_name() != "sqlite" or APP_ENV in {"production", "prod"}:
        return

    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            existing_columns = {
                row[1]
                for row in conn.exec_driver_sql(f'PRAGMA table_info("{table.name}")').fetchall()
            }
            for column in table.columns:
                if column.name in existing_columns:
                    continue
                column_type = column.type.compile(dialect=engine.dialect)
                conn.exec_driver_sql(
                    f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {column_type}'
                )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _sync_sqlite_dev_schema()
    yield


app = FastAPI(title="Elara API", lifespan=lifespan)


_RATE_LIMIT_BUCKETS: Dict[str, tuple[int, float]] = {}


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _rate_limit_for_request(request: Request) -> Optional[tuple[str, int]]:
    path = request.url.path
    method = request.method.upper()
    if method == "OPTIONS" or path in {"/api/health", "/api/ready", "/docs", "/openapi.json"}:
        return None
    if path in {"/api/webhooks/stripe", "/api/billing/webhook"}:
        return None  # Stripe signature verification replaces rate limiting
    if path.startswith("/api/auth/login") or path == "/api/auth/register":
        return ("auth", RATE_LIMIT_AUTH_MAX)
    if path.startswith("/api/agents/"):
        return ("ai", RATE_LIMIT_AI_MAX)
    if method == "POST" and "/documents" in path:
        return ("upload", RATE_LIMIT_UPLOAD_MAX)
    if path in {"/api/dashboard", "/api/market-data"}:
        return ("market", RATE_LIMIT_MARKET_MAX)
    return ("default", RATE_LIMIT_DEFAULT_MAX)


def _check_rate_limit(request: Request) -> Optional[JSONResponse]:
    if not RATE_LIMIT_ENABLED:
        return None

    config = _rate_limit_for_request(request)
    if config is None:
        return None

    group, limit = config
    if limit <= 0:
        return None

    now = time.monotonic()
    key = f"{group}:{_client_ip(request)}"
    count, reset_at = _RATE_LIMIT_BUCKETS.get(key, (0, now + RATE_LIMIT_WINDOW_SECONDS))

    if now >= reset_at:
        count = 0
        reset_at = now + RATE_LIMIT_WINDOW_SECONDS

    count += 1
    _RATE_LIMIT_BUCKETS[key] = (count, reset_at)

    if len(_RATE_LIMIT_BUCKETS) > 5000:
        expired_keys = [bucket_key for bucket_key, (_, bucket_reset_at) in _RATE_LIMIT_BUCKETS.items() if now >= bucket_reset_at]
        for bucket_key in expired_keys:
            _RATE_LIMIT_BUCKETS.pop(bucket_key, None)

    remaining = max(0, limit - count)
    retry_after = max(1, int(reset_at - now))
    if count > limit:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please try again shortly."},
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(time.time() + retry_after)),
            },
        )

    request.state.rate_limit_headers = {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(remaining),
        "X-RateLimit-Reset": str(int(time.time() + retry_after)),
    }
    return None


@app.middleware("http")
async def request_id_and_rate_limit(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    request.state.request_id = request_id

    limited_response = _check_rate_limit(request)
    if limited_response:
        limited_response.headers["X-Request-ID"] = request_id
        return limited_response

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    for header, value in getattr(request.state, "rate_limit_headers", {}).items():
        response.headers.setdefault(header, value)
    return response


if DEBUG_REQUEST_LOGS:
    @app.middleware("http")
    async def debug_logging(request, call_next):
        logger.info(
            "request id=%s method=%s url=%s",
            getattr(request.state, "request_id", "-"),
            request.method,
            request.url,
        )
        try:
            response = await call_next(request)
            logger.info(
                "response id=%s status=%s",
                getattr(request.state, "request_id", "-"),
                response.status_code,
            )
            return response
        except Exception:
            logger.exception("unhandled request exception")
            raise


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' *",
    )
    if APP_ENV in {"production", "prod"}:
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Upload directory
# ---------------------------------------------------------------------------

UPLOAD_DIR = os.path.abspath(os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "uploads")))
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/heic",
    "image/heif",
}
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".heic", ".heif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "environment": APP_ENV,
    }


@app.get("/api/ready")
async def readiness_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("database readiness check failed")
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ready"}


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


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _validate_account_type(account_type: Optional[str]) -> str:
    normalized = (account_type or "admin").strip().lower()
    if normalized not in {"admin", "tenant"}:
        raise HTTPException(status_code=400, detail="Invalid account type")
    return normalized


def _validate_password_strength(password: str, email: str) -> None:
    if len(password or "") < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long",
        )
    if email.split("@", 1)[0].lower() in password.lower():
        raise HTTPException(status_code=400, detail="Password cannot contain your email name")
    checks = [
        any(char.islower() for char in password),
        any(char.isupper() for char in password),
        any(char.isdigit() for char in password),
    ]
    if sum(checks) < 3:
        raise HTTPException(
            status_code=400,
            detail="Password must include uppercase, lowercase, and numeric characters",
        )


@app.post("/api/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    email = _normalize_email(str(req.email))
    account_type = _validate_account_type(req.account_type)
    _validate_password_strength(req.password, email)

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(email=email, hashed_password=hash_password(req.password), account_type=account_type)
    db.add(user)
    db.flush()
    organization = Organization(name=_default_organization_name(user.email))
    db.add(organization)
    db.flush()
    db.add(UserRole(user_id=user.id, organization_id=organization.id, role="Owner"))
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_token(user), email=user.email, account_type=user.account_type)


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == _normalize_email(form.username)).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return TokenResponse(access_token=create_token(user), email=user.email, account_type=user.account_type)


@app.post("/api/auth/login-json", response_model=TokenResponse)
async def login_json(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == _normalize_email(str(req.email))).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return TokenResponse(access_token=create_token(user), email=user.email, account_type=user.account_type)


@app.post("/api/auth/refresh")
async def refresh_token(
    request: Request,
    db: Session = Depends(get_db),
):
    """Issue a new token with a fresh expiry given a valid existing Bearer token."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = auth_header[len("Bearer "):]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing email claim",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"access_token": create_token(user), "token_type": "bearer"}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _issue_password_reset_token(user: User, db: Session) -> str:
    """Create a password reset token for the given user, invalidating any prior unused ones."""
    import secrets as _secrets
    # Invalidate prior unused tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,  # noqa: E712
    ).update({"used": True}, synchronize_session=False)

    raw_token = _secrets.token_urlsafe(32)
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    prt = PasswordResetToken(user_id=user.id, token=raw_token, expires_at=expires_at)
    db.add(prt)
    db.commit()
    return raw_token


@app.post("/api/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generate a password reset token and send it via email.

    Always returns the same response to avoid revealing whether an email exists.
    """
    from email_service import send_email

    email = _normalize_email(str(req.email))
    user = db.query(User).filter(User.email == email).first()
    if user:
        raw_token = _issue_password_reset_token(user, db)
        reset_link = f"{PUBLIC_APP_URL.rstrip('/')}/reset-password?token={raw_token}"
        logger.info("Password reset link for user_id=%s: %s", user.id, reset_link)
        try:
            send_email(
                to=user.email,
                subject="Reset your Elara password",
                body=(
                    f"<p>Hi,</p>"
                    f"<p>Click the link below to reset your Elara password. "
                    f"This link expires in 1 hour.</p>"
                    f'<p><a href="{reset_link}">{reset_link}</a></p>'
                    f"<p>If you did not request a password reset, you can safely ignore this email.</p>"
                ),
            )
        except Exception:
            logger.exception("Failed to send password reset email to user_id=%s", user.id)
    return {"message": "If that email exists, a reset link has been sent"}


@app.post("/api/auth/reset-password")
async def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Consume a valid, unexpired reset token and update the user's password."""
    prt = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token == req.token,
            PasswordResetToken.used == False,  # noqa: E712
        )
        .first()
    )
    if not prt:
        raise HTTPException(status_code=400, detail="Invalid or already-used reset token")
    if datetime.datetime.utcnow() > prt.expires_at:
        prt.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user = db.query(User).filter(User.id == prt.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    _validate_password_strength(req.new_password, user.email)

    user.hashed_password = hash_password(req.new_password)
    prt.used = True
    db.commit()
    return {"message": "Password reset successfully"}


@app.get("/api/auth/me")
async def me(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = ensure_user_organization(db, current)
    return {
        "id": current.id,
        "email": current.email,
        "organization": {
            "id": organization.id,
            "name": organization.name,
        },
    }


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


def _default_organization_name(email: str) -> str:
    local_part = (email or "User").split("@")[0].replace(".", " ").replace("_", " ").strip()
    display = local_part.title() if local_part else "User"
    return f"{display}'s Portfolio"


def ensure_user_organization(db: Session, user: User) -> Organization:
    role = (
        db.query(UserRole)
        .filter(UserRole.user_id == user.id)
        .order_by(UserRole.id.asc())
        .first()
    )
    if role:
        organization = db.query(Organization).filter(Organization.id == role.organization_id).first()
        if organization:
            _claim_unscoped_demo_data(db, user, organization)
            return organization

    organization = Organization(name=_default_organization_name(user.email))
    db.add(organization)
    db.flush()
    db.add(UserRole(user_id=user.id, organization_id=organization.id, role="Owner"))
    db.commit()
    db.refresh(organization)
    _claim_unscoped_demo_data(db, user, organization)
    return organization


def _claim_unscoped_demo_data(db: Session, user: User, organization: Organization) -> None:
    if APP_ENV in {"production", "prod"} or user.email != "demo@example.com":
        return

    updated = 0
    for model in (Property, Tenant, Transaction):
        updated += (
            db.query(model)
            .filter(model.organization_id.is_(None))
            .update({"organization_id": organization.id}, synchronize_session=False)
        )
    if updated:
        db.commit()


def get_current_organization(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Organization:
    return ensure_user_organization(db, current_user)


def _org_property_query(db: Session, organization: Organization):
    return db.query(Property).filter(Property.organization_id == organization.id)


def _org_tenant_query(db: Session, organization: Organization):
    return db.query(Tenant).filter(Tenant.organization_id == organization.id)


def _org_transaction_query(db: Session, organization: Organization):
    return db.query(Transaction).filter(Transaction.organization_id == organization.id)


def _get_property_or_404(property_id: int, db: Session, organization: Organization) -> Property:
    prop = _org_property_query(db, organization).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


def _get_tenant_or_404(tenant_id: int, db: Session, organization: Organization) -> Tenant:
    tenant = _org_tenant_query(db, organization).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def _get_transaction_or_404(transaction_id: int, db: Session, organization: Organization) -> Transaction:
    tx = _org_transaction_query(db, organization).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


def _get_maintenance_request_or_404(
    request_id: int,
    db: Session,
    organization: Organization,
) -> MaintenanceRequest:
    req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    _get_property_or_404(req.property_id, db, organization)
    return req


def _get_document_or_404(document_id: int, db: Session, organization: Organization) -> Document:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.transaction_id:
        _get_transaction_or_404(doc.transaction_id, db, organization)
    elif doc.property_id:
        _get_property_or_404(doc.property_id, db, organization)
    else:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


def _safe_download_filename(filename: Optional[str]) -> str:
    base = os.path.basename(filename or "document")
    base = base.replace("\r", "").replace("\n", "").replace('"', "")
    return base or "document"


# Global market data cache — bounded LRU with max 256 entries to prevent memory growth
_MARKET_DATA_CACHE_MAX = 256
MARKET_DATA_CACHE: "OrderedDict[str, tuple[Dict[str, Any], float]]" = OrderedDict()
MARKET_DATA_CACHE_TTL = 24 * 3600  # 24 hours


def _market_cache_get(key: str) -> Optional[tuple]:
    """Return cached (data, timestamp) for key, or None. Moves hit to end (LRU)."""
    entry = MARKET_DATA_CACHE.get(key)
    if entry is not None:
        MARKET_DATA_CACHE.move_to_end(key)
    return entry


def _market_cache_set(key: str, value: tuple) -> None:
    """Insert/update cache entry and evict oldest when over capacity."""
    MARKET_DATA_CACHE[key] = value
    MARKET_DATA_CACHE.move_to_end(key)
    while len(MARKET_DATA_CACHE) > _MARKET_DATA_CACHE_MAX:
        MARKET_DATA_CACHE.popitem(last=False)
MARKET_DATA_TIMEOUT_SECONDS = float(os.environ.get("MARKET_DATA_TIMEOUT_SECONDS", "5.0"))

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
    global _last_seen_test
    current_test = os.environ.get("PYTEST_CURRENT_TEST")
    if current_test and current_test != _last_seen_test:
        MARKET_DATA_CACHE.clear()
        _last_seen_test = current_test


async def fetch_zillow_market_data(city: str, alerts: list) -> Dict[str, Any]:
    check_and_clear_cache_for_testing()

    city_key = city.strip().lower()
    now = time.time()

    cached = _market_cache_get(city_key)
    if cached is not None:
        cached_data, timestamp = cached
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
        cached_stale = _market_cache_get(city_key)
        return cached_stale[0] if cached_stale else DEFAULT_FALLBACK_DATA

    url = f"{base_url}/market-data"
    headers = {
        "X-RapidAPI-Key": rapidapi_key,
        "X-RapidAPI-Host": rapidapi_host,
    }

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            response = await asyncio.wait_for(
                client.get(url, params={"city": city}, headers=headers),
                timeout=MARKET_DATA_TIMEOUT_SECONDS,
            )
            if response.status_code == 200:
                raw_data = response.json()
                sanitized = sanitize_market_data(raw_data)
                _market_cache_set(city_key, (sanitized, now))
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
                cached_stale = _market_cache_get(city_key)
                return cached_stale[0] if cached_stale else DEFAULT_FALLBACK_DATA
            else:
                print(f"Zillow API error: {response.status_code} - {response.text}")
                cached_stale = _market_cache_get(city_key)
                return cached_stale[0] if cached_stale else DEFAULT_FALLBACK_DATA
        except (httpx.TimeoutException, asyncio.TimeoutError) as e:
            print(f"Zillow fetch timeout: {e}")
            cached_stale = _market_cache_get(city_key)
            return cached_stale[0] if cached_stale else DEFAULT_FALLBACK_DATA
        except Exception as e:
            print(f"Zillow fetch exception: {e}")
            cached_stale = _market_cache_get(city_key)
            return cached_stale[0] if cached_stale else DEFAULT_FALLBACK_DATA


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

async def _compute_dashboard_metrics(db: Session, alerts: list, organization_id: int) -> dict:
    today = datetime.date.today()
    properties = (
        db.query(Property)
        .filter(Property.organization_id == organization_id)
        .order_by(Property.id)
        .all()
    )
    tenants = db.query(Tenant).filter(Tenant.organization_id == organization_id).all()
    transactions = db.query(Transaction).filter(Transaction.organization_id == organization_id).all()

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
    organization: Organization = Depends(get_current_organization),
):
    alerts = []
    base = await _compute_dashboard_metrics(db, alerts, organization.id)
    db_alerts = generate_insights(db, organization_id=organization.id)
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
        .filter(Tenant.organization_id == prop.organization_id)
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
    organization: Organization = Depends(get_current_organization),
):
    properties = _org_property_query(db, organization).all()
    return [_serialize_property(p, db) for p in properties]


@app.get("/api/properties/{property_id}")
async def get_property(
    property_id: int,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    prop = _get_property_or_404(property_id, db, organization)
    return _serialize_property(prop, db)


@app.post("/api/properties", status_code=201)
async def create_property(
    prop: PropertyCreate,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    db_prop = Property(
        address=prop.address,
        property_type=prop.propertyType,
        purchase_price=prop.purchasePrice,
        purchase_date=prop.purchaseDate,
        status=prop.status,
        organization_id=organization.id,
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
    organization: Organization = Depends(get_current_organization),
):
    prop = _get_property_or_404(property_id, db, organization)
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
    organization: Organization = Depends(get_current_organization),
):
    prop = _get_property_or_404(property_id, db, organization)
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
    organization: Organization = Depends(get_current_organization),
):
    _get_property_or_404(property_id, db, organization)
    m = db.query(Mortgage).filter(Mortgage.property_id == property_id).first()
    if not m:
        return None
    return _serialize_mortgage(m)


@app.post("/api/properties/{property_id}/mortgage", status_code=201)
async def create_mortgage(
    property_id: int,
    body: MortgageCreate,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    _get_property_or_404(property_id, db, organization)
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
    organization: Organization = Depends(get_current_organization),
):
    _get_property_or_404(property_id, db, organization)
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
    organization: Organization = Depends(get_current_organization),
):
    _get_property_or_404(property_id, db, organization)
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
    organization: Organization = Depends(get_current_organization),
):
    tenants = _org_tenant_query(db, organization).all()
    return [_serialize_tenant(t, db) for t in tenants]


@app.get("/api/tenants/{tenant_id}")
async def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    t = _get_tenant_or_404(tenant_id, db, organization)
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
    organization: Organization = Depends(get_current_organization),
):
    _get_property_or_404(body.property_id, db, organization)
    t = Tenant(
        name=body.name,
        email=body.email,
        phone=body.phone,
        property_id=body.property_id,
        user_id=body.user_id,
        organization_id=organization.id,
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
    organization: Organization = Depends(get_current_organization),
):
    t = _get_tenant_or_404(tenant_id, db, organization)
    if body.name is not None:
        t.name = body.name
    if body.email is not None:
        t.email = body.email
    if body.phone is not None:
        t.phone = body.phone
    if body.property_id is not None:
        _get_property_or_404(body.property_id, db, organization)
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
    organization: Organization = Depends(get_current_organization),
):
    t = _get_tenant_or_404(tenant_id, db, organization)
    db.delete(t)
    db.commit()


# ---------------------------------------------------------------------------
# Tenant Screening
# ---------------------------------------------------------------------------

@app.post("/api/tenants/{tenant_id}/screen")
async def screen_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    import random
    t = _get_tenant_or_404(tenant_id, db, organization)
    
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
    organization: Organization = Depends(get_current_organization),
):
    requests = (
        db.query(MaintenanceRequest)
        .join(Property, MaintenanceRequest.property_id == Property.id)
        .filter(Property.organization_id == organization.id)
        .all()
    )
    return [_serialize_maintenance(r) for r in requests]


@app.post("/api/maintenance", status_code=201)
async def create_maintenance_request(
    body: MaintenanceRequestCreate,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    _get_property_or_404(body.property_id, db, organization)
    if body.tenant_id is not None:
        tenant = _get_tenant_or_404(body.tenant_id, db, organization)
        if tenant.property_id != body.property_id:
            raise HTTPException(status_code=400, detail="Tenant is not assigned to this property")
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
    organization: Organization = Depends(get_current_organization),
):
    req = _get_maintenance_request_or_404(request_id, db, organization)
    if body.property_id is not None:
        _get_property_or_404(body.property_id, db, organization)
        req.property_id = body.property_id
    if body.tenant_id is not None:
        tenant = _get_tenant_or_404(body.tenant_id, db, organization)
        target_property_id = body.property_id if body.property_id is not None else req.property_id
        if tenant.property_id != target_property_id:
            raise HTTPException(status_code=400, detail="Tenant is not assigned to this property")
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
    organization: Organization = Depends(get_current_organization),
):
    properties = _org_property_query(db, organization).all()
    if not properties:
        return {"synced": 0, "message": "No properties found to sync rent"}
    
    import random
    synced_count = 0
    today = datetime.date.today()
    for _ in range(random.randint(1, 3)):
        prop = random.choice(properties)
        tx = Transaction(
            property_id=prop.id,
            organization_id=organization.id,
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

@app.get("/api/agents")
async def get_agents(_organization: Organization = Depends(get_current_organization)):
    return {"agents": []}


class RenewalLetterRequest(BaseModel):
    tenant_id: int


@app.post("/api/agents/renewal-letter")
async def renewal_letter(
    body: RenewalLetterRequest,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    """Draft a lease renewal letter using Claude.

    Fetches market rent from Zillow for the property city (falls back to
    current rent +3% if Zillow is unavailable or RAPIDAPI_KEY is unset).
    Returns 503 when ANTHROPIC_API_KEY is missing.
    """
    tenant = _get_tenant_or_404(body.tenant_id, db, organization)

    # Try to get market rent from Zillow
    market_rent: Optional[float] = None
    prop = _get_property_or_404(tenant.property_id, db, organization)
    if prop:
        dummy_alerts: list = []
        city = parse_city_from_address(prop.address)
        market_data = await fetch_zillow_market_data(city, dummy_alerts)
        zillow_rent = market_data.get("cityAverageRent")
        if zillow_rent and zillow_rent > 0:
            market_rent = float(zillow_rent)

    result = draft_renewal_letter(body.tenant_id, db, market_rent=market_rent, organization_id=organization.id)

    if "error" in result:
        error_msg = result["error"]
        if "GOOGLE_API_KEY" in error_msg or "not installed" in error_msg:
            raise HTTPException(
                status_code=503,
                detail=(
                    "AI service unavailable: " + error_msg +
                    " Set GOOGLE_API_KEY and restart the server to enable this feature."
                ),
            )
        raise HTTPException(status_code=500, detail=error_msg)

    return result


@app.get("/api/agents/portfolio-advice")
async def portfolio_advice(
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    """Get high-level portfolio strategic advice from Gemini."""
    result = get_portfolio_advice(db, organization_id=organization.id)

    if "error" in result:
        error_msg = result["error"]
        if "GOOGLE_API_KEY" in error_msg or "not installed" in error_msg:
            raise HTTPException(
                status_code=503,
                detail=error_msg
            )
        raise HTTPException(status_code=500, detail=error_msg)

    return result


@app.get("/api/agents/health-check")
async def portfolio_health_check(
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    alerts = generate_insights(db, organization_id=organization.id)
    maintenance_alerts = analyze_maintenance_health(db, organization_id=organization.id)
    advice = get_portfolio_advice(db, organization_id=organization.id)

    warning_count = len([a for a in alerts if a.get("type") in ("warning", "danger")])
    executive_summary = (
        f"Portfolio scan complete: {len(alerts)} active alert"
        f"{'s' if len(alerts) != 1 else ''}, {len(maintenance_alerts)} maintenance flag"
        f"{'s' if len(maintenance_alerts) != 1 else ''}, and {warning_count} item"
        f"{'s' if warning_count != 1 else ''} needing attention."
    )

    if "error" in advice:
        portfolio_advice_text = "AI advice is unavailable until GOOGLE_API_KEY is configured."
    else:
        portfolio_advice_text = advice.get("advice", "")

    lease_warnings = [
        {"title": a["title"], "description": a["description"]}
        for a in alerts
        if a.get("title") == "Lease Renewal Risk"
    ]

    return {
        "executive_summary": executive_summary,
        "maintenance_alerts": maintenance_alerts,
        "portfolio_advice": portfolio_advice_text,
        "lease_warnings": lease_warnings,
        "generated_at": datetime.datetime.utcnow().isoformat(),
    }


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
    organization: Organization = Depends(get_current_organization),
):
    transactions = _org_transaction_query(db, organization).all()
    return [_serialize_transaction(t, db) for t in transactions]


@app.get("/api/transactions/{transaction_id}")
async def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    t = _get_transaction_or_404(transaction_id, db, organization)
    return _serialize_transaction(t, db)


@app.post("/api/transactions")
async def create_transaction(
    tx: TransactionCreate,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    _get_property_or_404(tx.property_id, db, organization)
    new_tx = Transaction(
        property_id=tx.property_id,
        organization_id=organization.id,
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
    organization: Organization = Depends(get_current_organization),
):
    tx = _get_transaction_or_404(transaction_id, db, organization)
    if body.property_id is not None:
        _get_property_or_404(body.property_id, db, organization)
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
    organization: Organization = Depends(get_current_organization),
):
    tx = _get_transaction_or_404(transaction_id, db, organization)
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
    organization: Organization = Depends(get_current_organization),
):
    tx = _get_transaction_or_404(transaction_id, db, organization)

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
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"MIME type '{mime_type}' not allowed")

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

    # Attempt AI extraction via background task
    try:
        from worker import process_document_with_ai
        process_document_with_ai.delay(safe_filename, doc.id)
    except Exception:
        pass  # Extraction failure must never block a successful upload

    return _serialize_document(doc)


@app.post("/api/transactions/{transaction_id}/documents/{document_id}/sync")
async def sync_document_to_transaction(
    transaction_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    """Apply extracted document data back to the parent Transaction.

    Only updates fields where extraction_confidence > 0.7 and the extracted
    value is present. Returns the updated Transaction.
    """
    tx = _get_transaction_or_404(transaction_id, db, organization)

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
    organization: Organization = Depends(get_current_organization),
):
    _get_transaction_or_404(transaction_id, db, organization)
    docs = db.query(Document).filter(Document.transaction_id == transaction_id).all()
    return [_serialize_document(d) for d in docs]


@app.post("/api/properties/{property_id}/documents", status_code=201)
async def upload_property_document(
    property_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    _get_property_or_404(property_id, db, organization)

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
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"MIME type '{mime_type}' not allowed")

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
    organization: Organization = Depends(get_current_organization),
):
    _get_property_or_404(property_id, db, organization)
    docs = db.query(Document).filter(Document.property_id == property_id).all()
    return [_serialize_document(d) for d in docs]


_IMAGE_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
_IMAGE_ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


@app.post("/api/properties/{property_id}/image")
async def upload_property_image(
    property_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    """Upload a cover image for a property. Accepts JPEG, PNG, GIF, WebP."""
    prop = _get_property_or_404(property_id, db, organization)

    _, ext = os.path.splitext(file.filename or "")
    if ext.lower() not in _IMAGE_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed for images. Accepted: {', '.join(_IMAGE_ALLOWED_EXTENSIONS)}",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Image exceeds 10MB limit")

    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in _IMAGE_ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"MIME type '{mime_type}' not allowed for images")

    safe_filename = f"{property_id}_{uuid.uuid4().hex}{ext.lower()}"
    dest_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(dest_path, "wb") as f:
        f.write(contents)

    # Remove old image file if one existed
    if prop.image_path:
        old_path = os.path.join(UPLOAD_DIR, prop.image_path)
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    prop.image_path = safe_filename
    db.commit()
    return {"image_url": f"/api/properties/{property_id}/image"}


@app.get("/api/properties/{property_id}/image")
async def get_property_image(
    property_id: int,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    """Serve the cover image for a property."""
    prop = _get_property_or_404(property_id, db, organization)
    if not prop.image_path:
        raise HTTPException(status_code=404, detail="No image found for this property")

    file_path = os.path.join(UPLOAD_DIR, prop.image_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    _, ext = os.path.splitext(prop.image_path)
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                ".gif": "image/gif", ".webp": "image/webp"}
    media_type = mime_map.get(ext.lower(), "image/jpeg")
    return FileResponse(file_path, media_type=media_type)


@app.get("/api/documents/{document_id}")
async def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    doc = _get_document_or_404(document_id, db, organization)
    file_path = os.path.join(UPLOAD_DIR, doc.storage_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    def file_iterator():
        with open(file_path, "rb") as f:
            yield from iter(lambda: f.read(65536), b"")

    return StreamingResponse(
        file_iterator(),
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(_safe_download_filename(doc.filename))}"},
    )


@app.delete("/api/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    doc = _get_document_or_404(document_id, db, organization)
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
    organization: Organization = Depends(get_current_organization),
):
    today = datetime.date.today()
    current_year = today.year
    current_month = today.month

    transactions = _org_transaction_query(db, organization).all()
    properties = _org_property_query(db, organization).all()

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
    organization: Organization = Depends(get_current_organization),
):
    """Rent roll report. ?format=csv returns a downloadable CSV."""
    today = datetime.date.today()
    current_year = today.year

    properties = _org_property_query(db, organization).all()
    tenants = _org_tenant_query(db, organization).all()
    transactions = _org_transaction_query(db, organization).filter(
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
    organization: Organization = Depends(get_current_organization),
):
    """Schedule E formatted expense/income breakdown per property.
    Defaults to current year. ?format=csv returns downloadable CSV.
    """
    target_year = year or datetime.date.today().year

    properties = _org_property_query(db, organization).all()
    transactions = _org_transaction_query(db, organization).filter(
        Transaction.status == "Paid"
    ).all()

    tenants = _org_tenant_query(db, organization).all()
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
    organization: Organization = Depends(get_current_organization),
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

    properties = _org_property_query(db, organization).all()
    transactions = (
        _org_transaction_query(db, organization)
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
        annual_rate: Annual interest rate as a percentage (e.g. 6.5 for 6.5%).
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

    monthly_rate = annual_rate / 1200.0  # annual_rate is a percentage e.g. 6.5 for 6.5%

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
    organization: Organization = Depends(get_current_organization),
):
    """Return the full amortization schedule for a property's mortgage."""
    _get_property_or_404(property_id, db, organization)

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
    organization: Organization = Depends(get_current_organization),
):
    """Compare standard vs. accelerated payoff with an extra monthly payment."""
    _get_property_or_404(property_id, db, organization)

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
    organization: Organization = Depends(get_current_organization),
):
    """Scan trailing-12-month transactions for spending anomalies.

    Returns a list of alerts for expense categories that exceed 15% of
    gross income at the property level. Alert messages are generated by
    Gemini when GOOGLE_API_KEY is set; otherwise a template is used.
    """
    alerts = analyze_maintenance_health(db, organization_id=organization.id)
    return {"alerts": alerts, "count": len(alerts)}


# ---------------------------------------------------------------------------
# Portfolio Chat Agent (Gemini function calling)
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str  # "user" or "model"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


@app.post("/api/agents/chat")
async def portfolio_chat_endpoint(
    body: ChatRequest,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    """Conversational portfolio AI assistant backed by Gemini function calling.

    The agent can call portfolio data tools (properties, tenants, transactions,
    cashflow) to ground its answers in live data before responding.

    Request body:
      message   - The user's current message.
      history   - Prior conversation turns [{"role": "user"|"model", "content": str}].

    Returns:
      {"reply": str, "tools_used": List[str]}
    """
    history = [{"role": m.role, "content": m.content} for m in (body.history or [])]
    result = portfolio_chat(body.message, history, db, organization_id=organization.id)

    if "error" in result:
        error_msg = result["error"]
        status_code = 503 if ("GOOGLE_API_KEY" in error_msg or "not installed" in error_msg) else 500
        raise HTTPException(status_code=status_code, detail=error_msg)

    return result


# ---------------------------------------------------------------------------
# Deal Scorer Agent
# ---------------------------------------------------------------------------

class DealScoreRequest(BaseModel):
    purchase_price: float
    monthly_rent: float
    monthly_expenses: float
    down_payment: float
    loan_rate: float
    loan_term: Optional[int] = 360


@app.post("/api/agents/score-deal")
async def score_deal_endpoint(
    body: DealScoreRequest,
    _organization: Organization = Depends(get_current_organization),
):
    """Score a real estate deal with computed metrics and a Gemini recommendation.

    Returns: {"score": int, "recommendation": str, "metrics": {"cap_rate": float,
              "cash_on_cash": float, "noi": float}}
    """
    result = score_deal(body.dict())
    if "error" in result:
        error_msg = result["error"]
        status_code = 503 if ("GOOGLE_API_KEY" in error_msg or "not installed" in error_msg) else 500
        raise HTTPException(status_code=status_code, detail=error_msg)
    return result


# ---------------------------------------------------------------------------
# Lease Renewal Workflow Agent
# ---------------------------------------------------------------------------

@app.post("/api/agents/lease-renewal-workflow/{tenant_id}")
async def lease_renewal_workflow_endpoint(
    tenant_id: int,
    db: Session = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
):
    """Run the lease renewal workflow for a tenant.

    Returns: {"days_until_expiry": int, "recommended_deadline": str,
              "pricing_strategy": str, "tenant_intent": str}
    """
    _get_tenant_or_404(tenant_id, db, organization)
    result = lease_renewal_workflow(tenant_id, db, organization_id=organization.id)
    if "error" in result:
        error_msg = result["error"]
        status_code = 503 if ("GOOGLE_API_KEY" in error_msg or "not installed" in error_msg) else 500
        raise HTTPException(status_code=status_code, detail=error_msg)
    return result


# ---------------------------------------------------------------------------
# Billing
# ---------------------------------------------------------------------------
from billing import configured_tiers, is_stripe_configured, normalize_tier


class BillingCheckoutRequest(BaseModel):
    tier: str = "Portfolio"


@app.get("/api/billing/status")
async def billing_status(current_user: User = Depends(get_current_user)):
    return {
        "subscription_status": current_user.subscription_status or "inactive",
        "subscription_tier": current_user.subscription_tier or "free",
        "has_stripe_customer": bool(current_user.stripe_customer_id),
        "stripe_configured": is_stripe_configured(),
        "available_tiers": configured_tiers(),
    }


@app.post("/api/billing/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    from billing import handle_webhook_event
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    
    try:
        event = handle_webhook_event(payload, sig_header)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    event_type = event["type"]
    if event_type == "checkout.session.completed":
        session = event['data']['object']
        client_reference_id = session.get("client_reference_id")
        if client_reference_id:
            user = db.query(User).filter(User.id == int(client_reference_id)).first()
            if user:
                metadata = session.get("metadata") or {}
                customer_id = session.get("customer")
                if customer_id:
                    user.stripe_customer_id = str(customer_id)
                user.subscription_status = "active"
                user.subscription_tier = normalize_tier(metadata.get("tier"))
                db.commit()
    elif event_type in {"customer.subscription.updated", "customer.subscription.deleted"}:
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        if customer_id:
            user = db.query(User).filter(User.stripe_customer_id == str(customer_id)).first()
            if user:
                metadata = subscription.get("metadata") or {}
                user.subscription_status = "canceled" if event_type.endswith(".deleted") else subscription.get("status", "inactive")
                if metadata.get("tier"):
                    user.subscription_tier = normalize_tier(metadata.get("tier"))
                db.commit()

    return {"status": "success"}

@app.post("/api/billing/create-checkout")
async def create_checkout(
    body: Optional[BillingCheckoutRequest] = None,
    tier: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    from billing import create_checkout_session
    selected_tier = body.tier if body else tier
    try:
        url = create_checkout_session(
            user_id=current_user.id,
            user_email=current_user.email,
            tier=selected_tier or "Portfolio",
            success_url=f"{PUBLIC_APP_URL.rstrip('/')}/?billing=success",
            cancel_url=f"{PUBLIC_APP_URL.rstrip('/')}/?billing=cancel",
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        logger.exception("Stripe checkout session creation failed")
        raise HTTPException(status_code=502, detail="Could not create checkout session")
    return {"url": url}


@app.post("/api/billing/create-portal")
async def create_billing_portal(current_user: User = Depends(get_current_user)):
    from billing import create_customer_portal_session
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No Stripe customer found for this user")
    try:
        url = create_customer_portal_session(
            customer_id=current_user.stripe_customer_id,
            return_url=f"{PUBLIC_APP_URL.rstrip('/')}/?billing=portal",
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        logger.exception("Stripe customer portal session creation failed")
        raise HTTPException(status_code=502, detail="Could not create customer portal session")
    return {"url": url}


# ---------------------------------------------------------------------------
# Stripe Webhook (canonical path, excluded from JWT auth and rate limiting)
# ---------------------------------------------------------------------------

def _handle_stripe_webhook_event(event: dict, db: Session) -> None:
    """Apply side-effects for supported Stripe event types."""
    event_type = event.get("type", "")
    data_obj = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        client_reference_id = data_obj.get("client_reference_id")
        if client_reference_id:
            try:
                user_id = int(client_reference_id)
            except (ValueError, TypeError):
                logger.warning("stripe webhook: non-integer client_reference_id=%s", client_reference_id)
                return
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                metadata = data_obj.get("metadata") or {}
                customer_id = data_obj.get("customer")
                if customer_id:
                    user.stripe_customer_id = str(customer_id)
                user.subscription_status = "active"
                user.subscription_tier = normalize_tier(metadata.get("tier"))
                db.commit()
                logger.info("stripe webhook: activated subscription for user_id=%s tier=%s", user_id, user.subscription_tier)

    elif event_type == "customer.subscription.deleted":
        customer_id = data_obj.get("customer")
        if customer_id:
            user = db.query(User).filter(User.stripe_customer_id == str(customer_id)).first()
            if user:
                user.subscription_status = "canceled"
                db.commit()
                logger.info("stripe webhook: canceled subscription for stripe_customer=%s", customer_id)


@app.post("/api/webhooks/stripe")
async def stripe_webhook_canonical(request: Request, db: Session = Depends(get_db)):
    """Stripe webhook receiver at the canonical /api/webhooks/stripe path.

    Verifies the Stripe-Signature header before processing. No JWT auth required.
    Handles:
      - checkout.session.completed  -> activate subscription
      - customer.subscription.deleted -> cancel subscription
    """
    from billing import handle_webhook_event
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = handle_webhook_event(payload, sig_header)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Webhook verification failed: {exc}")

    _handle_stripe_webhook_event(event, db)
    return {"status": "ok"}
