# SIMPS (Smart Inventory and Procurement Management System)

Everything an AI coding agent (Antigravity) needs to build the Smart Inventory and Procurement
Management System (SIMPS) for Ramco Institute of Technology's central store.

## Contents
| Path | Purpose |
|---|---|
| `AGENTS.md` | Standing rules for the agent: stack, security, data-integrity and "no fake data" rules |
| `docs/SPEC.md` | Behaviour: roles, permissions, workflows, business rules, requirements |
| `db/001_init.sql` | The database schema (MySQL 8) |
| `docs/API.md` | REST endpoint contract |
| `docs/UI.md` | Light SaaS design system and screen list |
| `prompts/00..10` | Build prompts, run in order |

## How to use
1. Create the GitHub repo (`smart-inventory-procurement`), clone it, and copy this pack's contents into the repo root.
2. Install: Node 20+, MySQL 8 (or Docker), Git.
3. Open the repo folder in Antigravity. Add the contents of `AGENTS.md` as a workspace rule so it applies to every agent session (check Antigravity's current Customizations/Rules settings for the exact place).
4. Run the prompts **in order, one per agent conversation**. Start each session with:
   > Read AGENTS.md, then read and execute prompts/NN-name.md. Show me a plan first.
5. Review the plan before approving. When the agent finishes, run the acceptance checks yourself, commit, merge the branch, then start the next prompt.
6. The docs are the source of truth. If the agent drifts, tell it to re-read them. If a doc is wrong, fix the doc first, then continue.

## Principles
- One prompt = one reviewable unit of work on its own branch.
- Acceptance checks are commands you can run, not opinions.
- The app contains no fabricated data. Demo data lives only in `demo/` and can be attached and removed with one command each.
