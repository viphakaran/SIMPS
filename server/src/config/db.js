import mysql from 'mysql2/promise';
import env from './env.js';

const isTest = env.NODE_ENV === 'test';
const database = isTest ? env.DB_NAME_TEST : env.DB_NAME;

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: false,
  timezone: 'Z',
  multipleStatements: true
});

/**
 * Execute a transaction block with automatic commit and rollback.
 * @param {Function} fn - async (connection) => result
 * @returns {Promise<any>}
 */
export async function withTransaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Shorthand for pool.query with parameterized inputs
 */
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function closePool() {
  await pool.end();
}

export default {
  pool,
  withTransaction,
  query,
  closePool
};
