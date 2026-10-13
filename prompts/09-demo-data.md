# Prompt 09 — Demo data generator (attach and remove on demand)
Branch: `feat/09-demo`. Read first: AGENTS.md rule 2, docs/SPEC.md section 11, db/001_init.sql.

## Do
Create `demo/` with a CLI (`@faker-js/faker`, `en_IN` locale, fixed seed so runs are repeatable) exposing:
- `npm run demo:load` — refuses if demo data already exists unless `--reset`.
- `npm run demo:clear` — deletes every row with `is_demo = 1` in a foreign-key-safe order (notifications, stock_movements, purchase_orders, purchase_requests, items, suppliers, users, departments, categories; children cascade), prints per-table counts, never touches rows with `is_demo = 0`, and refuses to run when `NODE_ENV=production` unless `--force`.
- `npm run demo:status` — counts of demo rows per table.

Generated data (all `is_demo = 1`, clearly fake names and `@demo.invalid` emails):
1. A set of departments and categories, 25-40 items with realistic units, minimum levels and costs, 5-8 suppliers.
2. Users: one Principal, a HoD per department, two requesters per department, one procurement officer, one store manager, a supplier user per supplier, all ACTIVE, password from `DEMO_PASSWORD` env (default documented in the demo README). Print the demo login table at the end of `demo:load`.
3. About 60 days of consistent history: opening stock, receipts, issues; `balance_after` correct and never negative; `stock_qty` equals the sum of movements.
4. Requests in every status with matching approval-log rows and routing (HoD-raised ones pending/decided by the Principal); POs consistent with request status (including delivered ones with `delivered_date` before and after `expected_date` so supplier metrics are meaningful); notifications for the demo users.
5. End-of-load self-check that asserts the invariants above and exits non-zero if any fails.

Write `demo/README.md` explaining attach/remove for a demo day.

## Acceptance
- Start from a database containing a few real rows you created by hand: `demo:load` -> dashboards and reports are populated and the "Demo data loaded" banner shows; `demo:clear` -> real rows are byte-for-byte unchanged (compare counts and spot-check), banner disappears, no orphans remain (query each FK).
- Perform an action as a real admin on a demo item, then run `demo:clear`: it still completes cleanly (inherited `is_demo`).
- `demo:load` twice without `--reset` refuses safely.

## Finish
Commit, summary, stop.
