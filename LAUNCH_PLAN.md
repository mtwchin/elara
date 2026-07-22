# Elara Production Launch Plan

This plan tracks the work needed to move Elara from a polished prototype to a production-ready SaaS product for real users.

## Launch Goal

Ship a secure, reliable MVP for small real estate investors and property managers to manage properties, tenants, transactions, documents, reports, and AI-assisted portfolio insights.

## Phase 1: Production Foundation

- Enforce per-organization data isolation across every authenticated API route.
- Run Alembic migrations automatically in containerized deployments.
- Configure CORS through `CORS_ORIGINS` instead of wildcard origins.
- Add `/api/health` and `/api/ready` probes for deploy platforms and uptime checks.
- Require explicit Stripe configuration before enabling checkout.
- Keep demo seed data out of production environments.
- Add E2E regression coverage for multi-user isolation.
- Add request IDs, baseline rate limits, and registration password policy.
- Run backend E2E and frontend build checks in CI.

## Phase 2: Beta Readiness

- Move CI from SQLite to PostgreSQL and Redis services.
- Add password reset and invite flows.
- Add Redis/API-gateway-backed distributed rate limiting for multi-instance deployments.
- Add Sentry release/environment metadata and alert routing.
- Move uploaded documents to managed object storage with signed download URLs.
- Add database backups, restore drills, and retention policy.

## Phase 3: Product Launch

- Finalize pricing tiers and Stripe price IDs.
- Build billing UI for subscription status and customer portal access.
- Add onboarding flow for first property, tenant, and transaction setup.
- Add empty states and sample data import for new accounts.
- Publish privacy policy, terms, security contact, and data deletion workflow.
- Prepare support runbook, incident response checklist, and launch monitoring dashboard.

## Phase 4: Go-To-Market Readiness

- Position Elara for small rental owners and owner-operators first; treat hotels and short-term rental channel management as custom/future verticals.
- Use beta pricing: Starter $39/mo up to 5 units, Portfolio $89/mo up to 25 units, Operator $199/mo up to 100 units, custom above 100 units.
- Recruit 5-10 paid beta customers through local real estate investor groups, landlord communities, bookkeepers, agents, mortgage brokers, and direct LinkedIn/email outreach.
- Offer hands-on data import for founding customers in exchange for weekly feedback and permission to develop anonymized case studies.
- Build one high-intent landing page, one guided demo script, one onboarding checklist, and one pricing objection sheet before paid ads.
- Delay broad paid advertising until activation is measurable: first property imported, first tenant added, first transaction categorized, and one weekly return visit.

## Launch Gate

Do not launch to real users until these checks are green:

- Fresh production database can run `alembic upgrade head`.
- New user registration creates an isolated organization.
- User A cannot list, read, update, delete, export, or AI-query User B data.
- Frontend build passes with production `VITE_API_URL`.
- Backend boots with production env vars and no demo credentials.
- Stripe checkout and webhook are verified in test mode.
- Document uploads are scanned, size-limited, and stored outside the app container.
- Database backups and restore process are verified.
- Public marketing claims are evidence-backed; no fake testimonials, inflated waitlists, or unaudited compliance claims.
- At least three non-demo accounts complete onboarding without manual database edits.
