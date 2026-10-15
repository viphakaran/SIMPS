# Changes & Tooling Additions

This document records deviations, added tools, and operational additions beyond the original documentation.

## Phase 06 Tooling: Playwright E2E Test Suite
- **Added:** `@playwright/test` added to `client/package.json` devDependencies.
- **Location:** E2E test suites located in `client/e2e/`.
- **Browser Channel:** Uses native system Chromium (`channel: 'chrome'`), ensuring zero dependencies on remote download servers.
- **Dedicated Environment:**
  - Database: `smartinv_e2e` (isolated test database, keeping `smartinv` development data untouched).
  - Test Server: Runs on dedicated port `5001`.
  - Test Client: Runs on dedicated port `5174` with `VITE_API_URL=http://localhost:5001/api`.
