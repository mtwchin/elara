# Real Estate Portfolio Manager — Project Handoff Document

> **Last Updated**: 2026-06-17  
> **Status**: Active Development (Frontend functional, Backend partially implemented)

---

## 1. Project Overview

An **AI-driven Real Estate Portfolio Management Platform** that combines a React dashboard with a FastAPI backend, designed to be orchestrated by a multi-agent AI system. The platform provides property tracking, tenant management, financial analytics, and AI-powered insights (rent optimization, predictive maintenance, market analysis).

### Vision
A premium SaaS-style tool where real estate investors can manage their entire portfolio—properties, tenants, transactions, and financials—with AI agents continuously analyzing data and surfacing actionable recommendations.

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Frontend** | React + TypeScript + Vite | React 19, Vite 8 | Single-page app at `frontend/` |
| **Styling** | Vanilla CSS + CSS Custom Properties | — | Light theme, EB Garamond + Inter fonts |
| **Backend** | FastAPI + SQLAlchemy | — | Python server at `backend/` |
| **Database** | SQLite | — | File at `backend/portfolio.db` |
| **Auth** | Clerk (planned) | `@clerk/clerk-react ^5.61.8` | Package installed, **not yet wired up**. Currently uses mock login. |
| **Market Data** | RapidAPI / Zillow (planned) | — | **Not yet implemented**. Backend stubs exist. |
| **AI Agent** | Anthropic SDK (planned) | — | `backend/agent.py` exists but imports broken `google.antigravity` |
| **Testing** | pytest (E2E) | — | 35 test cases designed across 5 tiers at `tests/e2e/` |

---

## 3. How to Run

### Frontend (Working ✅)
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### Backend (Partially Working ⚠️)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python seed.py          # Seeds the SQLite database
uvicorn main:app --reload
# Opens at http://localhost:8000
```

> **Important**: The frontend currently uses **mock data** via intercepted `authFetch()` calls in `frontend/src/auth.ts`. It does NOT require the backend to be running for the UI to display. Once the backend is properly wired up, remove the mock interceptor block in `authFetch()`.

---

## 4. Project Structure

```
elara/
├── PROJECT.md              # Architecture & milestone tracker (created by teamwork agents)
├── CLAUDE.md               # Agent instructions for Claude Code
├── TEST_INFRA.md           # E2E test infrastructure documentation
├── TEST_READY.md           # E2E test readiness report (35 tests, Tiers 1-5)
│
├── frontend/
│   ├── package.json        # React 19 + Vite 8 + @clerk/clerk-react
│   ├── src/
│   │   ├── App.tsx         # Root: routing (Home → Login → Dashboard)
│   │   ├── auth.ts         # Auth utilities + mock API interceptor
│   │   ├── index.css       # Design system (Light theme, EB Garamond + Inter)
│   │   └── components/
│   │       ├── Home.tsx        # Public landing page (hero + demo preview)
│   │       ├── Login.tsx       # Authentication form
│   │       ├── Dashboard.tsx   # Main dashboard with metrics, charts, alerts
│   │       ├── Properties.tsx  # Property table view
│   │       ├── Tenants.tsx     # Tenant management view
│   │       ├── Transactions.tsx# Transaction log view
│   │       └── Financials.tsx  # Financial analytics view
│   └── ...
│
├── backend/
│   ├── main.py             # FastAPI server with all API routes (/api/*)
│   ├── auth.py             # JWT token verification (Clerk JWKS planned)
│   ├── models.py           # SQLAlchemy ORM: Property, Tenant, Transaction
│   ├── database.py         # SQLAlchemy engine + get_db dependency
│   ├── agent.py            # AI agent skeleton (BROKEN — needs Anthropic SDK)
│   ├── seed.py             # Database seeder script
│   ├── patch_main.py       # Teamwork-generated patches (may be partial)
│   ├── requirements.txt    # Python dependencies
│   └── portfolio.db        # SQLite database file
│
├── tests/
│   └── e2e/
│       ├── conftest.py         # Pytest fixtures (FastAPI test client, mock DB)
│       ├── test_auth.py        # 10 auth tests (Clerk JWT verification)
│       ├── test_market_data.py # 10 market data integration tests
│       └── test_scenarios.py   # 15 end-to-end scenario tests
│
└── .agents/                # Teamwork system working directories (can be deleted)
    ├── ORIGINAL_REQUEST.md
    ├── orchestrator/
    ├── sentinel/
    ├── sub_orch_clerk_auth/
    ├── sub_orch_e2e_testing/
    ├── sub_orch_live_market/
    ├── worker_clerk_auth/
    ├── worker_e2e_impl/
    └── ... (16 agent working dirs total)
```

---

## 5. Current State of Each Component

### Frontend (90% Complete ✅)

| Component | Status | Notes |
|---|---|---|
| `Home.tsx` | ✅ Done | Public landing page with hero section, demo preview, CTA buttons |
| `Login.tsx` | ✅ Done | Login/register form. Currently uses **mock login** (no real auth) |
| `Dashboard.tsx` | ✅ Done | Metrics cards, bar chart, AI alerts. Uses **mock data** from `authFetch` |
| `Properties.tsx` | ✅ Done | Table view with status badges. Uses **mock data** |
| `Tenants.tsx` | ✅ Done | Tenant list. Fetches from `/api/tenants` (mock returns `[]`) |
| `Transactions.tsx` | ✅ Done | Transaction log. Fetches from `/api/transactions` (mock returns `[]`) |
| `Financials.tsx` | ✅ Done | Financial analytics. Fetches from `/api/financials` (mock returns `[]`) |
| `App.tsx` | ✅ Done | Routing: `!authed` → Home → Login → Dashboard with pill navbar |
| `index.css` | ✅ Done | Light theme, EB Garamond serif headings, Inter UI text, glass panels |
| `auth.ts` | ⚠️ Mock | `authFetch()` intercepts API calls and returns mock data. `login()` is mocked. |

### Backend (40% Complete ⚠️)

| Component | Status | Notes |
|---|---|---|
| `main.py` | ⚠️ Partial | Routes exist but need Clerk auth middleware wired in |
| `auth.py` | ⚠️ Partial | JWT verification structure exists, needs Clerk JWKS integration |
| `models.py` | ✅ Done | Property, Tenant, Transaction models defined |
| `database.py` | ✅ Done | SQLAlchemy engine configured |
| `seed.py` | ✅ Done | Seeds sample properties, tenants, transactions |
| `agent.py` | ❌ Broken | Imports `google.antigravity` (doesn't exist). Needs rewrite with Anthropic SDK |
| `patch_main.py` | ⚠️ Partial | Generated by teamwork agents, may contain incomplete patches |
| `portfolio.db` | ✅ Done | Seeded SQLite database |

### Testing (70% Complete)

| Component | Status | Notes |
|---|---|---|
| `conftest.py` | ✅ Done | Pytest fixtures for FastAPI test client |
| `test_auth.py` | ✅ Written | 10 tests for Clerk JWT auth (will fail until auth is implemented) |
| `test_market_data.py` | ✅ Written | 10 tests for RapidAPI integration (will fail until implemented) |
| `test_scenarios.py` | ✅ Written | 15 E2E scenarios (will fail until backend is complete) |

---

## 6. What Needs To Be Done (Remaining Work)

### Priority 1: Wire Up Real Authentication
1. **Frontend**: Replace the mock `login()` in `auth.ts` with real Clerk authentication using `@clerk/clerk-react` (already installed in `package.json`).
2. **Backend**: Complete `auth.py` to verify Clerk JWT tokens via JWKS.
3. **Remove mock interceptor**: Delete the mock response block at the top of `authFetch()` in `auth.ts`.

### Priority 2: Connect Frontend to Real Backend
1. Start the FastAPI backend (`uvicorn main:app --reload`).
2. Ensure CORS is configured for `localhost:5173`.
3. Remove mock data from `authFetch()` so real API calls go through.
4. Verify all CRUD routes work: `/api/dashboard`, `/api/properties`, `/api/tenants`, `/api/transactions`.

### Priority 3: Live Market Data Integration
1. Set up a RapidAPI account and get a Zillow API key.
2. Create a RapidAPI client in the backend that fetches live property data.
3. Expose via `/api/market-data` endpoint.
4. Render market data in `Dashboard.tsx`.

### Priority 4: Fix AI Agent
1. Rewrite `backend/agent.py` to use the Anthropic SDK (`claude-sonnet-4-6`) instead of the broken `google.antigravity` import.
2. Wire up agent endpoints at `/api/agents/<name>`.

### Priority 5: Run E2E Tests
1. Once auth + market data are implemented, run: `cd tests && pytest e2e/ -v`
2. Target: 100% pass rate across all 35 tests.

### Priority 6: UI Polish (Optional)
- Current design: Light theme inspired by Cluely.com (EB Garamond headers, Inter body text, glass panels, dark CTA buttons).
- The `Tenants`, `Transactions`, and `Financials` pages currently show empty states since their mock data returns `[]`. These need richer mock data or real backend connections.

---

## 7. Design System Reference

### Fonts
- **Display/Headers (h1, metric values)**: `EB Garamond` (Google Fonts, serif)
- **Body/UI Text**: `Inter` (Google Fonts, sans-serif)

### Color Tokens
| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#f9fafb` | Page background |
| `--bg-secondary` | `#ffffff` | Card/panel backgrounds |
| `--bg-tertiary` | `#f3f4f6` | Subtle backgrounds |
| `--text-primary` | `#111827` | Headings, primary text |
| `--text-secondary` | `#6b7280` | Captions, labels |
| `--accent-purple` | `#9333ea` | Accent color |
| `--accent-blue` | `#3b82f6` | Links, info states |
| `--glass-border` | `rgba(0,0,0,0.08)` | Panel borders |

### Button System
- `.btn`: White background, subtle border, dark text
- `.btn-primary`: Dark gradient (`#18181b → #09090b`), white text, shadow

### Panel System
- `.glass-panel`: White glass with `backdrop-filter: blur(20px)`, 16px border-radius, subtle shadow
- Hover: lifts 2px with deeper shadow

---

## 8. Agent Orchestration History

This project was built using a multi-agent AI system. Here's the full history of agents that were used:

### Gemini Antigravity Agents (Session 1)
| Agent | Role | Status |
|---|---|---|
| `customer-persona` | Simulates a real estate investor customer | Completed feedback cycle |
| `product-owner` | Translates customer needs into technical requirements | Completed requirements |
| `senior-swe-pm` | Project manager, dispatches engineering agents | Completed initial sprint |
| `frontend-engineer` | Built React dashboard with glassmorphism design | Completed |
| `backend-agent-engineer` | Set up FastAPI server and agent skeleton | Completed |
| `database-architect` | Created SQLAlchemy models and seed script | Completed |
| `ui-ux-designer` | Revamped UI to Apple/Cluely aesthetic | Completed |

### Teamwork System Agents (Session 2 — Hit quota limit)
| Agent | Role | Status |
|---|---|---|
| `orchestrator` | Top-level project coordinator | Stopped (quota) |
| `sentinel` | Health monitoring and liveness checks | Stopped (quota) |
| `sub_orch_e2e_testing` | Managed E2E test suite creation | ✅ Completed |
| `sub_orch_clerk_auth` | Managing Clerk authentication implementation | ⚠️ In Progress (stopped) |
| `sub_orch_live_market` | Managing RapidAPI/Zillow integration | ⚠️ In Progress (stopped) |
| `worker_clerk_auth` | Implementing Clerk JWT verification | ⚠️ In Progress (stopped) |
| `worker_e2e_impl` | Implemented test infrastructure | ✅ Completed |
| `worker_doc_gen` | Generated PROJECT.md documentation | ✅ Completed |

---

## 9. Key Files to Read First (for a New Agent)

1. **This file** (`HANDOFF.md`) — You are here
2. **[PROJECT.md](PROJECT.md)** — Architecture, milestones, and API contracts
3. **[CLAUDE.md](CLAUDE.md)** — Agent conventions and known issues
4. **[frontend/src/auth.ts](frontend/src/auth.ts)** — The mock interceptor that needs to be removed
5. **[frontend/src/index.css](frontend/src/index.css)** — The full design system
6. **[backend/main.py](backend/main.py)** — All API routes

---

## 10. Environment Variables Needed

| Variable | Purpose | Where |
|---|---|---|
| `CLERK_PUBLISHABLE_KEY` | Clerk frontend auth | Frontend `.env` |
| `CLERK_SECRET_KEY` | Clerk backend JWT verification | Backend `.env` |
| `RAPIDAPI_KEY` | Zillow/market data API access | Backend `.env` |
| `ANTHROPIC_API_KEY` | Claude AI agent | Backend `.env` |

None of these are currently configured. The app runs entirely on mock data.

---

## 11. Quick Resume Checklist

If you're picking this project back up with a new agent orchestration setup:

- [ ] Read this document fully
- [ ] Run `cd frontend && npm install && npm run dev` to verify the UI works
- [ ] Decide on authentication strategy (Clerk is already in `package.json`, or swap for another)
- [ ] Wire up the backend: `cd backend && source venv/bin/activate && uvicorn main:app --reload`
- [ ] Remove the mock interceptor in `frontend/src/auth.ts` (lines 27-53)
- [ ] Implement real Clerk auth or your chosen auth in `backend/auth.py`
- [ ] Set up RapidAPI key and implement market data fetching
- [ ] Fix `backend/agent.py` (replace `google.antigravity` with Anthropic SDK)
- [ ] Run tests: `cd tests && pytest e2e/ -v`
- [ ] The `.agents/` directory contains old teamwork working files — safe to delete
iles — safe to delete
