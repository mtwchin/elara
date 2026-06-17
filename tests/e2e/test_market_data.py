import pytest
import httpx
import time
from conftest import generate_mock_clerk_token

pytestmark = pytest.mark.asyncio

# ==============================================================================
# TIER 1: Feature Coverage (Functional Baselines) - Market Data
# ==============================================================================

async def test_t1_mkt_01_dashboard_aggregation(async_client):
    """
    T1-MKT-01: Dashboard Aggregation
    GET /api/dashboard with valid auth.
    Verify that marketData matches Zillow mock results and merges with local SQLite metrics.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    response = await async_client.get("/api/dashboard", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert "metrics" in data
    assert "marketData" in data
    
    # Asserting that the market data averages returned match mock Zillow response
    market_data = data["marketData"]
    assert market_data["cityAveragePrice"] == 850000
    assert market_data["cityAverageRent"] == 3200
    assert len(market_data["listings"]) == 2

async def test_t1_mkt_02_api_endpoint_query(async_client):
    """
    T1-MKT-02: API Endpoint Query
    GET /api/market-data?city=Miami with valid auth.
    Verify returns 200 OK with correct JSON schema.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    response = await async_client.get("/api/market-data?city=Miami", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert "cityAveragePrice" in data
    assert "cityAverageRent" in data
    assert "listings" in data
    assert isinstance(data["listings"], list)

async def test_t1_mkt_03_caching_behavior(async_client, mock_external_services):
    """
    T1-MKT-03: Caching Behavior
    Make two consecutive requests to /api/market-data?city=Miami.
    Verify the backend only calls the external Zillow API once, serving the second request from cache.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Reset call counts
    mock_external_services["zillow_local_route"].calls.reset()
    mock_external_services["zillow_remote_route"].calls.reset()
    
    # First request
    res1 = await async_client.get("/api/market-data?city=Miami", headers=headers)
    assert res1.status_code == 200
    
    # Check that it made a call
    count1_local = len(mock_external_services["zillow_local_route"].calls)
    count1_remote = len(mock_external_services["zillow_remote_route"].calls)
    assert (count1_local + count1_remote) == 1
    
    # Second request (should hit cache)
    res2 = await async_client.get("/api/market-data?city=Miami", headers=headers)
    assert res2.status_code == 200
    
    # Call count should not have increased
    count2_local = len(mock_external_services["zillow_local_route"].calls)
    count2_remote = len(mock_external_services["zillow_remote_route"].calls)
    assert (count2_local + count2_remote) == 1

async def test_t1_mkt_04_missing_api_key_fallback(async_client, monkeypatch):
    """
    T1-MKT-04: Missing API Key Fallback
    Run backend with empty RAPIDAPI_KEY. Request /api/dashboard.
    Verify it falls back to mock/cached data, returns 200 OK, and appends a warning alert to the alerts list.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Override environment variable dynamically using monkeypatch
    monkeypatch.setenv("RAPIDAPI_KEY", "")
    
    response = await async_client.get("/api/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "alerts" in data
    # Ensure there is a warning alert indicating missing API configuration or fallback mode
    warnings = [a for a in data["alerts"] if a.get("type") == "warning" or "api key" in a.get("description", "").lower()]
    assert len(warnings) > 0

async def test_t1_mkt_05_rapidapi_down_fallback(async_client, mock_external_services):
    """
    T1-MKT-05: RapidAPI Down Fallback
    Force Zillow API mock to return 500 Internal Server Error. Request /api/dashboard.
    Verify the backend handles the error gracefully, serving cached/mock data instead of crashing.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Mock external service to fail
    mock_external_services["zillow_local_route"].mock(return_value=httpx.Response(500))
    mock_external_services["zillow_remote_route"].mock(return_value=httpx.Response(500))
    
    response = await async_client.get("/api/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "marketData" in data
    # Should still contain some fallback data or cached averages, not fail with 500
    assert "cityAveragePrice" in data["marketData"]


# ==============================================================================
# TIER 2: Boundary & Corner Cases (Robustness & Security) - Market Data
# ==============================================================================

async def test_t2_mkt_01_empty_listing_response(async_client, mock_external_services):
    """
    T2-MKT-01: Empty Listing Response
    Set Zillow API mock to return an empty listings list ([]). Request /api/market-data.
    Verify backend returns 200 OK with empty listings without division-by-zero or formatting errors.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    empty_payload = {
        "cityAveragePrice": 0,
        "cityAverageRent": 0,
        "listings": []
    }
    mock_external_services["zillow_local_route"].mock(return_value=httpx.Response(200, json=empty_payload))
    mock_external_services["zillow_remote_route"].mock(return_value=httpx.Response(200, json=empty_payload))
    
    response = await async_client.get("/api/market-data?city=Miami", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["listings"] == []
    assert data["cityAveragePrice"] == 0

async def test_t2_mkt_02_rate_limiting_429(async_client, mock_external_services):
    """
    T2-MKT-02: Rate Limiting (HTTP 429)
    Set Zillow API mock to return 429 Too Many Requests. Request /api/dashboard.
    Verify backend serves cached data and returns a system alert informing the user of the rate limit.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    mock_external_services["zillow_local_route"].mock(return_value=httpx.Response(429, content=b"Too Many Requests"))
    mock_external_services["zillow_remote_route"].mock(return_value=httpx.Response(429, content=b"Too Many Requests"))
    
    response = await async_client.get("/api/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    
    # Must serve cached/fallback market data
    assert "marketData" in data
    # Must append an alert about the rate limiting
    alerts = data.get("alerts", [])
    rate_limit_alerts = [a for a in alerts if "rate limit" in a.get("description", "").lower() or a.get("type") == "danger"]
    assert len(rate_limit_alerts) > 0

async def test_t2_mkt_03_data_type_anomalies(async_client, mock_external_services):
    """
    T2-MKT-03: Data Type Anomalies
    Set Zillow API mock to return extreme values (e.g. negative average rent, null prices, крайне long addresses).
    Verify the backend sanitizes or ignores corrupt fields.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    corrupt_payload = {
        "cityAveragePrice": -500000,
        "cityAverageRent": None,
        "listings": [
            { "address": "X" * 5000, "price": "NotANumber", "beds": -3, "baths": None }
        ]
    }
    mock_external_services["zillow_local_route"].mock(return_value=httpx.Response(200, json=corrupt_payload))
    mock_external_services["zillow_remote_route"].mock(return_value=httpx.Response(200, json=corrupt_payload))
    
    response = await async_client.get("/api/market-data?city=Miami", headers=headers)
    assert response.status_code == 200
    data = response.json()
    # Ensure values are sanitized (e.g., negative/null averages replaced by 0, strings parsed or skipped)
    assert data["cityAveragePrice"] >= 0
    assert data["cityAverageRent"] is not None

async def test_t2_mkt_04_slow_api_response_timeout(async_client, mock_external_services):
    """
    T2-MKT-04: Slow API Response Timeout
    Set Zillow API mock to delay responses by 10 seconds.
    Verify the backend client times out after 3-5 seconds and falls back to cached data, rather than hanging user request.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Custom respx response callback to simulate latency
    async def delayed_response(request):
        await asyncio.sleep(10)
        return httpx.Response(200, json={})
    
    import asyncio
    mock_external_services["zillow_local_route"].mock(side_effect=delayed_response)
    mock_external_services["zillow_remote_route"].mock(side_effect=delayed_response)
    
    start_time = time.time()
    response = await async_client.get("/api/dashboard", headers=headers)
    duration = time.time() - start_time
    
    # Verify response finishes quickly (times out and falls back in under 6 seconds)
    assert duration < 6.0
    assert response.status_code == 200

async def test_t2_mkt_05_special_character_inputs(async_client):
    """
    T2-MKT-05: Special Character Inputs
    Query /api/market-data?city=San+Francisco%21%40%23.
    Verify the backend URL-encodes queries properly and handles non-alphanumeric parameters safely.
    """
    token = generate_mock_clerk_token(email="test@example.com", sub="user_123")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = await async_client.get("/api/market-data?city=San+Francisco!@#", headers=headers)
    assert response.status_code == 200
