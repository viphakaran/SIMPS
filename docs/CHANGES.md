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

## Phase 07: Client Masters, Inventory & Stock Ledger
- **Stock Movement Pagination:** `StockService.listMovements` updated to use `parsePagination` utility to ensure `limit` and `offset` default properly when pagination parameters are provided via query string.
- **Toast Context API:** Added `showSuccess` and `showError` aliases to `ToastContext.jsx` alongside `success` and `error` to support standard component usage consistently.

## Phase 11: Institutional Branding & Real Master Data Coexistence
- **Central Branding Configuration:** Added `client/src/config/branding.js` and `server/src/config/branding.js` for single-source institutional facts (name, short name, address, contact, website, logo, disclaimer).
- **Official Assets:** Preserved original Ramco Institute of Technology emblem at `client/public/branding/ritlogo.png` (207×244 PNG).
- **UI Branding:**
  - Login and Register pages display the official emblem (max height 64px), college name, address line, and student mini project disclaimer.
  - Sidebar brand block displays the emblem (max height 32px), "SIMPS", and "RIT Central Store".
  - Document title updated to `SIMPS | RIT`.
- **Real Master Data Seeding (`npm run seed:college`):** Added `seed/college.js` to idempotently seed the 11 verified college departments into `departments` with `is_demo = 0`.
- **Demo Data Coexistence:** Updated `demo/load.js` to reuse existing real departments rather than duplicating names, attaching demo users and requests, while `demo/clear.js` clears demo HoD foreign keys and removes only `is_demo = 1` rows, leaving real departments intact.


