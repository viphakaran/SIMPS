import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import env from '../src/config/env.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--name' && args[i + 1]) {
      parsed.name = args[++i];
    } else if (arg === '--email' && args[i + 1]) {
      parsed.email = args[++i];
    } else if (arg === '--password' && args[i + 1]) {
      parsed.password = args[++i];
    }
  }
  return parsed;
}

export async function createAdmin(options = {}) {
  let { name, email, password } = options;

  if (!name || !email || !password) {
    const rl = readline.createInterface({ input, output });
    try {
      if (!name) {
        name = await rl.question('Admin Name: ');
      }
      if (!email) {
        email = await rl.question('Admin Email: ');
      }
      if (!password) {
        password = await rl.question('Admin Password: ');
      }
    } finally {
      rl.close();
    }
  }

  name = name?.trim();
  email = email?.trim().toLowerCase();

  if (!name || name.length < 2) {
    throw new Error('Name must be at least 2 characters long.');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Valid email address is required.');
  }

  if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error(
      'Password must be at least 8 characters long and contain at least one letter and one number.'
    );
  }

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    timezone: 'Z'
  });

  try {
    const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      throw new Error(`Refused: A user with email '${email}' already exists.`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await connection.query(
      `INSERT INTO users (name, email, password_hash, role, status, is_demo)
       VALUES (?, ?, ?, 'ADMIN', 'ACTIVE', 0)`,
      [name, email, passwordHash]
    );

    console.log(`[create-admin] Success: Admin user '${email}' created successfully with role ADMIN and status ACTIVE.`);
  } finally {
    await connection.end();
  }
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('create-admin.js') || process.argv[1].endsWith('createAdmin.js'));

if (isDirectRun) {
  const args = parseArgs();
  createAdmin(args)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[create-admin] Error:', err.message);
      process.exit(1);
    });
}
