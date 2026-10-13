# Prompt 10 — Tests, documentation, hardening, CI
Branch: `feat/10-final`. Read first: AGENTS.md, docs/SPEC.md, all of docs/.

## Do
1. Coverage review: list services without tests and add them; report coverage; target 80% on `server/src/services`.
2. Security review against AGENTS.md rule 3: attempt and record the results of: SQL injection strings in every query param, role escalation by editing JWT payload, accessing another supplier's PO, another department's request, mass-assignment of `role`/`status` on registration, brute-force on login hitting the rate limiter. Fix anything that fails. Run `npm audit` and fix or document findings.
3. Add a GitHub Actions workflow: install, lint, test (with a MySQL service container), build client.
4. Complete the README: overview, features, screenshots placeholders, architecture, ER diagram and workflow diagram as Mermaid, prerequisites, setup, env table, scripts, demo-data usage, project structure, testing, licence.
5. Create `docs/ARCHITECTURE.md` (layers, request flow, transaction and locking strategy, notification flow) and `docs/USER-GUIDE.md` (one section per role with the actions they can perform).
6. Create `docs/TEST-REPORT.md` listing test cases (ID, scenario, expected, actual, pass/fail) generated from the actual automated test results and the manual walkthrough you run now. Do not invent results.
7. Final end-to-end walkthrough on a clean database: migrate, create-admin, build the master data, run the full workflow, run demo:load and demo:clear.

## Acceptance
- CI workflow is green on a pull request.
- Security review table shows each attack attempted and the observed behaviour.
- A new developer can follow the README from a clean clone to a running app in under 15 minutes.

## Finish
Commit, summary, stop. Tag `v1.0.0`.
