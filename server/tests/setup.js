import { runMigrations } from '../scripts/migrate.js';
import { query, pool } from '../src/config/db.js';

export async function initTestDatabase() {
  await runMigrations('smartinv_test');
}

export async function clearTestDatabase() {
  // Disable foreign keys to truncate safely
  await query('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
    'notifications',
    'stock_movements',
    'po_items',
    'purchase_orders',
    'request_approvals',
    'request_items',
    'purchase_requests',
    'items',
    'users',
    'suppliers',
    'departments',
    'categories'
  ];
  for (const table of tables) {
    await query(`TRUNCATE TABLE ${table}`);
  }
  await query('SET FOREIGN_KEY_CHECKS = 1');
}

export async function closeTestDatabase() {
  await pool.end();
}
