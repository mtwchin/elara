# Real Estate Portfolio Manager

## Stack
- **Backend**: FastAPI + SQLAlchemy + SQLite — `cd backend && source venv/bin/activate && uvicorn main:app --reload`
- **Frontend**: React 19 + TypeScript + Vite — `cd frontend && npm run dev`
- **Auth**: Clerk (`@clerk/clerk-react` installed but NOT wired up). Frontend currently uses mock login.
- **Database**: SQLite file at `backend/portfolio.db` — seed with `cd backend && python seed.py`
- **Testing**: pytest E2E suite at `tests/e2e/` (35 tests across 5 tiers, all expect real auth + market data)

## Current State (2026-06-17)
- **Frontend**: Fully functional with mock data. Light theme, EB Garamond + Inter typography.
- **Backend**: Routes exist in `main.py` but auth middleware is not wired. Agent module is broken.
- **Auth**: `frontend/src/auth.ts` contains a mock interceptor (lines ~27-53) that fakes API responses. Remove this once the backend is running.
- **Mock Login**: `login()` in `auth.ts` sets a fake token. Replace with real Clerk auth.

## Key Files
- `backend/main.py` — all API routes (prefix: `/api/`)
- `backend/auth.py` — JWT verification structure (needs Clerk JWKS)
- `backend/models.py` — Property, Tenant, Transaction ORM models
- `backend/agent.py` — AI agent skeleton (**BROKEN** — imports nonexistent `google.antigravity`)
- `backend/database.py` — SQLAlchemy engine + `get_db` dependency
- `frontend/src/App.tsx` — Root layout: Home (public) → Login → Dashboard (authed)
- `frontend/src/auth.ts` — Auth utilities + **mock API interceptor** (remove when backend is ready)
- `frontend/src/index.css` — Full design system (light theme, glass panels, font imports)
- `frontend/src/components/Home.tsx` — Public landing page
- `frontend/src/components/Dashboard.tsx` — Main dashboard (metrics, charts, alerts)

## Data Models
- **Property**: address, property_type, purchase_price, purchase_date, status
- **Tenant**: name, email, phone, property_id (FK), lease_start, lease_end, rent_amount, intent
- **Transaction**: property_id (FK), transaction_date, amount, category, type (income/expense), status

## Design System
- **Fonts**: EB Garamond (display headings), Inter (UI body text)
- **Theme**: Light mode only (white backgrounds, dark text, glass panels)
- **Buttons**: `.btn` (white/subtle), `.btn-primary` (dark gradient, white text)
- **Panels**: `.glass-panel` (white glass, blur, 16px radius, hover lift)
- **Colors**: `--bg-primary: #f9fafb`, `--text-primary: #111827`, `--accent-purple: #9333ea`

## Conventions
- All API routes prefixed `/api/`, agent routes at `/api/agents/<name>`
- DB session via `get_db` dependency injection — never open sessions manually in routes
- Frontend fetch: always use loading/error/data state pattern with useEffect
- Styling: CSS custom properties defined in `index.css` (`var(--glass-bg)`, etc.)
- Mock data: currently hardcoded in `authFetch()` interceptor in `auth.ts`

## Known Issues
- `backend/agent.py` imports `google.antigravity` — not a real package; needs Anthropic SDK replacement
- `frontend/src/auth.ts` has a mock interceptor that bypasses all API calls — must be removed for real backend
- `login()` function is mocked — sets a fake token without any server call
- `Tenants`, `Transactions`, and `Financials` pages show empty states (mock returns `[]`)
- Clerk is installed (`@clerk/clerk-react`) but not configured — no env vars set
- `.agents/` directory contains old teamwork working files — safe to delete

## Environment Variables Needed
```
# Frontend .env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Backend .env
CLERK_SECRET_KEY=sk_test_...
RAPIDAPI_KEY=...
ANTHROPIC_API_KEY=...
```

## Remaining Work (Priority Order)
1. Wire up Clerk authentication (frontend + backend)
2. Remove mock interceptor from `auth.ts` and connect to real backend
3. Implement RapidAPI/Zillow market data integration
4. Fix `agent.py` with Anthropic SDK
5. Run E2E test suite: `cd tests && pytest e2e/ -v`
6. Add richer data to Tenants/Transactions/Financials pages

## See Also
- `HANDOFF.md` — Comprehensive project handoff documentation
- `PROJECT.md` — Architecture, milestones, and API interface contracts
- `TEST_READY.md` — E2E test suite documentation (35 tests, Tiers 1-5)
