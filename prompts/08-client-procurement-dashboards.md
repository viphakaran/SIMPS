# Prompt 08 — Screens: requests, approvals, procurement, orders, dashboards, reports
Branch: `feat/08-client-procurement`. Read first: AGENTS.md, docs/UI.md, docs/API.md (Requests, Orders, Reports), docs/SPEC.md sections 5, 6, 9.

## Do
1. `/requests` (my requests, status filters), `/requests/new` (multi-line item picker with search, quantity, priority, justification; prevents duplicate items client-side and shows server errors such as NO_HOD), `/requests/:id` (lines, approval Timeline, linked POs, cancel while pending).
2. `/approvals` for HOD and PRINCIPAL: queue, approve, reject with required reason (ConfirmReason).
3. `/procurement` for PROCUREMENT_OFFICER: approved queue; create-PO screen assigning supplier and unit price per line (default price from item cost), expected date, live total; return-with-reason action.
4. `/orders` and `/orders/:id`: list with filters (status, overdue); supplier sees only own and gets status buttons for the next valid status only; store manager gets "Receive goods" (confirmation dialog, then success summary of stock added); procurement officer can cancel eligible POs.
5. `/dashboard` for every role per SPEC section 9 using StatCards, short lists and at most two Recharts charts (for example requests by status, spend by month). Charts must render a clean empty state when there is no data.
6. `/reports`: tabs Inventory, Procurement, Suppliers; filters; CSV export buttons calling the `?format=csv` endpoints.
7. Remove all "Coming soon" placeholders.

## Acceptance
Walk the full flow in the browser with real accounts you create yourself:
requester raises request -> HoD approves -> officer creates PO -> supplier moves it to DELIVERED -> store manager receives -> stock increases, request becomes RECEIVED, notifications arrive at each step. Repeat once with a HoD-raised request approved by the Principal.
- Each role sees only its own navigation and data.
- `npm run lint` and `npm run build -w client` pass.

## Finish
Commit, summary, stop.
