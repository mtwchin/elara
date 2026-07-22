import os
import sys
import time
import json
import pytest
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm
import respx
import httpx
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

# Add backend directory to sys.path to allow importing main and auth
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend"))
sys.path.insert(0, backend_dir)

# Override environment variables for the test suite
os.environ.setdefault(
    "RE_PORTFOLIO_JWT_SECRET",
    "test-secret-for-e2e-suite-with-enough-entropy-0123456789abcdef",
)
os.environ["CLERK_JWKS_URL"] = "http://localhost:8001/.well-known/jwks.json"
os.environ["CLERK_ISSUER"] = "https://clerk.mock-issuer.com"
os.environ["CLERK_AUDIENCE"] = "mock-client-app"
os.environ["ZILLOW_API_BASE_URL"] = "http://localhost:8002"
os.environ["RAPIDAPI_KEY"] = "test-key"
os.environ["RAPIDAPI_HOST"] = "zillow-com1.p.rapidapi.com"

# Import app and database components after setting env variables and path
from main import app
from database import get_db
from models import Base, User, Property
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Programmatic generation of RSA private/public keypairs
# Standard key for valid tokens
_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_public_key = _private_key.public_key()

# Different dummy key for invalid signatures
_dummy_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

def generate_mock_clerk_token(email, sub, expired=False, invalid_sig=False, invalid_aud=False, **kwargs):
    """
    Utility helper that signs custom JWT claims representing a Clerk session token.
    Supports invalidating signatures, expiration, and audience mismatch.
    """
    key = _dummy_private_key if invalid_sig else _private_key
    aud = "wrong-client-app" if invalid_aud else "mock-client-app"
    now = int(time.time())
    
    # Base payload
    payload = {
        "sub": sub,
        "email": email,
        "iss": "https://clerk.mock-issuer.com",
        "aud": aud,
        "iat": now,
        "exp": now - 3600 if expired else now + 3600,
        "nbf": now - 60,
    }
    
    # Update payload with any additional kwargs passed (e.g. nbf override)
    payload.update(kwargs)
    
    headers = {"kid": "mock-clerk-key-id"}
    return jwt.encode(payload, key, algorithm="RS256", headers=headers)

@pytest.fixture
def mock_clerk_token_generator():
    return generate_mock_clerk_token

# Test database setup (in-memory SQLite)
from sqlalchemy.pool import StaticPool
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    
    # Seed a default user mapped to the sub 'user_123' and email 'test@example.com'
    db = TestingSessionLocal()
    from auth import hash_password
    default_user = User(email="test@example.com", hashed_password=hash_password("password123"))
    db.add(default_user)
    db.commit()
    db.close()
    
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pytest fixtures to run FastAPI app under test
@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

import pytest_asyncio

@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

# Mock interceptors using respx to intercept external API calls
@pytest.fixture(autouse=True)
def mock_external_services(respx_mock):
    # 1. JWKS URL Mocking
    jwk = json.loads(RSAAlgorithm.to_jwk(_public_key))
    jwk.update({
        "kid": "mock-clerk-key-id",
        "alg": "RS256",
        "use": "sig",
        "kty": "RSA"
    })
    jwks_data = {"keys": [jwk]}
    
    jwks_route = respx_mock.get("http://localhost:8001/.well-known/jwks.json").mock(
        return_value=httpx.Response(200, json=jwks_data)
    )
    
    # 2. Zillow API Mocking
    # Mock payload matching expected structure
    zillow_response = {
        "cityAveragePrice": 850000,
        "cityAverageRent": 3200,
        "listings": [
            { "address": "123 Ocean Drive, Miami FL", "price": 920000, "beds": 3, "baths": 2 },
            { "address": "456 Brickell Ave, Miami FL", "price": 780000, "beds": 2, "baths": 2 }
        ]
    }
    
    # Match any request to both the local mock URL or the RapidAPI Zillow domain
    zillow_local_route = respx_mock.get(url__regex=r"http://localhost:8002/.*").mock(
        return_value=httpx.Response(200, json=zillow_response)
    )
    zillow_remote_route = respx_mock.get(url__regex=r"https://zillow-com1.p.rapidapi.com/.*").mock(
        return_value=httpx.Response(200, json=zillow_response)
    )
    
    return {
        "jwks_route": jwks_route,
        "jwks_data": jwks_data,
        "zillow_local_route": zillow_local_route,
        "zillow_remote_route": zillow_remote_route,
        "zillow_response": zillow_response
    }
