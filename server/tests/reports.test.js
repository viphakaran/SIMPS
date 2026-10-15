import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { query } from '../src/config/db.js';
import { initTestDatabase, clearTestDatabase } from './setup.js';
import { runDailyStockDigest } from '../src/scheduler.js';

describe('Reports, Analytics & Scheduler', () => {
  let testPasswordHash;
  let adminToken;
  let principalToken;
  let hodCseToken;
  let hodEceToken;
  let reqCseToken;
  let reqCseId;
  let procOfficerToken;
  let storeManagerToken;
  let supplierToken;
  let supplierId;
  let deptCseId;
  let deptEceId;

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
    await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Principal User', 'principal@ritrjpm.ac.in', ?, 'PRINCIPAL', 'ACTIVE')`,
      [testPasswordHash]
    );
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
    await query('UPDATE departments SET hod_user_id = ? WHERE id = ?', [
      hod1Res.insertId,
      deptCseId
    ]);
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
    await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Store Manager', 'store@ritrjpm.ac.in', ?, 'STORE_MANAGER', 'ACTIVE')`,
      [testPasswordHash]
    );
    const smLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'store@ritrjpm.ac.in', password: 'Password123' });
    storeManagerToken = smLogin.body.token;

    // 9. Supplier
    const sRes = await query(
      "INSERT INTO suppliers (name, email, is_active) VALUES ('Global Tech Supplies', 'sales@globaltech.com', 1)"
    );
    supplierId = sRes.insertId;
    await query(
      `INSERT INTO users (name, email, password_hash, role, status, supplier_id)
       VALUES ('Global Tech Rep', 'rep@globaltech.com', ?, 'SUPPLIER', 'ACTIVE', ?)`,
      [testPasswordHash, supplierId]
    );
    const supLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rep@globaltech.com', password: 'Password123' });
    supplierToken = supLogin.body.token;
  }, 30000);

  describe('Acceptance Check 1: Empty Database Behavior', () => {
    it('returns empty structures with valid zeros/empty lists and zero fabricated numbers', async () => {
      // Reorder suggestions
      const reorderRes = await request(app)
        .get('/api/items/reorder-suggestions')
        .set('Authorization', `Bearer ${storeManagerToken}`);
      expect(reorderRes.status).toBe(200);
      expect(reorderRes.body).toEqual([]);

      // Suppliers report
      const supReportRes = await request(app)
        .get('/api/reports/suppliers')
        .set('Authorization', `Bearer ${procOfficerToken}`);
      expect(supReportRes.status).toBe(200);
      expect(supReportRes.body).toHaveLength(1); // 1 supplier with 0 orders
      expect(supReportRes.body[0]).toMatchObject({
        totalOrders: 0,
        deliveredCount: 0,
        onTimeRate: null,
        avgLeadDays: null
      });

      // Inventory report
      const invReportRes = await request(app)
        .get('/api/reports/inventory')
        .set('Authorization', `Bearer ${storeManagerToken}`);
      expect(invReportRes.status).toBe(200);
      expect(invReportRes.body).toEqual({
        items: [],
        totalCount: 0,
        totalValuation: 0
      });

      // Procurement report
      const procReportRes = await request(app)
        .get('/api/reports/procurement')
        .set('Authorization', `Bearer ${procOfficerToken}`);
      expect(procReportRes.status).toBe(200);
      expect(procReportRes.body).toEqual({
        countsByStatus: {},
        spendByMonthDepartment: [],
        totalSpend: 0
      });

      // Dashboards across all roles
      const smDash = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${storeManagerToken}`);
      expect(smDash.status).toBe(200);
      expect(smDash.body.items).toEqual({ total: 0, low: 0, out: 0, inStock: 0 });
      expect(smDash.body.posAwaitingReceipt).toBe(0);
      expect(smDash.body.recentMovements).toEqual([]);

      const proDash = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${procOfficerToken}`);
      expect(proDash.status).toBe(200);
      expect(proDash.body.approvedRequestsWaiting).toBe(0);
      expect(proDash.body.openOrders).toBe(0);
      expect(proDash.body.overdueOrders).toBe(0);
      expect(proDash.body.reorderSuggestionsCount).toBe(0);

      const hodDash = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${hodCseToken}`);
      expect(hodDash.status).toBe(200);
      expect(hodDash.body.pendingApprovals).toBe(0);
      expect(hodDash.body.requestsByStatus).toEqual({});

      const priDash = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${principalToken}`);
      expect(priDash.status).toBe(200);
      expect(priDash.body.pendingApprovals).toBe(0);
      expect(priDash.body.totalSpend).toBe(0);

      const reqDash = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${reqCseToken}`);
      expect(reqDash.status).toBe(200);
      expect(reqDash.body.requestsByStatus).toEqual({});
      expect(reqDash.body.recentRequests).toEqual([]);

      const supDash = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${supplierToken}`);
      expect(supDash.status).toBe(200);
      expect(supDash.body.openOrdersByStatus).toEqual({});
      expect(supDash.body.overdueDeliveries).toBe(0);

      const admDash = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(admDash.status).toBe(200);
      expect(admDash.body.pendingAccounts).toBe(0);
      expect(admDash.body.departmentsWithoutHod).toEqual([]);
    });
  });

  describe('Acceptance Check 2: Known Hand-Calculated Fixtures', () => {
    it('accurately computes the Reorder Suggestions formula with all input metrics', async () => {
      // Item 1: High usage item
      // min_level = 10, stock_qty = 5 (LOW status)
      // Issues in last 30 days = 60 units
      // avg_daily = 60 / 30 = 2.0
      // days_of_cover = 5 / 2.0 = 2.5
      // on_order = 10 (one active PO for 10 units)
      // suggested_qty = max(0, ceil(2.0 * 30) - 5 - 10) = 60 - 15 = 45
      const it1 = await query(
        `INSERT INTO items (sku, name, unit, stock_qty, min_level, unit_cost, is_active)
         VALUES ('SKU-HIGH-USE', 'Copper Wires', 'm', 5, 10, 100.00, 1)`
      );
      const item1Id = it1.insertId;

      // Insert stock issue movement 10 days ago (within 30 days): -60
      await query(
        `INSERT INTO stock_movements (item_id, type, quantity, balance_after, created_at)
         VALUES (?, 'ISSUE', -60, 5, DATE_SUB(NOW(), INTERVAL 10 DAY))`,
        [item1Id]
      );

      // Create an active PO for Item 1 with 10 units (PLACED)
      const pr1 = await query(
        `INSERT INTO purchase_requests (req_no, department_id, status)
         VALUES ('REQ-TEST-REORDER', ?, 'ORDERED')`,
        [deptCseId]
      );
      const po1 = await query(
        `INSERT INTO purchase_orders (po_no, request_id, supplier_id, status)
         VALUES ('PO-TEST-REORDER', ?, ?, 'PLACED')`,
        [pr1.insertId, supplierId]
      );
      await query(
        'INSERT INTO po_items (po_id, item_id, quantity, unit_price) VALUES (?, ?, 10, 100.00)',
        [po1.insertId, item1Id]
      );

      // Item 2: Zero stock, zero usage (insufficientData: true)
      // min_level = 8, stock_qty = 0 (OUT_OF_STOCK)
      // on_order = 0
      // suggested_qty = max(0, 8 - 0 - 0) = 8
      const it2 = await query(
        `INSERT INTO items (sku, name, unit, stock_qty, min_level, unit_cost, is_active)
         VALUES ('SKU-NO-USE', 'Breadboards', 'nos', 0, 8, 250.00, 1)`
      );
      const item2Id = it2.insertId;

      // Item 3: Plenty of stock (status IN_STOCK, daysOfCover > 14) -> should NOT be suggested
      await query(
        `INSERT INTO items (sku, name, unit, stock_qty, min_level, unit_cost, is_active)
         VALUES ('SKU-PLENTY', 'Resistors Pack', 'nos', 100, 10, 10.00, 1)`
      );

      const res = await request(app)
        .get('/api/items/reorder-suggestions')
        .set('Authorization', `Bearer ${storeManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      const sugg1 = res.body.find((s) => s.itemId === item1Id);
      expect(sugg1).toBeDefined();
      expect(sugg1.stockQty).toBe(5);
      expect(sugg1.minLevel).toBe(10);
      expect(sugg1.avgDaily).toBe(2.0);
      expect(sugg1.daysOfCover).toBe(2.5);
      expect(sugg1.onOrder).toBe(10);
      expect(sugg1.suggestedQty).toBe(45);
      expect(sugg1.insufficientData).toBe(false);

      const sugg2 = res.body.find((s) => s.itemId === item2Id);
      expect(sugg2).toBeDefined();
      expect(sugg2.stockQty).toBe(0);
      expect(sugg2.suggestedQty).toBe(8);
      expect(sugg2.insufficientData).toBe(true);
      expect(sugg2.insufficientDataMessage).toBe('Not enough usage data');
    });

    it('accurately computes supplier performance metrics with known dates and lead times', async () => {
      // Create second supplier with known delivery dates
      const s2Res = await query(
        "INSERT INTO suppliers (name, email, is_active) VALUES ('Logitech India', 'b2b@logitech.com', 1)"
      );
      const supp2Id = s2Res.insertId;

      const pr = await query(
        `INSERT INTO purchase_requests (req_no, department_id, status)
         VALUES ('REQ-METRICS-TEST', ?, 'ORDERED')`,
        [deptCseId]
      );
      const reqId = pr.insertId;

      // Order 1: Delivered ON TIME
      // created_at: 2026-09-01, expected: 2026-09-10, delivered: 2026-09-08 (lead days = 7)
      await query(
        `INSERT INTO purchase_orders (po_no, request_id, supplier_id, status, created_at, expected_date, delivered_date, total_amount)
         VALUES ('PO-S2-01', ?, ?, 'DELIVERED', '2026-09-01 10:00:00', '2026-09-10', '2026-09-08', 5000.00)`,
        [reqId, supp2Id]
      );

      // Order 2: Delivered LATE
      // created_at: 2026-09-01, expected: 2026-09-10, delivered: 2026-09-14 (lead days = 13)
      await query(
        `INSERT INTO purchase_orders (po_no, request_id, supplier_id, status, created_at, expected_date, delivered_date, total_amount)
         VALUES ('PO-S2-02', ?, ?, 'RECEIVED', '2026-09-01 10:00:00', '2026-09-10', '2026-09-14', 7000.00)`,
        [reqId, supp2Id]
      );

      // Order 3: CANCELLED (must be excluded from orders total per SPEC section 9)
      await query(
        `INSERT INTO purchase_orders (po_no, request_id, supplier_id, status, created_at, total_amount)
         VALUES ('PO-S2-03', ?, ?, 'CANCELLED', '2026-09-01 10:00:00', 3000.00)`,
        [reqId, supp2Id]
      );

      // Calculation:
      // totalOrders (excl cancelled) = 2
      // deliveredCount = 2
      // onTimeRate = 1 / 2 = 0.50
      // avgLeadDays = (7 + 13) / 2 = 10.0
      const res = await request(app)
        .get(`/api/suppliers/${supp2Id}/performance`)
        .set('Authorization', `Bearer ${procOfficerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.supplierId).toBe(supp2Id);
      expect(res.body.totalOrders).toBe(2);
      expect(res.body.deliveredCount).toBe(2);
      expect(res.body.onTimeRate).toBe(0.5);
      expect(res.body.avgLeadDays).toBe(10.0);
    });

    it('accurately computes inventory valuation and supports CSV formatting with quotes', async () => {
      // Insert items with comma and quotes in names to test CSV escaping
      await query(
        `INSERT INTO items (sku, name, unit, stock_qty, min_level, unit_cost, is_active)
         VALUES ('SKU-CSV-1', 'Monitor, 24" IPS "UltraFast"', 'nos', 10, 2, 12000.00, 1),
                ('SKU-CSV-2', 'Keyboard & Mouse Combo', 'set', 20, 5, 1500.00, 1)`
      );

      // JSON format
      const jsonRes = await request(app)
        .get('/api/reports/inventory')
        .set('Authorization', `Bearer ${storeManagerToken}`);

      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.totalCount).toBe(2);
      // Valuation: (10 * 12000) + (20 * 1500) = 120,000 + 30,000 = 150,000
      expect(jsonRes.body.totalValuation).toBe(150000);

      // CSV format
      const csvRes = await request(app)
        .get('/api/reports/inventory?format=csv')
        .set('Authorization', `Bearer ${storeManagerToken}`);

      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');
      expect(csvRes.text).toContain('SKU,Item Name,Category,Stock Quantity,Min Level,Unit,Unit Cost,Status,Valuation');
      // Escaped quotes test: "Monitor, 24"" IPS ""UltraFast"""
      expect(csvRes.text).toContain('"Monitor, 24"" IPS ""UltraFast"""');
    });

    it('enforces department scoping so HoD only sees own department in procurement report', async () => {
      // Create request in CSE
      await query(
        `INSERT INTO purchase_requests (req_no, department_id, requested_by, status)
         VALUES ('REQ-CSE-01', ?, ?, 'APPROVED')`,
        [deptCseId, reqCseId]
      );

      // Create request in ECE
      await query(
        `INSERT INTO purchase_requests (req_no, department_id, status)
         VALUES ('REQ-ECE-01', ?, 'APPROVED')`,
        [deptEceId]
      );

      // 1. HoD CSE views procurement report -> should only count 1 request (CSE)
      const cseReport = await request(app)
        .get('/api/reports/procurement')
        .set('Authorization', `Bearer ${hodCseToken}`);

      expect(cseReport.status).toBe(200);
      expect(cseReport.body.countsByStatus.APPROVED).toBe(1);

      // 2. HoD ECE views procurement report -> should only count 1 request (ECE)
      const eceReport = await request(app)
        .get('/api/reports/procurement')
        .set('Authorization', `Bearer ${hodEceToken}`);

      expect(eceReport.status).toBe(200);
      expect(eceReport.body.countsByStatus.APPROVED).toBe(1);

      // 3. Principal views procurement report -> counts both (2)
      const priReport = await request(app)
        .get('/api/reports/procurement')
        .set('Authorization', `Bearer ${principalToken}`);

      expect(priReport.status).toBe(200);
      expect(priReport.body.countsByStatus.APPROVED).toBe(2);
    });

    it('executes daily stock digest and notifies procurement officers when items are LOW or OUT', async () => {
      // Create one low stock item
      await query(
        `INSERT INTO items (sku, name, unit, stock_qty, min_level, unit_cost, is_active)
         VALUES ('SKU-LOW-DIGEST', 'Solder Wire 500g', 'roll', 1, 5, 300.00, 1)`
      );

      const digestResult = await runDailyStockDigest();
      expect(digestResult.notified).toBe(true);
      expect(digestResult.count).toBe(1);

      // Verify notification created
      const notifs = await query(
        "SELECT * FROM notifications WHERE type = 'LOW_STOCK' AND message LIKE '%Daily Inventory Digest%'"
      );
      expect(notifs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
