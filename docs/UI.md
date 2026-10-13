# SmartInv — UI Guidelines

Standard, simple, professional, light-theme SaaS. Consistency over decoration.

## Design tokens (CSS variables in `client/src/styles/theme.css`, override Bootstrap defaults)
- Background `#F6F7F9`, surface `#FFFFFF`, border `#E5E7EB`, text `#111827`, muted text `#6B7280`.
- Primary `#2563EB` (hover `#1D4ED8`), success `#16A34A`, warning `#D97706`, danger `#DC2626`, info `#0891B2`.
- Radius 8px, subtle shadow on cards only (`0 1px 2px rgba(16,24,40,.06)`), spacing scale 4/8/12/16/24/32.
- Font: Inter (npm `@fontsource/inter`, no CDN), fallback system-ui. Base 14px, headings 600 weight.
- Icons: `bootstrap-icons` only. No emojis, no gradients, no stock images, no remote assets.

## Layout
- Fixed left sidebar (240px, white, right border) with nav items filtered by role; collapses to an offcanvas menu under 992px.
- Top bar (56px): page title, notification bell with unread count, user menu (profile, change password, logout).
- Content: max-width 1280px, page header (title, description, primary action on the right), then cards or tables.
- If `GET /api/meta` says demo data is present, show a slim info banner: "Demo data loaded".

## Shared components
DataTable (server pagination, search, sortable headers, row actions), StatusBadge, PageHeader, Card, StatCard,
Modal, ConfirmDialog, Toast, FormField (label, hint, inline error), EmptyState (icon, message, action),
LoadingState (skeleton rows), ErrorState (message + Retry), Timeline (approval history), ConfirmReason (reject/return).

## Status badge colours
Success: IN_STOCK, APPROVED, RECEIVED, ACTIVE, DELIVERED. Warning: LOW, PENDING_HOD, PENDING_PRINCIPAL, PENDING, PLACED, CONFIRMED.
Info: SHIPPED, ORDERED. Danger: OUT, REJECTED, CANCELLED, DISABLED, RETURNED_BY_PROCUREMENT. Neutral: everything else.

## States (mandatory on every data view)
Loading skeleton, empty state with a helpful next action, error state with retry, inline form validation
matching server error codes, disabled buttons while submitting. Never show mock or placeholder numbers.

## Pages and routes
| Route | Roles | Content |
|---|---|---|
| /login, /register | Public | Auth forms; register shows department select; pending message after sign-up |
| /dashboard | All | Role-specific stat cards, lists, one or two charts (Recharts) |
| /items, /items/:id | Not SUP | List with filters; detail with movements; STO gets add/edit/issue/adjust |
| /reorder | STO, PRO | Suggestions table showing inputs and suggested quantity, "Create request" shortcut for STO |
| /requests, /requests/new, /requests/:id | HOD, REQ (+ read for others) | My requests, multi-line request form, detail with timeline |
| /approvals | HOD, PRI | Queue with approve / reject (reason) actions |
| /procurement | PRO | Approved requests queue; create-PO screen assigning supplier and price per line; return with reason |
| /orders, /orders/:id | PRO, STO, PRI, ADM, SUP (own) | List and detail; SUP status buttons; STO "Receive goods" |
| /suppliers, /suppliers/:id | PRO, ADM, PRI, STO | List, form, performance panel |
| /users, /departments, /categories | ADM | Account approvals tab, user CRUD, HoD assignment |
| /reports | ADM, PRI, PRO, STO, HOD | Inventory, procurement, supplier reports with filters and CSV export |
| /notifications | All | Inbox with read/unread |
| /403, /404 | - | Error pages |

## Accessibility and quality
Semantic HTML, labels on all inputs, visible focus ring, colour never the only status signal (badge text always present),
keyboard-operable modals, mobile-friendly tables (horizontal scroll container).
