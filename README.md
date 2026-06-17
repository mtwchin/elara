# Elara: Real Estate Portfolio Manager

Elara is a comprehensive real estate portfolio management system featuring a Vite/React frontend, a FastAPI backend, and integrated live market data via RapidAPI. It uses Google Gemini AI to provide actionable portfolio insights and automated document extraction.

## Features
- **Portfolio Tracking**: Manage properties, tenants, and transactions.
- **AI-Powered Insights**: Google Gemini AI provides rent optimization, predictive maintenance alerts, and document data extraction (receipts/invoices).
- **Financial Analytics**: Dashboard with metrics and charts for ROI, Cash Flow, Rent Roll, Schedule E, and Lender Metrics.
- **Live Market Data**: Integrated with Zillow API (via RapidAPI) for real-time market averages and comparables.
- **Secure Authentication**: Local JWT-powered authentication for secure access.

## Architecture
- **Frontend**: Vite + React 19 + TypeScript + Vanilla CSS (Glassmorphism)
- **Backend**: FastAPI + SQLAlchemy + SQLite + Google Generative AI
- **Testing**: Pytest for E2E and unit testing
- **Orchestration**: Docker Compose for simplified full-stack deployment

## Getting Started

The easiest way to run the entire stack is with Docker Compose.

### Docker Setup (Recommended)
1. Ensure Docker Desktop is running.
2. Provide necessary API keys in `backend/.env` (see `backend/.env.template`).
3. Run: `docker compose up --build`
4. Access the frontend at `http://localhost` and the backend API at `http://localhost:8000`.

### Local Setup (Alternative)

**Backend:**
1. Navigate to `backend/`
2. Create and activate a virtual environment: `python -m venv venv && source venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Seed the database: `python seed.py`
5. Run the server: `uvicorn main:app --reload`

**Frontend:**
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

## Documentation
- [PROJECT.md](./PROJECT.md) - Project overview and milestones.
- [HANDOFF.md](./HANDOFF.md) - Comprehensive status and future planning document.
- [TEST_INFRA.md](./TEST_INFRA.md) - Testing strategy and infrastructure.
- [TEST_READY.md](./TEST_READY.md) - E2E test scenarios and requirements.

## Contributors
- Isaac
- Matthew
