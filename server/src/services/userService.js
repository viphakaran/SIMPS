import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError
} from '../utils/errors.js';
import { parsePagination, formatPaginated } from '../utils/pagination.js';

export class UserService {
  static async listUsers(queryParams = {}) {
    const { page, pageSize, limit, offset, search } = parsePagination(queryParams);
    const { role, status } = queryParams;

    const conditions = [];
    const params = [];

    if (role) {
      conditions.push('u.role = ?');
      params.push(role);
    }

    if (status) {
      conditions.push('u.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM users u ${whereClause}`;
    const [countRows] = await query(countSql, params);
    const total = countRows ? countRows.total : 0;

    const dataSql = `
      SELECT u.id, u.name, u.email, u.phone, u.role, u.status,
             u.department_id, u.supplier_id, u.is_demo, u.created_at, u.updated_at,
             d.name AS department_name, s.name AS supplier_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN suppliers s ON u.supplier_id = s.id
      ${whereClause}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(dataSql, [...params, limit, offset]);

    const data = rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      departmentId: u.department_id,
      departmentName: u.department_name,
      supplierId: u.supplier_id,
      supplierName: u.supplier_name,
      isDemo: Boolean(u.is_demo),
      createdAt: u.created_at,
      updatedAt: u.updated_at
    }));

    return formatPaginated(data, total, page, pageSize);
  }

  static async createUser({ name, email, password, phone, role, departmentId, supplierId }) {
    const cleanEmail = email.toLowerCase().trim();

    const existing = await query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_EXISTS');
    }

    // Role-specific constraints
    if (role === 'PRINCIPAL') {
      const activePrincipal = await query(
        "SELECT id FROM users WHERE role = 'PRINCIPAL' AND status = 'ACTIVE'"
      );
      if (activePrincipal.length > 0) {
        throw new ConflictError(
          'An active Principal account already exists',
          'PRINCIPAL_EXISTS'
        );
      }
    }

    if (role === 'HOD' || role === 'REQUESTER') {
      if (!departmentId) {
        throw new BadRequestError(
          `${role} accounts require a valid departmentId`,
          'DEPARTMENT_REQUIRED'
        );
      }
      const dept = await query('SELECT id FROM departments WHERE id = ? AND is_active = 1', [
        departmentId
      ]);
      if (dept.length === 0) {
        throw new BadRequestError('Department not found or inactive', 'INVALID_DEPARTMENT');
      }
    }

    if (role === 'SUPPLIER') {
      if (!supplierId) {
        throw new BadRequestError(
          'SUPPLIER accounts require a valid supplierId',
          'SUPPLIER_REQUIRED'
        );
      }
      const sup = await query('SELECT id FROM suppliers WHERE id = ? AND is_active = 1', [
        supplierId
      ]);
      if (sup.length === 0) {
        throw new BadRequestError('Supplier not found or inactive', 'INVALID_SUPPLIER');
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, phone, role, status, department_id, supplier_id, is_demo)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, 0)`,
      [
        name.trim(),
        cleanEmail,
        passwordHash,
        phone ? phone.trim() : null,
        role,
        role === 'HOD' || role === 'REQUESTER' ? departmentId : null,
        role === 'SUPPLIER' ? supplierId : null
      ]
    );

    return this.getUserById(result.insertId);
  }

  static async getUserById(id) {
    const rows = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.status,
              u.department_id, u.supplier_id, u.is_demo, u.created_at, u.updated_at,
              d.name AS department_name, s.name AS supplier_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN suppliers s ON u.supplier_id = s.id
       WHERE u.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const u = rows[0];
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      departmentId: u.department_id,
      departmentName: u.department_name,
      supplierId: u.supplier_id,
      supplierName: u.supplier_name,
      isDemo: Boolean(u.is_demo),
      createdAt: u.created_at,
      updatedAt: u.updated_at
    };
  }

  static async updateUser(id, updates) {
    const existing = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const current = existing[0];
    const newRole = updates.role || current.role;
    const newDeptId = updates.departmentId !== undefined ? updates.departmentId : current.department_id;
    const newSupplierId = updates.supplierId !== undefined ? updates.supplierId : current.supplier_id;

    if (newRole === 'PRINCIPAL' && current.status === 'ACTIVE') {
      const activePrincipal = await query(
        "SELECT id FROM users WHERE role = 'PRINCIPAL' AND status = 'ACTIVE' AND id <> ?",
        [id]
      );
      if (activePrincipal.length > 0) {
        throw new ConflictError(
          'An active Principal account already exists',
          'PRINCIPAL_EXISTS'
        );
      }
    }

    if (newRole === 'HOD' || newRole === 'REQUESTER') {
      if (!newDeptId) {
        throw new BadRequestError(
          `${newRole} accounts require a valid departmentId`,
          'DEPARTMENT_REQUIRED'
        );
      }
      const dept = await query('SELECT id FROM departments WHERE id = ? AND is_active = 1', [
        newDeptId
      ]);
      if (dept.length === 0) {
        throw new BadRequestError('Department not found or inactive', 'INVALID_DEPARTMENT');
      }
    }

    if (newRole === 'SUPPLIER') {
      if (!newSupplierId) {
        throw new BadRequestError(
          'SUPPLIER accounts require a valid supplierId',
          'SUPPLIER_REQUIRED'
        );
      }
      const sup = await query('SELECT id FROM suppliers WHERE id = ? AND is_active = 1', [
        newSupplierId
      ]);
      if (sup.length === 0) {
        throw new BadRequestError('Supplier not found or inactive', 'INVALID_SUPPLIER');
      }
    }

    const fields = [];
    const params = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name.trim());
    }

    if (updates.phone !== undefined) {
      fields.push('phone = ?');
      params.push(updates.phone ? updates.phone.trim() : null);
    }

    if (updates.role !== undefined) {
      fields.push('role = ?');
      params.push(updates.role);
    }

    if (updates.departmentId !== undefined) {
      fields.push('department_id = ?');
      params.push(newRole === 'HOD' || newRole === 'REQUESTER' ? updates.departmentId : null);
    }

    if (updates.supplierId !== undefined) {
      fields.push('supplier_id = ?');
      params.push(newRole === 'SUPPLIER' ? updates.supplierId : null);
    }

    if (fields.length > 0) {
      params.push(id);
      await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    return this.getUserById(id);
  }

  static async approveUser(id) {
    const existing = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const user = existing[0];
    if (user.role === 'PRINCIPAL') {
      const activePrincipal = await query(
        "SELECT id FROM users WHERE role = 'PRINCIPAL' AND status = 'ACTIVE' AND id <> ?",
        [id]
      );
      if (activePrincipal.length > 0) {
        throw new ConflictError(
          'An active Principal account already exists',
          'PRINCIPAL_EXISTS'
        );
      }
    }

    await query("UPDATE users SET status = 'ACTIVE' WHERE id = ?", [id]);

    // TODO: Replace with NotificationService.notify in Prompt 03
    await query(
      `INSERT INTO notifications (user_id, type, message, link, is_read, emailed, is_demo)
       VALUES (?, 'ACCOUNT_APPROVED', 'Your account has been approved by the administrator.', '/login', 0, 0, ?)`,
      [id, user.is_demo]
    );

    return this.getUserById(id);
  }

  static async disableUser(id, currentAdminId) {
    if (Number(id) === Number(currentAdminId)) {
      throw new BadRequestError(
        'Administrators cannot disable their own account',
        'CANNOT_DISABLE_SELF'
      );
    }

    const existing = await query('SELECT id FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    await query("UPDATE users SET status = 'DISABLED' WHERE id = ?", [id]);
    return this.getUserById(id);
  }

  static async enableUser(id) {
    const existing = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const user = existing[0];
    if (user.role === 'PRINCIPAL') {
      const activePrincipal = await query(
        "SELECT id FROM users WHERE role = 'PRINCIPAL' AND status = 'ACTIVE' AND id <> ?",
        [id]
      );
      if (activePrincipal.length > 0) {
        throw new ConflictError(
          'An active Principal account already exists',
          'PRINCIPAL_EXISTS'
        );
      }
    }

    await query("UPDATE users SET status = 'ACTIVE' WHERE id = ?", [id]);
    return this.getUserById(id);
  }
}
