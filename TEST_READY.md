# E2E Test Suite Ready Status (TEST_READY)

This document provides the status of the E2E test suite, execution instructions, and a detailed feature coverage checklist.

---

## 1. E2E Test Suite Ready Status
The end-to-end (E2E) test suite is **fully implemented** and acts as the gatekeeper for verification. 

### Current Execution Metrics (Milestone 1 Baseline)
* **Total Collected Items**: 35 tests
* **Passed**: 16 tests
* **Failed**: 19 tests
* **Warnings**: 3 warnings

### Why the Tests Fail in Current State
The tests are running against the current development codebase where **Milestone 2 (Clerk Authentication)** and **Milestone 3 (Live Market Data)** are not yet implemented:
1. **Passing Tests (16)**: The 16 tests that pass are boundary/corner case tests in `test_auth.py` and scenario tests (e.g., `test_t3_mx_04_unauthenticated_healthy_zillow` and `test_t3_mx_05_expired_token_offline_zillow`) that expect a `401 Unauthorized` response. The backend currently returns `401 Unauthorized` for these requests due to the local database-based login dependency, satisfying these specific tests' assertions.
2. **Failing Tests (19)**: 
   * **Authentication (1)**: `test_t1_ath_01_valid_token` fails because it sends a mock Clerk token and expects access (`200 OK`), but the backend does not yet support Clerk token verification.
   * **Market Data (10)**: All 10 tests fail because `/api/market-data` is not yet defined (returns 404) and `/api/dashboard` expects a local database-logged-in session (returns 401).
   * **Scenarios (8)**: These integration scenario tests fail due to missing endpoints and lack of Clerk JWT decoding support that will be corrected as endpoints are fully wired.

---

## 2. How to Run
Follow these steps to run the E2E test suite locally on macOS:

### Prerequisites
Make sure your Python virtual environment is activated and dependencies are installed.
```bash
# Navigate to the backend directory and activate the virtual environment
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Run Commands (From Project Root)
Run all E2E tests:
```bash
./backend/venv/bin/pytest tests/e2e/
```

Run a specific test file:
```bash
./backend/venv/bin/pytest tests/e2e/test_auth.py
./backend/venv/bin/pytest tests/e2e/test_market_data.py
./backend/venv/bin/pytest tests/e2e/test_scenarios.py
```

Run tests in verbose mode showing individual test names:
```bash
./backend/venv/bin/pytest tests/e2e/ -v
```

---

## 3. Feature Coverage Checklist
The E2E test suite comprises 35 test cases (including parameterized permutations) structured into four testing tiers:

### Tier 1: Feature Coverage (Functional Baselines)
- [ ] **Authentication**
  - [ ] `test_t1_ath_01_valid_token`: Verify valid Clerk token gives access to protected endpoints (`200 OK`).
  - [ ] `test_t1_ath_02_missing_token`: Verify request without Authorization header is rejected (`401 Unauthorized`).
  - [ ] `test_t1_ath_03_expired_token`: Verify Clerk token with past expiration date is rejected (`401 Unauthorized`).
  - [ ] `test_t1_ath_04_signature_mismatch`: Verify token signed with an invalid key is rejected (`401 Unauthorized`).
  - [ ] `test_t1_ath_05_audience_mismatch`: Verify token with incorrect audience claim is rejected (`401 Unauthorized`).
- [ ] **Market Data**
  - [ ] `test_t1_mkt_01_dashboard_aggregation`: Verify `/api/dashboard` correctly aggregates local SQLite DB data and Zillow mock data.
  - [ ] `test_t1_mkt_02_api_endpoint_query`: Verify `/api/market-data?city=Miami` returns expected data schema.
  - [ ] `test_t1_mkt_03_caching_behavior`: Verify consecutive calls fetch from Zillow API once and serve second request from local cache.
  - [ ] `test_t1_mkt_04_missing_api_key_fallback`: Verify empty API key returns fallback data and sets a system warning alert.
  - [ ] `test_t1_mkt_05_rapidapi_down_fallback`: Verify Zillow API outage (500) fails gracefully and serves cached data.

### Tier 2: Boundary & Corner Cases (Robustness & Security)
- [ ] **Authentication**
  - [ ] `test_t2_ath_01_malformed_auth_headers` (6 cases): Verify rejection of malformed authentication header values:
    - [ ] `Bearer`
    - [ ] `Token token123`
    - [ ] `Bearer token1 token2`
    - [ ] `Bearer `
    - [ ] `bearer token123`
    - [ ] `Basic dGVzdEBleGFtcGxlLmNvbTpwYXNzd29yZDEyMw==`
  - [ ] `test_t2_ath_02_alg_claim_attack`: Verify rejection of HS256-signed bypass tokens (symmetric key exploits).
  - [ ] `test_t2_ath_03_future_activation`: Verify rejection of tokens with future not-before (`nbf`) activation times.
  - [ ] `test_t2_ath_04_jwks_server_offline`: Verify offline JWKS server doesn't crash the server and returns appropriate error status.
  - [ ] `test_t2_ath_05_missing_user_mapping`: Verify valid token for unregistered email doesn't crash server (handles gracefully).
- [ ] **Market Data**
  - [ ] `test_t2_mkt_01_empty_listing_response`: Verify handling of empty Zillow listing arrays without arithmetic or division-by-zero errors.
  - [ ] `test_t2_mkt_02_rate_limiting_429`: Verify Zillow rate limits (429) result in cached fallback data and append warning alerts.
  - [ ] `test_t2_mkt_03_data_type_anomalies`: Verify sanitization of extreme or corrupt data payloads (negative prices, null averages).
  - [ ] `test_t2_mkt_04_slow_api_response_timeout`: Verify slow Zillow requests timeout under 6 seconds and fall back to cached data.
  - [ ] `test_t2_mkt_05_special_character_inputs`: Verify safe URL-encoding and parameter handling of queries containing special characters.

### Tier 3: Cross-Feature Combinations (Pairwise Verification)
- [ ] **Scenarios (`test_scenarios.py`)**
  - [ ] `test_t3_mx_01_authenticated_healthy_zillow`: Active session with healthy Zillow (200 OK + listings).
  - [ ] `test_t3_mx_02_authenticated_rate_limited_zillow`: Active session with rate-limited Zillow (cached metrics + alerts).
  - [ ] `test_t3_mx_03_authenticated_offline_zillow`: Active session with offline Zillow (cached metrics + fallback).
  - [ ] `test_t3_mx_04_unauthenticated_healthy_zillow`: Unauthenticated session with healthy Zillow (fails with 401 without calling API).
  - [ ] `test_t3_mx_05_expired_token_offline_zillow`: Expired token with offline Zillow (fails with 401 without calling API).

### Tier 4: Real-World Application Scenarios (Integration Journeys)
- [ ] **Integration Journeys (`test_scenarios.py`)**
  - [ ] `test_t4_scenario_1_login_dashboard_render`: Standard login redirect, dashboard initialization, public key fetch, and page render.
  - [ ] `test_t4_scenario_2_session_expiration`: Intercepting an active session expiry and redirecting the user to login.
  - [ ] `test_t4_scenario_3_zero_config_fallback`: Zero-configuration startup container check.
  - [ ] `test_t4_scenario_4_multi_user_isolation_caching`: Verifies global cache sharing across distinct authenticated sessions.
  - [ ] `test_t4_scenario_5_property_add_roi_refresh`: Full ROI update flow (POST new property in Seattle, fetch Seattle averages, verify metrics update).

---
*Created per project requirements.*
