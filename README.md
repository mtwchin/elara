# Elara: Real Estate Portfolio Manager

Elara is a comprehensive real estate portfolio management system featuring a Vite/React frontend, a FastAPI backend, and integrated live market data via RapidAPI.

## Features
- **Portfolio Tracking**: Manage properties, tenants, and transactions.
- **Live Market Data**: Integrated with Zillow API (via RapidAPI) for real-time market insights.
- **Secure Authentication**: Clerk-powered authentication for secure access.
- **Financial Analytics**: Dashboard with metrics and charts for ROI and occupancy tracking.

## Architecture
- **Frontend**: Vite + React + TypeScript + Clerk Auth
- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Testing**: Pytest for E2E and unit testing

## Getting Started

### Backend Setup
1. Navigate to `backend/`
2. Create and activate a virtual environment: `python -m venv venv && source venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Run the server: `uvicorn main:app --reload`

### Frontend Setup
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

## Documentation
- [PROJECT.md](./PROJECT.md) - Project overview and milestones.
- [TEST_INFRA.md](./TEST_INFRA.md) - Testing strategy and infrastructure.
- [TEST_READY.md](./TEST_READY.md) - E2E test scenarios and requirements.
