# Prompt 01 — Server core and authentication
Branch: `feat/01-server-core-auth`. Read first: AGENTS.md, docs/SPEC.md sections 2-4, docs/API.md (System, Auth), db/001_init.sql.

## Do
1. `config/env.js`: load and validate env with zod; fail fast with a clear message.
2. `config/db.js`: mysql2/promise pool (connectionLimit 10, `decimalNumbers: true`, `dateStrings: false`, timezone `Z`); helper `withTransaction(fn)`.
3. Migration runner `server/scripts/migrate.js` (`npm run migrate`): applies `db/*.sql` in filename order inside a `schema_migrations` table, skipping applied files, each file in its own run, clear logging. It must work on an empty database and be safe to re-run.
4. App setup: helmet, cors (origin from env), `express.json({limit:'100kb'})`, morgan, rate limiter on `/api/auth/*`, `AppError` class, zod `validate` middleware (body, query, params), central error handler producing the standard error shape, 404 handler, graceful shutdown.
5. Routes: `GET /api/health` (checks DB), `GET /api/meta` (`demoDataPresent`).
6. Auth service/controller/routes per docs/API.md: register (REQUESTER only, PENDING, department must exist and be active), login, me, change-password. bcrypt cost 12, JWT with expiry from env, generic message for bad credentials, 403 codes for PENDING/DISABLED.
7. Middleware `authenticate` (verifies JWT, loads the user's current row, rejects non-ACTIVE) and `authorize(...roles)`.
8. CLI `server/scripts/create-admin.js` (`npm run create-admin -- --name --email --password`, or interactive prompt if omitted). Refuse if the email exists. Never log the password.
9. Tests (Jest + Supertest against `DB_NAME_TEST`, migrate in global setup, clean tables between tests): register, duplicate email, login success and failure, pending/disabled login, me, change-password, authorize 403.

## Acceptance
- `npm run migrate` on an empty DB creates all tables; running it twice changes nothing.
- `npm run create-admin` creates an ACTIVE admin; login returns a token; `GET /api/auth/me` works; tampered token returns 401.
- Registering as a role other than REQUESTER is impossible (field ignored or rejected).
- `npm test` passes; `npm run lint` passes.

## Finish
Commit, summary, stop.
