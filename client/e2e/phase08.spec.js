import { test, expect } from '@playwright/test';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import {
  setupE2eDatabase,
  startBackendServer,
  stopBackendServer
} from './server-controller.js';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 08 — Client Procurement, Approvals, Orders, Dashboards & Reports', () => {
  let db;

  async function loginAs(page, email, password = 'User123!') {
    await page.goto('http://localhost:5174/login');
    await page.fill('#login-email', email);
    await page.fill('#login-password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'));
  }

  async function logout(page) {
    if ((await page.locator('#user-menu-btn').count()) === 0) {
      await page.goto('http://localhost:5174/dashboard');
    }
    await page.click('#user-menu-btn');
    await page.click('#logout-btn');
    await page.waitForURL((url) => url.pathname.includes('/login'));
  }

  test.beforeAll(async () => {
    await setupE2eDatabase();

    db = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'rootpassword',
      database: 'smartinv_e2e'
    });

    const hash = await bcrypt.hash('User123!', 12);

    // 1. Get CSE Dept ID
    const [depts] = await db.query("SELECT id FROM departments WHERE name = 'Computer Science and Engineering'");
    const deptId = depts[0].id;

    // 2. Create Category
    const [catRes] = await db.query(
      "INSERT INTO categories (name, is_demo) VALUES ('Lab Equipment', 0)"
    );
    const catId = catRes.insertId;

    // 3. Create Item
    await db.query(
      `INSERT INTO items (sku, name, category_id, unit, min_level, stock_qty, unit_cost, is_active, is_demo)
       VALUES ('ARD-UNO-01', 'Arduino Uno R3', ?, 'Pieces', 5, 0, 650.00, 1, 0)`,
      [catId]
    );

    // 4. Create Supplier
    const [suppRes] = await db.query(
      `INSERT INTO suppliers (name, email, phone, is_active, is_demo)
       VALUES ('Apex Electronics', 'apex@demo.invalid', '9876543210', 1, 0)`
    );
    const suppId = suppRes.insertId;

    // 5. Create Requester user
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id, is_demo)
       VALUES ('Prof Ramesh', 'ramesh.cse@ritrjpm.ac.in', ?, 'REQUESTER', 'ACTIVE', ?, 0)`,
      [hash, deptId]
    );

    // 6. Create HoD user
    const [hodRes] = await db.query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id, is_demo)
       VALUES ('Dr Suresh', 'suresh.cse@ritrjpm.ac.in', ?, 'HOD', 'ACTIVE', ?, 0)`,
      [hash, deptId]
    );
    const hodId = hodRes.insertId;

    // Assign HoD to CSE department
    await db.query('UPDATE departments SET hod_user_id = ? WHERE id = ?', [hodId, deptId]);

    // 7. Create Principal user
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, status, is_demo)
       VALUES ('Dr Principal', 'principal@ritrjpm.ac.in', ?, 'PRINCIPAL', 'ACTIVE', 0)`,
      [hash]
    );

    // 8. Create Procurement Officer user
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, status, is_demo)
       VALUES ('Mr Officer', 'officer@ritrjpm.ac.in', ?, 'PROCUREMENT_OFFICER', 'ACTIVE', 0)`,
      [hash]
    );

    // 9. Create Supplier user
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, status, supplier_id, is_demo)
       VALUES ('Apex Rep', 'apex.rep@demo.invalid', ?, 'SUPPLIER', 'ACTIVE', ?, 0)`,
      [hash, suppId]
    );

    await startBackendServer();
  });

  test.afterAll(async () => {
    if (db) await db.end();
    stopBackendServer();
  });

  test('1. Full procurement cycle: Requester -> HoD -> Officer -> Supplier -> Store Manager receipt -> stock increases', async ({ page }) => {
    test.setTimeout(90000);

    // A. Requester raises request
    await loginAs(page, 'ramesh.cse@ritrjpm.ac.in');
    await page.goto('http://localhost:5174/requests/new');
    await expect(page.locator('h1')).toContainText('New Purchase Request');

    // Fill line item
    await page.selectOption('#req-line-item-0', { label: 'Arduino Uno R3 (SKU: ARD-UNO-01 • Pieces)' });
    await page.fill('#req-line-qty-0', '10');
    await page.selectOption('#req-priority', 'HIGH');
    await page.fill('#req-justification', 'Required for Embedded Systems Lab');

    await page.click('#submit-request-btn');

    // Should redirect to request detail
    await expect(page).toHaveURL(/.*\/requests\/\d+/);
    await expect(page.locator('body')).toContainText('Pending HoD');
    await expect(page.locator('table').locator('text=Arduino Uno R3')).toBeVisible();

    await logout(page);

    // B. HoD reviews and approves
    await loginAs(page, 'suresh.cse@ritrjpm.ac.in');
    await page.goto('http://localhost:5174/dashboard');

    // Check dashboard reflects 1 pending approval
    await expect(page.locator('.card:has-text("Pending Department Approvals")')).toContainText('1');

    // Navigate to Approvals
    await page.click('nav a:has-text("Approvals")');
    await expect(page).toHaveURL('http://localhost:5174/approvals');
    await expect(page.locator('table').locator('text=Prof Ramesh')).toBeVisible();

    // Click Approve
    const approveBtn = page.locator('table button:has-text("Approve")').first();
    await approveBtn.click();
    await page.click('.modal-footer button:has-text("Approve Requisition")');
    await expect(page.locator('.toast:has-text("approved successfully")')).toBeVisible();

    await logout(page);

    // C. Procurement Officer creates PO
    await loginAs(page, 'officer@ritrjpm.ac.in');
    await page.goto('http://localhost:5174/procurement');
    await expect(page.locator('table').locator('text=Prof Ramesh')).toBeVisible();

    // Click Create PO
    await page.locator('table button:has-text("Create PO")').first().click();
    await expect(page.locator('.modal-title')).toContainText('Generate Purchase Orders');

    // Select Supplier Apex Electronics
    await page.selectOption('#po-supplier-select-0', { label: 'Apex Electronics' });
    await page.click('#submit-po-form-btn');

    await expect(page.locator('.toast:has-text("purchase order(s) successfully")')).toBeVisible();

    await logout(page);

    // D. Supplier fulfills order: PLACED -> CONFIRMED -> SHIPPED -> DELIVERED
    await loginAs(page, 'apex.rep@demo.invalid');
    await page.goto('http://localhost:5174/orders');
    await page.locator('table button:has-text("View")').first().click();
    await expect(page).toHaveURL(/.*\/orders\/\d+/);

    // Initial status: Placed
    await expect(page.locator('body')).toContainText('Placed');

    // 1. Confirm Order
    await page.click('#supplier-status-action-btn:has-text("Confirm Order")');
    await expect(page.locator('.toast:has-text("CONFIRMED")')).toBeVisible();
    await expect(page.locator('body')).toContainText('Confirmed');

    // 2. Mark Shipped
    await page.click('#supplier-status-action-btn:has-text("Mark as Shipped")');
    await expect(page.locator('.toast:has-text("SHIPPED")')).toBeVisible();
    await expect(page.locator('body')).toContainText('Shipped');

    // 3. Mark Delivered
    await page.click('#supplier-status-action-btn:has-text("Mark as Delivered")');
    await expect(page.locator('.toast:has-text("DELIVERED")')).toBeVisible();
    await expect(page.locator('body')).toContainText('Delivered');

    await logout(page);

    // E. Store Manager receives goods
    await loginAs(page, 'store@ritrjpm.ac.in', 'Store123!');
    await page.goto('http://localhost:5174/orders');
    await page.locator('table button:has-text("Receive")').first().click();
    await expect(page).toHaveURL(/.*\/orders\/\d+/);

    // Click Receive Goods
    await page.click('#receive-goods-btn');
    await page.click('.modal-footer button:has-text("Confirm & Post Receipt")');

    // Goods Receipt Summary Modal should display
    await expect(page.locator('.modal-title')).toContainText('Goods Receipt Summary');
    await expect(page.locator('.modal-body')).toContainText('+10 Pieces');
    await page.click('.modal-footer button:has-text("Done")');

    // Verify stock has updated in inventory
    await page.goto('http://localhost:5174/items');
    await expect(page.locator('table').locator('text=Arduino Uno R3')).toBeVisible();
    await expect(page.locator('table').locator('text=10 Pieces')).toBeVisible();

    await logout(page);

    // F. Verify Requester sees request status as RECEIVED
    await loginAs(page, 'ramesh.cse@ritrjpm.ac.in');
    await page.goto('http://localhost:5174/requests');
    await expect(page.locator('table').locator('text=Received')).toBeVisible();

    // Check notifications
    await page.click('#notif-menu-btn');
    await page.click('button:has-text("View all notifications")');
    await expect(page.locator('body')).toContainText('received');

    await logout(page);
  });

  test('2. HoD-raised request approved by Principal', async ({ page }) => {
    test.setTimeout(60000);

    // HoD raises request
    await loginAs(page, 'suresh.cse@ritrjpm.ac.in');
    await page.goto('http://localhost:5174/requests/new');
    await page.selectOption('#req-line-item-0', { label: 'Arduino Uno R3 (SKU: ARD-UNO-01 • Pieces)' });
    await page.fill('#req-line-qty-0', '5');
    await page.click('#submit-request-btn');

    // Status should be Pending Principal
    await expect(page).toHaveURL(/.*\/requests\/\d+/);
    await expect(page.locator('body')).toContainText('Pending Principal');

    await logout(page);

    // Principal approves
    await loginAs(page, 'principal@ritrjpm.ac.in');
    await page.goto('http://localhost:5174/approvals');
    await expect(page.locator('table').locator('text=Dr Suresh')).toBeVisible();

    await page.locator('table button:has-text("Approve")').first().click();
    await page.click('.modal-footer button:has-text("Approve Requisition")');
    await expect(page.locator('.toast:has-text("approved successfully")')).toBeVisible();

    await logout(page);
  });

  test('3. Role navigation scoping, reports, and empty state check', async ({ page }) => {
    test.setTimeout(90000);

    // Supplier role isolation
    await loginAs(page, 'apex.rep@demo.invalid');

    // Supplier must not see Inventory, Reorder, Users, Departments, Categories in nav
    await expect(page.locator('nav a:has-text("Inventory")')).toHaveCount(0);
    await expect(page.locator('nav a:has-text("Reorder")')).toHaveCount(0);
    await expect(page.locator('nav a:has-text("Users")')).toHaveCount(0);

    // Direct access to forbidden route /items should show 403
    await page.goto('http://localhost:5174/items');
    await expect(page).toHaveURL('http://localhost:5174/403');
    await expect(page.locator('h1')).toContainText('Access Denied');

    await logout(page);

    // Admin checks Reports
    await loginAs(page, 'admin@ritrjpm.ac.in', 'Admin123!');
    await page.click('nav a:has-text("Reports")');
    await expect(page).toHaveURL('http://localhost:5174/reports');
    await expect(page.locator('body')).toContainText('Inventory Valuation');
    await expect(page.locator('#export-inventory-csv-btn')).toBeVisible();

    await page.click('#tab-procurement');
    await expect(page.locator('#export-procurement-csv-btn')).toBeVisible();

    await page.click('#tab-suppliers');
    await expect(page.locator('#export-suppliers-csv-btn')).toBeVisible();

    await logout(page);
  });
});
