# Prompt 02 — Users, departments, categories, suppliers
Branch: `feat/02-masters`. Read first: AGENTS.md, docs/SPEC.md sections 2-4 and 10, docs/API.md (Users, departments, categories; Suppliers).

## Do
1. Users admin endpoints: list with filters, create any role, edit, approve, disable, enable. Rules: single ACTIVE PRINCIPAL (409 `PRINCIPAL_EXISTS`); HOD and REQUESTER require a department; SUPPLIER requires an existing `supplierId`; Admin cannot disable themselves; email lowercase and unique.
2. Approving a PENDING user creates an `ACCOUNT_APPROVED` notification row. (A temporary direct insert is fine; prompt 03 introduces the notification service. Leave a TODO to switch.)
3. Departments: list, public list for the register form (`/departments/public`, active only, id and name only), create, edit, deactivate, `PUT /:id/hod` (user must be ACTIVE, role HOD, same department; replaces the previous HoD relation cleanly).
4. Categories: list, create, rename (unique name).
5. Suppliers: list with search and pagination, create, edit, deactivate. Role checks per docs/API.md. Performance endpoint comes later (prompt 05).
6. Tests for every rule above, including forbidden roles.

## Acceptance
- Admin can create a department, a HoD user, assign the HoD, and a REQUESTER can then self-register into that department and be approved.
- A second PRINCIPAL cannot be activated; a HoD cannot be assigned to another department.
- `npm test` and `npm run lint` pass.

## Finish
Commit, summary, stop.
