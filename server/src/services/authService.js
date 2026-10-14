import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { query } from '../config/db.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError
} from '../utils/errors.js';

export class AuthService {
  static async register({ name, email, password, phone, departmentId }) {
    const cleanEmail = email.toLowerCase().trim();

    // Check department existence and active status
    const deptRows = await query('SELECT id, is_active FROM departments WHERE id = ?', [
      departmentId
    ]);
    if (deptRows.length === 0 || !deptRows[0].is_active) {
      throw new BadRequestError(
        'Department does not exist or is inactive',
        'INVALID_DEPARTMENT'
      );
    }

    // Check duplicate email
    const existing = await query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, phone, role, status, department_id, is_demo)
       VALUES (?, ?, ?, ?, 'REQUESTER', 'PENDING', ?, 0)`,
      [name.trim(), cleanEmail, passwordHash, phone ? phone.trim() : null, departmentId]
    );

    return {
      id: result.insertId,
      name: name.trim(),
      email: cleanEmail,
      role: 'REQUESTER',
      status: 'PENDING',
      departmentId
    };
  }

  static async login({ email, password }) {
    const cleanEmail = email.toLowerCase().trim();
    const rows = await query(
      `SELECT id, name, email, password_hash, role, status, department_id, supplier_id, is_demo
       FROM users WHERE email = ?`,
      [cleanEmail]
    );

    if (rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.status === 'PENDING') {
      throw new ForbiddenError('Account is pending administrator approval', 'ACCOUNT_PENDING');
    }

    if (user.status === 'DISABLED') {
      throw new ForbiddenError('Account has been disabled', 'ACCOUNT_DISABLED');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenError('Account is not active', 'FORBIDDEN');
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        departmentId: user.department_id,
        supplierId: user.supplier_id,
        isDemo: Boolean(user.is_demo)
      }
    };
  }

  static async getCurrentUser(userId) {
    const rows = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.department_id, u.supplier_id, u.is_demo,
              d.name AS department_name, s.name AS supplier_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN suppliers s ON u.supplier_id = s.id
       WHERE u.id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      status: row.status,
      departmentId: row.department_id,
      departmentName: row.department_name,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      isDemo: Boolean(row.is_demo)
    };
  }

  static async changePassword(userId, { currentPassword, newPassword }) {
    const rows = await query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      throw new BadRequestError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    return { message: 'Password updated successfully' };
  }
}
