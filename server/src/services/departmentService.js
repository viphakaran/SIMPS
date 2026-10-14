import { query } from '../config/db.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError
} from '../utils/errors.js';
import { parsePagination, formatPaginated } from '../utils/pagination.js';

export class DepartmentService {
  static async listPublic() {
    const rows = await query(
      'SELECT id, name FROM departments WHERE is_active = 1 ORDER BY name ASC'
    );
    return rows.map((r) => ({ id: r.id, name: r.name }));
  }

  static async listDepartments(queryParams = {}) {
    const { page, pageSize, limit, offset, search } = parsePagination(queryParams);
    const { active } = queryParams;

    const conditions = [];
    const params = [];

    if (active !== undefined && active !== '') {
      conditions.push('d.is_active = ?');
      params.push(active === 'true' || active === '1' ? 1 : 0);
    }

    if (search) {
      conditions.push('d.name LIKE ?');
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM departments d ${whereClause}`;
    const [countRows] = await query(countSql, params);
    const total = countRows ? countRows.total : 0;

    const dataSql = `
      SELECT d.id, d.name, d.hod_user_id, d.is_active, d.is_demo, d.created_at,
             u.name AS hod_name
      FROM departments d
      LEFT JOIN users u ON d.hod_user_id = u.id
      ${whereClause}
      ORDER BY d.name ASC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(dataSql, [...params, limit, offset]);

    const data = rows.map((d) => ({
      id: d.id,
      name: d.name,
      hodUserId: d.hod_user_id,
      hodName: d.hod_name,
      isActive: Boolean(d.is_active),
      isDemo: Boolean(d.is_demo),
      createdAt: d.created_at
    }));

    return formatPaginated(data, total, page, pageSize);
  }

  static async createDepartment({ name }) {
    const cleanName = name.trim();
    const existing = await query('SELECT id FROM departments WHERE name = ?', [cleanName]);
    if (existing.length > 0) {
      throw new ConflictError('A department with this name already exists', 'DEPARTMENT_EXISTS');
    }

    const result = await query(
      'INSERT INTO departments (name, is_active, is_demo) VALUES (?, 1, 0)',
      [cleanName]
    );

    return this.getDepartmentById(result.insertId);
  }

  static async getDepartmentById(id) {
    const rows = await query(
      `SELECT d.id, d.name, d.hod_user_id, d.is_active, d.is_demo, d.created_at,
              u.name AS hod_name
       FROM departments d
       LEFT JOIN users u ON d.hod_user_id = u.id
       WHERE d.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Department not found', 'DEPARTMENT_NOT_FOUND');
    }

    const d = rows[0];
    return {
      id: d.id,
      name: d.name,
      hodUserId: d.hod_user_id,
      hodName: d.hod_name,
      isActive: Boolean(d.is_active),
      isDemo: Boolean(d.is_demo),
      createdAt: d.created_at
    };
  }

  static async updateDepartment(id, updates) {
    await this.getDepartmentById(id);

    const fields = [];
    const params = [];

    if (updates.name !== undefined) {
      const cleanName = updates.name.trim();
      const existing = await query(
        'SELECT id FROM departments WHERE name = ? AND id <> ?',
        [cleanName, id]
      );
      if (existing.length > 0) {
        throw new ConflictError(
          'A department with this name already exists',
          'DEPARTMENT_EXISTS'
        );
      }
      fields.push('name = ?');
      params.push(cleanName);
    }

    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }

    if (fields.length > 0) {
      params.push(id);
      await query(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    return this.getDepartmentById(id);
  }

  static async assignHod(departmentId, userId) {
    await this.getDepartmentById(departmentId);

    const userRows = await query(
      'SELECT id, role, status, department_id FROM users WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const user = userRows[0];

    if (user.status !== 'ACTIVE') {
      throw new BadRequestError('User must be ACTIVE to be assigned as HoD', 'USER_NOT_ACTIVE');
    }

    if (user.role !== 'HOD') {
      throw new BadRequestError('User must have role HOD', 'INVALID_HOD_ROLE');
    }

    if (Number(user.department_id) !== Number(departmentId)) {
      throw new BadRequestError(
        'HoD must belong to the department',
        'HOD_WRONG_DEPARTMENT'
      );
    }

    await query('UPDATE departments SET hod_user_id = ? WHERE id = ?', [userId, departmentId]);

    return this.getDepartmentById(departmentId);
  }
}
