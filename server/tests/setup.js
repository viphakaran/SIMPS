import { runMigrations } from '../scripts/migrate.js';
import { pool } from '../src/config/db.js';

export async function initTestDatabase() {
  await runMigrations('smartinv_test');
}

export async function clearTestDatabase() {
  const connection = await pool.getConnection();
  try {
    // Disable foreign keys to truncate safely on this connection
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
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
      await connection.query(`DELETE FROM ${table}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    connection.release();
  }
}

export async function closeTestDatabase() {
  await pool.end();
}
