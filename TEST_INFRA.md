# Test Infrastructure Documentation (TEST_INFRA)

This document outlines the testing philosophy, feature inventory, test architecture, and coverage thresholds for the Real Estate Portfolio Manager application.

---

## 1. Testing Philosophy
The project employs a tier-based, end-to-end (E2E) testing strategy to validate integration points, boundary conditions, and security configurations. Rather than testing units in complete isolation, our testing philosophy prioritizes verifying:
* **Security Boundaries**: Enforcing authentication checks and payload validity across all exposed API surfaces.
* **Resilience & Fallback**: Validating that the application behaves predictably under degraded states, rate limits, latency spikes, and missing configurations.
* **Data Flow & Aggregation**: Ensuring that external integrations (such as the Zillow API via RapidAPI) correctly merge with local database properties to deliver complete, accurate metrics to the client.
* **Hermetic & Independent Execution**: Every test is fully isolated, mock-based, and runs without making actual network requests to ensure stability and reproducibility in any deployment environment.

---

## 2. Feature Inventory
The testing framework targets three main areas of the application:

### A. Clerk Authentication & Session Security
* **Functional Token Validation**: Validates that valid, signed Clerk JWT bearer tokens permit access.
* **Access Control**: Validates rejection of requests without authorization headers.
* **Token Validity Checks**: Rejects expired tokens and checks standard token claims (issuer, audience, and future-dated not-before values).
* **Exploit Protection**: Asserts rejection of cryptographic algorithm manipulation attacks (e.g. HS256 algorithm exploit attempts).
* **Error Resilience**: Validates system stability and HTTP status response codes (401, 502, 503) if the Clerk JWKS server is offline or returns error states.

### B. Live Market Data Integration
* **Data Merging**: Validates that dashboard payloads combine SQLite metrics (such as purchase price) with live market averages from the Zillow API.
* **Query Formatting**: Validates JSON response schemas for regional searches.
* **Global Caching**: Asserts that consecutive API requests retrieve data from a local cache rather than consuming external API rate limits.
* **Fallback Behavior**: Verifies that missing API keys or external service failures resolve gracefully by serving mock/cached data and logging user-facing alerts.
* **Data Sanitization**: Prevents division-by-zero or formatting errors when listing lists are empty or contain corrupt, null, or negative numeric parameters.
* **Latency Management**: Times out slow third-party responses within a 3-5 second window to keep client requests responsive.

### C. End-to-End Scenarios & Multi-User Isolation
* **Simulated User Journeys**: Validates login transitions, dashboard loading, and session expirations.
* **Environment Fallbacks**: Ensures zero-config container deployments fallback to seed/mock data rather than crashing.
* **Multi-User Isolation**: Asserts that separate user sessions are isolated but leverage shared global API caching.
* **ROI Calculations**: Verifies that creating a new property automatically pulls regional market rents to recalculate and refresh dashboard metrics (e.g., computing Estimated ROI as `Rent * 12 / Purchase Price * 100`).

---

## 3. Test Architecture
The test suite resides in the `tests/` directory under a standard pytest structure:

```
tests/
└── e2e/
    ├── conftest.py          # Pytest fixtures, mock servers, key generators, and DB setup
    ├── test_auth.py         # Authentication baseline and boundary tests
    ├── test_market_data.py  # Zillow API, caching, fallback, and validation tests
    └── test_scenarios.py    # Pairwise verification and real-world user flows
```

### Key Architectural Components
1. **Mock Clerk Token Generator (`conftest.py`)**:
   Uses Python's `cryptography` library to programmatically generate RSA key pairs. It signs mock JWT payloads with custom claims (expiration, audience, signature) to simulate the Clerk identity provider.
2. **JWKS & RapidAPI Mocking (`respx`)**:
   Employs `respx` to intercept all outgoing HTTP client requests. It mocks:
   * The JWKS public key endpoint (`http://localhost:8001/.well-known/jwks.json`) to return the generated RSA public key matching the token generator.
   * Local and remote Zillow API queries (`http://localhost:8002/.*` and `https://zillow-com1.p.rapidapi.com/.*`) to return mock real estate averages and listings.
3. **Database Isolation (`setup_db` / `db`)**:
   Overrides the SQLAlchemy backend database context dynamically in tests. Runs all queries against a clean, in-memory SQLite database (`sqlite:///:memory:`) that is dropped and rebuilt between tests, ensuring zero side effects.
4. **Async Test Runner (`pytest-asyncio`)**:
   Powers asynchronous execution of endpoints via FastAPI's `AsyncClient`.

---

## 4. Coverage Thresholds
* **Security & Auth**: 100% of routes must be gated behind token checks, with E2E tests validating the full matrix of valid, invalid, expired, and malicious tokens.
* **Integrations**: All external requests to third-party endpoints must have mocked coverage for both successful (200 OK) and failed (429 Rate Limited, 500 Offline, Timeouts) paths.
* **Failing Tests (Current State)**: As of Milestone 1, the test suite acts as an executable specification. Actual code coverage is currently constrained by planned milestones, resulting in expected failures for unimplemented features.

---
*Created per project requirements.*
