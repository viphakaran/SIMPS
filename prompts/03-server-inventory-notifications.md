# Prompt 03 — Inventory, stock movements, notifications
Branch: `feat/03-inventory`. Read first: AGENTS.md, docs/SPEC.md sections 7-8, docs/API.md (Inventory, Notifications), db/001_init.sql.

## Do
1. `notificationService.notify({ userIds | roles, type, message, link })`: inserts in-app rows (inheriting `is_demo` rule where relevant), and sends email via Nodemailer when SMTP env is set (otherwise logs "email skipped"); email errors never throw to the caller; sets `emailed` accordingly. Expose it for reuse and replace the TODO from prompt 02.
2. Notification endpoints: list own (with `unreadCount`), mark one read, mark all read.
3. Stock service `applyMovement({ itemId, type, delta, reason, userId, departmentId, poId }, conn)`: inside the caller's transaction, `SELECT ... FOR UPDATE` the item, reject negative result (409 `INSUFFICIENT_STOCK`), insert `stock_movements` with `balance_after`, update `stock_qty`, then run the low-stock episode logic from SPEC section 7 (one alert per episode using `low_stock_alerted`). This is the only code allowed to change `stock_qty`.
4. Items: list (filters, search, pagination, derived `status`), detail, create (opening stock becomes an ADJUSTMENT movement with reason "Opening stock"), edit (never stockQty), issue, adjust, movements per item, global movements list.
5. Derived status must be computed in SQL or one shared helper, never stored.
6. Tests: concurrency test issuing stock from two parallel requests cannot go negative; alert fires once per episode and re-arms after restock; issue/adjust validation; role checks.

## Acceptance
- Creating an item with opening stock, issuing until below min level creates exactly one LOW_STOCK notification for each active store manager and procurement officer; further issues do not create more; adjusting above min level and dropping again creates a new one.
- `balance_after` of the latest movement always equals `items.stock_qty`.
- `npm test` and `npm run lint` pass.

## Finish
Commit, summary, stop.
