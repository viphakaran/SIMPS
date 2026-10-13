# SmartInv — REST API v1

Base path `/api`. JSON in and out, camelCase. Auth: `Authorization: Bearer <jwt>` except where marked Public.
Errors: `{ "error": { "code", "message", "details" } }` with HTTP 400 (validation), 401, 403, 404, 409, 429, 500.
Lists: `?page=1&pageSize=20&search=` -> `{ data, page, pageSize, total }`. "Scope" rules are in docs/SPEC.md section 4.

## System
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | /health | Public | Liveness and DB check |
| GET | /meta | Public | `{ demoDataPresent }` |

## Auth
| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | /auth/register | Public | Self-register a REQUESTER (status PENDING). Body: name, email, password, phone, departmentId |
| POST | /auth/login | Public | Returns `{ token, user }`; 403 ACCOUNT_PENDING / ACCOUNT_DISABLED |
| GET | /auth/me | Any | Current user |
| POST | /auth/change-password | Any | currentPassword, newPassword |

## Users, departments, categories
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | /users | ADMIN | List; filter `role`, `status` |
| POST | /users | ADMIN | Create any role (ACTIVE) |
| PATCH | /users/:id | ADMIN | Edit name, phone, role, department, supplier link |
| POST | /users/:id/approve | ADMIN | PENDING -> ACTIVE (notifies user) |
| POST | /users/:id/disable | ADMIN | -> DISABLED |
| POST | /users/:id/enable | ADMIN | DISABLED -> ACTIVE |
| GET | /departments | Any authenticated (also Public list `GET /departments/public` for the register form) | List |
| POST, PATCH | /departments, /departments/:id | ADMIN | Create / edit / deactivate |
| PUT | /departments/:id/hod | ADMIN | Assign HoD (`userId`) |
| GET | /categories | Any authenticated | List |
| POST, PATCH | /categories, /categories/:id | ADMIN | Create / rename |

## Suppliers
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | /suppliers | ADMIN, PRINCIPAL, PROCUREMENT_OFFICER, STORE_MANAGER | List |
| POST | /suppliers | ADMIN, PROCUREMENT_OFFICER | Create |
| PATCH | /suppliers/:id | ADMIN, PROCUREMENT_OFFICER | Edit / deactivate |
| GET | /suppliers/:id/performance | ADMIN, PRINCIPAL, PROCUREMENT_OFFICER | Metrics (SPEC section 9) |

## Inventory
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | /items | All except SUPPLIER | List; filters `categoryId`, `status` (IN_STOCK/LOW/OUT), `active`, `search` |
| GET | /items/:id | All except SUPPLIER | Detail with derived status |
| POST | /items | STORE_MANAGER | Create (opening stock creates an ADJUSTMENT movement) |
| PATCH | /items/:id | STORE_MANAGER | Edit name, category, unit, minLevel, unitCost, isActive (never stockQty) |
| POST | /items/:id/issue | STORE_MANAGER | quantity, departmentId, reason |
| POST | /items/:id/adjust | STORE_MANAGER | delta (signed, non-zero), reason (required) |
| GET | /items/:id/movements | All except SUPPLIER | Movement history, paginated |
| GET | /stock-movements | STORE_MANAGER, PROCUREMENT_OFFICER, PRINCIPAL, ADMIN | All movements; filters item, type, date range |
| GET | /items/reorder-suggestions | STORE_MANAGER, PROCUREMENT_OFFICER | SPEC section 9 formula with inputs |

## Requests
| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | /requests | HOD, REQUESTER | departmentId is taken from the user; body: priority, justification, lines[{itemId, quantity}] |
| GET | /requests | Scoped | Filters `status`, `departmentId`, `mine=true`, `queue=true` (items awaiting my decision / processing) |
| GET | /requests/:id | Scoped | Detail with lines, approvals timeline, linked POs |
| POST | /requests/:id/decision | HOD, PRINCIPAL | `{ decision: APPROVED\|REJECTED, reason }` |
| POST | /requests/:id/cancel | Requester who raised it | While pending |
| POST | /requests/:id/return | PROCUREMENT_OFFICER | reason required; APPROVED -> RETURNED_BY_PROCUREMENT |
| POST | /requests/:id/orders | PROCUREMENT_OFFICER | `{ expectedDate, lines[{requestItemId, supplierId, unitPrice}] }` -> creates POs, request -> ORDERED |

## Orders
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | /orders | ADMIN, PRINCIPAL, PROCUREMENT_OFFICER, STORE_MANAGER, SUPPLIER (own) | List; filters `status`, `supplierId`, `overdue=true` |
| GET | /orders/:id | Same | Detail with lines |
| PATCH | /orders/:id/status | SUPPLIER (own): CONFIRMED, SHIPPED, DELIVERED; PROCUREMENT_OFFICER: CANCELLED | Transition map enforced |
| POST | /orders/:id/receive | STORE_MANAGER | DELIVERED -> RECEIVED, adds stock transactionally |

## Notifications
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | /notifications | Any | Own; filter `unread=true`; also returns `unreadCount` |
| PATCH | /notifications/:id/read | Any | Mark one read |
| POST | /notifications/read-all | Any | Mark all read |

## Reports
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | /reports/dashboard | Any authenticated | Role-specific widgets (SPEC section 9) |
| GET | /reports/inventory | ADMIN, PRINCIPAL, PROCUREMENT_OFFICER, STORE_MANAGER | `?format=csv` supported |
| GET | /reports/procurement | ADMIN, PRINCIPAL, PROCUREMENT_OFFICER, STORE_MANAGER, HOD (own dept) | Filters from, to, status, departmentId; `?format=csv` |
| GET | /reports/suppliers | ADMIN, PRINCIPAL, PROCUREMENT_OFFICER | Performance table; `?format=csv` |
