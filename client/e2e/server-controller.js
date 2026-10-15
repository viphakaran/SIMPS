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

export async function startBackendServer() {
  if (serverProcess) {
    return;
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

  serverProcess.stderr.on('data', (data) => {
    const errText = data.toString();
    if (!errText.includes('ExperimentalWarning')) {
      console.error('[E2E Server Stderr]', errText);
    }
  });

  serverProcess.on('exit', () => {
    serverProcess = null;
  });

  // Poll /api/health until server is responsive
  const startTime = Date.now();
  while (Date.now() - startTime < 45000) {
    try {
      const res = await fetch('http://localhost:5001/api/health');
      if (res.ok) {
        return;
      }
    } catch {
      // Waiting for server to listen
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Timed out waiting for E2E backend server to start on port 5001');
}

export function stopBackendServer() {
  if (serverProcess && serverProcess.pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: 'ignore' });
        // Synchronous sleep on Windows to allow OS to release socket binding
        execSync('powershell -Command "Start-Sleep -Milliseconds 500"');
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch {
      // Process already terminated
    }
    serverProcess = null;
  }
}
