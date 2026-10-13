# Prompt 00 — Repository scaffold
Branch: `feat/00-scaffold`. Read first: AGENTS.md, docs/SPEC.md section 1, db/001_init.sql (do not edit).

## Do
1. Create an npm-workspaces monorepo: `client/` (Vite + React), `server/` (Express), `demo/` (Node scripts). Root `package.json` with scripts:
   `dev` (client + server together), `migrate`, `create-admin`, `demo:load`, `demo:clear`, `demo:status`, `lint`, `test`.
2. Add ESLint (flat config) + Prettier + `.editorconfig`, a Node-focused `.gitignore` (node_modules, .env, dist, coverage), and `.nvmrc` (20).
3. Add `docker-compose.yml` with MySQL 8 only (utf8mb4, named volume, port 3306, healthcheck) and the env vars it needs.
4. Add `server/.env.example` (PORT, NODE_ENV, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_NAME_TEST, JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGIN, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM) and `client/.env.example` (VITE_API_URL).
5. Create the empty folder structure from AGENTS.md (server `src/{config,routes,controllers,services,middleware,utils}`, `server/tests`, client `src/{api,components,context,pages,styles}`), each with a minimal working entry point: server answers `GET /api/health` with `{status:"ok"}`; client renders a placeholder heading.
6. Write a README skeleton: project summary, prerequisites, quick start (placeholders to be completed in prompt 10).
7. Initial commit on `main`, then work on the branch.

## Acceptance
- `docker compose up -d` starts MySQL healthy.
- `npm install` at root succeeds; `npm run dev` serves client and server; `curl localhost:<PORT>/api/health` returns ok.
- `npm run lint` passes. No secrets committed (`git ls-files | grep .env` shows only `.env.example` files).

## Finish
Commit, summary, stop.
