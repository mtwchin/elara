"""JWT auth — hashing, token issue/verify, and a FastAPI dependency."""

import datetime
import os
from dotenv import load_dotenv
load_dotenv()
from typing import Optional

import bcrypt
import jwt
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from models import User

JWT_SECRET = os.environ.get("RE_PORTFOLIO_JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "RE_PORTFOLIO_JWT_SECRET is not set. "
        "Generate one with: python3 -c \"import secrets; print(secrets.token_hex(32))\""
    )
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except ValueError:
        return False


def create_token(user: User) -> str:
    now = datetime.datetime.utcnow()
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": now,
        "exp": now + datetime.timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


CLERK_AUDIENCE = os.environ.get("CLERK_AUDIENCE", "mock-client-app")
CLERK_ISSUER = os.environ.get("CLERK_ISSUER", "https://clerk.mock-issuer.com")


class HTTPXPyJWKClient(jwt.PyJWKClient):
    def fetch_data(self) -> dict:
        response = httpx.get(self.uri, timeout=5.0)
        response.raise_for_status()
        return response.json()


def get_jwks_client():
    url = os.environ.get("CLERK_JWKS_URL")
    if not url:
        return None
    if not hasattr(get_jwks_client, "_client") or getattr(get_jwks_client, "_url", None) != url:
        # Enable caching to avoid fetching JWKS on every request
        get_jwks_client._client = HTTPXPyJWKClient(url, cache_keys=True)
        get_jwks_client._url = url
    return get_jwks_client._client


def get_current_user(
    token: Optional[str] = Depends(_oauth2),
    db: Session = Depends(get_db),
) -> User:
    creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise creds_exc

    # Try local HS256 token first (issued by /api/auth/login and /api/auth/register)
    try:
        unverified_header = jwt.get_unverified_header(token)
        if unverified_header.get("alg") == JWT_ALGORITHM:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            email = payload.get("email")
            if email:
                user = db.query(User).filter(User.email == email).first()
                if user:
                    return user
    except jwt.PyJWTError:
        pass  # Fall back to Clerk

    # Fall back to Clerk RS256 token if JWKS URL is configured
    try:
        jwks_client = get_jwks_client()
        if not jwks_client:
            raise creds_exc

        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=CLERK_AUDIENCE,
            issuer=CLERK_ISSUER,
            options={"require": ["exp", "iss", "sub", "nbf"]}
        )
    except (jwt.PyJWTError, Exception) as e:
        print(f"Clerk auth error: {e}")
        raise creds_exc

    # Clerk may store email in 'email' or 'email_address' claim depending on configuration
    email = payload.get("email") or payload.get("email_address")
    if not email:
        # If no email claim, try to use 'sub' or other identifiers if needed,
        # but the requirement specifies using the email from the token.
        raise creds_exc

    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Create local user for Clerk-authenticated users if they don't exist
        import secrets
        dummy_password = secrets.token_hex(32)
        user = User(email=email, hashed_password=hash_password(dummy_password))
        db.add(user)
        db.commit()
        db.refresh(user)

    return user
