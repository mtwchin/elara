# Project: Elara

## Architecture
- **Vite/React Frontend**: Coordinates user views (Dashboard, Properties, Tenants, Transactions, Financials, Calendar, Tools). Uses local JWT Bearer token authentication via a custom `authFetch` wrapper. Configured to point to the backend via `VITE_API_URL`.
- **FastAPI Backend**: Exposes SQLite-backed CRUD endpoints for managing the portfolio, creating local JWT tokens (`backend/auth.py`), and integrating with Google Gemini AI (`backend/agent.py`) for automated insights and letter drafting.
- **Database**: SQLite (`backend/portfolio.db`) managed via SQLAlchemy ORM, seeded with realistic 12-month data.
- **Docker Orchestration**: The entire stack is containerized using Docker Compose for seamless building and running.

## Code Layout
- `backend/`
  - `main.py`: Main FastAPI server, CRUD routes, and reporting logic (Cash Flow, Rent Roll, Schedule E).
  - `auth.py`: Local JWT creation and verification using HS256.
  - `database.py`: SQLAlchemy session engine and context manager.
  - `models.py`: Database models (User, Property, Tenant, Transaction, Mortgage, Document).
  - `agent.py`: Google Gemini-powered insights, renewal letter drafting, and portfolio advice.
  - `Dockerfile`: Python 3.12 slim container setup.
- `frontend/`
  - `src/App.tsx`: App layout, navigation, and auth gates.
  - `src/auth.ts`: Auth utility functions and custom fetch wrapper (`authFetch`).
  - `src/components/`:
    - `Dashboard.tsx`: Metrics, charts, and alerts. Shows live market data.
    - `Tools.tsx`: Five financial calculators (Deal Analyzer, Mortgage Calculator, Pro Forma Builder, Depreciation Tracker, Refinance Analyzer).
    - `Calendar.tsx`: Property lease and schedule visualization.
    - `Home.tsx`: Public landing page.
  - `Dockerfile`: Node 20 build output served by Nginx.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | E2E Testing Track | Define requirements, design test cases (Tiers 1-4), create testing scripts and harness. | None | DONE |
| 2 | Local JWT Authentication | Implement local HS256 JWT auth across frontend and backend; remove mock interceptors. | M1 | DONE |
| 3 | Live Market Data | Implement RapidAPI client (Zillow API) in Python backend; fetch, cache, and serve to dashboard. | M1 | DONE |
| 4 | Investor-Grade v2 (Sprint 2) | Logo navigation, Home page credibility overhaul, 5 financial calculators (Tools view). | None | DONE |
| 5 | Full-Stack Integration (Sprint 3) | Swap mock data for real FastAPI connection, integrate Google Gemini AI, add Docker, add advanced reporting. | M2, M3 | DONE (2026-06-17) |
| 6 | E2E Verification | Integrate frontend/backend, run full E2E test suite (Tiers 1-4), verify 100% pass rate. | M5 | PLANNED |
| 7 | Adversarial Hardening | Run Tier 5 Challengers to verify edge-case robustness, code layout compliance, security boundaries; fix any gaps. | M6 | PLANNED |

## Interface Contracts

### Frontend ↔ Backend (Authentication)
- **Header**: `Authorization: Bearer <jwt_token>`
- **Validation**: Backend decodes JWT using `RE_PORTFOLIO_JWT_SECRET`.
- **Error**: Return `401 Unauthorized` with `{"detail": "Could not validate credentials"}` if token is missing, expired, or invalid.

### Backend ↔ AI (Google Gemini)
- **Endpoint**: Google Generative AI SDK
- **Environment**: `GOOGLE_API_KEY`
- **Fallback**: Gracefully handles missing API keys by returning fallback text or a specific `{"error": "..."}` structure to the frontend.

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
