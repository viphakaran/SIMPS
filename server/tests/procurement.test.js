import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { query } from '../src/config/db.js';
import { initTestDatabase, clearTestDatabase } from './setup.js';

describe('Procurement Lifecycle: Requests, Approvals, Orders & Receiving', () => {
  let testPasswordHash;
  let adminToken;
  let principalToken;
  let principalId;
  let hodCseToken;
  let hodCseId;
  let hodEceToken;
  let reqCseToken;
  let reqCseId;
  let procOfficerToken;
  let storeManagerToken;
  let storeManagerId;
  let supplier1Token;
  let supplier1Id;
  let supplier2Token;
  let supplier2Id;

  let deptCseId;
  let deptEceId;
  let item1Id;
  let item2Id;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    testPasswordHash = await bcrypt.hash('Password123', 12);
    await initTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    // 1. Departments
    const d1 = await query("INSERT INTO departments (name) VALUES ('Computer Science')");
    deptCseId = d1.insertId;
    const d2 = await query("INSERT INTO departments (name) VALUES ('Electronics')");
    deptEceId = d2.insertId;

    // 2. Admin
    await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Admin User', 'admin@ritrjpm.ac.in', ?, 'ADMIN', 'ACTIVE')`,
      [testPasswordHash]
    );
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@ritrjpm.ac.in', password: 'Password123' });
    adminToken = adminLogin.body.token;

    // 3. Principal
    const priRes = await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Principal User', 'principal@ritrjpm.ac.in', ?, 'PRINCIPAL', 'ACTIVE')`,
      [testPasswordHash]
    );
    principalId = priRes.insertId;
    const priLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'principal@ritrjpm.ac.in', password: 'Password123' });
    principalToken = priLogin.body.token;

    // 4. HoD CSE
    const hod1Res = await query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id)
       VALUES ('HoD CSE', 'hod.cse@ritrjpm.ac.in', ?, 'HOD', 'ACTIVE', ?)`,
      [testPasswordHash, deptCseId]
    );
    hodCseId = hod1Res.insertId;
    await query('UPDATE departments SET hod_user_id = ? WHERE id = ?', [hodCseId, deptCseId]);
    const hod1Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hod.cse@ritrjpm.ac.in', password: 'Password123' });
    hodCseToken = hod1Login.body.token;

    // 5. HoD ECE
    const hod2Res = await query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id)
       VALUES ('HoD ECE', 'hod.ece@ritrjpm.ac.in', ?, 'HOD', 'ACTIVE', ?)`,
      [testPasswordHash, deptEceId]
    );
    await query('UPDATE departments SET hod_user_id = ? WHERE id = ?', [
      hod2Res.insertId,
      deptEceId
    ]);
    const hod2Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hod.ece@ritrjpm.ac.in', password: 'Password123' });
    hodEceToken = hod2Login.body.token;

    // 6. Requester CSE
    const reqRes = await query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id)
       VALUES ('Faculty CSE', 'faculty.cse@ritrjpm.ac.in', ?, 'REQUESTER', 'ACTIVE', ?)`,
      [testPasswordHash, deptCseId]
    );
    reqCseId = reqRes.insertId;
    const reqLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'faculty.cse@ritrjpm.ac.in', password: 'Password123' });
    reqCseToken = reqLogin.body.token;

    // 7. Procurement Officer
    await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Proc Officer', 'proc@ritrjpm.ac.in', ?, 'PROCUREMENT_OFFICER', 'ACTIVE')`,
      [testPasswordHash]
    );
    const procLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'proc@ritrjpm.ac.in', password: 'Password123' });
    procOfficerToken = procLogin.body.token;

    // 8. Store Manager
    const smRes = await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Store Manager', 'store@ritrjpm.ac.in', ?, 'STORE_MANAGER', 'ACTIVE')`,
      [testPasswordHash]
    );
    storeManagerId = smRes.insertId;
    const smLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'store@ritrjpm.ac.in', password: 'Password123' });
    storeManagerToken = smLogin.body.token;

    // 9. Suppliers
    const s1 = await query(
      "INSERT INTO suppliers (name, email, is_active) VALUES ('Dell India', 'sales@dell.com', 1)"
    );
    supplier1Id = s1.insertId;
    const s2 = await query(
      "INSERT INTO suppliers (name, email, is_active) VALUES ('HP India', 'sales@hp.com', 1)"
    );
    supplier2Id = s2.insertId;

    // Supplier users
    await query(
      `INSERT INTO users (name, email, password_hash, role, status, supplier_id)
       VALUES ('Dell Vendor', 'vendor@dell.com', ?, 'SUPPLIER', 'ACTIVE', ?)`,
      [testPasswordHash, supplier1Id]
    );
    const sup1Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vendor@dell.com', password: 'Password123' });
    supplier1Token = sup1Login.body.token;

    await query(
      `INSERT INTO users (name, email, password_hash, role, status, supplier_id)
       VALUES ('HP Vendor', 'vendor@hp.com', ?, 'SUPPLIER', 'ACTIVE', ?)`,
      [testPasswordHash, supplier2Id]
    );
    const sup2Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vendor@hp.com', password: 'Password123' });
    supplier2Token = sup2Login.body.token;

    // 10. Items
    const it1 = await query(
      "INSERT INTO items (sku, name, unit, stock_qty, min_level, unit_cost, is_active) VALUES ('IT-DELL-01', 'Dell Optiplex', 'nos', 10, 5, 45000.00, 1)"
    );
    item1Id = it1.insertId;
    const it2 = await query(
      "INSERT INTO items (sku, name, unit, stock_qty, min_level, unit_cost, is_active) VALUES ('IT-HP-01', 'HP LaserJet Pro', 'nos', 2, 2, 18000.00, 1)"
    );
    item2Id = it2.insertId;
  }, 30000);

  describe('Full End-to-End Procurement Lifecycle (Path A: Requester -> HoD -> Procurement -> Supplier -> Store Manager)', () => {
    it('executes the full lifecycle and increases stock by exactly PO quantities with matching movements', async () => {
      // Step 1: Requester raises multi-line purchase request
      const createRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${reqCseToken}`)
        .send({
          priority: 'HIGH',
          justification: 'New CSE AI/ML Lab setup',
          lines: [
            { itemId: item1Id, quantity: 5 },
            { itemId: item2Id, quantity: 2 }
          ]
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.status).toBe('PENDING_HOD');
      expect(createRes.body.reqNo).toMatch(/^REQ-\d{4}-\d{5}$/);
      expect(createRes.body.lines).toHaveLength(2);
      const requestId = createRes.body.id;

      // Verify notification sent to HoD CSE
      const hodNotifs = await query(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'REQUEST_SUBMITTED'",
        [hodCseId]
      );
      expect(hodNotifs.length).toBe(1);

      // Step 2: HoD CSE approves request
      const decideRes = await request(app)
        .post(`/api/requests/${requestId}/decision`)
        .set('Authorization', `Bearer ${hodCseToken}`)
        .send({ decision: 'APPROVED', reason: 'Recommended for AI/ML lab' });

      expect(decideRes.status).toBe(200);
      expect(decideRes.body.status).toBe('APPROVED');
      expect(decideRes.body.approvals).toHaveLength(1);
      expect(decideRes.body.approvals[0]).toMatchObject({
        stage: 'HOD',
        decision: 'APPROVED',
        reason: 'Recommended for AI/ML lab'
      });

      // Verify notification sent to requester and procurement officer
      const reqDecidedNotifs = await query(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'REQUEST_DECIDED'",
        [reqCseId]
      );
      expect(reqDecidedNotifs.length).toBe(1);
      const procNotifs = await query(
        "SELECT * FROM notifications WHERE type = 'REQUEST_APPROVED'"
      );
      expect(procNotifs.length).toBeGreaterThanOrEqual(1);

      // Step 3: Procurement Officer splits lines across two suppliers into two POs
      const reqDetail = await request(app)
        .get(`/api/requests/${requestId}`)
        .set('Authorization', `Bearer ${procOfficerToken}`);
      const lineDell = reqDetail.body.lines.find((l) => l.itemId === item1Id);
      const lineHp = reqDetail.body.lines.find((l) => l.itemId === item2Id);

      const orderCreateRes = await request(app)
        .post(`/api/requests/${requestId}/orders`)
        .set('Authorization', `Bearer ${procOfficerToken}`)
        .send({
          expectedDate: '2026-12-31',
          lines: [
            { requestItemId: lineDell.id, supplierId: supplier1Id, unitPrice: 42000.0 },
            { requestItemId: lineHp.id, supplierId: supplier2Id, unitPrice: 17500.0 }
          ]
        });

      expect(orderCreateRes.status).toBe(201);
      expect(orderCreateRes.body.orders).toHaveLength(2);

      const poDell = orderCreateRes.body.orders.find((o) => o.supplierId === supplier1Id);
      const poHp = orderCreateRes.body.orders.find((o) => o.supplierId === supplier2Id);

      expect(poDell.status).toBe('PLACED');
      expect(poDell.totalAmount).toBe(5 * 42000.0);
      expect(poDell.poNo).toMatch(/^PO-\d{4}-\d{5}$/);

      expect(poHp.status).toBe('PLACED');
      expect(poHp.totalAmount).toBe(2 * 17500.0);
      expect(poHp.poNo).toMatch(/^PO-\d{4}-\d{5}$/);

      // Request status must now be ORDERED
      const reqAfterOrders = await request(app)
        .get(`/api/requests/${requestId}`)
        .set('Authorization', `Bearer ${procOfficerToken}`);
      expect(reqAfterOrders.body.status).toBe('ORDERED');

      // Step 4: Dell Vendor transitions order: PLACED -> CONFIRMED -> SHIPPED -> DELIVERED
      const confRes = await request(app)
        .patch(`/api/orders/${poDell.id}/status`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ status: 'CONFIRMED' });
      expect(confRes.status).toBe(200);
      expect(confRes.body.status).toBe('CONFIRMED');

      const shipRes = await request(app)
        .patch(`/api/orders/${poDell.id}/status`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ status: 'SHIPPED' });
      expect(shipRes.status).toBe(200);
      expect(shipRes.body.status).toBe('SHIPPED');

      const delivRes = await request(app)
        .patch(`/api/orders/${poDell.id}/status`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ status: 'DELIVERED' });
      expect(delivRes.status).toBe(200);
      expect(delivRes.body.status).toBe('DELIVERED');
      expect(delivRes.body.deliveredDate).not.toBeNull();

      // Step 5: HP Vendor also delivers their order
      await request(app)
        .patch(`/api/orders/${poHp.id}/status`)
        .set('Authorization', `Bearer ${supplier2Token}`)
        .send({ status: 'CONFIRMED' });
      await request(app)
        .patch(`/api/orders/${poHp.id}/status`)
        .set('Authorization', `Bearer ${supplier2Token}`)
        .send({ status: 'SHIPPED' });
      await request(app)
        .patch(`/api/orders/${poHp.id}/status`)
        .set('Authorization', `Bearer ${supplier2Token}`)
        .send({ status: 'DELIVERED' });

      // Initial stocks: item1 = 10, item2 = 2
      const [it1Before] = await query('SELECT stock_qty FROM items WHERE id = ?', [item1Id]);
      const [it2Before] = await query('SELECT stock_qty FROM items WHERE id = ?', [item2Id]);
      expect(it1Before.stock_qty).toBe(10);
      expect(it2Before.stock_qty).toBe(2);

      // Step 6: Store Manager receives Dell PO
      const recDellRes = await request(app)
        .post(`/api/orders/${poDell.id}/receive`)
        .set('Authorization', `Bearer ${storeManagerToken}`);
      expect(recDellRes.status).toBe(200);
      expect(recDellRes.body.status).toBe('RECEIVED');

      // Verify item1 stock increased by exactly 5 (10 + 5 = 15)
      const [it1AfterDell] = await query('SELECT stock_qty FROM items WHERE id = ?', [item1Id]);
      expect(it1AfterDell.stock_qty).toBe(15);

      // Verify stock movement row exists with balance_after = 15, type = RECEIPT
      const m1 = await query(
        'SELECT * FROM stock_movements WHERE po_id = ? AND item_id = ?',
        [poDell.id, item1Id]
      );
      expect(m1.length).toBe(1);
      expect(m1[0].type).toBe('RECEIPT');
      expect(m1[0].quantity).toBe(5);
      expect(m1[0].balance_after).toBe(15);

      // Request status still ORDERED because HP PO is not yet received
      const reqMid = await request(app)
        .get(`/api/requests/${requestId}`)
        .set('Authorization', `Bearer ${procOfficerToken}`);
      expect(reqMid.body.status).toBe('ORDERED');

      // Step 7: Store Manager receives HP PO
      const recHpRes = await request(app)
        .post(`/api/orders/${poHp.id}/receive`)
        .set('Authorization', `Bearer ${storeManagerToken}`);
      expect(recHpRes.status).toBe(200);
      expect(recHpRes.body.status).toBe('RECEIVED');

      // Verify item2 stock increased by exactly 2 (2 + 2 = 4)
      const [it2AfterHp] = await query('SELECT stock_qty FROM items WHERE id = ?', [item2Id]);
      expect(it2AfterHp.stock_qty).toBe(4);

      // Both POs received -> Request status automatically becomes RECEIVED
      const reqFinal = await request(app)
        .get(`/api/requests/${requestId}`)
        .set('Authorization', `Bearer ${procOfficerToken}`);
      expect(reqFinal.body.status).toBe('RECEIVED');

      // Verify notification PO_RECEIVED sent to requester
      const poRecNotifs = await query(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'PO_RECEIVED'",
        [reqCseId]
      );
      expect(poRecNotifs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Full Lifecycle (Path B: HoD Request -> Principal Approval -> Procurement Return / PO Cancellation Recompute)', () => {
    it('routes HoD request to Principal, supports return by procurement, and reverts ORDERED to APPROVED when PO cancelled', async () => {
      // 1. HoD raises request -> must route to PENDING_PRINCIPAL
      const createRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${hodCseToken}`)
        .send({
          priority: 'NORMAL',
          justification: 'Dept lab maintenance components',
          lines: [{ itemId: item1Id, quantity: 2 }]
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.status).toBe('PENDING_PRINCIPAL');
      const requestId = createRes.body.id;

      // Verify Principal received REQUEST_SUBMITTED notification
      const priNotifs = await query(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'REQUEST_SUBMITTED'",
        [principalId]
      );
      expect(priNotifs.length).toBe(1);

      // 2. Principal approves request
      const approveRes = await request(app)
        .post(`/api/requests/${requestId}/decision`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({ decision: 'APPROVED', reason: 'Principal approval granted' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe('APPROVED');
      expect(approveRes.body.approvals[0].stage).toBe('PRINCIPAL');

      // 3. Procurement officer returns request with reason
      const returnRes = await request(app)
        .post(`/api/requests/${requestId}/return`)
        .set('Authorization', `Bearer ${procOfficerToken}`)
        .send({ reason: 'Budget allocation currently on hold' });

      expect(returnRes.status).toBe(200);
      expect(returnRes.body.status).toBe('RETURNED_BY_PROCUREMENT');
      expect(returnRes.body.approvals).toHaveLength(2);
      expect(returnRes.body.approvals[1]).toMatchObject({
        stage: 'PROCUREMENT',
        decision: 'RETURNED',
        reason: 'Budget allocation currently on hold'
      });

      // 4. Test PO Cancellation recompute: create fresh request and approve it
      const req2 = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${hodCseToken}`)
        .send({
          priority: 'NORMAL',
          lines: [{ itemId: item1Id, quantity: 1 }]
        });
      await request(app)
        .post(`/api/requests/${req2.body.id}/decision`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({ decision: 'APPROVED' });

      const req2Detail = await request(app)
        .get(`/api/requests/${req2.body.id}`)
        .set('Authorization', `Bearer ${procOfficerToken}`);
      const lineId = req2Detail.body.lines[0].id;

      // Create single PO
      const orderRes = await request(app)
        .post(`/api/requests/${req2.body.id}/orders`)
        .set('Authorization', `Bearer ${procOfficerToken}`)
        .send({
          lines: [{ requestItemId: lineId, supplierId: supplier1Id, unitPrice: 40000 }]
        });
      const poId = orderRes.body.orders[0].id;

      // Cancel the PO
      const cancelRes = await request(app)
        .patch(`/api/orders/${poId}/status`)
        .set('Authorization', `Bearer ${procOfficerToken}`)
        .send({ status: 'CANCELLED' });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('CANCELLED');

      // Request must revert from ORDERED back to APPROVED
      const reqAfterCancel = await request(app)
        .get(`/api/requests/${req2.body.id}`)
        .set('Authorization', `Bearer ${procOfficerToken}`);
      expect(reqAfterCancel.body.status).toBe('APPROVED');
    });
  });

  describe('Authorization, Scoping & Negative Edge Cases', () => {
    it('HoD from another department receives 404/403 on every attempt to view or decide the request', async () => {
      // Create CSE request
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${reqCseToken}`)
        .send({
          lines: [{ itemId: item1Id, quantity: 1 }]
        });
      const reqId = reqRes.body.id;

      // HoD ECE views CSE request -> 404 per scoping rules
      const viewRes = await request(app)
        .get(`/api/requests/${reqId}`)
        .set('Authorization', `Bearer ${hodEceToken}`);
      expect(viewRes.status).toBe(404);

      // HoD ECE tries to decide CSE request -> 403 Forbidden
      const decideRes = await request(app)
        .post(`/api/requests/${reqId}/decision`)
        .set('Authorization', `Bearer ${hodEceToken}`)
        .send({ decision: 'APPROVED' });
      expect(decideRes.status).toBe(403);
    });

    it('rejects self-approval when a user attempts to approve their own request', async () => {
      // HoD CSE creates request (status PENDING_PRINCIPAL)
      const hodReq = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${hodCseToken}`)
        .send({
          lines: [{ itemId: item1Id, quantity: 1 }]
        });
      const reqId = hodReq.body.id;

      // HoD CSE attempts to decide their own request
      const decideRes = await request(app)
        .post(`/api/requests/${reqId}/decision`)
        .set('Authorization', `Bearer ${hodCseToken}`)
        .send({ decision: 'APPROVED' });
      expect(decideRes.status).toBe(403);
    });

    it('rejects rejection without reason with 400 REASON_REQUIRED', async () => {
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${reqCseToken}`)
        .send({
          lines: [{ itemId: item1Id, quantity: 1 }]
        });

      const rejectRes = await request(app)
        .post(`/api/requests/${reqRes.body.id}/decision`)
        .set('Authorization', `Bearer ${hodCseToken}`)
        .send({ decision: 'REJECTED', reason: '' });
      expect(rejectRes.status).toBe(400);
      expect(rejectRes.body.error.code).toBe('REASON_REQUIRED');
    });

    it('supplier receives 404 when accessing foreign purchase orders', async () => {
      // Create request, approve, and place PO with Supplier 1 (Dell)
      const r = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${reqCseToken}`)
        .send({ lines: [{ itemId: item1Id, quantity: 1 }] });
      await request(app)
        .post(`/api/requests/${r.body.id}/decision`)
        .set('Authorization', `Bearer ${hodCseToken}`)
        .send({ decision: 'APPROVED' });

      const detail = await request(app)
        .get(`/api/requests/${r.body.id}`)
        .set('Authorization', `Bearer ${procOfficerToken}`);
      const lineId = detail.body.lines[0].id;

      const orderRes = await request(app)
        .post(`/api/requests/${r.body.id}/orders`)
        .set('Authorization', `Bearer ${procOfficerToken}`)
        .send({
          lines: [{ requestItemId: lineId, supplierId: supplier1Id, unitPrice: 40000 }]
        });
      const poId = orderRes.body.orders[0].id;

      // Supplier 2 (HP) tries to view Supplier 1's PO -> 404
      const viewRes = await request(app)
        .get(`/api/orders/${poId}`)
        .set('Authorization', `Bearer ${supplier2Token}`);
      expect(viewRes.status).toBe(404);

      // Supplier 2 tries to update status of Supplier 1's PO -> 404
      const updateRes = await request(app)
        .patch(`/api/orders/${poId}/status`)
        .set('Authorization', `Bearer ${supplier2Token}`)
        .send({ status: 'CONFIRMED' });
      expect(updateRes.status).toBe(404);
    });

    it('rejects invalid PO status transitions', async () => {
      const r = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${reqCseToken}`)
        .send({ lines: [{ itemId: item1Id, quantity: 1 }] });
      await request(app)
        .post(`/api/requests/${r.body.id}/decision`)
        .set('Authorization', `Bearer ${hodCseToken}`)
        .send({ decision: 'APPROVED' });
      const detail = await request(app)
        .get(`/api/requests/${r.body.id}`)
        .set('Authorization', `Bearer ${procOfficerToken}`);
      const orderRes = await request(app)
        .post(`/api/requests/${r.body.id}/orders`)
        .set('Authorization', `Bearer ${procOfficerToken}`)
        .send({
          lines: [{ requestItemId: detail.body.lines[0].id, supplierId: supplier1Id, unitPrice: 40000 }]
        });
      const poId = orderRes.body.orders[0].id;

      // Cannot skip directly from PLACED to SHIPPED or DELIVERED
      const skipRes = await request(app)
        .patch(`/api/orders/${poId}/status`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ status: 'DELIVERED' });
      expect(skipRes.status).toBe(409);
    });

    it('returns 409 when double-receiving an order or receiving a non-delivered order', async () => {
      const r = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${reqCseToken}`)
        .send({ lines: [{ itemId: item1Id, quantity: 1 }] });
      await request(app)
        .post(`/api/requests/${r.body.id}/decision`)
        .set('Authorization', `Bearer ${hodCseToken}`)
        .send({ decision: 'APPROVED' });
      const detail = await request(app)
        .get(`/api/requests/${r.body.id}`)
        .set('Authorization', `Bearer ${procOfficerToken}`);
      const orderRes = await request(app)
        .post(`/api/requests/${r.body.id}/orders`)
        .set('Authorization', `Bearer ${procOfficerToken}`)
        .send({
          lines: [{ requestItemId: detail.body.lines[0].id, supplierId: supplier1Id, unitPrice: 40000 }]
        });
      const poId = orderRes.body.orders[0].id;

      // 1. Attempt to receive while PLACED (not DELIVERED) -> 409
      const earlyRec = await request(app)
        .post(`/api/orders/${poId}/receive`)
        .set('Authorization', `Bearer ${storeManagerToken}`);
      expect(earlyRec.status).toBe(409);

      // Transition to DELIVERED
      await request(app)
        .patch(`/api/orders/${poId}/status`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ status: 'CONFIRMED' });
      await request(app)
        .patch(`/api/orders/${poId}/status`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ status: 'SHIPPED' });
      await request(app)
        .patch(`/api/orders/${poId}/status`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ status: 'DELIVERED' });

      // Verify PO_STATUS notification delivered to store manager
      const smNotifs = await query(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'PO_STATUS'",
        [storeManagerId]
      );
      expect(smNotifs.length).toBeGreaterThanOrEqual(1);

      // First receive succeeds
      const rec1 = await request(app)
        .post(`/api/orders/${poId}/receive`)
        .set('Authorization', `Bearer ${storeManagerToken}`);
      expect(rec1.status).toBe(200);

      // Second receive returns 409 ALREADY_RECEIVED
      const rec2 = await request(app)
        .post(`/api/orders/${poId}/receive`)
        .set('Authorization', `Bearer ${storeManagerToken}`);
      expect(rec2.status).toBe(409);
      expect(rec2.body.error.code).toBe('ALREADY_RECEIVED');
    });

    it('returns 409 NO_HOD when a department has no active HoD', async () => {
      // Remove HoD from CSE
      await query('UPDATE departments SET hod_user_id = NULL WHERE id = ?', [deptCseId]);

      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${reqCseToken}`)
        .send({ lines: [{ itemId: item1Id, quantity: 1 }] });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NO_HOD');
    });

    it('returns 409 NO_PRINCIPAL when creating an HoD request without an active Principal', async () => {
      // Disable Principal
      await query("UPDATE users SET status = 'DISABLED' WHERE id = ?", [principalId]);

      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${hodCseToken}`)
        .send({ lines: [{ itemId: item1Id, quantity: 1 }] });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NO_PRINCIPAL');
    });

    it('allows Admin to view all requests and orders college-wide', async () => {
      const reqList = await request(app)
        .get('/api/requests')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(reqList.status).toBe(200);

      const ordList = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ordList.status).toBe(200);
    });
  });
});
