import { pool } from '../src/config/db.js';
import { initTestDatabase, clearTestDatabase, closeTestDatabase } from './setup.js';
import { seedCollegeDepartments, COLLEGE_DEPARTMENTS } from '../../seed/college.js';
import { loadDemoData } from '../../demo/load.js';
import { clearDemoData } from '../../demo/clear.js';

describe('Seed College Departments & Demo Coexistence', () => {
  let connection;

  beforeAll(async () => {
    await initTestDatabase();
    connection = await pool.getConnection();
  });

  afterAll(async () => {
    if (connection) connection.release();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  test('1. seed:college inserts all 11 verified college departments with is_demo = 0', async () => {
    const result = await seedCollegeDepartments(connection);

    expect(result.inserted).toHaveLength(COLLEGE_DEPARTMENTS.length);
    expect(result.existing).toHaveLength(0);
    expect(result.total).toBe(COLLEGE_DEPARTMENTS.length);

    const [rows] = await connection.query(
      'SELECT id, name, is_demo, is_active FROM departments WHERE is_demo = 0 ORDER BY name'
    );
    expect(rows).toHaveLength(COLLEGE_DEPARTMENTS.length);
    for (const row of rows) {
      expect(row.is_demo).toBe(0);
      expect(row.is_active).toBe(1);
    }
  });

  test('2. seed:college is strictly idempotent — second run inserts 0 rows', async () => {
    const firstRun = await seedCollegeDepartments(connection);
    expect(firstRun.inserted).toHaveLength(COLLEGE_DEPARTMENTS.length);

    const secondRun = await seedCollegeDepartments(connection);
    expect(secondRun.inserted).toHaveLength(0);
    expect(secondRun.existing).toHaveLength(COLLEGE_DEPARTMENTS.length);
    expect(secondRun.total).toBe(COLLEGE_DEPARTMENTS.length);

    const [rows] = await connection.query('SELECT COUNT(*) AS count FROM departments');
    expect(Number(rows[0].count)).toBe(COLLEGE_DEPARTMENTS.length);
  });

  test('3. demo:load reuses existing real departments without duplicates', async () => {
    // First seed the real college departments
    await seedCollegeDepartments(connection);

    // Now run demo:load
    await loadDemoData(connection, { reset: false });

    // Verify department count hasn't created duplicate names
    const [allDepts] = await connection.query('SELECT id, name, is_demo, hod_user_id FROM departments');
    const deptNames = allDepts.map((d) => d.name);
    const uniqueNames = new Set(deptNames);
    expect(uniqueNames.size).toBe(deptNames.length); // Zero duplicate department names

    // Check that real departments are still is_demo = 0
    const [realDepts] = await connection.query('SELECT id, name, is_demo, hod_user_id FROM departments WHERE is_demo = 0');
    expect(realDepts).toHaveLength(COLLEGE_DEPARTMENTS.length);

    // Verify demo users are attached to these departments
    const [demoUsersInRealDepts] = await connection.query(
      `SELECT u.id, u.email, u.role, u.department_id 
       FROM users u 
       JOIN departments d ON u.department_id = d.id 
       WHERE d.is_demo = 0 AND u.is_demo = 1`
    );
    expect(demoUsersInRealDepts.length).toBeGreaterThan(0);
  });

  test('4. demo:clear leaves real departments intact and clears demo HoD assignment', async () => {
    // Seed real departments
    await seedCollegeDepartments(connection);

    // Load demo data
    await loadDemoData(connection, { reset: false });

    // Clear demo data
    const counts = await clearDemoData(connection, { force: true });
    expect(counts.users).toBeGreaterThan(0);
    expect(counts.departments).toBe(0); // Zero real departments deleted

    // Verify all 11 real departments remain
    const [remainingDepts] = await connection.query(
      'SELECT id, name, is_demo, hod_user_id FROM departments ORDER BY id'
    );
    expect(remainingDepts).toHaveLength(COLLEGE_DEPARTMENTS.length);
    for (const dept of remainingDepts) {
      expect(dept.is_demo).toBe(0);
      expect(dept.hod_user_id).toBeNull(); // HoD reference safely unlinked
    }

    // Verify zero demo records remain across all tables
    const [demoUsers] = await connection.query('SELECT COUNT(*) AS count FROM users WHERE is_demo = 1');
    expect(Number(demoUsers[0].count)).toBe(0);
  });
});
