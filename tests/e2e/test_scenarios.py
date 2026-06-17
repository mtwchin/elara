import pytest
import httpx
import time
from conftest import generate_mock_clerk_token

pytestmark = pytest.mark.asyncio

# ==============================================================================
# TIER 3: Cross-Feature Combinations (Pairwise Verification)
# ==============================================================================

async def test_t3_mx_01_authenticated_healthy_zillow(async_client, mock_external_services):
    """
    T3-MX-01: Authenticated | Healthy (200 OK)
    Success: Returns dashboard metrics + live market averages + listings.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = await async_client.get("/api/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "metrics" in data
    assert "marketData" in data
    assert data["marketData"]["cityAveragePrice"] == 850000

async def test_t3_mx_02_authenticated_rate_limited_zillow(async_client, mock_external_services):
    """
    T3-MX-02: Authenticated | Rate Limited (429)
    Degraded Success: Backend serves dashboard metrics but appends fallback/cached market data and a warning alert.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Mock rate limiting from Zillow
    mock_external_services["zillow_local_route"].mock(return_value=httpx.Response(429, content=b"Rate limited"))
    mock_external_services["zillow_remote_route"].mock(return_value=httpx.Response(429, content=b"Rate limited"))
    
    response = await async_client.get("/api/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "metrics" in data
    assert "marketData" in data
    # Alert should be present
    assert len(data.get("alerts", [])) > 0

async def test_t3_mx_03_authenticated_offline_zillow(async_client, mock_external_services):
    """
    T3-MX-03: Authenticated | Offline (500/Timeout)
    Degraded Success: Backend serves dashboard metrics but appends cached market data.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Mock offline Zillow
    mock_external_services["zillow_local_route"].mock(return_value=httpx.Response(500))
    mock_external_services["zillow_remote_route"].mock(return_value=httpx.Response(500))
    
    response = await async_client.get("/api/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "metrics" in data
    assert "marketData" in data

async def test_t3_mx_04_unauthenticated_healthy_zillow(async_client, mock_external_services):
    """
    T3-MX-04: Unauthenticated | Healthy (200 OK)
    Blocked: Backend immediately returns 401 Unauthorized without calling the Zillow API.
    """
    mock_external_services["zillow_local_route"].calls.reset()
    mock_external_services["zillow_remote_route"].calls.reset()
    
    response = await async_client.get("/api/dashboard")
    assert response.status_code == 401
    
    # Verify Zillow API was not called
    local_calls = len(mock_external_services["zillow_local_route"].calls)
    remote_calls = len(mock_external_services["zillow_remote_route"].calls)
    assert (local_calls + remote_calls) == 0

async def test_t3_mx_05_expired_token_offline_zillow(async_client, mock_external_services):
    """
    T3-MX-05: Expired Token | Offline (500/Timeout)
    Blocked: Backend immediately returns 401 Unauthorized without calling the Zillow API.
    """
    mock_external_services["zillow_local_route"].calls.reset()
    mock_external_services["zillow_remote_route"].calls.reset()
    
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123", expired=True)
    headers = {"Authorization": f"Bearer {token}"}
    
    response = await async_client.get("/api/dashboard", headers=headers)
    assert response.status_code == 401
    
    # Verify Zillow API was not called
    local_calls = len(mock_external_services["zillow_local_route"].calls)
    remote_calls = len(mock_external_services["zillow_remote_route"].calls)
    assert (local_calls + remote_calls) == 0


# ==============================================================================
# TIER 4: Real-World Application Scenarios (Integration Journeys)
# ==============================================================================

async def test_t4_scenario_1_login_dashboard_render(async_client):
    """
    Scenario 1: User Login, Dashboard Loading, and Live Data Rendering
    1. Unauthenticated client loads frontend; is blocked from dashboard.
    2. User logs in via mock Clerk login (stores mock JWT in localStorage, simulated via test runner).
    3. Frontend sends GET request to /api/dashboard with the new Bearer token.
    4. Backend fetches public keys from mock JWKS, verifies token signature, and requests Zillow API data.
    5. Backend merges Zillow market averages with SQLite database portfolio metrics and returns payload.
    6. Verify returned data structure.
    """
    # 1. Unauthenticated client blocked
    res_unauth = await async_client.get("/api/dashboard")
    assert res_unauth.status_code == 401
    
    # 2 & 3. Simulate logging in and hitting dashboard with Bearer token
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 4 & 5. Backend verifies token, fetches Zillow mock, and merges data
    response = await async_client.get("/api/dashboard", headers=headers)
    assert response.status_code == 200
    
    # 6. Verify dashboard response format
    data = response.json()
    assert "metrics" in data
    assert "marketData" in data
    assert "totalPortfolioValue" in data["metrics"]
    assert "cityAveragePrice" in data["marketData"]

async def test_t4_scenario_2_session_expiration(async_client):
    """
    Scenario 2: Active Session Expiration and Graceful Redirect
    1. User is active on dashboard with valid session.
    2. Test suite invalidates the session (using expired token).
    3. User attempts to load properties list.
    4. Backend returns 401 Unauthorized (which frontend intercepts to redirect/logout).
    """
    # 1. Valid session
    token_valid = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers_valid = {"Authorization": f"Bearer {token_valid}"}
    res_valid = await async_client.get("/api/properties", headers=headers_valid)
    assert res_valid.status_code == 200
    
    # 2 & 3. Try request with expired/invalidated token
    token_expired = generate_mock_clerk_token(email="test@example.com", sub="user_123", expired=True)
    headers_expired = {"Authorization": f"Bearer {token_expired}"}
    
    # 4. Returns 401
    res_invalid = await async_client.get("/api/properties", headers=headers_expired)
    assert res_invalid.status_code == 401

async def test_t4_scenario_3_zero_config_fallback(async_client, monkeypatch):
    """
    Scenario 3: Zero-Config Deployment Fallback
    1. Backend starts up in a fresh container without RAPIDAPI_KEY or custom JWKS variables.
    2. Request /api/dashboard.
    3. Verify authentication is bypassed/mocked or handles default dev checkout gracefully, and Zillow client falls back to seed/mock.
    """
    # Remove config environment variables
    monkeypatch.delenv("RAPIDAPI_KEY", raising=False)
    monkeypatch.delenv("CLERK_JWKS_URL", raising=False)
    
    # Hit dashboard with a valid dev token (or check default behavior)
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = await async_client.get("/api/dashboard", headers=headers)
    # The application should not crash, it should return 200 OK and fall back to local mock data
    assert response.status_code == 200
    data = response.json()
    assert "metrics" in data
    assert "marketData" in data

async def test_t4_scenario_4_multi_user_isolation_caching(async_client, mock_external_services):
    """
    Scenario 4: Multi-User Isolation under API Limits
    1. User A logs in and requests /api/market-data?city=Austin. Zillow API mock receives request, caches results for Austin.
    2. User B logs in and requests /api/market-data?city=Austin.
    3. Verify User B is authenticated, but backend serves cached data. Zillow API mock registers exactly 1 incoming request.
    4. User A requests /api/market-data?city=Boston. Zillow API mock receives request for Boston.
    5. Verify user data is isolated, but caching is shared globally to minimize API costs.
    """
    mock_external_services["zillow_local_route"].calls.reset()
    mock_external_services["zillow_remote_route"].calls.reset()
    
    # 1. User A requests Austin
    token_a = generate_mock_clerk_token(email="usera@example.com", sub="user_a")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    res_a1 = await async_client.get("/api/market-data?city=Austin", headers=headers_a)
    assert res_a1.status_code == 200
    
    # Zillow mock registers 1 call
    local_calls = len(mock_external_services["zillow_local_route"].calls)
    remote_calls = len(mock_external_services["zillow_remote_route"].calls)
    assert (local_calls + remote_calls) == 1
    
    # 2 & 3. User B requests Austin (served from cache)
    token_b = generate_mock_clerk_token(email="userb@example.com", sub="user_b")
    headers_b = {"Authorization": f"Bearer {token_b}"}
    res_b = await async_client.get("/api/market-data?city=Austin", headers=headers_b)
    assert res_b.status_code == 200
    
    # Zillow mock should still register only 1 call total (no new call for User B)
    local_calls = len(mock_external_services["zillow_local_route"].calls)
    remote_calls = len(mock_external_services["zillow_remote_route"].calls)
    assert (local_calls + remote_calls) == 1
    
    # 4. User A requests Boston
    res_a2 = await async_client.get("/api/market-data?city=Boston", headers=headers_a)
    assert res_a2.status_code == 200
    
    # Zillow mock should now register exactly 2 calls total
    local_calls = len(mock_external_services["zillow_local_route"].calls)
    remote_calls = len(mock_external_services["zillow_remote_route"].calls)
    assert (local_calls + remote_calls) == 2

async def test_t4_scenario_5_property_add_roi_refresh(async_client, mock_external_services):
    """
    Scenario 5: Property Add and Auto-Refreshed Valuation ROI
    1. Authenticated user adds a new property located in "Seattle" with a purchase price of $500,000.
    2. Frontend issues POST to /api/properties then navigates to Dashboard.
    3. Dashboard triggers load. Backend fetches Zillow market averages for Seattle.
    4. Zillow mock returns average rent of $3,000 for Seattle.
    5. Backend computes new estimated ROI for the Seattle property: 3000 * 12 / 500000 * 100 = 7.2%.
    6. Verify returned dashboard ROI metric includes this property and updates to reflect Seattle average trends.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Mock Zillow to return average rent of $3,000 and price of $500,000 for Seattle
    seattle_payload = {
        "cityAveragePrice": 500000,
        "cityAverageRent": 3000,
        "listings": [
            { "address": "Seattle address", "price": 500000, "beds": 3, "baths": 2 }
        ]
    }
    
    mock_external_services["zillow_local_route"].mock(return_value=httpx.Response(200, json=seattle_payload))
    mock_external_services["zillow_remote_route"].mock(return_value=httpx.Response(200, json=seattle_payload))
    
    # 1 & 2. POST to create the property
    property_data = {
        "address": "Seattle",
        "propertyType": "Single Family",
        "purchasePrice": 500000,
        "purchaseDate": "2026-06-17",
        "status": "Active"
    }
    
    res_post = await async_client.post("/api/properties", json=property_data, headers=headers)
    assert res_post.status_code == 200 or res_post.status_code == 201
    
    # 3 & 4 & 5 & 6. Load dashboard, verify ROI calculations
    res_dash = await async_client.get("/api/dashboard", headers=headers)
    assert res_dash.status_code == 200
    data = res_dash.json()
    
    # Seattle rent: $3,000/mo = $36,000/yr. Purchase price: $500,000. ROI = 7.2%.
    # If this is the only property, the portfolio average ROI should be 7.2%.
    # Check if the metrics update as expected.
    assert "metrics" in data
    assert data["metrics"]["avgRoi"] == 7.2
