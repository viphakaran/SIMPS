import crypto from 'crypto';
import { query, withTransaction } from '../config/db.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError
} from '../utils/errors.js';
import { parsePagination, formatPaginated } from '../utils/pagination.js';
import { StockService } from './stockService.js';
import { NotificationService } from './notificationService.js';

export class OrderService {
  /**
   * Helper to fetch a single purchase order by ID with scoping
   */
  static async getOrderById(id, user = null) {
    const rows = await query(
      `SELECT po.id, po.po_no, po.request_id, po.supplier_id, po.status,
              po.expected_date, po.delivered_date, po.total_amount, po.created_by,
              po.is_demo, po.created_at, po.updated_at,
              s.name AS supplier_name, s.email AS supplier_email, s.phone AS supplier_phone,
              pr.req_no, pr.department_id, d.name AS department_name,
              u.name AS created_by_name
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.id
       JOIN purchase_requests pr ON po.request_id = pr.id
       JOIN departments d ON pr.department_id = d.id
       LEFT JOIN users u ON po.created_by = u.id
       WHERE po.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Purchase order not found', 'ORDER_NOT_FOUND');
    }

    const po = rows[0];

    // Enforce scoping: Supplier sees ONLY own orders; others 404 for foreign
    if (user) {
      this.assertCanViewOrder(user, po);
    }

    // Lines
    const items = await query(
      `SELECT poi.id, poi.item_id, poi.quantity, poi.unit_price,
              (poi.quantity * poi.unit_price) AS line_total,
              i.sku, i.name, i.unit
       FROM po_items poi
       JOIN items i ON poi.item_id = i.id
       WHERE poi.po_id = ?
       ORDER BY poi.id ASC`,
      [id]
    );

    return {
      id: po.id,
      poNo: po.po_no,
      requestId: po.request_id,
      reqNo: po.req_no,
      departmentId: po.department_id,
      departmentName: po.department_name,
      supplierId: po.supplier_id,
      supplierName: po.supplier_name,
      supplierEmail: po.supplier_email,
      supplierPhone: po.supplier_phone,
      status: po.status,
      expectedDate: po.expected_date,
      deliveredDate: po.delivered_date,
      totalAmount: Number(po.total_amount),
      createdBy: po.created_by,
      createdByName: po.created_by_name,
      isDemo: Boolean(po.is_demo),
      createdAt: po.created_at,
      updatedAt: po.updated_at,
      lines: items.map((item) => ({
        id: item.id,
        itemId: item.item_id,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total)
      }))
    };
  }

  /**
   * Scope check: determines if user has view permission for a purchase order.
   * Throws NotFoundError (404) for foreign records per SPEC section 4 & 5.
   */
  static assertCanViewOrder(user, po) {
    if (['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER'].includes(user.role)) {
      return;
    }

    if (user.role === 'SUPPLIER') {
      if (user.supplierId && po.supplier_id === user.supplierId) {
        return;
      }
      throw new NotFoundError('Purchase order not found', 'ORDER_NOT_FOUND');
    }

    // HOD and REQUESTER do not have order view permissions per SPEC section 4
    throw new NotFoundError('Purchase order not found', 'ORDER_NOT_FOUND');
  }

  /**
   * Create Purchase Orders for an approved request.
   * Every request line must be assigned an active supplier and unit price.
   * Grouped by supplier into one PO per supplier in a single transaction.
   */
  static async createOrdersForRequest(requestId, user, { expectedDate, lines }) {
    if (user.role !== 'PROCUREMENT_OFFICER') {
      throw new ForbiddenError(
        'Only procurement officers can create purchase orders',
        'FORBIDDEN'
      );
    }

    // 1. Validate request status is APPROVED
    const reqRows = await query(
      'SELECT id, req_no, status, is_demo FROM purchase_requests WHERE id = ?',
      [requestId]
    );

    if (reqRows.length === 0) {
      throw new NotFoundError('Purchase request not found', 'REQUEST_NOT_FOUND');
    }

    const pr = reqRows[0];
    if (pr.status !== 'APPROVED') {
      throw new ConflictError(
        `Request must be in APPROVED status to create orders (current status: ${pr.status})`,
        'INVALID_REQUEST_STATUS'
      );
    }

    // 2. Validate all request item lines are accounted for
    const dbLines = await query(
      'SELECT id, item_id, quantity FROM request_items WHERE request_id = ?',
      [requestId]
    );

    if (dbLines.length === 0) {
      throw new BadRequestError('Request has no item lines', 'EMPTY_REQUEST');
    }

    const dbLineMap = new Map(dbLines.map((l) => [l.id, l]));
    const providedLineIds = new Set(lines.map((l) => l.requestItemId));

    if (providedLineIds.size !== dbLineMap.size) {
      throw new BadRequestError(
        'Every line of the purchase request must be assigned to an order line',
        'INCOMPLETE_ORDER_LINES'
      );
    }

    for (const lineId of dbLineMap.keys()) {
      if (!providedLineIds.has(lineId)) {
        throw new BadRequestError(
          `Request item line ${lineId} is missing an order assignment`,
          'INCOMPLETE_ORDER_LINES'
        );
      }
    }

    // 3. Validate suppliers
    const supplierIds = [...new Set(lines.map((l) => l.supplierId))];
    const placeholders = supplierIds.map(() => '?').join(',');
    const suppliers = await query(
      `SELECT id, is_active, is_demo FROM suppliers WHERE id IN (${placeholders})`,
      supplierIds
    );

    if (suppliers.length !== supplierIds.length || suppliers.some((s) => !s.is_active)) {
      throw new BadRequestError(
        'One or more suppliers are invalid or inactive',
        'INVALID_OR_INACTIVE_SUPPLIER'
      );
    }

    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

    // 4. Group lines by supplierId
    const supplierGroups = new Map();
    for (const line of lines) {
      if (!supplierGroups.has(line.supplierId)) {
        supplierGroups.set(line.supplierId, []);
      }
      supplierGroups.get(line.supplierId).push(line);
    }

    // 5. Create orders atomically in transaction
    const createdPoIds = await withTransaction(async (conn) => {
      // Guarded update of request status to ORDERED
      const [updateReq] = await conn.query(
        "UPDATE purchase_requests SET status = 'ORDERED' WHERE id = ? AND status = 'APPROVED'",
        [requestId]
      );

      if (updateReq.affectedRows === 0) {
        throw new ConflictError(
          'Request status changed concurrently',
          'CONCURRENT_MODIFICATION'
        );
      }

      // Record procurement approval log row
      await conn.query(
        `INSERT INTO request_approvals (request_id, decided_by, stage, decision, reason)
         VALUES (?, ?, 'PROCUREMENT', 'APPROVED', 'Purchase orders created')`,
        [requestId, user.id]
      );

      const year = new Date().getFullYear();
      const poIds = [];

      for (const [suppId, groupLines] of supplierGroups.entries()) {
        const supp = supplierMap.get(suppId);
        const isDemo = Boolean(pr.is_demo || supp.is_demo || user.isDemo);
        const tempPoNo = `TMP-${crypto.randomUUID()}`;

        const [poResult] = await conn.query(
          `INSERT INTO purchase_orders (po_no, request_id, supplier_id, status, expected_date, total_amount, created_by, is_demo)
           VALUES (?, ?, ?, 'PLACED', ?, 0, ?, ?)`,
          [tempPoNo, requestId, suppId, expectedDate || null, user.id, isDemo ? 1 : 0]
        );

        const poId = poResult.insertId;
        poIds.push(poId);

        let totalAmount = 0;
        for (const line of groupLines) {
          const reqItem = dbLineMap.get(line.requestItemId);
          const lineTotal = reqItem.quantity * line.unitPrice;
          totalAmount += lineTotal;

          await conn.query(
            `INSERT INTO po_items (po_id, item_id, quantity, unit_price)
             VALUES (?, ?, ?, ?)`,
            [poId, reqItem.item_id, reqItem.quantity, line.unitPrice]
          );
        }

        const finalPoNo = `PO-${year}-${String(poId).padStart(5, '0')}`;
        await conn.query(
          'UPDATE purchase_orders SET po_no = ?, total_amount = ? WHERE id = ?',
          [finalPoNo, totalAmount, poId]
        );
      }

      return poIds;
    });

    // 6. Fetch created orders and dispatch notifications to active supplier users
    const createdOrders = [];
    for (const poId of createdPoIds) {
      const order = await this.getOrderById(poId, user);
      createdOrders.push(order);

      // Query active supplier users for this supplier
      const supplierUsers = await query(
        "SELECT id FROM users WHERE supplier_id = ? AND role = 'SUPPLIER' AND status = 'ACTIVE'",
        [order.supplierId]
      );
      const supplierUserIds = supplierUsers.map((u) => u.id);

      if (supplierUserIds.length > 0) {
        await NotificationService.notify({
          userIds: supplierUserIds,
          type: 'PO_PLACED',
          message: `New purchase order ${order.poNo} placed with your company.`,
          link: `/orders/${order.id}`,
          isDemo: order.isDemo
        });
      }
    }

    return createdOrders;
  }

  /**
   * List purchase orders with role-based scoping and filters.
   */
  static async listOrders(user, queryParams = {}) {
    const { page, pageSize, limit, offset, search } = parsePagination(queryParams);
    const { status, supplierId, overdue } = queryParams;

    const conditions = [];
    const params = [];

    // Role-based scoping per SPEC section 4
    if (['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER'].includes(user.role)) {
      if (supplierId) {
        conditions.push('po.supplier_id = ?');
        params.push(supplierId);
      }
    } else if (user.role === 'SUPPLIER') {
      if (!user.supplierId) {
        return formatPaginated([], 0, page, pageSize);
      }
      conditions.push('po.supplier_id = ?');
      params.push(user.supplierId);
    } else {
      // Other roles have no PO visibility
      return formatPaginated([], 0, page, pageSize);
    }

    // Additional query filters
    if (status) {
      conditions.push('po.status = ?');
      params.push(status);
    }

    if (overdue === 'true' || overdue === '1') {
      conditions.push(
        "po.expected_date < CURDATE() AND po.status NOT IN ('DELIVERED', 'RECEIVED', 'CANCELLED')"
      );
    }

    if (search) {
      conditions.push('(po.po_no LIKE ? OR s.name LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      ${whereClause}
    `;
    const [countRows] = await query(countSql, params);
    const total = countRows ? countRows.total : 0;

    const dataSql = `
      SELECT po.id, po.po_no, po.request_id, po.supplier_id, po.status,
             po.expected_date, po.delivered_date, po.total_amount, po.is_demo,
             po.created_at, po.updated_at,
             s.name AS supplier_name,
             COUNT(poi.id) AS item_count
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN po_items poi ON po.id = poi.po_id
      ${whereClause}
      GROUP BY po.id
      ORDER BY po.id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(dataSql, [...params, limit, offset]);

    const data = rows.map((r) => ({
      id: r.id,
      poNo: r.po_no,
      requestId: r.request_id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      status: r.status,
      expectedDate: r.expected_date,
      deliveredDate: r.delivered_date,
      totalAmount: Number(r.total_amount),
      itemCount: Number(r.item_count),
      isDemo: Boolean(r.is_demo),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return formatPaginated(data, total, page, pageSize);
  }

  /**
   * Update PO status through transition map.
   * Supplier: CONFIRMED, SHIPPED, DELIVERED (sets delivered_date to CURDATE()).
   * Procurement Officer: CANCELLED (recomputes request status).
   */
  static async updateOrderStatus(id, user, { status: newStatus }) {
    const rows = await query(
      'SELECT id, po_no, request_id, supplier_id, status, is_demo FROM purchase_orders WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Purchase order not found', 'ORDER_NOT_FOUND');
    }

    const po = rows[0];

    // Transition validation
    if (user.role === 'SUPPLIER') {
      if (!user.supplierId || po.supplier_id !== user.supplierId) {
        throw new NotFoundError('Purchase order not found', 'ORDER_NOT_FOUND');
      }

      const validTransitions = {
        PLACED: 'CONFIRMED',
        CONFIRMED: 'SHIPPED',
        SHIPPED: 'DELIVERED'
      };

      if (validTransitions[po.status] !== newStatus) {
        throw new ConflictError(
          `Cannot transition order from ${po.status} to ${newStatus}`,
          'INVALID_STATUS_TRANSITION'
        );
      }
    } else if (user.role === 'PROCUREMENT_OFFICER') {
      if (newStatus !== 'CANCELLED') {
        throw new ForbiddenError(
          'Procurement officers can only cancel purchase orders',
          'FORBIDDEN'
        );
      }

      if (!['PLACED', 'CONFIRMED'].includes(po.status)) {
        throw new ConflictError(
          `Only orders in PLACED or CONFIRMED status can be cancelled (current status: ${po.status})`,
          'INVALID_STATUS_TRANSITION'
        );
      }
    } else {
      throw new ForbiddenError(
        'You do not have permission to update purchase order status',
        'FORBIDDEN'
      );
    }

    // Atomic state update with recomputing request status if cancelled
    await withTransaction(async (conn) => {
      let updateSql;
      let updateParams;

      if (newStatus === 'DELIVERED') {
        updateSql =
          "UPDATE purchase_orders SET status = 'DELIVERED', delivered_date = CURDATE() WHERE id = ? AND status = 'SHIPPED'";
        updateParams = [id];
      } else if (newStatus === 'CANCELLED') {
        updateSql =
          "UPDATE purchase_orders SET status = 'CANCELLED' WHERE id = ? AND status IN ('PLACED', 'CONFIRMED')";
        updateParams = [id];
      } else {
        updateSql =
          'UPDATE purchase_orders SET status = ? WHERE id = ? AND status = ?';
        updateParams = [newStatus, id, po.status];
      }

      const [res] = await conn.query(updateSql, updateParams);
      if (res.affectedRows === 0) {
        throw new ConflictError('Order status changed concurrently', 'CONCURRENT_MODIFICATION');
      }

      // If cancelled, recompute request status per SPEC section 5:
      // If every PO for this request is cancelled, revert request to APPROVED
      if (newStatus === 'CANCELLED') {
        const [allPos] = await conn.query(
          'SELECT status FROM purchase_orders WHERE request_id = ?',
          [po.request_id]
        );
        const everyCancelled = allPos.every((p) => p.status === 'CANCELLED');
        if (everyCancelled) {
          await conn.query(
            "UPDATE purchase_requests SET status = 'APPROVED' WHERE id = ? AND status = 'ORDERED'",
            [po.request_id]
          );
        }
      }
    });

    // Notify procurement officers and store managers of status change per SPEC section 8
    await NotificationService.notify({
      roles: ['PROCUREMENT_OFFICER', 'STORE_MANAGER'],
      type: 'PO_STATUS',
      message: `Purchase order ${po.po_no} status updated to ${newStatus}.`,
      link: `/orders/${id}`,
      isDemo: po.is_demo
    });

    return this.getOrderById(id, user);
  }

  /**
   * Receive goods for a DELIVERED purchase order.
   * Role: STORE_MANAGER.
   * Runs in a transaction: marks PO as RECEIVED, applies stock movement for each line,
   * recomputes request status (mark RECEIVED if all non-cancelled POs are RECEIVED),
   * and notifies the requester.
   */
  static async receiveOrder(id, user) {
    if (user.role !== 'STORE_MANAGER') {
      throw new ForbiddenError(
        'Only store managers can receive goods for purchase orders',
        'FORBIDDEN'
      );
    }

    const rows = await query(
      `SELECT po.id, po.po_no, po.request_id, po.status, po.is_demo,
              pr.requested_by
       FROM purchase_orders po
       JOIN purchase_requests pr ON po.request_id = pr.id
       WHERE po.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Purchase order not found', 'ORDER_NOT_FOUND');
    }

    const po = rows[0];

    if (po.status === 'RECEIVED') {
      throw new ConflictError(
        'Purchase order has already been received',
        'ALREADY_RECEIVED'
      );
    }

    if (po.status !== 'DELIVERED') {
      throw new ConflictError(
        `Only DELIVERED purchase orders can be received (current status: ${po.status})`,
        'ORDER_NOT_DELIVERED'
      );
    }

    // Load PO items to receive
    const poItems = await query(
      'SELECT item_id, quantity FROM po_items WHERE po_id = ?',
      [id]
    );

    if (poItems.length === 0) {
      throw new BadRequestError('Purchase order has no items to receive', 'EMPTY_ORDER');
    }

    await withTransaction(async (conn) => {
      // 1. Guarded update of PO status
      const [updateResult] = await conn.query(
        "UPDATE purchase_orders SET status = 'RECEIVED' WHERE id = ? AND status = 'DELIVERED'",
        [id]
      );

      if (updateResult.affectedRows === 0) {
        throw new ConflictError(
          'Order status changed concurrently or is not DELIVERED',
          'CONCURRENT_MODIFICATION'
        );
      }

      // 2. Transactionally apply RECEIPT movement for each line
      for (const item of poItems) {
        await StockService.applyMovement(
          {
            itemId: item.item_id,
            type: 'RECEIPT',
            delta: item.quantity,
            reason: `PO receipt ${po.po_no}`,
            userId: user.id,
            poId: po.id
          },
          conn
        );
      }

      // 3. Recompute request status:
      // If every non-cancelled PO is RECEIVED (and at least 1 non-cancelled PO exists),
      // mark the purchase request as RECEIVED.
      const [allPos] = await conn.query(
        'SELECT status FROM purchase_orders WHERE request_id = ?',
        [po.request_id]
      );

      const nonCancelled = allPos.filter((p) => p.status !== 'CANCELLED');
      const allReceived =
        nonCancelled.length > 0 && nonCancelled.every((p) => p.status === 'RECEIVED');

      if (allReceived) {
        await conn.query(
          "UPDATE purchase_requests SET status = 'RECEIVED' WHERE id = ? AND status = 'ORDERED'",
          [po.request_id]
        );
      }
    });

    // Notify requester per SPEC section 8
    if (po.requested_by) {
      await NotificationService.notify({
        userIds: [po.requested_by],
        type: 'PO_RECEIVED',
        message: `Items from purchase order ${po.po_no} have been received into central store inventory.`,
        link: `/requests/${po.request_id}`,
        isDemo: po.is_demo
      });
    }

    return this.getOrderById(id, user);
  }
}
