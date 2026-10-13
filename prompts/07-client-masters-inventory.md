# Prompt 07 — Screens: administration, suppliers, inventory, notifications
Branch: `feat/07-client-inventory`. Read first: AGENTS.md, docs/UI.md, docs/API.md (Users..Inventory, Notifications), docs/SPEC.md sections 3, 4, 7.

## Do
1. `/users`: tabs All and Pending approvals; create/edit user modal (role-dependent fields: department for HOD/REQUESTER, supplier for SUPPLIER); approve, disable, enable actions with confirmation.
2. `/departments` (create/edit/deactivate, assign HoD from eligible users) and `/categories`.
3. `/suppliers` and `/suppliers/:id` (form, list with search, performance panel showing "No data yet" when null).
4. `/items` (filters: category, status, active, search; derived status badge; capacity of the view is server-paginated), `/items/:id` (details, movement history table), and for STORE_MANAGER: add/edit item, issue stock (department, quantity, reason), adjust stock (signed, reason required). Show server validation errors (for example INSUFFICIENT_STOCK) inline.
5. `/reorder`: suggestions table showing every input value next to the suggested quantity; show "Not enough usage data" where applicable.
6. `/notifications` inbox (unread highlighting, mark read, mark all read); bell dropdown shows the latest few.
7. All screens respect role visibility from docs/UI.md; buttons the user cannot use are hidden, and the server still enforces everything.

## Acceptance
- As admin: create department, HoD, assign HoD, approve a self-registered requester.
- As store manager: create category and item with opening stock, issue stock below minimum, see exactly one low-stock notification arrive; movement history shows the opening, issue and balance columns.
- Empty database screens show helpful empty states with actions.
- `npm run lint` and `npm run build -w client` pass.

## Finish
Commit, summary, stop.
