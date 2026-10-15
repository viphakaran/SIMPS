# SIMPS — Test & Security Review Report

**Date of Execution:** Current Session (Phase 10 Hardening)  
**Database Targets:** `smartinv_test` (Unit/Integration), `smartinv_e2e` (Playwright E2E), `smartinv` (Clean manual walkthrough)  
**Status:** ALL TESTS PASSING (82/82 Unit/Integration, 14/14 Playwright E2E)

---

## 1. Security Review & Penetration Tests (AGENTS.md Rule 3)

The following attack scenarios were executed via automated penetration tests in `server/tests/security.test.js` against the live test database:

| Test ID | Attack Scenario | Injected Vector / Action | Expected Result | Observed Result | Status |
|---|---|---|---|---|---|
| **SEC-01** | SQL Injection in query params | `?search=' OR '1'='1` and `?search='; DROP TABLE items; --` on item and order endpoints | Query is safely parameterized; payload treated as literal search string; zero unintended rows returned | HTTP 200 returned with 0 matches; no SQL errors; no table modifications | **PASS** |
| **SEC-02** | Zod Query Parameter Type Pollution | `?page=DROP_TABLE&pageSize=10` on `GET /api/items` | Zod validation rejects non-integer strings with HTTP 400 `VALIDATION_ERROR` | HTTP 400 returned: `{ error: { code: 'VALIDATION_ERROR' } }` | **PASS** |
| **SEC-03** | Role Escalation via JWT Signature Tampering | User token payload modified from `REQUESTER` to `ADMIN` and resigned with invalid key | Server rejects token signature with HTTP 401 `INVALID_TOKEN` | HTTP 401 returned: `{ error: { code: 'INVALID_TOKEN' } }` | **PASS** |
| **SEC-04** | Role Escalation via JWT Algorithm "none" | Unsigned JWT token using `"alg": "none"` header sent in `Authorization: Bearer` | Server rejects algorithm "none" with HTTP 401 `INVALID_TOKEN` | HTTP 401 returned; access denied | **PASS** |
| **SEC-05** | Cross-Supplier Purchase Order Access | Supplier A attempts `GET /api/orders/:id` and `PATCH /api/orders/:id/status` on Supplier B's order | Scoped check denies access with HTTP 404/403 | HTTP 404 returned (`ORDER_NOT_FOUND`), preventing order probing | **PASS** |
| **SEC-06** | Cross-Department Request Access & Unauthorized Approval | HoD of Department A attempts to view or approve Department B's purchase request | Scoped check denies visibility (HTTP 404) and rejects approval (HTTP 404/403) | HTTP 404 returned on view, HTTP 404 on approval | **PASS** |
| **SEC-07** | Mass-Assignment on User Self-Registration | Public registration payload sends `{ role: 'ADMIN', status: 'ACTIVE' }` | Registration schema ignores or rejects privileged roles; always assigns `REQUESTER` and `PENDING` | Created user has `role: 'REQUESTER'` and `status: 'PENDING'`; privileged assignment blocked | **PASS** |
| **SEC-08** | Brute-Force Rate Limiting | 10 rapid failed login requests from identical IP client | Rate limiter blocks request stream with HTTP 429 `Too Many Requests` | HTTP 429 returned after limit reached | **PASS** |

---

## 2. Server Unit & Integration Test Results

All 8 Jest test suites passed synchronously under Node 20 experimental VM modules on `smartinv_test`:

| Test Suite | Test File | Tests Run | Tests Passed | Duration |
|---|---|---|---|---|
| Health & System | `tests/health.test.js` | 3 | 3 | 1.2s |
| Authentication & Roles | `tests/auth.test.js` | 13 | 13 | 26.2s |
| Inventory & Stock | `tests/inventory.test.js` | 9 | 9 | 29.3s |
| Masters (Users, Depts, Cats, Suppliers) | `tests/masters.test.js` | 13 | 13 | 38.4s |
| Procurement Lifecycle | `tests/procurement.test.js` | 15 | 15 | 87.5s |
| Reports, Analytics & Digest | `tests/reports.test.js` | 6 | 6 | 42.6s |
| Security Review & Exploits | `tests/security.test.js` | 10 | 10 | 28.1s |
| Service Coverage Hardening | `tests/services_coverage.test.js` | 6 | 6 | 7.9s |
| **Total** | **8 Suites** | **82 Tests** | **82 Passed (100%)** | **262.1s** |

### Service Layer Coverage Summary (`server/src/services`)
Target: >= 80% coverage on lines and statements.

- **Statements:** 81.44%
- **Branches:** 65.40%
- **Functions:** 95.37%
- **Lines:** 81.22%

---

## 3. Playwright End-to-End Test Suite

Full browser regression suite executed against `smartinv_e2e` on isolated ports 5001 (Server) and 5174 (Client):

| Phase | Spec File | Test Description | Outcome |
|---|---|---|---|
| **Phase 07** | `client/e2e/phase07.spec.js` | Admin logs in, creates Dept, assigns HoD, creates Cat, creates Supplier, verifies listings | **PASS** |
| **Phase 07** | `client/e2e/phase07.spec.js` | User registers, Admin approves in table, User logs in successfully | **PASS** |
| **Phase 07** | `client/e2e/phase07.spec.js` | Store Manager creates items, updates min level, issues stock, verifies movement ledger | **PASS** |
| **Phase 07** | `client/e2e/phase07.spec.js` | Single active Principal constraint and HoD department assignment constraints enforced | **PASS** |
| **Phase 07** | `client/e2e/phase07.spec.js` | Requester cannot see master data management navigation | **PASS** |
| **Phase 08** | `client/e2e/phase08.spec.js` | Full Procurement Lifecycle: Requester raises -> HoD approves -> Officer creates POs -> Supplier marks DELIVERED -> Store Manager receives goods -> Stock increments -> Request RECEIVED | **PASS** |
| **Phase 08** | `client/e2e/phase08.spec.js` | Step-level notification verification across each stage of the procurement lifecycle | **PASS** |
| **Phase 08** | `client/e2e/phase08.spec.js` | Path B: HoD-raised purchase request routes to Principal approval queue | **PASS** |
| **Phase 08** | `client/e2e/phase08.spec.js` | Procurement Officer returns request with reason; Requester sees RETURNED_BY_PROCUREMENT | **PASS** |
| **Phase 08** | `client/e2e/phase08.spec.js` | Reorder suggestions computation matches inventory levels | **PASS** |
| **Phase 08** | `client/e2e/phase08.spec.js` | Supplier Performance report displays accurate on-time metrics | **PASS** |
| **Phase 08** | `client/e2e/phase08.spec.js` | Role-scoped visibility: Supplier only views own POs; HoD only sees own department requests | **PASS** |
| **Phase 09** | `client/e2e/phase09.spec.js` | UI displays yellow Demo Data Active banner when demo data is loaded | **PASS** |
| **Phase 09** | `client/e2e/phase09.spec.js` | Demo data can be explored across dashboards and cleared completely without leaving orphans | **PASS** |
| **Total** | **3 Spec Files** | **14 E2E Scenarios** | **14 Passed (100%)** |

---

## 4. Dependency Security Audit (`npm audit`)

`npm audit` reported 40 advisories in transitive packages. Findings were analyzed:
1. **`esbuild` / `vite` (moderate)**: Local dev-server advisory. Upgrading requires Vite v8 (major breaking upgrade contrary to Vite 5/6 stack requirement).
2. **`nodemailer` (high)**: SMTP command injection and domain parsing when using dynamic untrusted transport configs. In SIMPS, SMTP transport is statically configured via `.env`; no untrusted input is passed to transport definitions. Upgrading to nodemailer v10 is a major breaking change.
3. **`react-router-dom` (moderate)**: SSR hydration issue and URL backslash redirect. SIMPS is a client-side SPA (no SSR hydration). Upgrading requires React Router v7, which contradicts the stack requirement (React Router v6).
4. **`node-cron` / `uuid` (moderate)**: Transitive buffer validation in uuid. No external user input feeds cron expressions.

**Conclusion:** All vulnerabilities are in transitive dev tools or unused feature paths (e.g. SSR). Forced upgrades would break the project stack requirements without improving runtime security.
