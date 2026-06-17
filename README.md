<div align="center">
  <img src="frontend/public/favicon.svg" alt="Elara Logo" width="120" height="120" />
  <h1>Elara</h1>
  <p><strong>AI-Driven Real Estate Portfolio Management Platform</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#documentation">Documentation</a>
  </p>
</div>

---

Elara is a comprehensive real estate portfolio management system designed to bring modern software engineering and artificial intelligence to property investors. Featuring a blazing-fast React/Vite frontend, a robust FastAPI backend, and Google Gemini AI integration, Elara automates insights, tracks financials, and manages tenant relations seamlessly.

## ✨ Features

- **📊 Comprehensive Portfolio Tracking**: Manage properties, tenants, and transactions in one unified dashboard.
- **🤖 AI-Powered Insights**: Google Gemini AI continuously analyzes your data to provide rent optimization suggestions, predictive maintenance alerts, and automated document data extraction.
- **📈 Advanced Financial Analytics**: Real-time metrics and charts for ROI, Cash Flow, Rent Roll, Schedule E, and Lender Metrics.
- **🏠 Live Market Data**: Integrated seamlessly with the Zillow API (via RapidAPI) for real-time market averages, comparables, and regional rent tracking.
- **🧮 Investor Toolsuite**: Built-in calculators for Deal Analysis, Mortgages, Pro Forma Building, Depreciation Tracking, and Refinance Analysis.
- **🔒 Secure Authentication**: Self-contained, robust local JWT-powered authentication for secure access without third-party identity providers.

## 🏗️ Architecture Stack

Elara is built with a modern, scalable stack designed for reliability and speed.

- **Frontend**: React 19, Vite 8, TypeScript, Vanilla CSS (Glassmorphism design system)
- **Backend**: Python 3.12, FastAPI, SQLAlchemy, SQLite (Development) / PostgreSQL-ready
- **AI Integration**: Google Generative AI (`google-generativeai`)
- **Testing**: Pytest (E2E, API, and Unit testing)
- **Deployment**: Fully containerized with Docker Compose

## 🚀 Getting Started

The easiest way to get Elara running locally is via Docker Compose.

### Prerequisites
- Docker and Docker Compose installed.
- API Keys for Google Gemini (and optionally RapidAPI for Zillow data).

### Quick Start (Docker)

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/your-org/elara.git
   cd elara
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the `backend/` directory:
   ```bash
   cp backend/.env.template backend/.env
   ```
   Add your keys to `backend/.env`:
   ```env
   RE_PORTFOLIO_JWT_SECRET=your_super_secret_jwt_key
   GOOGLE_API_KEY=your_gemini_api_key
   RAPIDAPI_KEY=your_rapidapi_key # Optional: for live Zillow data
   ```

3. **Spin up the stack**:
   ```bash
   docker compose up --build
   ```

4. **Access the application**:
   - **Frontend**: http://localhost
   - **Backend API Docs**: http://localhost:8000/docs

### Local Development (Without Docker)
For detailed local development setup instructions without Docker, please see our [Contributing Guide](CONTRIBUTING.md).

## 📚 Documentation

We believe in comprehensive, high-quality documentation. Explore the deeper technical aspects of Elara:

- [**ARCHITECTURE.md**](ARCHITECTURE.md): System design, data models, API contracts, and codebase layout.
- [**TESTING.md**](TESTING.md): E2E test strategy, coverage, and instructions on running the test suite.
- [**ROADMAP.md**](ROADMAP.md): Project milestones, future plans, and the transition to enterprise scale.
- [**CONTRIBUTING.md**](CONTRIBUTING.md): Guidelines for developers, local setup, and coding conventions.

## 🤝 Contributors

Elara was built by passionate engineers dedicated to modernizing real estate management.

- **Isaac**
- **Matthew**

---
<div align="center">
  <i>Built with ❤️ for Real Estate Investors</i>
</div>