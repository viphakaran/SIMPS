import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { query } from '../src/config/db.js';
import { initTestDatabase, clearTestDatabase } from './setup.js';

describe('Inventory, Stock Movements & Notifications', () => {
  let testPasswordHash;
  let storeManagerToken;
  let storeManagerId;
  let procOfficerToken;
  let procOfficerId;
  let requesterToken;
  let supplierToken;
  let departmentId;
  let categoryId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    testPasswordHash = await bcrypt.hash('Password123', 12);
    await initTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    // 1. Department
    const deptRes = await query(
      "INSERT INTO departments (name, is_active) VALUES ('Mechanical Engg', 1)"
    );
    departmentId = deptRes.insertId;

    // 2. Category
    const catRes = await query("INSERT INTO categories (name) VALUES ('Lab Hardware')");
    categoryId = catRes.insertId;

    // 3. Supplier
    const supRes = await query(
      `INSERT INTO suppliers (name, email, phone, category_id, is_active)
       VALUES ('Hardware Supplier', 'hardware@vendor.com', '9876543210', ?, 1)`,
      [categoryId]
    );
    const supplierId = supRes.insertId;

    // 4. Store Manager
    const smRes = await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Store Manager User', 'store@ritrkpm.ac.in', ?, 'STORE_MANAGER', 'ACTIVE')`,
      [testPasswordHash]
    );
    storeManagerId = smRes.insertId;
    const smLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'store@ritrkpm.ac.in', password: 'Password123' });
    storeManagerToken = smLogin.body.token;

    // 5. Procurement Officer
    const poRes = await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Procurement Officer User', 'proc@ritrkpm.ac.in', ?, 'PROCUREMENT_OFFICER', 'ACTIVE')`,
      [testPasswordHash]
    );
    procOfficerId = poRes.insertId;
    const poLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'proc@ritrkpm.ac.in', password: 'Password123' });
    procOfficerToken = poLogin.body.token;

    // 6. Requester
    await query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id)
       VALUES ('Requester User', 'req@ritrkpm.ac.in', ?, 'REQUESTER', 'ACTIVE', ?)`,
      [testPasswordHash, departmentId]
    );
    const reqLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'req@ritrkpm.ac.in', password: 'Password123' });
    requesterToken = reqLogin.body.token;

    // 7. Supplier User
    await query(
      `INSERT INTO users (name, email, password_hash, role, status, supplier_id)
       VALUES ('Supplier User', 'vendor@vendor.com', ?, 'SUPPLIER', 'ACTIVE', ?)`,
      [testPasswordHash, supplierId]
    );
    const supLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vendor@vendor.com', password: 'Password123' });
    supplierToken = supLogin.body.token;
  });

  describe('Permissions & Role Checks', () => {
    it('forbids SUPPLIER from accessing items list', async () => {
      const res = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${supplierToken}`);

      expect(res.status).toBe(403);
    });

    it('allows REQUESTER to view items, but forbids creating items or issuing stock', async () => {
      const listRes = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${requesterToken}`);
      expect(listRes.status).toBe(200);

      const createRes = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          sku: 'ITEM-TEST-001',
          name: 'Oscilloscope',
          categoryId
        });
      expect(createRes.status).toBe(403);
    });
  });

  describe('Item Catalog & Stock Movements', () => {
    it('creates an item with opening stock and verifies ADJUSTMENT movement', async () => {
      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          sku: 'SKU-OSC-01',
          name: 'Digital Oscilloscope 100MHz',
          categoryId,
          unit: 'units',
          minLevel: 5,
          unitCost: 15000.5,
          openingStock: 25
        });

      expect(res.status).toBe(201);
      expect(res.body.sku).toBe('SKU-OSC-01');
      expect(res.body.stockQty).toBe(25);
      expect(res.body.minLevel).toBe(5);
      expect(res.body.status).toBe('IN_STOCK');

      const itemId = res.body.id;

      // Verify movement row
      const movements = await query('SELECT * FROM stock_movements WHERE item_id = ?', [itemId]);
      expect(movements.length).toBe(1);
      expect(movements[0].type).toBe('ADJUSTMENT');
      expect(movements[0].quantity).toBe(25);
      expect(movements[0].balance_after).toBe(25);
      expect(movements[0].reason).toBe('Opening stock');
    });

    it('rejects duplicate SKU with 409 Conflict', async () => {
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          sku: 'DUPLICATE-SKU',
          name: 'First Item',
          categoryId
        });

      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          sku: 'DUPLICATE-SKU',
          name: 'Second Item',
          categoryId
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SKU_EXISTS');
    });

    it('rejects issuing stock beyond available quantity with 409 INSUFFICIENT_STOCK', async () => {
      const itemRes = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          sku: 'SKU-LIMITED',
          name: 'Limited Stock Item',
          categoryId,
          openingStock: 5
        });
      const itemId = itemRes.body.id;

      const issueRes = await request(app)
        .post(`/api/items/${itemId}/issue`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          quantity: 10,
          departmentId,
          reason: 'Excessive request'
        });

      expect(issueRes.status).toBe(409);
      expect(issueRes.body.error.code).toBe('INSUFFICIENT_STOCK');

      // Verify stock did not change
      const [item] = await query('SELECT stock_qty FROM items WHERE id = ?', [itemId]);
      expect(item.stock_qty).toBe(5);
    });
  });

  describe('Low-Stock Alert Episodes & Invariant Acceptance Checks', () => {
    it('fires exactly one LOW_STOCK alert per episode, re-arms when restocked above min level, and verifies balance_after invariant', async () => {
      // 1. Create item: opening stock 20, min level 10
      const createRes = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          sku: 'SKU-ALERT-TEST',
          name: 'Arduino Uno R3',
          categoryId,
          minLevel: 10,
          openingStock: 20
        });
      expect(createRes.status).toBe(201);
      const itemId = createRes.body.id;
      expect(createRes.body.status).toBe('IN_STOCK');

      // No low-stock notifications initially
      let notifs = await query("SELECT * FROM notifications WHERE type = 'LOW_STOCK'");
      expect(notifs.length).toBe(0);

      // 2. Issue 12 units -> stock becomes 8 (<= 10, so status becomes LOW)
      const issue1 = await request(app)
        .post(`/api/items/${itemId}/issue`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          quantity: 12,
          departmentId,
          reason: 'Robotics lab batch 1'
        });
      expect(issue1.status).toBe(200);
      expect(issue1.body.stockQty).toBe(8);
      expect(issue1.body.status).toBe('LOW');

      // Check notifications: exactly 1 for Store Manager and 1 for Procurement Officer
      const smNotifs1 = await query(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'LOW_STOCK'",
        [storeManagerId]
      );
      const poNotifs1 = await query(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'LOW_STOCK'",
        [procOfficerId]
      );
      expect(smNotifs1.length).toBe(1);
      expect(poNotifs1.length).toBe(1);

      // 3. Issue another 3 units -> stock becomes 5 (still LOW)
      const issue2 = await request(app)
        .post(`/api/items/${itemId}/issue`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          quantity: 3,
          departmentId,
          reason: 'Robotics lab batch 2'
        });
      expect(issue2.status).toBe(200);
      expect(issue2.body.stockQty).toBe(5);
      expect(issue2.body.status).toBe('LOW');

      // Crucial: No extra notifications should be sent during the same low-stock episode!
      const smNotifs2 = await query(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'LOW_STOCK'",
        [storeManagerId]
      );
      expect(smNotifs2.length).toBe(1);

      // 4. Issue 5 units -> stock becomes 0 (OUT)
      const issue3 = await request(app)
        .post(`/api/items/${itemId}/issue`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          quantity: 5,
          departmentId,
          reason: 'Final units issued'
        });
      expect(issue3.status).toBe(200);
      expect(issue3.body.stockQty).toBe(0);
      expect(issue3.body.status).toBe('OUT');

      // Still no extra notifications during this episode
      const smNotifs3 = await query(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'LOW_STOCK'",
        [storeManagerId]
      );
      expect(smNotifs3.length).toBe(1);

      // 5. Restock above min level: Adjust stock +15 -> stock becomes 15 (> 10 -> IN_STOCK)
      const adjust1 = await request(app)
        .post(`/api/items/${itemId}/adjust`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          delta: 15,
          reason: 'Inventory restock'
        });
      expect(adjust1.status).toBe(200);
      expect(adjust1.body.stockQty).toBe(15);
      expect(adjust1.body.status).toBe('IN_STOCK');

      // Verify low_stock_alerted flag is reset to 0
      const [itemRow] = await query(
        'SELECT stock_qty, low_stock_alerted FROM items WHERE id = ?',
        [itemId]
      );
      expect(itemRow.low_stock_alerted).toBe(0);

      // 6. Issue 7 units -> stock becomes 8 (<= 10 -> LOW again)
      const issue4 = await request(app)
        .post(`/api/items/${itemId}/issue`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          quantity: 7,
          departmentId,
          reason: 'New workshop'
        });
      expect(issue4.status).toBe(200);
      expect(issue4.body.stockQty).toBe(8);
      expect(issue4.body.status).toBe('LOW');

      // New episode: exactly one NEW alert sent (total 2 now)
      const smNotifsFinal = await query(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'LOW_STOCK'",
        [storeManagerId]
      );
      const poNotifsFinal = await query(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'LOW_STOCK'",
        [procOfficerId]
      );
      expect(smNotifsFinal.length).toBe(2);
      expect(poNotifsFinal.length).toBe(2);

      // 7. Verify Invariant: balance_after of latest movement == items.stock_qty
      const [latestMovement] = await query(
        'SELECT balance_after FROM stock_movements WHERE item_id = ? ORDER BY id DESC LIMIT 1',
        [itemId]
      );
      const [currentItem] = await query('SELECT stock_qty FROM items WHERE id = ?', [itemId]);
      expect(latestMovement.balance_after).toBe(currentItem.stock_qty);
    });
  });

  describe('Concurrency Test', () => {
    it('prevents stock from going negative when two parallel requests issue stock concurrently', async () => {
      // Create item with stockQty = 5
      const createRes = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({
          sku: 'CONCURRENT-ITEM',
          name: 'Concurrent Stock Test Item',
          categoryId,
          openingStock: 5
        });
      const itemId = createRes.body.id;

      // Two simultaneous requests both attempting to issue 4 units (total 8 > 5)
      const req1 = request(app)
        .post(`/api/items/${itemId}/issue`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({ quantity: 4, departmentId, reason: 'Parallel client 1' });

      const req2 = request(app)
        .post(`/api/items/${itemId}/issue`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send({ quantity: 4, departmentId, reason: 'Parallel client 2' });

      const [res1, res2] = await Promise.all([req1, req2]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one request should succeed (200), and one must fail with 409 INSUFFICIENT_STOCK
      expect(statuses).toEqual([200, 409]);

      // Stock must be 1, never negative
      const [item] = await query('SELECT stock_qty FROM items WHERE id = ?', [itemId]);
      expect(item.stock_qty).toBe(1);
    });
  });

  describe('Notifications Endpoints API', () => {
    it('lists own notifications, returns unreadCount, and marks notifications read', async () => {
      // Create test notifications for store manager
      await query(
        `INSERT INTO notifications (user_id, type, message, is_read)
         VALUES (?, 'TEST_1', 'Message 1', 0), (?, 'TEST_2', 'Message 2', 0)`,
        [storeManagerId, storeManagerId]
      );

      // List
      const listRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${storeManagerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.unreadCount).toBeGreaterThanOrEqual(2);
      const notifId = listRes.body.data[0].id;

      // Mark one read
      const markRes = await request(app)
        .patch(`/api/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${storeManagerToken}`);
      expect(markRes.status).toBe(200);

      // Mark all read
      const markAllRes = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${storeManagerToken}`);
      expect(markAllRes.status).toBe(200);

      const verifyRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${storeManagerToken}`);
      expect(verifyRes.body.unreadCount).toBe(0);

      // Verify procurement officer can also query their notifications
      const poRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${procOfficerToken}`);
      expect(poRes.status).toBe(200);
    });
  });
});
