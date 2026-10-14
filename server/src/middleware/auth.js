import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { query } from '../config/db.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token required', 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new UnauthorizedError('Invalid or expired token', 'UNAUTHORIZED');
    }

    const rows = await query(
      'SELECT id, name, email, role, status, department_id, supplier_id, is_demo FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (rows.length === 0) {
      throw new UnauthorizedError('User not found', 'UNAUTHORIZED');
    }

    const user = rows[0];

    if (user.status === 'PENDING') {
      throw new ForbiddenError('Account is pending administrator approval', 'ACCOUNT_PENDING');
    }

    if (user.status === 'DISABLED') {
      throw new ForbiddenError('Account has been disabled', 'ACCOUNT_DISABLED');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenError('Account is not active', 'FORBIDDEN');
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      departmentId: user.department_id,
      supplierId: user.supplier_id,
      isDemo: Boolean(user.is_demo)
    };

    next();
  } catch (err) {
    next(err);
  }
}

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required', 'UNAUTHORIZED'));
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          'You do not have permission to access this resource',
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}
