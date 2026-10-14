import { query } from '../config/db.js';
import {
  ConflictError,
  NotFoundError
} from '../utils/errors.js';
import { parsePagination, formatPaginated } from '../utils/pagination.js';

export class CategoryService {
  static async listCategories(queryParams = {}) {
    const { page, pageSize, limit, offset, search } = parsePagination(queryParams);

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('name LIKE ?');
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM categories ${whereClause}`;
    const [countRows] = await query(countSql, params);
    const total = countRows ? countRows.total : 0;

    const dataSql = `
      SELECT id, name, is_demo, created_at
      FROM categories
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(dataSql, [...params, limit, offset]);

    const data = rows.map((c) => ({
      id: c.id,
      name: c.name,
      isDemo: Boolean(c.is_demo),
      createdAt: c.created_at
    }));

    return formatPaginated(data, total, page, pageSize);
  }

  static async getCategoryById(id) {
    const rows = await query('SELECT id, name, is_demo, created_at FROM categories WHERE id = ?', [
      id
    ]);
    if (rows.length === 0) {
      throw new NotFoundError('Category not found', 'CATEGORY_NOT_FOUND');
    }
    const c = rows[0];
    return {
      id: c.id,
      name: c.name,
      isDemo: Boolean(c.is_demo),
      createdAt: c.created_at
    };
  }

  static async createCategory({ name }) {
    const cleanName = name.trim();
    const existing = await query('SELECT id FROM categories WHERE name = ?', [cleanName]);
    if (existing.length > 0) {
      throw new ConflictError('A category with this name already exists', 'CATEGORY_EXISTS');
    }

    const result = await query(
      'INSERT INTO categories (name, is_demo) VALUES (?, 0)',
      [cleanName]
    );

    return this.getCategoryById(result.insertId);
  }

  static async updateCategory(id, { name }) {
    await this.getCategoryById(id);
    const cleanName = name.trim();

    const existing = await query(
      'SELECT id FROM categories WHERE name = ? AND id <> ?',
      [cleanName, id]
    );
    if (existing.length > 0) {
      throw new ConflictError('A category with this name already exists', 'CATEGORY_EXISTS');
    }

    await query('UPDATE categories SET name = ? WHERE id = ?', [cleanName, id]);
    return this.getCategoryById(id);
  }
}
