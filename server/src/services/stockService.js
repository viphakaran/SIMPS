import { withTransaction, query } from '../config/db.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError
} from '../utils/errors.js';
import { parsePagination, formatPaginated } from '../utils/pagination.js';
import { NotificationService } from './notificationService.js';

export function deriveItemStatus(stockQty, minLevel) {
  if (stockQty === 0) {
    return 'OUT';
  }
  if (minLevel > 0 && stockQty <= minLevel) {
    return 'LOW';
  }
  return 'IN_STOCK';
}

export class StockService {
  /**
   * Sole authority to modify items.stock_qty and record stock_movements.
   * Runs under row lock SELECT ... FOR UPDATE.
   */
  static async applyMovement(
    { itemId, type, delta, reason, userId, departmentId, poId },
    conn = null
  ) {
    if (!['RECEIPT', 'ISSUE', 'ADJUSTMENT'].includes(type)) {
      throw new BadRequestError(`Invalid movement type: ${type}`, 'INVALID_MOVEMENT_TYPE');
    }

    if (delta === 0) {
      throw new BadRequestError('Movement delta cannot be zero', 'ZERO_DELTA');
    }

    if (type === 'ADJUSTMENT' && (!reason || !reason.trim())) {
      throw new BadRequestError('Reason is required for stock adjustment', 'REASON_REQUIRED');
    }

    if (type === 'ISSUE' && !departmentId && !reason) {
      // department is required when issuing to departments
    }

    const execute = async (connection) => {
      const [rows] = await connection.query(
        'SELECT id, sku, name, stock_qty, min_level, low_stock_alerted, is_demo FROM items WHERE id = ? FOR UPDATE',
        [itemId]
      );

      if (rows.length === 0) {
        throw new NotFoundError('Item not found', 'ITEM_NOT_FOUND');
      }

      const item = rows[0];
      const newQty = item.stock_qty + delta;

      if (newQty < 0) {
        throw new ConflictError(
          `Insufficient stock available. Current: ${item.stock_qty}, Requested: ${Math.abs(delta)}`,
          'INSUFFICIENT_STOCK'
        );
      }

      // Record stock movement
      const [smResult] = await connection.query(
        `INSERT INTO stock_movements (
          item_id, type, quantity, balance_after, po_id, department_id, recorded_by, reason, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          type,
          delta,
          newQty,
          poId || null,
          departmentId || null,
          userId || null,
          reason ? reason.trim() : null,
          item.is_demo
        ]
      );

      // Update item stock quantity
      await connection.query('UPDATE items SET stock_qty = ? WHERE id = ?', [newQty, itemId]);

      // Episode check
      const newStatus = deriveItemStatus(newQty, item.min_level);

      if ((newStatus === 'LOW' || newStatus === 'OUT') && item.low_stock_alerted === 0) {
        await connection.query('UPDATE items SET low_stock_alerted = 1 WHERE id = ?', [itemId]);
        // Trigger alert to store managers and procurement officers
        await NotificationService.notify({
          roles: ['STORE_MANAGER', 'PROCUREMENT_OFFICER'],
          type: 'LOW_STOCK',
          message: `Low stock alert: Item "${item.name}" (SKU: ${item.sku}) is ${newStatus} with ${newQty} remaining.`,
          link: `/items/${itemId}`,
          isDemo: item.is_demo
        });
      } else if (newStatus === 'IN_STOCK' && item.low_stock_alerted === 1) {
        await connection.query('UPDATE items SET low_stock_alerted = 0 WHERE id = ?', [itemId]);
      }

      return {
        movementId: smResult.insertId,
        itemId,
        type,
        delta,
        balanceAfter: newQty,
        status: newStatus
      };
    };

    if (conn) {
      return execute(conn);
    }
    return withTransaction(execute);
  }

  static async listMovements(queryParams = {}) {
    const { page, pageSize, limit, offset, search } = parsePagination(queryParams);
    const { itemId, type, departmentId, fromDate, toDate } = queryParams;

    const conditions = [];
    const params = [];

    if (itemId) {
      conditions.push('sm.item_id = ?');
      params.push(itemId);
    }

    if (type) {
      conditions.push('sm.type = ?');
      params.push(type);
    }

    if (departmentId) {
      conditions.push('sm.department_id = ?');
      params.push(departmentId);
    }

    if (fromDate) {
      conditions.push('sm.created_at >= ?');
      params.push(fromDate);
    }

    if (toDate) {
      conditions.push('sm.created_at <= ?');
      params.push(toDate);
    }

    if (search) {
      conditions.push('(i.name LIKE ? OR i.sku LIKE ? OR sm.reason LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      ${whereClause}
    `;
    const [countRows] = await query(countSql, params);
    const total = countRows ? countRows.total : 0;

    const dataSql = `
      SELECT sm.id, sm.item_id, sm.type, sm.quantity, sm.balance_after,
             sm.po_id, sm.department_id, sm.recorded_by, sm.reason, sm.is_demo, sm.created_at,
             i.name AS item_name, i.sku AS item_sku, i.unit AS item_unit,
             d.name AS department_name, u.name AS recorded_by_name,
             po.po_no
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      LEFT JOIN departments d ON sm.department_id = d.id
      LEFT JOIN users u ON sm.recorded_by = u.id
      LEFT JOIN purchase_orders po ON sm.po_id = po.id
      ${whereClause}
      ORDER BY sm.id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(dataSql, [...params, limit, offset]);

    const data = rows.map((m) => ({
      id: m.id,
      itemId: m.item_id,
      itemName: m.item_name,
      itemSku: m.item_sku,
      itemUnit: m.item_unit,
      type: m.type,
      quantity: m.quantity,
      balanceAfter: m.balance_after,
      poId: m.po_id,
      poNo: m.po_no,
      departmentId: m.department_id,
      departmentName: m.department_name,
      recordedBy: m.recorded_by,
      recordedByName: m.recorded_by_name,
      reason: m.reason,
      isDemo: Boolean(m.is_demo),
      createdAt: m.created_at
    }));

    return formatPaginated(data, total, page, pageSize);
  }
}
