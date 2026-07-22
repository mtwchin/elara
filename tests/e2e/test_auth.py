import pytest
import httpx
import time
from conftest import generate_mock_clerk_token

pytestmark = pytest.mark.asyncio

# ==============================================================================
# TIER 1: Feature Coverage (Functional Baselines) - Authentication
# ==============================================================================

async def test_t1_ath_01_valid_token(async_client):
    """
    T1-ATH-01: Valid Token Authorization
    Send a valid, signed Clerk JWT token in the Authorization header to /api/properties.
    Verify 200 OK is returned with the property list.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    response = await async_client.get("/api/properties", headers=headers)
    
    # During E2E suite verification before full Clerk integration, this is expected to fail with 401
    assert response.status_code == 200
    assert isinstance(response.json(), list)

async def test_t1_ath_02_missing_token(async_client):
    """
    T1-ATH-02: Missing Token Rejection
    Request /api/properties without an Authorization header.
    Verify 401 Unauthorized with {"detail": "Could not validate credentials"}.
    """
    response = await async_client.get("/api/properties")
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"

async def test_t1_ath_03_expired_token(async_client):
    """
    T1-ATH-03: Expired Token Rejection
    Send a Clerk JWT token with exp in the past.
    Verify 401 Unauthorized is returned.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123", expired=True)
    headers = {"Authorization": f"Bearer {token}"}
    response = await async_client.get("/api/properties", headers=headers)
    assert response.status_code == 401

async def test_t1_ath_04_signature_mismatch(async_client):
    """
    T1-ATH-04: Signature Mismatch Rejection
    Send a Clerk JWT token signed with an invalid private key.
    Verify 401 Unauthorized is returned.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123", invalid_sig=True)
    headers = {"Authorization": f"Bearer {token}"}
    response = await async_client.get("/api/properties", headers=headers)
    assert response.status_code == 401

async def test_t1_ath_05_audience_mismatch(async_client):
    """
    T1-ATH-05: Audience Mismatch Rejection
    Send a Clerk JWT token with an invalid aud claim.
    Verify 401 Unauthorized is returned.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123", invalid_aud=True)
    headers = {"Authorization": f"Bearer {token}"}
    response = await async_client.get("/api/properties", headers=headers)
    assert response.status_code == 401


# ==============================================================================
# TIER 2: Boundary & Corner Cases (Robustness & Security) - Authentication
# ==============================================================================

@pytest.mark.parametrize("header_value", [
    "Bearer",
    "Token token123",
    "Bearer token1 token2",
    "Bearer ",
    "bearer token123",
    "Basic dGVzdEBleGFtcGxlLmNvbTpwYXNzd29yZDEyMw=="
])
async def test_t2_ath_01_malformed_auth_headers(async_client, header_value):
    """
    T2-ATH-01: Malformed Auth Headers
    Send values like Bearer, Token token123, or Bearer token1 token2 in the Authorization header.
    Verify 401 Unauthorized is returned.
    """
    headers = {"Authorization": header_value}
    response = await async_client.get("/api/properties", headers=headers)
    assert response.status_code == 401

async def test_t2_ath_02_alg_claim_attack(async_client):
    """
    T2-ATH-02: Alg Claim Attack
    Send a JWT token with alg: "HS256" (symmetric key exploit).
    Verify the backend rejects the token because it expects RS256.
    """
    import jwt
    import time
    # Sign with a symmetric key exploit: sign using the HS256 algorithm but with the public key as the secret
    # or just a simple string secret, representing a bypass attempt.
    now = int(time.time())
    payload = {
        "sub": "user_123",
        "email": "test@example.com",
        "iss": "https://clerk.mock-issuer.com",
        "aud": "mock-client-app",
        "iat": now,
        "exp": now + 3600,
    }
    # Standard symmetric secret bypass attempt
    malicious_token = jwt.encode(payload, "secret", algorithm="HS256")
    headers = {"Authorization": f"Bearer {malicious_token}"}
    response = await async_client.get("/api/properties", headers=headers)
    assert response.status_code == 401

async def test_t2_ath_03_future_activation(async_client):
    """
    T2-ATH-03: Future Activation (nbf)
    Send a JWT token where the nbf (not before) claim is in the future.
    Verify 401 Unauthorized is returned.
    """
    future_time = int(time.time()) + 3600
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123", nbf=future_time)
    headers = {"Authorization": f"Bearer {token}"}
    response = await async_client.get("/api/properties", headers=headers)
    assert response.status_code == 401

async def test_t2_ath_04_jwks_server_offline(async_client, mock_external_services):
    """
    T2-ATH-04: JWKS Server Offline
    Temporarily terminate/fail the mock JWKS server, then request /api/properties.
    Verify the backend does not crash. If JWKS keys are already cached, the
    token may still validate successfully.
    """
    # Force JWKS server to return a 500 error, or timeout
    mock_external_services["jwks_route"].mock(return_value=httpx.Response(500))
    
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = await async_client.get("/api/properties", headers=headers)
        assert response.status_code in (200, 401, 503, 502)
    except httpx.HTTPError:
        # If it raises a client-side HTTPError instead of returning 500, that's also handled or checked
        pass

async def test_t2_ath_05_missing_user_mapping(async_client):
    """
    T2-ATH-05: Missing User Mapping
    Send a valid Clerk JWT containing a subject sub (or email) that is not registered in the database.
    Verify how the backend maps or auto-registers the user, returning 401 or handling creation gracefully.
    Ensure no 500 server crash occurs.
    """
    token = generate_mock_clerk_token(email="unregistered-user@example.com", sub="user_999")
    headers = {"Authorization": f"Bearer {token}"}
    response = await async_client.get("/api/properties", headers=headers)
    # The behavior depends on design: either it auto-registers (200) or rejects (401). It must NOT 500.
    assert response.status_code in (200, 401)


async def test_t2_ath_06_users_are_isolated_by_organization(async_client):
    """
    T2-ATH-06: Multi-user data isolation
    A property created by User A must not be listed or readable by User B.
    """
    token_a = generate_mock_clerk_token(email="owner-a@example.com", sub="user_a")
    token_b = generate_mock_clerk_token(email="owner-b@example.com", sub="user_b")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    property_data = {
        "address": "101 Isolation Way, Austin, TX",
        "propertyType": "Single Family",
        "purchasePrice": 425000,
        "purchaseDate": "2026-06-17",
        "status": "Active",
    }

    create_res = await async_client.post("/api/properties", json=property_data, headers=headers_a)
    assert create_res.status_code in (200, 201)
    property_id = create_res.json()["id"]

    owner_res = await async_client.get("/api/properties", headers=headers_a)
    assert owner_res.status_code == 200
    assert any(p["id"] == property_id for p in owner_res.json())

    other_list_res = await async_client.get("/api/properties", headers=headers_b)
    assert other_list_res.status_code == 200
    assert all(p["id"] != property_id for p in other_list_res.json())

    other_read_res = await async_client.get(f"/api/properties/{property_id}", headers=headers_b)
    assert other_read_res.status_code == 404


async def test_t2_ath_07_register_requires_strong_password(async_client):
    """
    T2-ATH-07: Registration password policy
    Weak passwords should be rejected before account creation.
    """
    response = await async_client.post(
        "/api/auth/register",
        json={"email": "weak-password@example.com", "password": "short1A"},
    )
    assert response.status_code == 400
    assert "Password" in response.json()["detail"]


async def test_t2_ath_08_register_normalizes_email(async_client):
    """
    T2-ATH-08: Registration email normalization
    Emails should be stored and returned in lowercase to avoid duplicate identities.
    """
    response = await async_client.post(
        "/api/auth/register",
        json={"email": "MixedCase@Example.com", "password": "StrongPass123"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "mixedcase@example.com"


async def test_t2_ath_09_production_config_rejects_local_defaults(monkeypatch):
    """
    T2-ATH-09: Production config safety
    Production mode should fail fast when local-only defaults are present.
    """
    import main

    monkeypatch.setattr(main, "APP_ENV", "production")
    monkeypatch.setattr(main, "CORS_ORIGINS", ["http://localhost:5173"])
    monkeypatch.setattr(main, "PUBLIC_APP_URL", "http://localhost")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./portfolio.db")
    monkeypatch.setenv("RE_PORTFOLIO_JWT_SECRET", "short")

    with pytest.raises(RuntimeError):
        main._validate_production_config()


async def test_t2_ath_10_billing_status_requires_auth_and_returns_subscription(async_client):
    """
    T2-ATH-10: Billing status contract
    Billing status should be authenticated and return the current user's subscription state.
    """
    unauthenticated = await async_client.get("/api/billing/status")
    assert unauthenticated.status_code == 401

    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    response = await async_client.get(
        "/api/billing/status",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["subscription_status"] == "inactive"
    assert data["subscription_tier"] == "free"
    assert data["has_stripe_customer"] is False
