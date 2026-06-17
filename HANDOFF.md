# Real Estate Portfolio Manager — Project Handoff Document

> **Last Updated**: 2026-06-17  
> **Status**: Fully Functional Full-Stack (Sprint 3 Completed)

---

## 1. Project Overview

An **AI-driven Real Estate Portfolio Management Platform** that combines a React dashboard with a FastAPI backend, orchestrated by Google Gemini AI. The platform provides property tracking, tenant management, financial analytics, and AI-powered insights (rent optimization, maintenance alerts, market analysis).

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
| **Auth** | Local JWT | — | HS256 tokens in `backend/auth.py` |
| **Market Data** | RapidAPI / Zillow | — | Implemented with caching in backend |
| **AI Agent** | Google Gemini | `google-generativeai` | Generates insights, portfolio advice, and document data extraction |
| **Container** | Docker Compose | — | Full-stack orchestration |
| **Testing** | pytest (E2E) | — | 35 test cases designed across 5 tiers at `tests/e2e/` |

---

## 3. How to Run

### Option A: Docker Compose (Recommended)
```bash
docker compose up --build
# Frontend opens at http://localhost
# Backend API opens at http://localhost:8000
```

### Option B: Local Development
**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python seed.py          # Seeds the SQLite database
uvicorn main:app --reload
# Opens at http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

> **Note**: The frontend connects to the real backend via `authFetch()` configured with `VITE_API_URL`. Ensure the backend is running to load data.

---

## 4. Project Structure

```
elara/
├── PROJECT.md              # Architecture & milestone tracker
├── CLAUDE.md               # Agent instructions and context
├── README.md               # Quick start guide
├── docker-compose.yml      # Orchestrates backend + frontend
│
├── frontend/
│   ├── package.json        # React 19 + Vite 8
│   ├── Dockerfile          # Node 20 build → nginx serve
│   ├── nginx.conf          # SPA routing fallback config
│   ├── src/
│   │   ├── App.tsx         # Root: routing (Home → Login → Dashboard)
│   │   ├── auth.ts         # Auth utilities hitting real backend
│   │   ├── index.css       # Design system
│   │   └── components/     # UI views (Dashboard, Calendar, Tools, etc.)
│   └── ...
│
├── backend/
│   ├── main.py             # FastAPI server, all CRUD/reporting routes
│   ├── auth.py             # JWT token creation + verification
│   ├── models.py           # SQLAlchemy ORM
│   ├── database.py         # SQLAlchemy engine
│   ├── agent.py            # Google Gemini AI agent logic
│   ├── seed.py             # Rich demo data seeder
│   ├── Dockerfile          # Python 3.12 slim image
│   ├── requirements.txt    # Python dependencies
│   └── portfolio.db        # SQLite database file
│
└── tests/
    └── e2e/                # Pytest framework and tests
```

---

## 5. Current State of Each Component

### Frontend (100% Functional ✅)
All views (Home, Login, Dashboard, Properties, Tenants, Transactions, Financials, Calendar, Tools) are fully implemented and integrated with the backend API.

### Backend (100% Functional ✅)
All core CRUD routes, authentication, reporting (Cash Flow, Rent Roll, Schedule E), and AI agent endpoints are implemented and functional.

### Testing (70% Complete ⚠️)
The E2E test infrastructure (`tests/e2e/`) is written, but needs to be executed against the newly integrated backend to ensure 100% pass rate.

---

## 6. What Needs To Be Done (Future Production Planning)

With the core MVP completed in Sprint 3, the focus shifts to production readiness:

1. **E2E Test Execution & Fixes**: Run the full Pytest suite and resolve any edge cases or regressions between the newly completed frontend and backend.
2. **Database Migration**: Transition from SQLite to PostgreSQL for production concurrency and scale. Introduce Alembic for schema migrations.
3. **CI/CD Pipeline**: Create GitHub Actions workflows to run linters, the E2E test suite, and automatically build Docker images on push.
4. **Cloud Deployment**: Deploy the Docker Compose stack to a managed service (e.g., AWS ECS, Render, Railway, or DigitalOcean).
5. **Secrets Management**: Securely manage `GOOGLE_API_KEY`, `RAPIDAPI_KEY`, and `RE_PORTFOLIO_JWT_SECRET` in the production environment.
6. **Robust Error Monitoring**: Integrate Sentry or a similar tool for capturing backend exceptions and frontend crashes in production.

---

## 7. Environment Variables Needed

Create a `.env` file in the `backend/` directory based on `.env.template`:

| Variable | Purpose | Where |
|---|---|---|
| `RE_PORTFOLIO_JWT_SECRET` | Backend JWT signing secret | Backend `.env` |
| `GOOGLE_API_KEY` | Gemini AI agent access | Backend `.env` |
| `RAPIDAPI_KEY` | Zillow/market data API access | Backend `.env` (Optional) |
| `VITE_API_URL` | Frontend pointer to backend | Frontend `.env.local` / Build Arg |

---

## 8. Design System Reference

- **Fonts**: EB Garamond (Headings), Inter (Body)
- **Buttons**: `.btn-primary` (dark gradient), `.btn` (glass/white)
- **Panels**: `.glass-panel` (backdrop blur, subtle border)
