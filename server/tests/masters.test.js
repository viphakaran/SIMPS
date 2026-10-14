import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { query } from '../src/config/db.js';
import { initTestDatabase, clearTestDatabase } from './setup.js';

describe('Masters: Users, Departments, Categories, Suppliers', () => {
  let adminToken;
  let adminUser;
  let requesterToken;
  let requesterUser;
  let defaultDeptId;

  let testPasswordHash;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    testPasswordHash = await bcrypt.hash('AdminPass123', 12);
    await initTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    // Create a default active department
    const deptRes = await query(
      "INSERT INTO departments (name, is_active) VALUES ('Computer Science', 1)"
    );
    defaultDeptId = deptRes.insertId;

    // Create an Admin user
    const adminRes = await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Admin User', 'admin@ritrkpm.ac.in', ?, 'ADMIN', 'ACTIVE')`,
      [testPasswordHash]
    );
    adminUser = { id: adminRes.insertId, email: 'admin@ritrkpm.ac.in' };

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@ritrkpm.ac.in', password: 'AdminPass123' });
    adminToken = adminLogin.body.token;

    // Create a regular Requester user
    const reqRes = await query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id)
       VALUES ('Regular Requester', 'req@ritrkpm.ac.in', ?, 'REQUESTER', 'ACTIVE', ?)`,
      [testPasswordHash, defaultDeptId]
    );
    requesterUser = { id: reqRes.insertId, email: 'req@ritrkpm.ac.in' };

    const reqLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'req@ritrkpm.ac.in', password: 'AdminPass123' });
    requesterToken = reqLogin.body.token;
  });

  describe('Departments API', () => {
    it('GET /api/departments/public returns active departments without authentication', async () => {
      await query("INSERT INTO departments (name, is_active) VALUES ('Inactive Dept', 0)");

      const res = await request(app).get('/api/departments/public');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Computer Science');
      expect(res.body[0]).not.toHaveProperty('hodUserId');
    });

    it('GET /api/departments returns paginated departments for authenticated users', async () => {
      const res = await request(app)
        .get('/api/departments')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total', 1);
      expect(res.body.data[0].name).toBe('Computer Science');
    });

    it('POST /api/departments allows Admin to create a department', async () => {
      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Mechanical Engineering' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Mechanical Engineering');
      expect(res.body.isActive).toBe(true);
    });

    it('POST /api/departments forbids non-Admin users', async () => {
      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ name: 'Civil Engineering' });

      expect(res.status).toBe(403);
    });

    it('POST /api/departments rejects duplicate department names with 409', async () => {
      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Computer Science' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DEPARTMENT_EXISTS');
    });

    it('PUT /api/departments/:id/hod assigns an active HoD belonging to the department', async () => {
      const hodRes = await query(
        `INSERT INTO users (name, email, password_hash, role, status, department_id)
         VALUES ('Dr. CS HOD', 'cshod@ritrkpm.ac.in', ?, 'HOD', 'ACTIVE', ?)`,
        [testPasswordHash, defaultDeptId]
      );
      const hodUserId = hodRes.insertId;

      const res = await request(app)
        .put(`/api/departments/${defaultDeptId}/hod`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: hodUserId });

      expect(res.status).toBe(200);
      expect(res.body.hodUserId).toBe(hodUserId);
      expect(res.body.hodName).toBe('Dr. CS HOD');
    });

    it('PUT /api/departments/:id/hod rejects if user does not belong to the department', async () => {
      const otherDept = await query(
        "INSERT INTO departments (name, is_active) VALUES ('ECE', 1)"
      );
      const hodRes = await query(
        `INSERT INTO users (name, email, password_hash, role, status, department_id)
         VALUES ('Dr. ECE HOD', 'ecehod@ritrkpm.ac.in', ?, 'HOD', 'ACTIVE', ?)`,
        [testPasswordHash, otherDept.insertId]
      );

      const res = await request(app)
        .put(`/api/departments/${defaultDeptId}/hod`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: hodRes.insertId });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('HOD_WRONG_DEPARTMENT');
    });

    it('PUT /api/departments/:id/hod rejects if user is not HOD role or not ACTIVE', async () => {
      // Test requester user
      const res1 = await request(app)
        .put(`/api/departments/${defaultDeptId}/hod`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: requesterUser.id });

      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('INVALID_HOD_ROLE');

      // Test pending HOD
      const pendingHod = await query(
        `INSERT INTO users (name, email, password_hash, role, status, department_id)
         VALUES ('Pending HOD', 'penghod@ritrkpm.ac.in', ?, 'HOD', 'PENDING', ?)`,
        [testPasswordHash, defaultDeptId]
      );

      const res2 = await request(app)
        .put(`/api/departments/${defaultDeptId}/hod`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: pendingHod.insertId });

      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('USER_NOT_ACTIVE');
    });
  });

  describe('Users Admin API', () => {
    it('GET /api/users returns paginated user list for admin', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.data[0]).not.toHaveProperty('password_hash');
    });

    it('GET /api/users rejects non-admin users with 403', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(403);
    });

    it('POST /api/users allows Admin to create an ACTIVE user with department requirement', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Faculty Member',
          email: 'faculty@ritrkpm.ac.in',
          password: 'Password123',
          role: 'REQUESTER',
          departmentId: defaultDeptId
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.departmentId).toBe(defaultDeptId);
    });

    it('POST /api/users rejects HOD or REQUESTER without departmentId', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Missing Dept HOD',
          email: 'nodept@ritrkpm.ac.in',
          password: 'Password123',
          role: 'HOD'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DEPARTMENT_REQUIRED');
    });

    it('enforces single ACTIVE PRINCIPAL constraint on creation and approval', async () => {
      // Create first Principal
      const res1 = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Principal 1',
          email: 'principal1@ritrkpm.ac.in',
          password: 'Password123',
          role: 'PRINCIPAL'
        });

      expect(res1.status).toBe(201);
      expect(res1.body.role).toBe('PRINCIPAL');
      expect(res1.body.status).toBe('ACTIVE');

      // Attempt creating second active Principal
      const res2 = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Principal 2',
          email: 'principal2@ritrkpm.ac.in',
          password: 'Password123',
          role: 'PRINCIPAL'
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('PRINCIPAL_EXISTS');

      // Create a pending Principal via direct DB insert and attempt approving
      const pendingPrin = await query(
        `INSERT INTO users (name, email, password_hash, role, status)
         VALUES ('Pending Principal', 'penprin@ritrkpm.ac.in', ?, 'PRINCIPAL', 'PENDING')`,
        [testPasswordHash]
      );

      const res3 = await request(app)
        .post(`/api/users/${pendingPrin.insertId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res3.status).toBe(409);
      expect(res3.body.error.code).toBe('PRINCIPAL_EXISTS');
    });

    it('approves a PENDING user and creates ACCOUNT_APPROVED notification', async () => {
      const pendingRes = await query(
        `INSERT INTO users (name, email, password_hash, role, status, department_id)
         VALUES ('Pending Requester', 'pendingreq@ritrkpm.ac.in', ?, 'REQUESTER', 'PENDING', ?)`,
        [testPasswordHash, defaultDeptId]
      );
      const pendingId = pendingRes.insertId;

      const res = await request(app)
        .post(`/api/users/${pendingId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');

      // Verify notification row was created
      const notifs = await query(
        'SELECT * FROM notifications WHERE user_id = ? AND type = ?',
        [pendingId, 'ACCOUNT_APPROVED']
      );
      expect(notifs.length).toBe(1);
    });

    it('disables a user, and prevents admin from disabling themselves', async () => {
      // Disabling self
      const selfRes = await request(app)
        .post(`/api/users/${adminUser.id}/disable`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(selfRes.status).toBe(400);
      expect(selfRes.body.error.code).toBe('CANNOT_DISABLE_SELF');

      // Disabling another user
      const otherRes = await request(app)
        .post(`/api/users/${requesterUser.id}/disable`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(otherRes.status).toBe(200);
      expect(otherRes.body.status).toBe('DISABLED');
    });
  });

  describe('Categories API', () => {
    it('allows Admin to create and rename category, rejecting duplicates', async () => {
      // Create
      const res1 = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Lab Consumables' });

      expect(res1.status).toBe(201);
      const catId = res1.body.id;

      // Duplicate
      const dupRes = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Lab Consumables' });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe('CATEGORY_EXISTS');

      // Rename
      const res2 = await request(app)
        .patch(`/api/categories/${catId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Stationery & Consumables' });

      expect(res2.status).toBe(200);
      expect(res2.body.name).toBe('Stationery & Consumables');

      // List as regular requester
      const listRes = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
    });
  });

  describe('Suppliers API', () => {
    let categoryId;

    beforeEach(async () => {
      const catRes = await query("INSERT INTO categories (name) VALUES ('Lab Equipment')");
      categoryId = catRes.insertId;
    });

    it('allows Admin to create, list, and update suppliers', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Supreme Scientific Supplies',
          email: 'sales@supremesci.com',
          phone: '9840123456',
          address: 'Chennai, TN',
          categoryId
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Supreme Scientific Supplies');
      const supplierId = res.body.id;

      // Update
      const updateRes = await request(app)
        .patch(`/api/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ phone: '9840000000', isActive: false });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.phone).toBe('9840000000');
      expect(updateRes.body.isActive).toBe(false);
    });

    it('forbids REQUESTER from viewing suppliers', async () => {
      const res = await request(app)
        .get('/api/suppliers')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('End-to-End Masters Acceptance Scenario', () => {
    it('completes the acceptance workflow: department -> HoD -> assign -> self-register -> approve -> login', async () => {
      // 1. Admin creates department Mechanical Engineering
      const deptRes = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Mechanical Engineering' });
      expect(deptRes.status).toBe(201);
      const mechDeptId = deptRes.body.id;

      // 2. Admin creates HoD user for Mechanical Engineering
      const hodRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dr. Mech HOD',
          email: 'mechhod@ritrkpm.ac.in',
          password: 'Password123',
          role: 'HOD',
          departmentId: mechDeptId
        });
      expect(hodRes.status).toBe(201);
      const hodUserId = hodRes.body.id;

      // 3. Admin assigns HoD to Mechanical Engineering
      const assignRes = await request(app)
        .put(`/api/departments/${mechDeptId}/hod`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: hodUserId });
      expect(assignRes.status).toBe(200);
      expect(assignRes.body.hodUserId).toBe(hodUserId);

      // 4. REQUESTER self-registers selecting Mechanical Engineering
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Mech Student Lab Incharge',
          email: 'mechstudent@ritrkpm.ac.in',
          password: 'Password123',
          phone: '9876543210',
          departmentId: mechDeptId
        });
      expect(regRes.status).toBe(201);
      expect(regRes.body.status).toBe('PENDING');
      const studentId = regRes.body.id;

      // Verify login before approval is forbidden
      const preLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'mechstudent@ritrkpm.ac.in', password: 'Password123' });
      expect(preLogin.status).toBe(403);
      expect(preLogin.body.error.code).toBe('ACCOUNT_PENDING');

      // 5. Admin approves the student account
      const approveRes = await request(app)
        .post(`/api/users/${studentId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe('ACTIVE');

      // 6. Student can now log in
      const postLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'mechstudent@ritrkpm.ac.in', password: 'Password123' });
      expect(postLogin.status).toBe(200);
      expect(postLogin.body).toHaveProperty('token');
      expect(postLogin.body.user.status).toBe('ACTIVE');
      expect(postLogin.body.user.departmentId).toBe(mechDeptId);
    });
  });
});
