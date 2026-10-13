# Prompt 05 — Reports, analytics, scheduler
Branch: `feat/05-reports`. Read first: AGENTS.md, docs/SPEC.md section 9, docs/API.md (Reports, Inventory reorder, Suppliers performance).

## Do
1. `GET /items/reorder-suggestions` with the exact formula and displayed inputs (avg daily usage, days of cover, on-order quantity, suggested quantity, or `insufficientData: true`).
2. `GET /suppliers/:id/performance` and `GET /reports/suppliers` (on-time rate, average lead days, order counts; null when no deliveries).
3. `GET /reports/inventory` and `GET /reports/procurement` with the filters in docs/API.md; `?format=csv` streams a properly escaped CSV with headers.
4. `GET /reports/dashboard`: a role-specific payload exactly as listed in SPEC section 9. Every number comes from a query; empty data returns zeros or empty arrays plus flags, never invented values.
5. Scheduler (`node-cron`, 08:00 server time, disabled when `NODE_ENV=test`): daily digest notification to procurement officers of items still LOW/OUT, skipped if none.
6. Tests with hand-built fixtures inside the test setup (not shared seed data): reorder formula, supplier metrics with known dates, CSV escaping, dashboard scoping per role, HOD only sees own department in procurement report.

## Acceptance
- With a small known fixture, each report number equals the hand-calculated value in the tests.
- With an empty database every report and the dashboard return valid empty results (no errors, no fabricated numbers).
- `npm test` and `npm run lint` pass.

## Finish
Commit, summary, stop.
