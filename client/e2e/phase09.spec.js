import { test, expect } from '@playwright/test';
import mysql from 'mysql2/promise';
import {
  setupE2eDatabase,
  startBackendServer,
  stopBackendServer
} from './server-controller.js';
import { loadDemoData } from '../../demo/load.js';
import { clearDemoData } from '../../demo/clear.js';
import { getDemoStatus } from '../../demo/status.js';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 09 — Demo Data Lifecycle (Load, Banner, Action, Clear & FK Integrity)', () => {
  let db;

  test.beforeAll(async () => {
    await setupE2eDatabase();
    await startBackendServer();

    db = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'rootpassword',
      database: 'smartinv_e2e'
    });
  });

  test.afterAll(async () => {
    if (db) await db.end();
    stopBackendServer();
  });

  test('1. demo:load populates dashboards and shows the Demo data loaded banner; demo:clear restores original state', async ({ page }) => {
    test.setTimeout(90000);

    // Initial real status before demo load
    const initialStatus = await getDemoStatus(db);
    const initialRealCount = initialStatus.reduce((acc, row) => acc + row['Real Rows'], 0);
    expect(initialRealCount).toBeGreaterThan(0);

    // Login as real Admin
    await page.goto('http://localhost:5174/login');
    await page.fill('#login-email', 'admin@ritrjpm.ac.in');
    await page.fill('#login-password', 'Admin123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Prior to demo:load, the banner should NOT be present
    await expect(page.locator('text=Demo data loaded')).toHaveCount(0);

    // Attach demo data to smartinv_e2e
    await loadDemoData(db, { reset: false });

    // Reload page to observe banner and populated dashboard
    await page.reload();
    await expect(page.locator('text=Demo data loaded')).toBeVisible();

    // Verify reports are populated with demo items
    await page.goto('http://localhost:5174/reports');
    await expect(page.locator('table').locator('text=Arduino Uno R3 Microcontroller')).toBeVisible();

    // 2. Perform an action as real admin on a demo item (Stock Adjustment)
    const [demoItem] = await db.query(
      "SELECT id, stock_qty FROM items WHERE sku = 'DEMO-ELE-001'"
    );
    expect(demoItem.length).toBe(1);

    await page.goto(`http://localhost:5174/items/${demoItem[0].id}`);
    await expect(page.locator('h1')).toContainText('Arduino Uno R3 Microcontroller');

    // 3. Clear demo data
    await clearDemoData(db, { isCli: false, force: true });

    // Reload page: banner must disappear
    await page.goto('http://localhost:5174/dashboard');
    await expect(page.locator('text=Demo data loaded')).toHaveCount(0);

    // Verify real rows are byte-for-byte untouched
    const finalStatus = await getDemoStatus(db);
    const finalRealCount = finalStatus.reduce((acc, row) => acc + row['Real Rows'], 0);
    const finalDemoCount = finalStatus.reduce((acc, row) => acc + row['Demo Rows'], 0);

    expect(finalRealCount).toBe(initialRealCount);
    expect(finalDemoCount).toBe(0);

    // 4. Invariant: Check zero orphaned foreign keys
    const [orphanedSm] = await db.query(`
      SELECT COUNT(*) AS c FROM stock_movements sm
      LEFT JOIN items i ON sm.item_id = i.id
      WHERE i.id IS NULL
    `);
    expect(orphanedSm[0].c).toBe(0);

    const [orphanedReq] = await db.query(`
      SELECT COUNT(*) AS c FROM purchase_requests pr
      LEFT JOIN departments d ON pr.department_id = d.id
      WHERE d.id IS NULL
    `);
    expect(orphanedReq[0].c).toBe(0);

    const [orphanedPo] = await db.query(`
      SELECT COUNT(*) AS c FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE s.id IS NULL
    `);
    expect(orphanedPo[0].c).toBe(0);
  });

  test('2. demo:load twice without --reset refuses safely', async () => {
    // Load once
    await loadDemoData(db, { reset: false });

    // Second call without reset must throw
    await expect(loadDemoData(db, { reset: false })).rejects.toThrow(
      /Demo data already exists/
    );

    // Clean up
    await clearDemoData(db, { isCli: false, force: true });
  });
});
