# Project: Elara (Clerk Auth & RapidAPI)

## Architecture
- **Vite/React Frontend**: Coordinates user views (Dashboard, Properties, Tenants, Transactions, Financials). Employs Clerk Authentication components (`ClerkProvider`, custom or standard Clerk gates) to enforce that only authenticated users can access views. Communicates with FastAPI backend using a JWT Bearer token via a custom `authFetch` wrapper.
- **FastAPI Backend**: Exposes SQLite-backed CRUD endpoints for managing the portfolio. Verifies incoming Clerk JWT session tokens locally or via JWKS cache. Fetches live real estate data from RapidAPI (Zillow or similar) on-demand, caching results to avoid rate limits, and exposes it via `/api/dashboard` or `/api/market-data`.
- **Database**: SQLite (`backend/portfolio.db`) managed via SQLAlchemy ORM.

## Code Layout
- `backend/`
  - `main.py`: Main FastAPI server, routes, and CORS setup.
  - `auth.py`: Token extraction, decoding, signature verification, and user injection.
  - `database.py`: SQLAlchemy session engine and context manager.
  - `models.py`: Database models (User, Property, Tenant, Transaction).
- `frontend/`
  - `src/App.tsx`: App layout, navigation, and auth gates.
  - `src/auth.ts`: Auth utility functions and custom fetch wrapper (`authFetch`).
  - `src/components/`:
    - `Dashboard.tsx`: Metrics, charts, and alerts. Shows live market data.
    - `Login.tsx`: Login view, updated to work with Clerk components.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | E2E Testing Track | Define requirements, design test cases (Tiers 1-4), create testing scripts and harness, publish `TEST_READY.md`. | None | DONE |
| 2 | Clerk Authentication | Implement `@clerk/clerk-react` in frontend; implement Clerk JWT verification in `backend/auth.py`; update protected endpoints to enforce Clerk auth. | M1 | IN_PROGRESS (Conv ID: 1a7c8989-dedb-46c3-a58c-0b3ff23834e1) |
| 3 | Live Market Data | Implement RapidAPI client (Zillow API) in Python backend; fetch and parse live data; expose via backend; render in React dashboard. | M1 | IN_PROGRESS (Conv ID: 34440ed6-e239-4150-86ed-53df98ab4e10) |
| 4 | E2E Verification | Integrate frontend/backend, run full E2E test suite (Tiers 1-4), verify 100% pass rate. | M2, M3 | PLANNED |
| 5 | Adversarial Hardening | Run Tier 5 Challengers to verify edge-case robustness, code layout compliance, security boundaries; fix any gaps. | M4 | PLANNED |

## Interface Contracts

### Frontend ↔ Backend (Authentication)
- **Header**: `Authorization: Bearer <clerk_session_token>`
- **Validation**: Backend decodes JWT using Clerk public keys (JWKS) or local mock keys in development/testing.
- **Error**: Return `401 Unauthorized` with `{"detail": "Could not validate credentials"}` if token is missing, expired, or invalid.

### Backend ↔ RapidAPI (Zillow/Market Data)
- **Endpoint**: RapidAPI Zillow API (e.g. search or rent estimate).
- **Headers**:
  - `X-RapidAPI-Key`: API Key
  - `X-RapidAPI-Host`: Endpoint Host
- **Payload**: JSON response containing properties list, market averages, or valuation estimates.
- **Fallback**: Returns mock/cached data if request fails, is rate-limited, or if the API key is not configured.

### Frontend ↔ Backend (Dashboard & Market Data API)
- **Endpoint**: `/api/dashboard` or `/api/market-data`
- **Response**:
  ```json
  {
    "metrics": {
      "totalPortfolioValue": number,
      "monthlyRevenue": number,
      "avgRoi": number,
      "occupancyRate": number
    },
    "chartData": [
      { "month": "Jan", "revenue": number, "expenses": number }
    ],
    "alerts": [
      { "id": number, "type": "warning" | "info" | "danger" | "success", "title": "...", "description": "...", "time": "..." }
    ],
    "marketData": {
      "cityAveragePrice": number,
      "cityAverageRent": number,
      "listings": [
        { "address": "...", "price": number, "beds": number, "baths": number }
      ]
    }
  }
  ```
