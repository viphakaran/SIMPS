import { getDbConnection } from './db.js';

export async function clearDemoData(connection, options = {}) {
  const { isCli = false, force = false } = options;

  if (process.env.NODE_ENV === 'production' && !force) {
    const errorMsg = 'Refusing to clear demo data in production environment without --force flag.';
    if (isCli) {
      console.error(`\x1b[31m[ERROR]\x1b[0m ${errorMsg}`);
      process.exit(1);
    }
    throw new Error(errorMsg);
  }

  const counts = {};

  // 1. Break circular dependency: set hod_user_id to null for demo departments/users
  await connection.query(`
    UPDATE departments 
    SET hod_user_id = NULL 
    WHERE is_demo = 1 
       OR hod_user_id IN (SELECT id FROM (SELECT id FROM users WHERE is_demo = 1) AS u)
  `);

  // 2. Notifications
  const [notifRes] = await connection.query('DELETE FROM notifications WHERE is_demo = 1');
  counts.notifications = notifRes.affectedRows;

  // 3. Stock movements
  const [smRes] = await connection.query('DELETE FROM stock_movements WHERE is_demo = 1');
  counts.stock_movements = smRes.affectedRows;

  // 4. po_items (child of purchase_orders)
  const [poiRes] = await connection.query(
    'DELETE FROM po_items WHERE po_id IN (SELECT id FROM purchase_orders WHERE is_demo = 1)'
  );
  counts.po_items = poiRes.affectedRows;

  // 5. Purchase orders
  const [poRes] = await connection.query('DELETE FROM purchase_orders WHERE is_demo = 1');
  counts.purchase_orders = poRes.affectedRows;

  // 6. request_approvals (child of purchase_requests)
  const [raRes] = await connection.query(
    'DELETE FROM request_approvals WHERE request_id IN (SELECT id FROM purchase_requests WHERE is_demo = 1)'
  );
  counts.request_approvals = raRes.affectedRows;

  // 7. request_items (child of purchase_requests)
  const [riRes] = await connection.query(
    'DELETE FROM request_items WHERE request_id IN (SELECT id FROM purchase_requests WHERE is_demo = 1)'
  );
  counts.request_items = riRes.affectedRows;

  // 8. Purchase requests
  const [prRes] = await connection.query('DELETE FROM purchase_requests WHERE is_demo = 1');
  counts.purchase_requests = prRes.affectedRows;

  // 9. Items
  const [itemRes] = await connection.query('DELETE FROM items WHERE is_demo = 1');
  counts.items = itemRes.affectedRows;

  // 10. Users
  const [userRes] = await connection.query('DELETE FROM users WHERE is_demo = 1');
  counts.users = userRes.affectedRows;

  // 11. Suppliers
  const [suppRes] = await connection.query('DELETE FROM suppliers WHERE is_demo = 1');
  counts.suppliers = suppRes.affectedRows;

  // 12. Departments
  const [deptRes] = await connection.query('DELETE FROM departments WHERE is_demo = 1');
  counts.departments = deptRes.affectedRows;

  // 13. Categories
  const [catRes] = await connection.query('DELETE FROM categories WHERE is_demo = 1');
  counts.categories = catRes.affectedRows;

  return counts;
}

async function runCli() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  console.log('\x1b[36m[SIMPS Demo Clear]\x1b[0m Connecting to database...');
  const connection = await getDbConnection();

  try {
    const counts = await clearDemoData(connection, { isCli: true, force });

    console.log('\n\x1b[32m✔ Demo data cleared successfully. Deleted rows per table:\x1b[0m');
    console.table(counts);

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`Total demo rows removed: \x1b[33m${total}\x1b[0m (Zero real rows touched)\n`);
  } catch (err) {
    console.error('\x1b[31m[ERROR]\x1b[0m Failed to clear demo data:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('clear.js')) {
  runCli();
}
