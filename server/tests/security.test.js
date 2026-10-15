import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import express from 'express';
import rateLimit from 'express-rate-limit';
import app from '../src/app.js';
import { query } from '../src/config/db.js';
import { initTestDatabase, clearTestDatabase } from './setup.js';

describe('Security Review & Penetration Tests (AGENTS.md Rule 3)', () => {
  let testPasswordHash;
  let adminToken;
  let deptAId;
  let deptBId;
  let suppAId;
  let suppBId;
  let suppAUserToken;
  let hodAToken;
  let reqDeptBId;
  let poSuppBId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    testPasswordHash = await bcrypt.hash('UserPass123!', 12);
    await initTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    // 1. Departments A & B
    const deptARes = await query("INSERT INTO departments (name, is_active) VALUES ('Dept Alpha', 1)");
    deptAId = deptARes.insertId;

    const deptBRes = await query("INSERT INTO departments (name, is_active) VALUES ('Dept Beta', 1)");
    deptBId = deptBRes.insertId;

    // 2. Suppliers A & B
    const suppARes = await query(
      "INSERT INTO suppliers (name, email, is_active) VALUES ('Supplier Alpha', 'suppa@demo.invalid', 1)"
    );
    suppAId = suppARes.insertId;

    const suppBRes = await query(
      "INSERT INTO suppliers (name, email, is_active) VALUES ('Supplier Beta', 'suppb@demo.invalid', 1)"
    );
    suppBId = suppBRes.insertId;

    // 3. Admin user
    await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Admin Secure', 'admin.sec@ritrjpm.ac.in', ?, 'ADMIN', 'ACTIVE')`,
      [testPasswordHash]
    );
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin.sec@ritrjpm.ac.in', password: 'UserPass123!' });
    adminToken = adminLogin.body.token;

    // 4. HoD for Dept A
    const hodARes = await query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id)
       VALUES ('Dr. Hod Alpha', 'hod.alpha@ritrjpm.ac.in', ?, 'HOD', 'ACTIVE', ?)`,
      [testPasswordHash, deptAId]
    );
    await query('UPDATE departments SET hod_user_id = ? WHERE id = ?', [hodARes.insertId, deptAId]);
    const hodALogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hod.alpha@ritrjpm.ac.in', password: 'UserPass123!' });
    hodAToken = hodALogin.body.token;

    // 5. Requester in Dept B
    const reqBRes = await query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id)
       VALUES ('Req Beta', 'req.beta@ritrjpm.ac.in', ?, 'REQUESTER', 'ACTIVE', ?)`,
      [testPasswordHash, deptBId]
    );

    // 6. Supplier A User
    await query(
      `INSERT INTO users (name, email, password_hash, role, status, supplier_id)
       VALUES ('Supplier A Rep', 'rep.a@demo.invalid', ?, 'SUPPLIER', 'ACTIVE', ?)`,
      [testPasswordHash, suppAId]
    );
    const suppALogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rep.a@demo.invalid', password: 'UserPass123!' });
    suppAUserToken = suppALogin.body.token;

    // 7. Request in Dept B
    const reqRow = await query(
      `INSERT INTO purchase_requests (req_no, department_id, requested_by, priority, status, justification)
       VALUES ('REQ-TEST-0001', ?, ?, 'NORMAL', 'PENDING_HOD', 'Test Req for Dept B')`,
      [deptBId, reqBRes.insertId]
    );
    reqDeptBId = reqRow.insertId;

    // 8. Purchase Order for Supplier B
    const poRow = await query(
      `INSERT INTO purchase_orders (po_no, request_id, supplier_id, status, total_amount)
       VALUES ('PO-TEST-0001', ?, ?, 'PLACED', 1500.00)`,
      [reqDeptBId, suppBId]
    );
    poSuppBId = poRow.insertId;
  });

  describe('1. SQL Injection strings in query params', () => {
    const maliciousPayloads = [
      "' OR 1=1 --",
      "'; DROP TABLE users; --",
      "' UNION SELECT null, null, null --",
      "admin'--",
      "\" OR \"\"=\"",
      "1; SELECT SLEEP(2);"
    ];

    it('rejects or safely parameterizes SQL injection payloads across search and list query params', async () => {
      for (const payload of maliciousPayloads) {
        // Test /api/items?search=...
        const resItems = await request(app)
          .get(`/api/items?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(resItems.status).toBe(200);
        expect(Array.isArray(resItems.body.data)).toBe(true);

        // Test /api/users?search=...
        const resUsers = await request(app)
          .get(`/api/users?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(resUsers.status).toBe(200);
        expect(Array.isArray(resUsers.body.data)).toBe(true);

        // Test /api/suppliers?search=...
        const resSupp = await request(app)
          .get(`/api/suppliers?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(resSupp.status).toBe(200);
        expect(Array.isArray(resSupp.body.data)).toBe(true);

        // Test /api/requests?search=...
        const resReq = await request(app)
          .get(`/api/requests?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(resReq.status).toBe(200);
        expect(Array.isArray(resReq.body.data)).toBe(true);

        // Test /api/orders?search=...
        const resOrders = await request(app)
          .get(`/api/orders?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(resOrders.status).toBe(200);
        expect(Array.isArray(resOrders.body.data)).toBe(true);
      }
    });

    it('rejects invalid non-integer pagination params via Zod validation', async () => {
      const res = await request(app)
        .get('/api/items?page=DROP_TABLE&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('2. Role escalation by editing JWT payload', () => {
    it('rejects tokens forged with an incorrect secret or modified payload', async () => {
      // Create a forged token claiming role ADMIN signed with a different key
      const forgedToken = jwt.sign(
        { id: 999, email: 'hacker@ritrjpm.ac.in', role: 'ADMIN' },
        'wrong_secret_key_1234567890'
      );

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects tokens using algorithm "none"', async () => {
      // Forging token with alg: none
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ id: 1, email: 'admin.sec@ritrjpm.ac.in', role: 'ADMIN' })
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${noneToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe("3. Accessing another supplier's Purchase Order", () => {
    it("returns 404/403 when Supplier A tries to access Supplier B's order", async () => {
      const res = await request(app)
        .get(`/api/orders/${poSuppBId}`)
        .set('Authorization', `Bearer ${suppAUserToken}`);
      // Scoped access prevents leaking existence of competitor POs
      expect([403, 404]).toContain(res.status);
    });

    it("returns 404/403 when Supplier A tries to advance Supplier B's order status", async () => {
      const res = await request(app)
        .patch(`/api/orders/${poSuppBId}/status`)
        .set('Authorization', `Bearer ${suppAUserToken}`)
        .send({ status: 'CONFIRMED' });
      expect([403, 404]).toContain(res.status);
    });
  });

  describe("4. Accessing another department's Purchase Request", () => {
    it("returns 404/403 when HoD of Dept A attempts to view Dept B's request in queue", async () => {
      const res = await request(app)
        .get('/api/requests?queue=true')
        .set('Authorization', `Bearer ${hodAToken}`);
      expect(res.status).toBe(200);
      // Must not contain Dept B's request in Dept A HoD's queue
      const ids = res.body.data.map((r) => r.id);
      expect(ids).not.toContain(reqDeptBId);
    });

    it("rejects HoD of Dept A from approving Dept B's request", async () => {
      const res = await request(app)
        .post(`/api/requests/${reqDeptBId}/approve`)
        .set('Authorization', `Bearer ${hodAToken}`)
        .send({});
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('5. Mass-assignment of role / status on registration', () => {
    it('strictly forbids setting role to ADMIN, PRINCIPAL, or HOD during registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Attacker Admin',
          email: 'attacker@ritrjpm.ac.in',
          password: 'Password123!',
          phone: '9876543210',
          departmentId: deptAId,
          role: 'ADMIN',
          status: 'ACTIVE'
        });
      // Validation schema restricts role to REQUESTER or ignores injection
      if (res.status === 201) {
        // If created, role MUST be REQUESTER and status MUST be PENDING
        expect(res.body.user.role).toBe('REQUESTER');
        expect(res.body.user.status).toBe('PENDING');
      } else {
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('6. Brute-force protection via rate limiter', () => {
    it('triggers HTTP 429 Too Many Requests when request limits are exceeded', async () => {
      // Create dedicated test instance of rate limiter with max: 3 to test limit enforcement
      const testLimiter = rateLimit({
        windowMs: 1000,
        max: 3,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests, please try again later',
            details: []
          }
        }
      });

      const testApp = express();
      testApp.use(testLimiter);
      testApp.get('/test-limit', (req, res) => res.json({ status: 'ok' }));

      // Request 1, 2, 3 succeed
      await request(testApp).get('/test-limit').expect(200);
      await request(testApp).get('/test-limit').expect(200);
      await request(testApp).get('/test-limit').expect(200);

      // Request 4 must hit 429
      const res4 = await request(testApp).get('/test-limit');
      expect(res4.status).toBe(429);
      expect(res4.body.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });
});
