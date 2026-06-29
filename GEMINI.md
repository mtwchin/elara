# Elara Project Instructions

## Project Overview
Elara is an AI-driven real estate portfolio management platform designed to help property investors manage properties, tenants, and financial transactions. It features a modern Single Page Application (SPA) frontend and a RESTful API backend, integrated with Google Gemini for AI insights and Zillow (via RapidAPI) for live market data.

### Architecture Stack
*   **Frontend**: React 19, Vite 8, TypeScript, Vanilla CSS (Glassmorphism design system).
*   **Backend**: Python 3.12, FastAPI, SQLAlchemy, SQLite (Development ready) / PostgreSQL.
*   **AI Integration**: Google Generative AI (`google-generativeai`).
*   **Authentication**: Local JWT-powered authentication (HS256, bcrypt).
*   **Testing**: Pytest (E2E, API, and Unit testing) with `respx` for mock third-party API calls.
*   **Deployment**: Containerized with Docker Compose.

## Building and Running

### Using Docker (Recommended)
1.  Ensure you have a `.env` file in the `backend/` directory (e.g., copied from `backend/.env.template` with necessary keys: `RE_PORTFOLIO_JWT_SECRET`, `GOOGLE_API_KEY`, etc.).
2.  Run the application stack:
    ```bash
    docker compose up --build
    ```

### Local Development (Without Docker)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Testing

The project uses a comprehensive end-to-end (E2E) testing suite located in `tests/e2e/`, emphasizing hermetic execution (no actual network requests).

**Run all backend tests:**
```bash
./backend/venv/bin/pytest tests/e2e/
```

## Development Conventions
*   **Frontend Styling**: Uses pure Vanilla CSS with CSS Custom Properties (Variables). The UI implements a "Glassmorphism" aesthetic (`.glass-panel` with backdrop-blur). Avoid utility-first CSS frameworks like Tailwind.
*   **Authentication**: Strictly local JWT authentication. The frontend uses an `authFetch` wrapper (in `src/auth.ts`) to manage Bearer token injection.
*   **API Design**: The backend provides RESTful JSON endpoints.
*   **AI Integration**: Encapsulated in `backend/agent.py`. The system is designed to degrade gracefully and return fallback JSON if the Google API is unreachable or keys are missing.
*   **Security**: All secrets must reside exclusively on the backend and be loaded via environment variables. The frontend should never possess API keys directly.
