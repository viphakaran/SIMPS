# Prompt 06 — Client foundation
Branch: `feat/06-client-foundation`. Read first: AGENTS.md, docs/UI.md, docs/API.md (System, Auth).

## Do
1. Install and configure React Router 6, Bootstrap 5, bootstrap-icons, `@fontsource/inter`, axios, Recharts. Create `styles/theme.css` with the tokens from docs/UI.md overriding Bootstrap variables.
2. `api/client.js`: axios instance using `VITE_API_URL`, bearer token injection, response interceptor that clears auth and redirects to /login on 401, and normalizes the standard error shape.
3. `AuthContext`: login, logout, current user, token kept in `sessionStorage`, restore on reload by calling `/auth/me`.
4. App shell: sidebar with role-filtered navigation (items from the Pages table in docs/UI.md; routes not yet built render a "Coming soon" placeholder page), top bar with notification bell (unread count from the API) and user menu (change password, logout), responsive offcanvas under 992px, the "Demo data loaded" banner driven by `/api/meta`.
5. Route guards: `ProtectedRoute` (auth) and `RoleRoute` (roles) with /403 and /404 pages.
6. Shared components listed in docs/UI.md: DataTable, StatusBadge (with the colour map), PageHeader, Card, StatCard, Modal, ConfirmDialog, Toast, FormField, EmptyState, LoadingState, ErrorState, Timeline, ConfirmReason.
7. Pages: Login, Register (loads `/departments/public`), pending-approval message, change password.
8. No mock data anywhere. Every data view must implement loading, empty and error states.

## Acceptance
- With the server running: register a REQUESTER, see the pending message, log in as admin (created via CLI), log out and in again; wrong password shows a clear inline error.
- Navigation shows only the entries allowed for the logged-in role; direct URL access to a forbidden route shows /403.
- Stop the server: pages show the error state with Retry, not fake data.
- `npm run lint` and `npm run build -w client` pass.

## Finish
Commit, summary, stop.
