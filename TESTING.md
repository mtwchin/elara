# Testing Guide

This document outlines the testing philosophy, feature inventory, test architecture, and execution instructions for Elara.

---

## 1. Testing Philosophy
The project employs a tier-based, end-to-end (E2E) testing strategy to validate integration points, boundary conditions, and security configurations. Rather than testing units in complete isolation, our testing philosophy prioritizes verifying:
* **Security Boundaries**: Enforcing local JWT authentication checks and payload validity across all exposed API surfaces.
* **Resilience & Fallback**: Validating that the application behaves predictably under degraded states, rate limits, latency spikes, and missing configurations (e.g., missing API keys).
* **Data Flow & Aggregation**: Ensuring that external integrations (such as the Zillow API via RapidAPI) correctly merge with local database properties to deliver complete, accurate metrics to the client.
* **Hermetic & Independent Execution**: Every test is fully isolated, mock-based, and runs without making actual network requests to ensure stability and reproducibility in any deployment environment.

---

## 2. Test Architecture
The test suite resides in the `tests/` directory under a standard pytest structure:

```text
tests/
└── e2e/
    ├── conftest.py          # Pytest fixtures, mock servers, key generators, and DB setup
    ├── test_auth.py         # Authentication baseline and boundary tests
    ├── test_market_data.py  # Zillow API, caching, fallback, and validation tests
    └── test_scenarios.py    # Pairwise verification and real-world user flows
```

### Key Architectural Components
1. **Mock Token Generator (`conftest.py`)**:
   Generates local HS256 JWTs using a mock `RE_PORTFOLIO_JWT_SECRET` to simulate active, expired, or tampered sessions.
2. **Third-Party Mocking (`respx`)**:
   Employs `respx` to intercept all outgoing HTTP client requests, specifically local and remote Zillow API queries, returning mock real estate averages and listings.
3. **Database Isolation**:
   Overrides the SQLAlchemy backend database context dynamically in tests. Runs all queries against a clean, in-memory SQLite database (`sqlite:///:memory:`) that is dropped and rebuilt between tests, ensuring zero side effects.
4. **Async Test Runner**:
   Powers asynchronous execution of endpoints via FastAPI's `AsyncClient`.

---

## 3. How to Run the Tests

Follow these steps to run the E2E test suite locally. 

### Prerequisites
Ensure your Python virtual environment is activated and test dependencies (like `pytest`, `pytest-asyncio`, `respx`) are installed.
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Execution Commands (From Project Root)

**Run all E2E tests:**
```bash
./backend/venv/bin/pytest tests/e2e/
```

**Run a specific test file:**
```bash
./backend/venv/bin/pytest tests/e2e/test_auth.py
```

**Run tests in verbose mode (shows individual test names):**
```bash
./backend/venv/bin/pytest tests/e2e/ -v
```

---

## 4. Coverage Matrix & Tiers

The E2E test suite comprises tests structured into four testing tiers.

### Tier 1: Feature Coverage (Functional Baselines)
- **Authentication**: Validates that valid local JWT tokens permit access, while missing, expired, or incorrectly signed tokens are strictly rejected with a `401 Unauthorized`.
- **Market Data**: Verifies `/api/dashboard` correctly aggregates local SQLite DB data and Zillow mock data, checks API caching behavior, and ensures missing API keys trigger graceful fallbacks.

### Tier 2: Boundary & Corner Cases (Robustness)
- **Security Bypass Attempts**: Verifies rejection of malformed auth headers (e.g., `Bearer `, `Token 123`) and algorithm manipulation attacks.
- **External Failures**: Verifies handling of empty listing arrays, rate limits (429), data type anomalies (negative prices, null averages), and slow Zillow response timeouts.

### Tier 3: Cross-Feature Combinations
- **Scenarios**: Testing the matrix of session states against external API states (e.g., *Active session with offline Zillow API* vs *Expired session with healthy Zillow API*).

### Tier 4: Real-World Application Scenarios
- **Integration Journeys**: Validates end-to-end flows like login redirect routing, dashboard initialization, zero-configuration startup, and complex state updates (e.g., POSTing a new property triggers a recalculation of ROI using regional market rents).