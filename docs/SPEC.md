# SmartInv — Functional Specification v1

## 1. Context
Setting: the central store of Ramco Institute of Technology. Departments request items. The HoD approves
(or the Principal, for requests raised by a HoD). The Procurement Officer orders from suppliers. The Store
Manager receives goods and issues stock. Nothing about the college is hardcoded: departments, categories,
units and suppliers are all data entered by users.

## 2. Roles
| Role | Who |
|---|---|
| ADMIN | System administrator. Manages accounts, departments, categories. Cannot approve requests. |
| PRINCIPAL | Approves requests raised by HoDs. Read-only college-wide dashboard. Exactly one ACTIVE. |
| HOD | Head of Department. Approves requests from own department. Can raise requests. |
| REQUESTER | Lab in-charge / faculty. Raises requests for own department. |
| PROCUREMENT_OFFICER | Processes approved requests into purchase orders. Manages suppliers. |
| STORE_MANAGER | Manages items, issues stock, receives goods. |
| SUPPLIER | External vendor. Sees and updates only own orders. |

## 3. Accounts
- Self-registration is allowed only for REQUESTER (name, email, password, phone, department). Status starts PENDING.
- Admin creates every other role (ACTIVE immediately, Admin sets the initial password). Supplier accounts are linked to a supplier record via `supplier_id`.
- Admin approves (ACTIVE) or rejects (DISABLED) pending accounts. PENDING and DISABLED users cannot log in
  (403 `ACCOUNT_PENDING` / `ACCOUNT_DISABLED`).
- Emails are stored lowercase and unique. Passwords: minimum 8 characters, at least one letter and one digit.
- At most one ACTIVE PRINCIPAL (409 `PRINCIPAL_EXISTS`).
- A department has at most one HoD (`departments.hod_user_id`). The user must have role HOD and the same department. Admin assigns it.
- The first admin is created only by the CLI `npm run create-admin`.

## 4. Permissions
Y = full, R = read-only, Own = own records only, - = none.
| Capability | ADM | PRI | HOD | REQ | PRO | STO | SUP |
|---|---|---|---|---|---|---|---|
| Users, departments, categories (manage) | Y | - | - | - | - | - | - |
| Items: view | R | R | R | R | R | Y | - |
| Items: create/edit/deactivate | - | - | - | - | - | Y | - |
| Issue / adjust stock, receive goods | - | - | - | - | - | Y | - |
| Raise request | - | - | Y | Y | - | - | - |
| View requests | R | R | Own dept | Own | Approved+ | Ordered+ | - |
| Decide request | - | HoD-raised only | Own-dept REQUESTER-raised only | - | - | - | - |
| Cancel request (while pending) | - | - | Own | Own | - | - | - |
| Process request: create PO or return | - | - | - | - | Y | - | - |
| Suppliers: view | R | R | - | - | Y | R | - |
| Suppliers: create/edit | Y | - | - | - | Y | - | - |
| View POs | R | R | - | - | Y | Y | Own |
| Update PO status | - | - | - | - | Cancel only | - | Own |
| Reports | Y | Y | Own dept | - | Y | Y | - |
Every endpoint enforces role and scope on the server.

## 5. Request workflow
Create: REQUESTER request -> `PENDING_HOD` (department must have an active HoD, else 409 `NO_HOD`).
HOD request -> `PENDING_PRINCIPAL` (an active Principal must exist, else 409 `NO_PRINCIPAL`).
A request has one or more lines (item, quantity). An item may appear once per request.

| From | To | Actor | Rule |
|---|---|---|---|
| PENDING_HOD | APPROVED / REJECTED | HOD of the request's department | approver is not the requester; rejection needs a reason |
| PENDING_PRINCIPAL | APPROVED / REJECTED | PRINCIPAL | rejection needs a reason |
| PENDING_HOD / PENDING_PRINCIPAL | CANCELLED | the requester | |
| APPROVED | ORDERED | PROCUREMENT_OFFICER | creates POs (section 6) |
| APPROVED | RETURNED_BY_PROCUREMENT | PROCUREMENT_OFFICER | reason required |
| ORDERED | RECEIVED | system | when all non-cancelled POs are RECEIVED (and at least one) |
| ORDERED | APPROVED | system | if every PO is cancelled |
Each decision writes a `request_approvals` row (stage HOD / PRINCIPAL / PROCUREMENT, decision, reason).

## 6. Purchase orders and receiving
- The officer assigns a supplier and a unit price to every request line. One PO is created per distinct supplier,
  all in one transaction; the request becomes ORDERED. `expected_date` is entered by the officer.
- `total_amount` = sum(quantity x unit_price), computed on the server. Default unit price = item `unit_cost`.
- PO transitions: PLACED -> CONFIRMED -> SHIPPED -> DELIVERED (supplier; DELIVERED sets `delivered_date` to today);
  DELIVERED -> RECEIVED (store manager); PLACED/CONFIRMED -> CANCELLED (procurement officer).
- Receiving (`POST /orders/:id/receive`) runs in a transaction: lock each item row, add a RECEIPT movement per line,
  update `stock_qty`, set the PO RECEIVED, update the request status. A second receive attempt returns 409.

## 7. Stock rules and alerts
- `stock_qty` changes only through the stock service. It never goes below 0 (issue with insufficient stock: 409 `INSUFFICIENT_STOCK`).
- `stock_movements.quantity` is signed: RECEIPT positive, ISSUE negative, ADJUSTMENT either. Every row stores `balance_after`. ADJUSTMENT requires a reason.
- Item status is derived, not stored: OUT (qty = 0), LOW (qty <= min_level, min_level > 0), else IN_STOCK.
- Low-stock alert: after any movement, if status is LOW or OUT and `low_stock_alerted = 0`, notify all ACTIVE
  STORE_MANAGER and PROCUREMENT_OFFICER users and set the flag to 1. When stock rises above `min_level`, reset the flag to 0.
  So there is exactly one alert per low-stock episode.

## 8. Notifications
In-app rows always. Email via Nodemailer when SMTP env vars are set; otherwise log "email skipped".
Email failure is logged and never blocks the request. Events:
| Event | Recipients |
|---|---|
| REQUEST_SUBMITTED | the approver (HoD of dept, or Principal) |
| REQUEST_DECIDED | requester |
| REQUEST_APPROVED | all ACTIVE procurement officers |
| REQUEST_RETURNED | requester |
| PO_PLACED | ACTIVE supplier users of that supplier |
| PO_STATUS | procurement officers and store managers |
| PO_RECEIVED | requester |
| LOW_STOCK | store managers and procurement officers |
| ACCOUNT_APPROVED | the user |

## 9. Reports and analytics (all computed from real rows; show "No data yet" instead of zeros that mislead)
- **Reorder suggestion** (store manager, procurement officer): for items with status LOW/OUT or days_of_cover < 14:
  `avg_daily = abs(sum(ISSUE quantity, last 30 days)) / 30`; `days_of_cover = stock_qty / avg_daily` (null if avg_daily = 0);
  `on_order = sum(po_items.quantity)` for POs in PLACED/CONFIRMED/SHIPPED/DELIVERED;
  `suggested_qty = max(0, ceil(avg_daily * 30) - stock_qty - on_order)`. Items with no ISSUE in 30 days show "Not enough usage data".
  Always display the inputs next to the suggestion.
- **Supplier performance:** orders (excl. cancelled), delivered count, `on_time_rate` = delivered with delivered_date <= expected_date
  / delivered with expected_date, `avg_lead_days` = avg(DATEDIFF(delivered_date, DATE(created_at))). Null when no deliveries.
- **Inventory report:** item, category, qty, min level, status, valuation = qty x unit_cost, total valuation.
- **Procurement report:** filters date range, status, department; counts by status; spend = sum of RECEIVED PO totals by month and by department.
- **Dashboards (role-specific):** STO: items total/low/out, POs awaiting receipt, recent movements, low-stock list.
  PRO: approved requests waiting, open POs, overdue POs (expected_date < today, not delivered), reorder suggestion count.
  HOD: pending approvals, department requests by status. PRI: pending approvals, college-wide requests by status, open POs, spend by month/department.
  REQ: my requests by status. SUP: my open orders by status, overdue deliveries.
  ADM: pending accounts, users by role, departments without HoD.
- CSV export for inventory, procurement and supplier reports (`?format=csv`).
- A daily cron job (08:00 server time) sends one in-app digest to procurement officers listing items still LOW/OUT.

## 10. Conventions
- Numbers: `REQ-YYYY-NNNNN`, `PO-YYYY-NNNNN` (year of creation, id zero-padded). Insert with a temporary unique value (`TMP-` + UUID), then update inside the same transaction.
- No hard deletes through the API: items, suppliers, departments use `is_active`.
- All list endpoints are paginated (default pageSize 20, max 100).

## 11. Demo data
- Loaded and removed only by `demo/` CLI (`demo:load`, `demo:clear`, `demo:status`). Never at server start, never in migrations.
- Rows created by the loader have `is_demo = 1`. Rows created in normal use that reference a demo row inherit `is_demo = 1`.
- `GET /api/meta` returns `{ demoDataPresent }` (true if any `is_demo` user exists); the UI shows a "Demo data loaded" banner.

## 12. Functional requirements
FR-01 Register / login with role-based access. FR-02 Admin approves accounts, manages users, departments, categories.
FR-03 Items: add, edit, categorize, deactivate. FR-04 Receive, issue, adjust stock with a full movement log.
FR-05 Live stock with derived status. FR-06 One low-stock alert per episode. FR-07 Multi-line purchase requests.
FR-08a HoD/Principal approval with reasons. FR-08b Procurement review: create PO or return. FR-09 POs per supplier.
FR-10 Supplier management. FR-11 Supplier order-status updates. FR-12 Goods receipt increases stock transactionally.
FR-13 Procurement history per request, PO and item. FR-14 In-app and email notifications.
FR-15 Role-specific dashboards. FR-16 Inventory, procurement and supplier-performance reports with CSV export.

## 13. Non-functional
Password hashing and server-side authorization everywhere; input validation; concurrent users via connection pool
(limit 10) and row locks; responsive layout; stateless API; graceful shutdown; `/api/health`; tests for all services.

## 14. Out of scope
Payments and invoicing, barcode scanning, multi-campus, batch/expiry tracking, partial goods receipts, SMS.
