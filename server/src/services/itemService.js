import { query, withTransaction } from '../config/db.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError
} from '../utils/errors.js';
import { parsePagination, formatPaginated } from '../utils/pagination.js';
import { StockService, deriveItemStatus } from './stockService.js';

export { deriveItemStatus };

export class ItemService {
  static async listItems(queryParams = {}) {
    const { page, pageSize, limit, offset, search } = parsePagination(queryParams);
    const { categoryId, status, active } = queryParams;

    const conditions = [];
    const params = [];

    if (active !== undefined && active !== '') {
      conditions.push('i.is_active = ?');
      params.push(active === 'true' || active === '1' ? 1 : 0);
    }

    if (categoryId) {
      conditions.push('i.category_id = ?');
      params.push(categoryId);
    }

    if (status) {
      if (status === 'OUT') {
        conditions.push('i.stock_qty = 0');
      } else if (status === 'LOW') {
        conditions.push('i.stock_qty > 0 AND i.min_level > 0 AND i.stock_qty <= i.min_level');
      } else if (status === 'IN_STOCK') {
        conditions.push('(i.stock_qty > i.min_level OR (i.min_level = 0 AND i.stock_qty > 0))');
      }
    }

    if (search) {
      conditions.push('(i.name LIKE ? OR i.sku LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM items i ${whereClause}`;
    const [countRows] = await query(countSql, params);
    const total = countRows ? countRows.total : 0;

    const dataSql = `
      SELECT i.id, i.sku, i.name, i.category_id, i.unit, i.stock_qty, i.min_level, i.unit_cost,
             i.is_active, i.low_stock_alerted, i.is_demo, i.created_at, i.updated_at,
             c.name AS category_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      ${whereClause}
      ORDER BY i.name ASC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(dataSql, [...params, limit, offset]);

    const data = rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      categoryId: r.category_id,
      categoryName: r.category_name,
      unit: r.unit,
      stockQty: r.stock_qty,
      minLevel: r.min_level,
      unitCost: Number(r.unit_cost),
      status: deriveItemStatus(r.stock_qty, r.min_level),
      isActive: Boolean(r.is_active),
      lowStockAlerted: Boolean(r.low_stock_alerted),
      isDemo: Boolean(r.is_demo),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return formatPaginated(data, total, page, pageSize);
  }

  static async getItemById(id) {
    const rows = await query(
      `SELECT i.id, i.sku, i.name, i.category_id, i.unit, i.stock_qty, i.min_level, i.unit_cost,
              i.is_active, i.low_stock_alerted, i.is_demo, i.created_at, i.updated_at,
              c.name AS category_name
       FROM items i
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE i.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Item not found', 'ITEM_NOT_FOUND');
    }

    const r = rows[0];
    return {
      id: r.id,
      sku: r.sku,
      name: r.name,
      categoryId: r.category_id,
      categoryName: r.category_name,
      unit: r.unit,
      stockQty: r.stock_qty,
      minLevel: r.min_level,
      unitCost: Number(r.unit_cost),
      status: deriveItemStatus(r.stock_qty, r.min_level),
      isActive: Boolean(r.is_active),
      lowStockAlerted: Boolean(r.low_stock_alerted),
      isDemo: Boolean(r.is_demo),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  static async createItem(
    { sku, name, categoryId, unit = 'nos', minLevel = 0, unitCost = 0.0, openingStock = 0 },
    userId
  ) {
    const cleanSku = sku.trim();
    const cleanName = name.trim();

    const existing = await query('SELECT id FROM items WHERE sku = ?', [cleanSku]);
    if (existing.length > 0) {
      throw new ConflictError('An item with this SKU already exists', 'SKU_EXISTS');
    }

    if (categoryId) {
      const cat = await query('SELECT id FROM categories WHERE id = ?', [categoryId]);
      if (cat.length === 0) {
        throw new BadRequestError('Invalid category ID', 'INVALID_CATEGORY');
      }
    }

    return withTransaction(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO items (sku, name, category_id, unit, stock_qty, min_level, unit_cost, is_active, low_stock_alerted, is_demo)
         VALUES (?, ?, ?, ?, 0, ?, ?, 1, 0, 0)`,
        [cleanSku, cleanName, categoryId || null, unit.trim(), minLevel, unitCost]
      );

      const itemId = result.insertId;

      if (openingStock > 0) {
        await StockService.applyMovement(
          {
            itemId,
            type: 'ADJUSTMENT',
            delta: openingStock,
            reason: 'Opening stock',
            userId
          },
          conn
        );
      }

      const [itemRows] = await conn.query(
        `SELECT i.id, i.sku, i.name, i.category_id, i.unit, i.stock_qty, i.min_level, i.unit_cost,
                i.is_active, i.low_stock_alerted, i.is_demo, i.created_at, i.updated_at,
                c.name AS category_name
         FROM items i
         LEFT JOIN categories c ON i.category_id = c.id
         WHERE i.id = ?`,
        [itemId]
      );
      const r = itemRows[0];
      return {
        id: r.id,
        sku: r.sku,
        name: r.name,
        categoryId: r.category_id,
        categoryName: r.category_name,
        unit: r.unit,
        stockQty: r.stock_qty,
        minLevel: r.min_level,
        unitCost: Number(r.unit_cost),
        status: deriveItemStatus(r.stock_qty, r.min_level),
        isActive: Boolean(r.is_active),
        lowStockAlerted: Boolean(r.low_stock_alerted),
        isDemo: Boolean(r.is_demo),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });
  }

  static async updateItem(id, updates) {
    await this.getItemById(id);

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

    if (updates.categoryId !== undefined) {
      fields.push('category_id = ?');
      params.push(updates.categoryId || null);
    }

    if (updates.unit !== undefined) {
      fields.push('unit = ?');
      params.push(updates.unit.trim());
    }

    if (updates.minLevel !== undefined) {
      fields.push('min_level = ?');
      params.push(updates.minLevel);
    }

    if (updates.unitCost !== undefined) {
      fields.push('unit_cost = ?');
      params.push(updates.unitCost);
    }

    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }

    if (fields.length > 0) {
      params.push(id);
      await query(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    return this.getItemById(id);
  }

  static async issueStock(id, { quantity, departmentId, reason }, userId) {
    if (!departmentId) {
      throw new BadRequestError('Department ID is required to issue stock', 'DEPARTMENT_REQUIRED');
    }

    const dept = await query('SELECT id FROM departments WHERE id = ? AND is_active = 1', [
      departmentId
    ]);
    if (dept.length === 0) {
      throw new BadRequestError('Department not found or inactive', 'INVALID_DEPARTMENT');
    }

    await StockService.applyMovement({
      itemId: id,
      type: 'ISSUE',
      delta: -Math.abs(quantity),
      reason: reason || 'Stock issue to department',
      userId,
      departmentId
    });

    return this.getItemById(id);
  }

  static async adjustStock(id, { delta, reason }, userId) {
    if (delta === 0) {
      throw new BadRequestError('Adjustment delta cannot be zero', 'ZERO_DELTA');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestError('Reason is required for stock adjustment', 'REASON_REQUIRED');
    }

    await StockService.applyMovement({
      itemId: id,
      type: 'ADJUSTMENT',
      delta,
      reason,
      userId
    });

    return this.getItemById(id);
  }
}
