# Elara Backend Production Readiness

Transition the Elara MVP backend to a scalable, production-ready SaaS application in alignment with Phase 1 & 2 of the ROADMAP. This will involve migrating from SQLite to PostgreSQL, introducing multi-tenancy and RBAC, setting up asynchronous job queues with Celery + Redis, and adding billing and observability integrations.

## User Review Required

> [!IMPORTANT]
> **Data Migration Strategy**: The introduction of multi-tenancy (Organizations and Portfolios) will fundamentally change the `models.py` schema. We will need to decide if we want to write a migration script for existing local `portfolio.db` data or just start fresh with Alembic and a clean PostgreSQL database. I recommend starting fresh for production unless there's critical data in the local SQLite db.

> [!WARNING]
> **Cloud Dependencies**: This plan introduces Redis (for Celery) and PostgreSQL. This means the `docker-compose.yml` will need to be updated, and local development will require these services running.

## Open Questions

> [!IMPORTANT]
> 1. Which Email provider should we integrate for notifications? (e.g., SendGrid, AWS SES, Resend)
> 2. For billing, are we implementing a standard SaaS tiered subscription model via Stripe (e.g., Basic, Pro, Enterprise)?
> 3. Should we enforce PostgreSQL for local development to maintain parity with production, or should we keep SQLite as an option via environment variables?

## Proposed Changes

---

### Database & Schema (Multi-Tenancy)

We will introduce Alembic for migrations and update the schema to support Organizations and Portfolios.

#### [MODIFY] [models.py](file:///Users/mtwchin/workspace/elara/backend/models.py)
- **[NEW]** `Organization` model to represent a business or individual entity.
- **[NEW]** `Portfolio` model to group properties.
- **[NEW]** `UserRole` mapping for RBAC (Owner, Manager, Viewer).
- **[MODIFY]** Link `Property`, `Tenant`, `Transaction` to `Portfolio` and `Organization`.
- **[MODIFY]** `User` to include Stripe Customer ID and Subscription Status.

#### [MODIFY] [database.py](file:///Users/mtwchin/workspace/elara/backend/database.py)
- Switch to reading `DATABASE_URL` from the environment to connect to PostgreSQL.
- Setup connection pooling configurations suitable for production.

#### [NEW] `backend/alembic.ini` & `backend/alembic/`
- Initialize Alembic environment for schema migrations.

---

### Asynchronous Processing (Celery & Redis)

Long-running tasks like Google Gemini AI processing and email dispatching will be moved to a background worker to prevent blocking API requests.

#### [NEW] [worker.py](file:///Users/mtwchin/workspace/elara/backend/worker.py)
- Configure Celery app pointing to Redis broker.
- Define tasks: `process_document_with_ai`, `generate_predictive_insights`, `send_email_notification`.

#### [MODIFY] [agent.py](file:///Users/mtwchin/workspace/elara/backend/agent.py)
- Refactor the current synchronous Google Gemini calls to be triggered via Celery tasks.

#### [MODIFY] [main.py](file:///Users/mtwchin/workspace/elara/backend/main.py)
- Update endpoints (e.g., document upload) to dispatch a Celery task and return a `202 Accepted` with a task ID or use WebSockets/polling for frontend updates.

---

### Integrations & Observability

#### [NEW] [billing.py](file:///Users/mtwchin/workspace/elara/backend/billing.py)
- Stripe integration: Checkout sessions, webhook handler for subscription lifecycle events.

#### [NEW] [email.py](file:///Users/mtwchin/workspace/elara/backend/email.py)
- Email sending utility using the chosen provider (e.g., SendGrid) for transactional emails and tenant invites.

#### [MODIFY] [main.py](file:///Users/mtwchin/workspace/elara/backend/main.py)
- Integrate **Sentry** SDK for error tracking and APM.
- Implement structured logging (e.g., using `structlog` or standard `logging` with JSON formatter).
- Hardening: Set up appropriate CORS origins, rate limiting, and secure headers.

---

### DevOps & CI/CD

#### [MODIFY] [docker-compose.yml](file:///Users/mtwchin/workspace/elara/docker-compose.yml)
- Add `db` (PostgreSQL), `redis`, and `worker` (Celery) services.

#### [NEW] `.github/workflows/ci.yml`
- Setup automated testing (Pytest), linting (Ruff/Flake8), and Docker build checks on push to main/PRs.

## Verification Plan

### Automated Tests
- `pytest tests/` to ensure all existing and new API endpoints function correctly with the multi-tenant schema.
- Celery task unit tests mocking external APIs (Stripe, Gemini, Email).

### Manual Verification
- **Docker Compose**: `docker compose up --build` and verify the entire stack (FastAPI, Postgres, Redis, Celery, Frontend) boots successfully.
- **Tenant Isolation**: Log in as User A and verify they cannot access User B's portfolio or properties.
- **Async Task**: Upload a receipt document and verify the frontend handles the asynchronous extraction gracefully while the Celery worker processes it.

