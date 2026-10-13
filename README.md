# SIMPS (Smart Inventory and Procurement Management System)

Web application for the central store of Ramco Institute of Technology: stock tracking, purchase requests with HoD/Principal approval, purchase orders to suppliers, goods receipt, alerts, and reports.

## Prerequisites
- Node.js 20+
- Git
- Docker (or local MySQL 8.0+)

## Quick Start
1. **Clone repository:**
   ```bash
   git clone https://github.com/viphakaran/SIMPS.git
   cd SIMPS
   ```
2. **Start MySQL database:**
   ```bash
   docker compose up -d
   ```
3. **Environment Setup:**
   - Copy `server/.env.example` to `server/.env` and update secrets if needed.
   - Copy `client/.env.example` to `client/.env`.
4. **Install Dependencies:**
   ```bash
   npm install
   ```
5. **Database Migration:**
   ```bash
   npm run migrate
   ```
6. **Create Initial Admin Account:**
   ```bash
   npm run create-admin
   ```
7. **Run Development Server (Client & Server):**
   ```bash
   npm run dev
   ```

## Demo Data
- Load demo data: `npm run demo:load`
- Status of demo data: `npm run demo:status`
- Clear demo data: `npm run demo:clear`

## Documentation & Architecture
- [AGENTS.md](AGENTS.md) — Architectural rules, security standards, and non-negotiable conventions
- [docs/SPEC.md](docs/SPEC.md) — Functional specifications, roles, and business workflows
- [docs/API.md](docs/API.md) — REST API endpoint contract
- [docs/UI.md](docs/UI.md) — Design system and screen catalog
- [db/001_init.sql](db/001_init.sql) — Core database schema (MySQL 8)
- [PROGRESS.md](PROGRESS.md) — Phase-by-phase build logs and acceptance tracking
