import { spawn, execSync } from 'child_process';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../../server/scripts/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let serverProcess = null;

export async function setupE2eDatabase() {
  // Ensure smartinv_e2e database exists
  const rootConn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'rootpassword'
  });
  await rootConn.query(
    'CREATE DATABASE IF NOT EXISTS smartinv_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'
  );
  await rootConn.end();

  // Run migrations against smartinv_e2e
  await runMigrations('smartinv_e2e');

  // Truncate tables for a pristine state
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'rootpassword',
    database: 'smartinv_e2e'
  });

  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
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
    await conn.query(`TRUNCATE TABLE ${table}`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  // Seed active CSE Department
  const [deptRes] = await conn.query(
    "INSERT INTO departments (name, is_active, is_demo) VALUES ('Computer Science and Engineering', 1, 0)"
  );
  const deptId = deptRes.insertId;

  // Seed active Admin user
  const adminHash = await bcrypt.hash('Admin123!', 12);
  await conn.query(
    `INSERT INTO users (name, email, password_hash, role, status, is_demo)
     VALUES ('System Admin', 'admin@ritrjpm.ac.in', ?, 'ADMIN', 'ACTIVE', 0)`,
    [adminHash]
  );

  // Seed active Store Manager user
  const storeHash = await bcrypt.hash('Store123!', 12);
  await conn.query(
    `INSERT INTO users (name, email, password_hash, role, status, department_id, is_demo)
     VALUES ('Store Manager', 'store@ritrjpm.ac.in', ?, 'STORE_MANAGER', 'ACTIVE', ?, 0)`,
    [storeHash, deptId]
  );

  await conn.end();
}

export function startBackendServer() {
  return new Promise((resolve, reject) => {
    if (serverProcess) {
      return resolve();
    }
    serverProcess = spawn('node', ['server/src/server.js'], {
      cwd: rootDir,
      env: {
        ...process.env,
        PORT: '5001',
        DB_NAME: 'smartinv_e2e',
        DB_NAME_TEST: 'smartinv_e2e',
        CORS_ORIGIN: 'http://localhost:5174',
        NODE_ENV: 'test'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let resolved = false;

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('5001') && !resolved) {
        resolved = true;
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const errText = data.toString();
      if (!errText.includes('ExperimentalWarning')) {
        console.error('[E2E Server Stderr]', errText);
      }
    });

    serverProcess.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    serverProcess.on('exit', () => {
      serverProcess = null;
    });

    // Fallback if stdout regex misses
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 2500);
  });
}

export function stopBackendServer() {
  if (serverProcess && serverProcess.pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: 'ignore' });
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch {
      // Process already terminated
    }
    serverProcess = null;
  }
}
