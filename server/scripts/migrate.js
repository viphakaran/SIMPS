import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import env from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(targetDatabase = null) {
  const dbName = targetDatabase || (env.NODE_ENV === 'test' ? env.DB_NAME_TEST : env.DB_NAME);

  console.log(`[migrate] Connecting to database: ${dbName}...`);
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: dbName,
    multipleStatements: true,
    timezone: 'Z'
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    const [rows] = await connection.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    const dbDir = path.resolve(__dirname, '../../db');
    if (!fs.existsSync(dbDir)) {
      throw new Error(`Migration directory not found: ${dbDir}`);
    }

    const files = fs
      .readdirSync(dbDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      console.log(`[migrate] Applying ${file}...`);
      const filePath = path.join(dbDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      console.log(`[migrate] Successfully applied ${file}`);
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log('[migrate] Database is up to date. No new migrations.');
    } else {
      console.log(`[migrate] Applied ${appliedCount} migration(s).`);
    }
  } finally {
    await connection.end();
  }
}

// If executed directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targetDb = process.argv.includes('--test') ? env.DB_NAME_TEST : null;
  runMigrations(targetDb)
    .then(() => {
      console.log('[migrate] Migration run complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[migrate] Migration failed:', err);
      process.exit(1);
    });
}
