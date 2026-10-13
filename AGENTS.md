# AGENTS.md — SmartInv

Web application for the central store of Ramco Institute of Technology: stock tracking, purchase
requests with HoD/Principal approval, purchase orders to suppliers, goods receipt, alerts and reports.
It is an academic mini project, but it must behave like a real working system.

## Source of truth
Read before every task: `docs/SPEC.md` (behaviour), `db/001_init.sql` (schema), `docs/API.md` (endpoints),
`docs/UI.md` (design and screens). If a prompt conflicts with these, stop and ask. If the docs are
incomplete, propose the doc change first. Never improvise silently.

## Stack (fixed; do not substitute)
- Server: Node.js 20, Express 4, `mysql2/promise` (plain SQL, no ORM), `zod`, `bcryptjs`, `jsonwebtoken`,
  `helmet`, `cors`, `express-rate-limit`, `morgan`, `nodemailer`, `node-cron`. Tests: Jest + Supertest.
- Client: React 18 + Vite, `react-router-dom` 6, `bootstrap` 5 + `bootstrap-icons` (installed via npm, never CDN),
  `axios`, `recharts`.
- Database: MySQL 8.0+ (InnoDB, utf8mb4).
- Plain JavaScript (ES modules). No TypeScript, Tailwind, ORM or extra UI kit.
- Tooling: ESLint + Prettier, npm workspaces (`client`, `server`, `demo`).

## Non-negotiable rules
1. **No fabricated data anywhere** in app code, migrations, fixtures, fallbacks or UI. An empty database
   shows empty states. If the API fails, show an error state with retry. Never fall back to mock data.
2. **Demo data exists only in `demo/`**, loaded and removed by CLI. Every row it creates has `is_demo = 1`.
   Any row created by normal use that references a demo row (item, request, PO, user) also gets `is_demo = 1`,
   so `demo:clear` never leaves orphans and never touches real rows.
3. **Security:** bcrypt cost 12; JWT secret and expiry from env; parameterized queries only; zod validation on
   every body, query and params; role AND scope checks in the API (hiding buttons is not security);
   helmet; rate limiting on auth routes; never return `password_hash`; generic login error messages;
   CORS origin from env; load the user's current status on every authenticated request.
4. **Integrity:** multi-table writes use a transaction; stock changes only through the stock service, under
   `SELECT ... FOR UPDATE`, writing a `stock_movements` row; status changes only through a transition map
   using `UPDATE ... WHERE id=? AND status=?` and checking `affectedRows` (409 on mismatch).
5. **Errors** use one shape: `{ "error": { "code": "...", "message": "...", "details": [] } }`.
6. **Secrets** are never committed. Keep `.env.example` current.

## Conventions
- Server layout: `server/src/{config,routes,controllers,services,middleware,utils}`; business rules and SQL live in services.
- DB columns are snake_case; JSON and JS are camelCase (convert at the service boundary).
- Lists accept `?page&pageSize&search` and return `{ data, page, pageSize, total }`.
- Dates are stored in UTC and sent as ISO 8601. Money is DECIMAL(…,2) in the DB and a number in JSON.
- Git: branch `feat/NN-name` per prompt, Conventional Commits, small commits, never commit `.env` or `node_modules`.

## Definition of done (every prompt)
- The app runs without errors; every acceptance check in the prompt passes.
- Lint passes; new service logic has tests.
- Docs updated if behaviour changed.
- Final message lists: what changed, deviations from the docs, and exact commands to verify.
- Then **stop and wait**. Do not start the next prompt.

## Working style
Plan first. Make small steps. Do not refactor unrelated code or add features outside the prompt.
Ask when something is ambiguous. Never run destructive database commands against anything but the dev
or test database.
