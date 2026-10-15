import { getDbConnection } from './db.js';

export async function getDemoStatus(connection) {
  const tables = [
    { name: 'categories', hasDemoCol: true },
    { name: 'departments', hasDemoCol: true },
    { name: 'suppliers', hasDemoCol: true },
    { name: 'users', hasDemoCol: true },
    { name: 'items', hasDemoCol: true },
    { name: 'purchase_requests', hasDemoCol: true },
    {
      name: 'request_items',
      hasDemoCol: false,
      query: `SELECT 
                SUM(CASE WHEN pr.is_demo = 1 THEN 1 ELSE 0 END) AS demo_count,
                SUM(CASE WHEN pr.is_demo = 0 THEN 1 ELSE 0 END) AS real_count
              FROM request_items ri
              JOIN purchase_requests pr ON ri.request_id = pr.id`
    },
    {
      name: 'request_approvals',
      hasDemoCol: false,
      query: `SELECT 
                SUM(CASE WHEN pr.is_demo = 1 THEN 1 ELSE 0 END) AS demo_count,
                SUM(CASE WHEN pr.is_demo = 0 THEN 1 ELSE 0 END) AS real_count
              FROM request_approvals ra
              JOIN purchase_requests pr ON ra.request_id = pr.id`
    },
    { name: 'purchase_orders', hasDemoCol: true },
    {
      name: 'po_items',
      hasDemoCol: false,
      query: `SELECT 
                SUM(CASE WHEN po.is_demo = 1 THEN 1 ELSE 0 END) AS demo_count,
                SUM(CASE WHEN po.is_demo = 0 THEN 1 ELSE 0 END) AS real_count
              FROM po_items poi
              JOIN purchase_orders po ON poi.po_id = po.id`
    },
    { name: 'stock_movements', hasDemoCol: true },
    { name: 'notifications', hasDemoCol: true }
  ];

  const results = [];

  for (const t of tables) {
    if (t.hasDemoCol) {
      const [rows] = await connection.query(`
        SELECT 
          SUM(CASE WHEN is_demo = 1 THEN 1 ELSE 0 END) AS demo_count,
          SUM(CASE WHEN is_demo = 0 THEN 1 ELSE 0 END) AS real_count,
          COUNT(*) AS total_count
        FROM ${t.name}
      `);
      results.push({
        Table: t.name,
        'Demo Rows': Number(rows[0].demo_count || 0),
        'Real Rows': Number(rows[0].real_count || 0),
        Total: Number(rows[0].total_count || 0)
      });
    } else {
      const [rows] = await connection.query(t.query);
      const demoCount = Number(rows[0].demo_count || 0);
      const realCount = Number(rows[0].real_count || 0);
      results.push({
        Table: t.name,
        'Demo Rows': demoCount,
        'Real Rows': realCount,
        Total: demoCount + realCount
      });
    }
  }

  return results;
}

async function runCli() {
  console.log('\x1b[36m[SIMPS Demo Status]\x1b[0m Inspecting database...');
  const connection = await getDbConnection();

  try {
    const status = await getDemoStatus(connection);
    console.log('\n\x1b[32m=== Database Record Counts (Demo vs Real) ===\x1b[0m');
    console.table(status);

    const totalDemo = status.reduce((acc, row) => acc + row['Demo Rows'], 0);
    const totalReal = status.reduce((acc, row) => acc + row['Real Rows'], 0);

    console.log(
      `Summary: \x1b[33m${totalDemo}\x1b[0m demo rows present, \x1b[32m${totalReal}\x1b[0m real rows present.\n`
    );
  } catch (err) {
    console.error('\x1b[31m[ERROR]\x1b[0m Failed to query demo status:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('status.js')) {
  runCli();
}
