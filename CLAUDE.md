# Elara

## Stack
- **Backend**: FastAPI + SQLAlchemy + SQLite — `cd backend && source venv/bin/activate && uvicorn main:app --reload`
- **Frontend**: React 19 + TypeScript + Vite — `cd frontend && npm run dev`
- **Auth**: Local JWT (`auth.py` — register/login endpoints, HS256 tokens). Clerk is installed but not wired.
- **Database**: SQLite file at `backend/portfolio.db` — seed with `cd backend && python seed.py`
- **AI**: Google Gemini (`google-generativeai` package, `GOOGLE_API_KEY` env var)
- **Docker**: `docker compose up --build` — builds backend + frontend, serves on ports 8000 and 80
- **Testing**: pytest E2E suite at `tests/e2e/` (35 tests across 5 tiers, all expect real auth + market data)

## Current State (2026-06-17, Sprint 3 shipped)
- **Backend**: Fully functional. All CRUD routes wired, auth works, AI endpoints call Gemini.
- **Frontend**: Hits real backend at `http://localhost:8000` (or `VITE_API_URL` in prod). No mock interceptor.
- **Auth**: `login()` and `register()` hit `/api/auth/login-json` and `/api/auth/register`. JWT stored in localStorage.
- **AI**: `agent.py` uses Google Gemini for renewal letters, portfolio advice, document extraction, maintenance alerts. Gracefully returns error dict when `GOOGLE_API_KEY` is absent.
- **Seed data**: 3 properties, 3 tenants (one expiring, one leaving), 12 months of realistic transactions.
- **Sprint 3**: Swapped Anthropic → Gemini, fixed import bug, seeded DB, Dockerized, production env config.
- **Sprint 4** (2026-06-23): Agent orchestration (BaseAgent, 8 agent classes, AgentOrchestrator); new API routes (`/api/agents/*`, `/api/tenant-portal/me`); Maintenance.tsx and TenantPortal.tsx components; Dashboard health check; Transactions auto-categorize; Tools deal scorer; Calendar renewal workflow; shared `types.ts`; ErrorBoundary; CORS hardening; debug logging gated; `/api/health` probe.
- **Sprint 5** (2026-06-23): Pagination on list endpoints (skip/limit wrapper); `/api/transactions/export.csv`; property image upload/serve (`/api/properties/{id}/image`); document viewer modal in Transactions; CSV export button in Transactions UI.

## Key Files
- `backend/main.py` — all API routes (prefix: `/api/`)
- `backend/auth.py` — JWT creation + verification (local HS256, with optional Clerk RS256 fallback)
- `backend/models.py` — Property, Tenant, Transaction, Mortgage, Document ORM models
- `backend/agent.py` — Gemini-powered AI: insights, renewal letters, portfolio advice, document extraction
- `backend/database.py` — SQLAlchemy engine + `get_db` dependency
- `backend/seed.py` — Demo user + 3 properties + 3 tenants + 12-month transactions
- `backend/Dockerfile` — Python 3.12 slim image
- `frontend/src/App.tsx` — Root layout: Home (public) → Login → Dashboard (authed)
- `frontend/src/auth.ts` — Auth utilities + `API_BASE` (reads `VITE_API_URL` env var)
- `frontend/src/index.css` — Full design system (light theme, glass panels, font imports)
- `frontend/src/components/Home.tsx` — Public landing page (hero, testimonials, trust badges, CTA)
- `frontend/src/components/Dashboard.tsx` — Main dashboard (metrics, charts, alerts)
- `frontend/src/components/Tools.tsx` — 5 financial calculators (all client-side)
- `frontend/src/components/Calendar.tsx` — Calendar view (exists, not yet wired to backend)
- `frontend/Dockerfile` — Node 20 build → nginx serve (VITE_API_URL as build arg)
- `frontend/nginx.conf` — SPA routing fallback config
- `docker-compose.yml` — Orchestrates backend + frontend

## Data Models
- **Property**: address, property_type, purchase_price, purchase_date, status
- **Tenant**: name, email, phone, property_id (FK), lease_start, lease_end, rent_amount, intent
- **Transaction**: property_id (FK), transaction_date, amount, category, type (income/expense), status, description
- **Mortgage**: property_id (FK, unique), principal, interest_rate, term_months, lender, monthly_pi, monthly_escrow, origination_date
- **Document**: transaction_id/property_id (FK, nullable), filename, storage_path, MIME type, AI extraction fields

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

## Environment Variables
```
# Backend (.env or Railway env vars)
RE_PORTFOLIO_JWT_SECRET=long_random_secret   # required
GOOGLE_API_KEY=your_key                      # required for AI features
RAPIDAPI_KEY=                                # optional, Zillow market data

# Frontend (build arg for Docker / Vercel env var)
VITE_API_URL=https://your-backend.railway.app  # defaults to http://localhost:8000
```
See `backend/.env.template` and `frontend/.env.example` for full reference.

## Quick Start (local)
```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.template .env   # fill in RE_PORTFOLIO_JWT_SECRET + GOOGLE_API_KEY
python seed.py
uvicorn main:app --reload

# Frontend (new terminal)
cd frontend && npm install && npm run dev
# → http://localhost:5173, login: demo@example.com / demo1234
```

## Docker
```bash
cp backend/.env.template backend/.env   # fill in secrets
VITE_API_URL=http://localhost:8000 docker compose up --build
# → http://localhost (frontend) + http://localhost:8000 (backend)
```

## Deploy (Railway + Vercel)
1. **Backend** → New Railway project, deploy `./backend`, set env vars: `RE_PORTFOLIO_JWT_SECRET`, `GOOGLE_API_KEY`
2. **Frontend** → Vercel, root = `./frontend`, set `VITE_API_URL` = Railway backend URL

## Remaining Work (Priority Order)
1. Push local commits to GitHub (PAT needs `Contents: write` scope — current PAT is read-only)
2. Run E2E test suite: `cd tests && pytest e2e/ -v` and fix failures for new paginated responses
3. Wire Clerk auth end-to-end (optional — local JWT works fine for v1)
4. RapidAPI/Zillow integration (optional — fallback heuristic already works)
5. Real-time maintenance status notifications (WebSocket or SSE)
6. Mobile responsiveness audit

## See Also
- `HANDOFF.md` — Comprehensive project handoff documentation
- `PROJECT.md` — Architecture, milestones, and API interface contracts
- `TEST_READY.md` — E2E test suite documentation (35 tests, Tiers 1-5)
