import { query } from '../config/db.js';
import {
  BadRequestError,
  NotFoundError
} from '../utils/errors.js';
import { parsePagination, formatPaginated } from '../utils/pagination.js';

export class SupplierService {
  static async listSuppliers(queryParams = {}) {
    const { page, pageSize, limit, offset, search } = parsePagination(queryParams);
    const { active, categoryId } = queryParams;

    const conditions = [];
    const params = [];

    if (active !== undefined && active !== '') {
      conditions.push('s.is_active = ?');
      params.push(active === 'true' || active === '1' ? 1 : 0);
    }

    if (categoryId) {
      conditions.push('s.category_id = ?');
      params.push(categoryId);
    }

    if (search) {
      conditions.push('(s.name LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM suppliers s ${whereClause}`;
    const [countRows] = await query(countSql, params);
    const total = countRows ? countRows.total : 0;

    const dataSql = `
      SELECT s.id, s.name, s.email, s.phone, s.address, s.category_id, s.is_active, s.is_demo, s.created_at,
             c.name AS category_name
      FROM suppliers s
      LEFT JOIN categories c ON s.category_id = c.id
      ${whereClause}
      ORDER BY s.name ASC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(dataSql, [...params, limit, offset]);

    const data = rows.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      address: s.address,
      categoryId: s.category_id,
      categoryName: s.category_name,
      isActive: Boolean(s.is_active),
      isDemo: Boolean(s.is_demo),
      createdAt: s.created_at
    }));

    return formatPaginated(data, total, page, pageSize);
  }

  static async getSupplierById(id) {
    const rows = await query(
      `SELECT s.id, s.name, s.email, s.phone, s.address, s.category_id, s.is_active, s.is_demo, s.created_at,
              c.name AS category_name
       FROM suppliers s
       LEFT JOIN categories c ON s.category_id = c.id
       WHERE s.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Supplier not found', 'SUPPLIER_NOT_FOUND');
    }

    const s = rows[0];
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      address: s.address,
      categoryId: s.category_id,
      categoryName: s.category_name,
      isActive: Boolean(s.is_active),
      isDemo: Boolean(s.is_demo),
      createdAt: s.created_at
    };
  }

  static async createSupplier({ name, email, phone, address, categoryId }) {
    if (categoryId) {
      const cat = await query('SELECT id FROM categories WHERE id = ?', [categoryId]);
      if (cat.length === 0) {
        throw new BadRequestError('Invalid category ID', 'INVALID_CATEGORY');
      }
    }

    const cleanEmail = email.toLowerCase().trim();

    const result = await query(
      `INSERT INTO suppliers (name, email, phone, address, category_id, is_active, is_demo)
       VALUES (?, ?, ?, ?, ?, 1, 0)`,
      [
        name.trim(),
        cleanEmail,
        phone ? phone.trim() : null,
        address ? address.trim() : null,
        categoryId || null
      ]
    );

    return this.getSupplierById(result.insertId);
  }

  static async updateSupplier(id, updates) {
    await this.getSupplierById(id);

    if (updates.categoryId) {
      const cat = await query('SELECT id FROM categories WHERE id = ?', [updates.categoryId]);
      if (cat.length === 0) {
        throw new BadRequestError('Invalid category ID', 'INVALID_CATEGORY');
      }
    }

    const fields = [];
    const params = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name.trim());
    }

    if (updates.email !== undefined) {
      fields.push('email = ?');
      params.push(updates.email.toLowerCase().trim());
    }

    if (updates.phone !== undefined) {
      fields.push('phone = ?');
      params.push(updates.phone ? updates.phone.trim() : null);
    }

    if (updates.address !== undefined) {
      fields.push('address = ?');
      params.push(updates.address ? updates.address.trim() : null);
    }

    if (updates.categoryId !== undefined) {
      fields.push('category_id = ?');
      params.push(updates.categoryId || null);
    }

    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }

    if (fields.length > 0) {
      params.push(id);
      await query(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    return this.getSupplierById(id);
  }
}
