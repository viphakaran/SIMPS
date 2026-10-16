import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env files in priority order
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Official academic departments verified from Ramco Institute of Technology (ritrjpm.ac.in).
 * Documented in docs/BRANDING.md.
 */
export const COLLEGE_DEPARTMENTS = [
  'Civil Engineering',
  'Computer Science and Engineering',
  'Electrical and Electronics Engineering',
  'Electronics and Communication Engineering',
  'Mechanical Engineering',
  'Artificial Intelligence and Data Science',
  'Computer Science and Business Systems',
  'Information Technology',
  'Computer Science and Engineering (Artificial Intelligence and Machine Learning)',
  'Computer Science and Engineering (Cyber Security)',
  'Science and Humanities'
];

/**
 * Idempotently seeds official college departments with is_demo = 0.
 * Skips any departments that already exist by name.
 * Never creates users, items, suppliers, categories, or real accounts.
 *
 * @param {import('mysql2/promise').Connection} [customConnection]
 * @returns {Promise<{ inserted: string[], existing: string[], total: number }>}
 */
export async function seedCollegeDepartments(customConnection = null) {
  let connection = customConnection;
  let shouldClose = false;

  if (!connection) {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || 'rootpassword';
    const database = process.env.DB_NAME || 'smartinv';

    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      dateStrings: true
    });
    shouldClose = true;
  }

  try {
    const [rows] = await connection.query('SELECT name FROM departments');
    const existingNames = new Set(rows.map((r) => r.name.trim().toLowerCase()));

    const inserted = [];
    const existing = [];

    for (const deptName of COLLEGE_DEPARTMENTS) {
      if (existingNames.has(deptName.trim().toLowerCase())) {
        existing.push(deptName);
      } else {
        await connection.query(
          'INSERT INTO departments (name, is_active, is_demo) VALUES (?, 1, 0)',
          [deptName]
        );
        inserted.push(deptName);
      }
    }

    const [totalRows] = await connection.query('SELECT COUNT(*) AS count FROM departments WHERE is_demo = 0');
    const total = Number(totalRows[0].count);

    return { inserted, existing, total };
  } finally {
    if (shouldClose && connection) {
      await connection.end();
    }
  }
}

async function runCli() {
  console.log('\x1b[36m[SIMPS Seed College]\x1b[0m Seeding verified Ramco Institute of Technology departments...');

  try {
    const result = await seedCollegeDepartments();

    if (result.inserted.length > 0) {
      console.log(`\n\x1b[32m✔ Successfully inserted ${result.inserted.length} real department(s) (is_demo = 0):\x1b[0m`);
      result.inserted.forEach((name, i) => {
        console.log(`  ${i + 1}. ${name}`);
      });
    } else {
      console.log('\n\x1b[33mℹ 0 departments inserted. (All verified departments already exist in database).\x1b[0m');
    }

    if (result.existing.length > 0) {
      console.log(`\nSkipped ${result.existing.length} existing department(s):`);
      result.existing.forEach((name) => console.log(`  - ${name}`));
    }

    console.log(`\nTotal real departments in database: \x1b[32m${result.total}\x1b[0m\n`);
  } catch (err) {
    console.error('\n\x1b[31m[ERROR]\x1b[0m Failed to seed college departments:', err.message);
    process.exit(1);
  }
}

// Run CLI directly if executed from command line
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli();
}
