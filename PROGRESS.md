# PROGRESS.md — SIMPS (Smart Inventory and Procurement Management System)

Tracking build progress across all phases (prompts 00 through 10).

## Summary Table
| Phase | Prompt | Branch | Status | Merge Commit |
|---|---|---|---|---|
| 00 | 00-scaffold.md | feat/00-scaffold | done | b19d7af6cae3c2f679bb4398c6c980c611fb63bc |
| 01 | 01-server-core-auth.md | feat/01-server-core-auth | done | 718b931f7ec5e64d7cdbbda3d286e75c69a8b47d |
| 02 | 02-server-masters.md | feat/02-masters | done | 0d6fc267ff90718d27416cf48b393ca7cd1541cd |
| 03 | 03-server-inventory-notifications.md | feat/03-inventory | done | b185a0e259bb6ae5581c9b8ee63766bcf686f8c2 |
| 04 | 04-server-procurement.md | feat/04-procurement | done | 3b85f66015cd1429477919e047dbaf619957ffe7 |
| 05 | 05-server-reports.md | feat/05-reports | done | f47fa087c58bf8347a5cb026e47d5d6e61875e1a |
| 06 | 06-client-foundation.md | feat/06-client-foundation | done | 91ba015a536d8ad137ca4c9d21b25c23e4eba4ab |
| 07 | 07-client-masters-inventory.md | feat/07-client-inventory | done | 1e0f6deaa912c13149a0f70b6b1c7f346590d89f |
| 08 | 08-client-procurement-dashboards.md | feat/08-client-procurement | done | e9a701cb2fc1abc0447df2d10458373f25eee180 |
| 09 | 09-demo-data.md | feat/09-demo-data | not started | - |
| 10 | 10-tests-docs-hardening.md | feat/10-tests-docs-hardening | not started | - |

---

## Phase Details

### Phase 00: Scaffold
- **Status:** done
- **Branch:** feat/00-scaffold
- **Merge Commit:** b19d7af6cae3c2f679bb4398c6c980c611fb63bc
- **Acceptance Checks:**
  - `docker compose up -d`: PASS — `simps-mysql` container started healthy on port 3306.
  - `npm install`: PASS — Monorepo dependencies installed cleanly across client, server, and demo.
  - `npm run dev`: PASS — Concurrently served server on port 5000 and Vite client on port 5173.
  - `Invoke-RestMethod http://localhost:5000/api/health`: PASS — Returned `{"status":"ok"}`.
  - `npm run lint`: PASS — Flat ESLint passed with 0 errors and 0 warnings.
  - `git ls-files | Select-String '\.env'`: PASS — Only `client/.env.example` and `server/.env.example` tracked; secrets ignored.
- **Deviations:** Added `eslint-plugin-react` to support ESLint 9 flat config JSX parsing cleanly.
- **Open Issues:** None

### Phase 01: Server Core & Auth
- **Status:** done
- **Branch:** feat/01-server-core-auth
- **Merge Commit:** 718b931f7ec5e64d7cdbbda3d286e75c69a8b47d
- **Acceptance Checks:**
  - `npm run migrate`: PASS — Initial run created all tables in `smartinv`; running second time verified zero changes (idempotent).
  - `npm run create-admin`: PASS — Created active ADMIN account, rejected duplicate email creation, login returned valid JWT, `/api/auth/me` succeeded, tampered token returned 401.
  - Role registration restriction: PASS — Attempting to self-register with role other than REQUESTER returned 400 validation error.
  - `npm test`: PASS — 22/22 integration tests passed across `auth.test.js` and `health.test.js`.
  - `npm run lint`: PASS — ESLint passed with 0 errors and 0 warnings.
- **Deviations:** None
- **Open Issues:** None

### Phase 02: Server Masters
- **Status:** done
- **Branch:** feat/02-masters
- **Merge Commit:** 0d6fc267ff90718d27416cf48b393ca7cd1541cd
- **Acceptance Checks:**
  - Admin department & HoD workflow: PASS — Admin created department, created HoD, assigned HoD; REQUESTER self-registered, was approved, and logged in.
  - Role restrictions: PASS — Second active PRINCIPAL rejected (409 `PRINCIPAL_EXISTS`); HoD belonging to another department rejected (400 `HOD_WRONG_DEPARTMENT`); admin self-disable rejected (400 `CANNOT_DISABLE_SELF`).
  - `npm test`: PASS — 41/41 tests passing across `masters.test.js`, `auth.test.js`, `health.test.js`.
  - `npm run lint`: PASS — ESLint passed with 0 errors and 0 warnings.
- **Deviations:** None
- **Open Issues:** None

### Phase 03: Server Inventory & Notifications
- **Status:** done
- **Branch:** feat/03-inventory
- **Merge Commit:** b185a0e259bb6ae5581c9b8ee63766bcf686f8c2
- **Acceptance Checks:**
  - Low-stock episode notification logic: PASS — Creating an item with opening stock and issuing below min level created exactly 1 LOW_STOCK notification for each active STORE_MANAGER and PROCUREMENT_OFFICER; further issues did not re-alert; restocking above min level and dropping below re-armed and triggered a new episode alert.
  - Balance invariant: PASS — `balance_after` of latest stock movement strictly equals `items.stock_qty`.
  - Concurrency test: PASS — Parallel requests attempting to issue stock simultaneously prevented negative inventory (one 200, one 409 `INSUFFICIENT_STOCK`).
  - Notifications API: PASS — List with unread count, mark single notification as read, mark all read.
  - `npm test`: PASS — 49/49 tests passing across all 4 test suites (`inventory.test.js`, `masters.test.js`, `auth.test.js`, `health.test.js`).
  - `npm run lint`: PASS — ESLint passed with 0 errors and 0 warnings.
- **Deviations:** None
- **Open Issues:** None

### Phase 04: Server Procurement
- **Status:** done
- **Branch:** feat/04-procurement
- **Merge Commit:** 3b85f66015cd1429477919e047dbaf619957ffe7
- **Acceptance Checks:**
  - End-to-end lifecycle (Path A): PASS — Multi-line request created with `REQ-YYYY-NNNNN`, approved by HoD (writing `request_approvals` stage HOD), split across two suppliers into POs (`PO-YYYY-NNNNN`, request status ORDERED, writing `request_approvals` stage PROCUREMENT), confirmed/shipped/delivered by suppliers (`delivered_date` set), received by Store Manager; `items.stock_qty` increased by exactly the PO quantities (10->15 and 2->4) with matching `RECEIPT` movements and exact `balance_after`; request automatically set to `RECEIVED`.
  - End-to-end lifecycle (Path B): PASS — HoD request routed to `PENDING_PRINCIPAL`, approved by Principal; returned by procurement with reason; cancelling POs recomputes request status back to `APPROVED`.
  - Scoping and negative checks: PASS — Foreign HoD receives 404/403; self-approval rejected (403); rejection without reason rejected (400 `REASON_REQUIRED`); foreign supplier receives 404; invalid transitions rejected (409); double receive rejected (409 `ALREADY_RECEIVED`); missing HoD/Principal triggers 409 `NO_HOD`/`NO_PRINCIPAL`.
  - `npm test`: PASS — 60/60 tests passing across all 5 test suites (`procurement.test.js`, `inventory.test.js`, `masters.test.js`, `auth.test.js`, `health.test.js`).
  - `npm run lint`: PASS — ESLint passed with 0 errors and 0 warnings.
- **Deviations:** None
- **Open Issues:** None

### Phase 05: Server Reports
- **Status:** done
- **Branch:** feat/05-reports
- **Merge Commit:** f47fa087c58bf8347a5cb026e47d5d6e61875e1a
- **Acceptance Checks:**
  - Empty Database Check: PASS — With an empty database, every report (`reorder-suggestions`, `suppliers`, `inventory`, `procurement`) and all 7 role dashboards return valid empty results with zeros/empty arrays, with zero fabricated or mock data.
  - Hand-calculated fixtures: PASS — Small known fixtures verified against mathematical formulas: Reorder suggestions (avg_daily, days_of_cover, on_order, suggested_qty, insufficient_data), Supplier performance (total orders excluding cancelled, delivered count, on-time rate 0.50, avg lead days 10.0), Inventory valuation (150,000), Procurement spend by month/dept.
  - Department Scoping: PASS — HoD in procurement report strictly sees only own department's counts and spend.
  - CSV Export: PASS — `?format=csv` streams properly formatted and escaped CSV for inventory, procurement, and supplier reports.
  - Daily Scheduler: PASS — `runDailyStockDigest()` queries low/out stock items and creates daily digest notification for procurement officers; skips when none.
  - `npm test`: PASS — 66/66 tests passing across all 6 test suites (`reports.test.js`, `procurement.test.js`, `inventory.test.js`, `masters.test.js`, `auth.test.js`, `health.test.js`).
  - `npm run lint`: PASS — ESLint passed with 0 errors and 0 warnings.
- **Deviations:** None
- **Open Issues:** None

### Phase 06: Client Foundation & E2E Acceptance
- **Status:** done
- **Branch:** feat/06-client-foundation & feat/06b-e2e-acceptance
- **Merge Commit:** 91ba015a536d8ad137ca4c9d21b25c23e4eba4ab (feat/06-client-foundation)
- **Code Checks:**
  - `npm run lint`: PASS — ESLint passed with 0 errors and 0 warnings.
  - `npm test`: PASS — 66/66 integration tests passed across all 6 test suites (`auth.test.js`, `health.test.js`, `inventory.test.js`, `masters.test.js`, `procurement.test.js`, `reports.test.js`).
  - `npm run build -w client`: PASS — Vite production bundle generated cleanly with 0 errors.
- **Browser Acceptance Checks (`npm run test:e2e`):**
  - Command: `npx playwright test` via `npm run test:e2e` (running against isolated database `smartinv_e2e`, test server port 5001, test client port 5174).
  - Check 1 (Registration pending): PASS — Registration submits with college domain, creates pending requester, displays "Registration Submitted - Pending Approval" screen with no automatic login.
  - Check 2 (Admin login/logout/login): PASS — Logs in as System Admin, confirms redirect to dashboard and user display, logs out cleanly via header dropdown, and successfully logs in again.
  - Check 3 (Invalid credentials): PASS — Submitting incorrect password displays inline error alert ("Invalid email or password") with no crash.
  - Check 4 (Role-filtered navigation): PASS — ADMIN sidebar displays Users, Departments, Categories, Inventory; STORE_MANAGER sees Inventory and Reorder Suggestions while admin master links (Users, Departments, Categories) are hidden.
  - Check 5 (Forbidden route /403): PASS — Authenticated STORE_MANAGER directly navigating to `/users` is blocked and redirected to `/403` with "403 — Access Denied" card.
  - Check 6 (Server offline / Retry / No fake data): PASS — With backend server stopped on port 5001, navigating to `/register` renders the standard `ErrorState` component with Retry button and 0 fake department options; restarting server and clicking Retry successfully loads active departments without page reload.
  - Overall Suite: PASS (6/6 tests passing in 32.5s).
- **Resume after interruption:**
  - Resumed on branch `feat/06b-e2e-acceptance` following host restart.
  - Verified Docker container `simps-mysql` healthy on port 3306.
  - Terminated orphaned dev processes on ports 5000/5173 to ensure ports remain free.
  - Hardened `.gitignore` to prevent leakage of `.env.e2e`, `test-results/`, and temporary build artifacts.
  - Completed and executed all 6 Playwright browser acceptance checks against isolated `smartinv_e2e`.
- **Deviations:** Introduced `@playwright/test` dev dependency with dedicated `smartinv_e2e` database and ports 5001/5174 to satisfy browser acceptance requirements without touching development data (documented in `docs/CHANGES.md`).
- **Open Issues:** None

### Phase 07: Client Masters, Inventory & Notifications
- **Status:** done
- **Branch:** feat/07-client-inventory
- **Merge Commit:** 1e0f6deaa912c13149a0f70b6b1c7f346590d89f
- **Code Checks:**
  - `npm run lint`: PASS — ESLint passed with 0 errors and 0 warnings.
  - `npm test`: PASS — 66/66 integration tests passed across all 6 test suites.
  - `npm run build -w client`: PASS — Vite production bundle generated cleanly in 3.05s.
- **Browser Acceptance Checks (`npx playwright test client/e2e/phase07.spec.js --config client/playwright.config.js`):**
  - Command: `npx playwright test client/e2e/phase07.spec.js --config client/playwright.config.js` (running against isolated database `smartinv_e2e`, test server port 5001, test client port 5174).
  - Check 1 (Admin workflow): PASS — Created department "Mechanical Engineering", created HoD user "Dr. Murugan HoD", assigned HoD to department, and approved self-registered requester "Selvi Student" from Pending Approvals tab (7.9s).
  - Check 2 (Store Manager workflow): PASS — Created category "Electronics & Sensors", created item "Arduino Uno R3 Board" (SKU `ELEC-ARD-001`, unit cost 450, min level 10, opening stock 15), issued 8 units to Computer Science department (stock dropping to 7 < 10 threshold), confirmed status changed to Low Stock, verified exactly 1 low-stock notification arrived in notification inbox, and confirmed movement history ledger on `/items/:id` accurately displays opening stock (+15, balance 15) and issue stock (-8, balance 7) with dates and reasons (4.0s).
  - Check 3 (Empty database screens): PASS — Verified `/suppliers` empty state displays friendly "No suppliers found" message and "Add Supplier" action button (2.3s).
  - Combined E2E Suite (`client/e2e/`): PASS — All 9 tests passed across Phase 06 and Phase 07 in 49.2s.
- **Deviations:** None
- **Open Issues:** None

### Phase 08: Client Procurement & Dashboards
- **Status:** done
- **Branch:** feat/08-client-procurement
- **Merge Commit:** e9a701cb2fc1abc0447df2d10458373f25eee180
- **Acceptance Checks:**
  - `npm run lint`: PASS — Flat ESLint passed with 0 errors and 0 warnings.
  - `npm test`: PASS — 66/66 integration tests passed across all 6 test suites (`procurement.test.js`, `reports.test.js`, `masters.test.js`, `inventory.test.js`, `auth.test.js`, `health.test.js`).
  - `npm run build -w client`: PASS — Vite client production bundle built cleanly in 14.13s.
  - `npm run test:e2e` (Playwright E2E suite against `smartinv_e2e`, ports 5001 & 5174): PASS — All 12/12 tests passing in 2.9m:
    - `e2e/phase08.spec.js`:
      1. Full procurement cycle: Requester -> HoD -> Officer -> Supplier -> Store Manager receipt -> stock increases, request RECEIVED, step-level notifications for all parties (36.5s).
      2. HoD-raised request approved by Principal (10.6s).
      3. Role navigation scoping, reports tabs & CSV exports, and 403 access control (8.7s).
- **Acceptance Verification Matrix:**
  | Requirement | Test File | Test Name | Result |
  |---|---|---|---|
  | Admin: create department, HoD, assign HoD, approve self-registered requester | `client/e2e/phase07.spec.js` | 1. Admin creates department, HoD user, assigns HoD, and approves a self-registered requester | PASS |
  | Store manager: create category & item with opening stock, issue stock below minimum, see exactly 1 low-stock notification, movement history shows opening, issue, balance | `client/e2e/phase07.spec.js` | 2. Store Manager creates item with opening stock, issues stock below minimum, checks notification and ledger | PASS |
  | Empty database screens show helpful empty states with actions | `client/e2e/phase07.spec.js` | 3. Empty database screens show helpful empty states with actions | PASS |
  | Full procurement cycle: requester raises -> HoD approves -> officer creates PO -> supplier moves to DELIVERED -> store manager receives -> stock increases, request RECEIVED, notifications at each step | `client/e2e/phase08.spec.js` | 1. Full procurement cycle: Requester -> HoD -> Officer -> Supplier -> Store Manager receipt -> stock increases | PASS |
  | HoD-raised request approved by Principal | `client/e2e/phase08.spec.js` | 2. HoD-raised request approved by Principal | PASS |
  | Role-scoped navigation and data visibility | `client/e2e/phase08.spec.js` & `client/e2e/phase06.spec.js` | 3. Role navigation scoping, reports, and empty state check | PASS |
- **Deviations:** None
- **Open Issues:** None

### Phase 09: Demo Data
- **Status:** not started
- **Branch:** feat/09-demo-data
- **Merge Commit:** -
- **Acceptance Checks:**
- **Deviations:** None
- **Open Issues:** None

### Phase 10: Tests, Docs & Hardening
- **Status:** not started
- **Branch:** feat/10-tests-docs-hardening
- **Merge Commit:** -
- **Acceptance Checks:**
- **Deviations:** None
- **Open Issues:** None
