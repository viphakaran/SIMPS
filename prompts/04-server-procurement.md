# Prompt 04 — Purchase requests, approvals, purchase orders, receiving
Branch: `feat/04-procurement`. Read first: AGENTS.md, docs/SPEC.md sections 4-6 and 8, docs/API.md (Requests, Orders), db/001_init.sql.

## Do
1. Request service: create (routing to PENDING_HOD or PENDING_PRINCIPAL, `NO_HOD`/`NO_PRINCIPAL` errors, lines validated: active items, unique per request, quantity > 0), list with scoping per SPEC section 4, detail with lines, approvals timeline and linked POs.
2. Decisions: `POST /requests/:id/decision` for HOD (own department, REQUESTER-raised only) and PRINCIPAL (HoD-raised only); no self-approval; rejection requires a reason; writes `request_approvals`; guarded status update with `affectedRows` check; notifications per SPEC section 8.
3. Cancel (requester, while pending) and return (procurement officer, reason required).
4. Create POs: `POST /requests/:id/orders` in one transaction: every request line must be assigned a supplier (active) and unit price; group by supplier; create one PO per supplier with `po_items`, computed `total_amount`, number `PO-YYYY-NNNNN`; set request ORDERED; notify supplier users and write the PROCUREMENT approval log row.
5. Order list/detail with supplier scoping (a supplier sees only own POs; others 404 not 403 for foreign records).
6. Supplier status updates through a transition map (CONFIRMED, SHIPPED, DELIVERED; DELIVERED sets `delivered_date`); PO cancel by procurement officer; recompute request status per SPEC section 5 (all cancelled returns request to APPROVED).
7. Receive: `POST /orders/:id/receive` (STORE_MANAGER) in a transaction using the stock service for each line; mark RECEIVED; recompute request status; notify requester. Second call returns 409.
8. `req_no` / `po_no` generation per SPEC section 10.
9. Tests: one end-to-end scenario test walking the whole lifecycle for both routing paths; negative tests (other department's HoD, self-approval, supplier touching a foreign PO, double receive, invalid transitions, concurrent decisions on the same request).

## Acceptance
- The full lifecycle test passes and ends with `items.stock_qty` increased by exactly the PO quantities and matching movement rows.
- A HoD from another department receives 403/404 on every attempt to see or decide the request.
- `npm test` and `npm run lint` pass.

## Finish
Commit, summary, stop.
