# Roadmap & Future Planning

This document outlines the strategic roadmap for Elara, transitioning from the completed MVP to a scalable, production-ready SaaS application for real estate investors.

---

## Core Objectives
1. **Reliability & Scale**: Transition from local development tooling (SQLite, manual deployment) to robust enterprise infrastructure (PostgreSQL, CI/CD, Cloud Hosting).
2. **Business Viability**: Implement multi-tenancy, role-based access control, and billing logic to convert the MVP into a monetizable platform.
3. **User Acquisition**: Refine the onboarding flow and introduce product analytics to measure and optimize product-market fit.

---

## Phased Execution Plan

### Phase 1: Hardening & Production Readiness (Months 1-2)
*The transition from MVP to a stable, observable, and reliable application.*

- **[ ] Database Migration**: Replace SQLite with PostgreSQL to support concurrent transactions, robust backups, and cloud deployment. Implement Alembic for schema migrations.
- **[ ] CI/CD Pipeline**: Create GitHub Actions workflows to automatically run the Pytest E2E suite, execute linters, and build Docker images on code push.
- **[ ] Observability & Alerting**: Integrate Sentry for frontend and backend error tracking. Add Datadog or Prometheus/Grafana for system metrics and API performance monitoring.
- **[ ] Cloud Deployment**: Deploy the Docker Compose stack to a managed cloud service (e.g., AWS ECS, Render, or DigitalOcean App Platform) utilizing managed database services.
- **[ ] Security Hardening**: Safely manage secrets (`GOOGLE_API_KEY`, `RAPIDAPI_KEY`, `RE_PORTFOLIO_JWT_SECRET`) in the production environment via a secret manager.

### Phase 2: SaaS Foundation & Market Fit (Months 3-6)
*Building the features necessary for a multi-user, monetizable SaaS business.*

- **[ ] Multi-tenancy & RBAC**: Overhaul the database schema to support Organizations and Portfolios. Implement Role-Based Access Control (Owner, Property Manager, Read-Only).
- **[ ] Billing Integration**: Integrate Stripe for subscription management and tiered billing plans.
- **[ ] Asynchronous Processing**: Introduce a message queue (Celery + Redis) to handle long-running Google Gemini AI tasks (like large document processing) without blocking web requests.
- **[ ] Email/Notifications Delivery**: Integrate SendGrid or AWS SES for reliable transaction receipts, tenant invites, and maintenance alerts.
- **[ ] Beta Launch & Analytics**: Launch to a closed group of beta users. Implement Mixpanel or PostHog to track feature adoption and onboarding friction.

### Phase 3: Scaling & Advanced Features (Months 7-12)
*Expanding the product surface area and preparing for high scale.*

- **[ ] Mobile Application**: Develop a companion React Native (Expo) app to allow on-the-go access for property managers.
- **[ ] Public API & Webhooks**: Expose an API for advanced users to integrate Elara with Zapier, QuickBooks, or bespoke internal software.
- **[ ] Advanced Predictive AI**: Begin pooling anonymized market data to fine-tune predictive models for local market rent trends, reducing reliance on external APIs.
- **[ ] Strategic Partnerships**: Integrate natively with major real estate platforms (Zillow, Apartments.com) for listing syndication.

---

## Completed Milestones (Historical Context)

* **Sprint 1**: E2E Testing Framework defined and mocked.
* **Sprint 2**: Implemented self-contained local JWT authentication (replacing initial plans for third-party providers) and frontend Investor Toolsuite.
* **Sprint 3 (MVP Complete)**: Full-stack integration. Swapped mock data for real FastAPI database connection, integrated Google Gemini AI, added Docker Compose, and completed advanced financial reporting.