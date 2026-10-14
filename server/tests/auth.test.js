import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { query } from '../src/config/db.js';
import { initTestDatabase, clearTestDatabase } from './setup.js';
import { authorize } from '../src/middleware/auth.js';
import { authenticate } from '../src/middleware/auth.js';

import express from 'express';

const testAuthApp = express();
testAuthApp.use(express.json());
testAuthApp.get('/api/test-admin-only', authenticate, authorize('ADMIN'), (req, res) => {
  res.json({ message: 'admin access granted' });
});
testAuthApp.use((err, req, res, _next) => {
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message
    }
  });
});

describe('Server Core, Auth & System Endpoints', () => {
  let activeDepartmentId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    // Insert an active department for testing
    const deptResult = await query(
      "INSERT INTO departments (name, is_active) VALUES ('Computer Science', 1)"
    );
    activeDepartmentId = deptResult.insertId;
  });

  describe('System Endpoints', () => {
    it('GET /api/health returns ok status and verifies DB connectivity', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /api/meta returns demoDataPresent: false when no demo users exist', async () => {
      const res = await request(app).get('/api/meta');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ demoDataPresent: false });
    });

    it('GET /api/meta returns demoDataPresent: true when a demo user exists', async () => {
      const hash = await bcrypt.hash('Password123', 12);
      await query(
        `INSERT INTO users (name, email, password_hash, role, status, is_demo)
         VALUES ('Demo User', 'demo@ritrkpm.ac.in', ?, 'REQUESTER', 'ACTIVE', 1)`,
        [hash]
      );

      const res = await request(app).get('/api/meta');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ demoDataPresent: true });
    });

    it('GET /api/non-existent returns 404 in standard error shape', async () => {
      const res = await request(app).get('/api/non-existent');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/auth/register', () => {
    it('successfully registers a REQUESTER with PENDING status', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@ritrkpm.ac.in',
          password: 'Password123',
          phone: '9876543210',
          departmentId: activeDepartmentId
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toBe('jane@ritrkpm.ac.in');
      expect(res.body.role).toBe('REQUESTER');
      expect(res.body.status).toBe('PENDING');
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('password_hash');

      // Verify DB row
      const [user] = await query('SELECT * FROM users WHERE email = ?', ['jane@ritrkpm.ac.in']);
      expect(user.status).toBe('PENDING');
      expect(user.role).toBe('REQUESTER');
    });

    it('rejects duplicate email with 409 Conflict', async () => {
      const payload = {
        name: 'Jane Doe',
        email: 'duplicate@ritrkpm.ac.in',
        password: 'Password123',
        departmentId: activeDepartmentId
      };

      const res1 = await request(app).post('/api/auth/register').send(payload);
      expect(res1.status).toBe(201);

      const res2 = await request(app).post('/api/auth/register').send(payload);
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('rejects self-registration for any role other than REQUESTER', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Hacker',
          email: 'hacker@ritrkpm.ac.in',
          password: 'Password123',
          departmentId: activeDepartmentId,
          role: 'ADMIN'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects registration with invalid department ID', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'No Dept',
          email: 'nodept@ritrkpm.ac.in',
          password: 'Password123',
          departmentId: 99999
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DEPARTMENT');
    });

    it('rejects registration with weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Weak Pass',
          email: 'weak@ritrkpm.ac.in',
          password: 'short',
          departmentId: activeDepartmentId
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    let passwordHash;

    beforeEach(async () => {
      passwordHash = await bcrypt.hash('Password123', 12);
    });

    it('logs in an ACTIVE user and returns JWT and user profile', async () => {
      await query(
        `INSERT INTO users (name, email, password_hash, role, status, department_id)
         VALUES ('Active User', 'active@ritrkpm.ac.in', ?, 'REQUESTER', 'ACTIVE', ?)`,
        [passwordHash, activeDepartmentId]
      );

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ACTIVE@RITRKPM.AC.IN', // verify case insensitivity
          password: 'Password123'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toMatchObject({
        email: 'active@ritrkpm.ac.in',
        role: 'REQUESTER',
        status: 'ACTIVE'
      });
      expect(res.body.user).not.toHaveProperty('password_hash');
    });

    it('returns generic 401 INVALID_CREDENTIALS for wrong password', async () => {
      await query(
        `INSERT INTO users (name, email, password_hash, role, status, department_id)
         VALUES ('Active User', 'active@ritrkpm.ac.in', ?, 'REQUESTER', 'ACTIVE', ?)`,
        [passwordHash, activeDepartmentId]
      );

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'active@ritrkpm.ac.in',
          password: 'WrongPassword999'
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns generic 401 INVALID_CREDENTIALS for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@ritrkpm.ac.in',
          password: 'Password123'
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 403 ACCOUNT_PENDING when user status is PENDING', async () => {
      await query(
        `INSERT INTO users (name, email, password_hash, role, status, department_id)
         VALUES ('Pending User', 'pending@ritrkpm.ac.in', ?, 'REQUESTER', 'PENDING', ?)`,
        [passwordHash, activeDepartmentId]
      );

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'pending@ritrkpm.ac.in',
          password: 'Password123'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_PENDING');
    });

    it('returns 403 ACCOUNT_DISABLED when user status is DISABLED', async () => {
      await query(
        `INSERT INTO users (name, email, password_hash, role, status, department_id)
         VALUES ('Disabled User', 'disabled@ritrkpm.ac.in', ?, 'REQUESTER', 'DISABLED', ?)`,
        [passwordHash, activeDepartmentId]
      );

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'disabled@ritrkpm.ac.in',
          password: 'Password123'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });
  });

  describe('GET /api/auth/me', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const hash = await bcrypt.hash('Password123', 12);
      const userRes = await query(
        `INSERT INTO users (name, email, password_hash, role, status, department_id)
         VALUES ('Active User', 'active@ritrkpm.ac.in', ?, 'REQUESTER', 'ACTIVE', ?)`,
        [hash, activeDepartmentId]
      );
      userId = userRes.insertId;

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'active@ritrkpm.ac.in', password: 'Password123' });
      token = loginRes.body.token;
    });

    it('returns the current user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(userId);
      expect(res.body.email).toBe('active@ritrkpm.ac.in');
      expect(res.body.departmentName).toBe('Computer Science');
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when token is tampered with', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}tampered`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/change-password', () => {
    let token;

    beforeEach(async () => {
      const hash = await bcrypt.hash('OldPassword1', 12);
      await query(
        `INSERT INTO users (name, email, password_hash, role, status, department_id)
         VALUES ('Pass User', 'pass@ritrkpm.ac.in', ?, 'REQUESTER', 'ACTIVE', ?)`,
        [hash, activeDepartmentId]
      );

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pass@ritrkpm.ac.in', password: 'OldPassword1' });
      token = loginRes.body.token;
    });

    it('successfully changes password and allows login with new password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldPassword1',
          newPassword: 'NewPassword2'
        });

      expect(res.status).toBe(200);

      // Verify login with old password fails
      const failLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pass@ritrkpm.ac.in', password: 'OldPassword1' });
      expect(failLogin.status).toBe(401);

      // Verify login with new password succeeds
      const successLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pass@ritrkpm.ac.in', password: 'NewPassword2' });
      expect(successLogin.status).toBe(200);
    });

    it('returns 400 when current password does not match', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'IncorrectOldPassword',
          newPassword: 'NewPassword2'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    });
  });

  describe('Role-based Authorization', () => {
    it('returns 403 FORBIDDEN when user role does not match required role', async () => {
      const hash = await bcrypt.hash('Password123', 12);
      await query(
        `INSERT INTO users (name, email, password_hash, role, status, department_id)
         VALUES ('Requester User', 'req@ritrkpm.ac.in', ?, 'REQUESTER', 'ACTIVE', ?)`,
        [hash, activeDepartmentId]
      );

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'req@ritrkpm.ac.in', password: 'Password123' });
      const reqToken = loginRes.body.token;

      const res = await request(testAuthApp)
        .get('/api/test-admin-only')
        .set('Authorization', `Bearer ${reqToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows access when user role matches required role', async () => {
      const hash = await bcrypt.hash('Password123', 12);
      await query(
        `INSERT INTO users (name, email, password_hash, role, status)
         VALUES ('Admin User', 'admin@ritrkpm.ac.in', ?, 'ADMIN', 'ACTIVE')`,
        [hash]
      );

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@ritrkpm.ac.in', password: 'Password123' });
      const adminToken = loginRes.body.token;

      const res = await request(testAuthApp)
        .get('/api/test-admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('admin access granted');
    });
  });
});
