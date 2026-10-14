import crypto from 'crypto';
import { query, withTransaction } from '../config/db.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError
} from '../utils/errors.js';
import { parsePagination, formatPaginated } from '../utils/pagination.js';
import { NotificationService } from './notificationService.js';

export class RequestService {
  /**
   * Helper to fetch full request details with lines, approvals, and POs
   */
  static async getRequestById(id, user = null) {
    const rows = await query(
      `SELECT pr.id, pr.req_no, pr.department_id, pr.requested_by, pr.priority, pr.status,
              pr.justification, pr.is_demo, pr.created_at, pr.updated_at,
              d.name AS department_name,
              u.name AS requested_by_name, u.email AS requested_by_email, u.role AS requested_by_role
       FROM purchase_requests pr
       JOIN departments d ON pr.department_id = d.id
       LEFT JOIN users u ON pr.requested_by = u.id
       WHERE pr.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Purchase request not found', 'REQUEST_NOT_FOUND');
    }

    const pr = rows[0];

    // Enforce scoping if a user context is provided
    if (user) {
      this.assertCanViewRequest(user, pr);
    }

    // Lines
    const lines = await query(
      `SELECT ri.id, ri.item_id, ri.quantity,
              i.sku, i.name, i.unit, i.unit_cost, (ri.quantity * i.unit_cost) AS estimated_total
       FROM request_items ri
       JOIN items i ON ri.item_id = i.id
       WHERE ri.request_id = ?
       ORDER BY ri.id ASC`,
      [id]
    );

    // Approvals timeline
    const approvals = await query(
      `SELECT ra.id, ra.stage, ra.decision, ra.reason, ra.decided_at,
              ra.decided_by, u.name AS decided_by_name, u.role AS decided_by_role
       FROM request_approvals ra
       LEFT JOIN users u ON ra.decided_by = u.id
       WHERE ra.request_id = ?
       ORDER BY ra.decided_at ASC`,
      [id]
    );

    // Linked POs
    const orders = await query(
      `SELECT po.id, po.po_no, po.supplier_id, po.status, po.expected_date,
              po.delivered_date, po.total_amount, po.created_at,
              s.name AS supplier_name
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.request_id = ?
       ORDER BY po.id ASC`,
      [id]
    );

    return {
      id: pr.id,
      reqNo: pr.req_no,
      departmentId: pr.department_id,
      departmentName: pr.department_name,
      requestedBy: pr.requested_by,
      requestedByName: pr.requested_by_name,
      requestedByEmail: pr.requested_by_email,
      requestedByRole: pr.requested_by_role,
      priority: pr.priority,
      status: pr.status,
      justification: pr.justification,
      isDemo: Boolean(pr.is_demo),
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      lines: lines.map((l) => ({
        id: l.id,
        itemId: l.item_id,
        sku: l.sku,
        name: l.name,
        unit: l.unit,
        unitCost: Number(l.unit_cost),
        quantity: l.quantity,
        estimatedTotal: Number(l.estimated_total)
      })),
      approvals: approvals.map((a) => ({
        id: a.id,
        stage: a.stage,
        decision: a.decision,
        reason: a.reason,
        decidedAt: a.decided_at,
        decidedBy: a.decided_by,
        decidedByName: a.decided_by_name,
        decidedByRole: a.decided_by_role
      })),
      orders: orders.map((o) => ({
        id: o.id,
        poNo: o.po_no,
        supplierId: o.supplier_id,
        supplierName: o.supplier_name,
        status: o.status,
        expectedDate: o.expected_date,
        deliveredDate: o.delivered_date,
        totalAmount: Number(o.total_amount),
        createdAt: o.created_at
      }))
    };
  }

  /**
   * Scope check: determines if user has view permission for a specific request.
   * Throws NotFoundError (404) for unauthorized access per spec convention.
   */
  static assertCanViewRequest(user, pr) {
    if (user.role === 'ADMIN' || user.role === 'PRINCIPAL') {
      return;
    }

    if (user.role === 'HOD') {
      if (pr.department_id === user.departmentId) {
        return;
      }
      throw new NotFoundError('Purchase request not found', 'REQUEST_NOT_FOUND');
    }

    if (user.role === 'REQUESTER') {
      if (pr.requested_by === user.id) {
        return;
      }
      throw new NotFoundError('Purchase request not found', 'REQUEST_NOT_FOUND');
    }

    if (user.role === 'PROCUREMENT_OFFICER') {
      // Approved+ (APPROVED, ORDERED, RETURNED_BY_PROCUREMENT, RECEIVED) or own
      const allowedStatuses = ['APPROVED', 'ORDERED', 'RETURNED_BY_PROCUREMENT', 'RECEIVED'];
      if (allowedStatuses.includes(pr.status) || pr.requested_by === user.id) {
        return;
      }
      throw new NotFoundError('Purchase request not found', 'REQUEST_NOT_FOUND');
    }

    if (user.role === 'STORE_MANAGER') {
      // Ordered+ (ORDERED, RECEIVED) or own
      const allowedStatuses = ['ORDERED', 'RECEIVED'];
      if (allowedStatuses.includes(pr.status) || pr.requested_by === user.id) {
        return;
      }
      throw new NotFoundError('Purchase request not found', 'REQUEST_NOT_FOUND');
    }

    // SUPPLIER has no access to purchase requests
    throw new NotFoundError('Purchase request not found', 'REQUEST_NOT_FOUND');
  }

  /**
   * Create a purchase request with multi-line items.
   * Routes to PENDING_HOD or PENDING_PRINCIPAL.
   */
  static async createRequest(user, { priority = 'NORMAL', justification, lines }) {
    if (!['REQUESTER', 'HOD'].includes(user.role)) {
      throw new ForbiddenError('Only Requesters and HoDs can raise purchase requests', 'FORBIDDEN');
    }

    if (!user.departmentId) {
      throw new BadRequestError('User does not belong to any department', 'USER_NO_DEPARTMENT');
    }

    // Item validation: unique items per request
    const itemIds = lines.map((l) => l.itemId);
    if (new Set(itemIds).size !== lines.length) {
      throw new BadRequestError('Items must be unique per request', 'DUPLICATE_ITEM_IN_REQUEST');
    }

    // Item validation: all items must exist and be active
    const placeholders = itemIds.map(() => '?').join(',');
    const activeItems = await query(
      `SELECT id, is_active, is_demo FROM items WHERE id IN (${placeholders})`,
      itemIds
    );

    if (activeItems.length !== itemIds.length || activeItems.some((i) => !i.is_active)) {
      throw new BadRequestError(
        'One or more items are invalid or inactive',
        'INVALID_OR_INACTIVE_ITEM'
      );
    }

    // Any demo item makes the request demo
    const anyDemoItem = activeItems.some((i) => Boolean(i.is_demo));
    const isDemo = Boolean(user.isDemo || anyDemoItem);

    let initialStatus;
    let approverUserId;

    if (user.role === 'REQUESTER') {
      // Must route to department's active HoD
      const deptRows = await query('SELECT hod_user_id FROM departments WHERE id = ?', [
        user.departmentId
      ]);
      const hodUserId = deptRows[0]?.hod_user_id;

      if (!hodUserId) {
        throw new ConflictError(
          'Department does not have an assigned Head of Department',
          'NO_HOD'
        );
      }

      const hodRows = await query(
        "SELECT id FROM users WHERE id = ? AND role = 'HOD' AND status = 'ACTIVE'",
        [hodUserId]
      );
      if (hodRows.length === 0) {
        throw new ConflictError(
          'Department Head of Department is not active',
          'NO_HOD'
        );
      }

      initialStatus = 'PENDING_HOD';
      approverUserId = hodUserId;
    } else {
      // HOD request -> routes to active Principal
      const principalRows = await query(
        "SELECT id FROM users WHERE role = 'PRINCIPAL' AND status = 'ACTIVE' LIMIT 1"
      );
      if (principalRows.length === 0) {
        throw new ConflictError('System does not have an active Principal', 'NO_PRINCIPAL');
      }

      initialStatus = 'PENDING_PRINCIPAL';
      approverUserId = principalRows[0].id;
    }

    // Execute in transaction
    const requestId = await withTransaction(async (conn) => {
      const tempReqNo = `TMP-${crypto.randomUUID()}`;

      const [prResult] = await conn.query(
        `INSERT INTO purchase_requests (req_no, department_id, requested_by, priority, status, justification, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tempReqNo, user.departmentId, user.id, priority, initialStatus, justification || null, isDemo ? 1 : 0]
      );

      const insertedId = prResult.insertId;

      // Insert lines
      for (const line of lines) {
        await conn.query(
          `INSERT INTO request_items (request_id, item_id, quantity)
           VALUES (?, ?, ?)`,
          [insertedId, line.itemId, line.quantity]
        );
      }

      // Generate permanent REQ-YYYY-NNNNN number per SPEC section 10
      const year = new Date().getFullYear();
      const finalReqNo = `REQ-${year}-${String(insertedId).padStart(5, '0')}`;
      await conn.query('UPDATE purchase_requests SET req_no = ? WHERE id = ?', [
        finalReqNo,
        insertedId
      ]);

      return insertedId;
    });

    const createdRequest = await this.getRequestById(requestId, user);

    // Notify approver
    await NotificationService.notify({
      userIds: [approverUserId],
      type: 'REQUEST_SUBMITTED',
      message: `New purchase request ${createdRequest.reqNo} submitted for approval.`,
      link: `/requests/${requestId}`,
      isDemo
    });

    return createdRequest;
  }

  /**
   * List purchase requests with role-based scoping and filters.
   */
  static async listRequests(user, queryParams = {}) {
    const { page, pageSize, limit, offset, search } = parsePagination(queryParams);
    const { status, departmentId, mine, queue } = queryParams;

    const conditions = [];
    const params = [];

    // Role-based scoping per SPEC section 4
    if (user.role === 'ADMIN' || user.role === 'PRINCIPAL') {
      // Can view all requests
    } else if (user.role === 'HOD') {
      conditions.push('pr.department_id = ?');
      params.push(user.departmentId);
    } else if (user.role === 'REQUESTER') {
      conditions.push('pr.requested_by = ?');
      params.push(user.id);
    } else if (user.role === 'PROCUREMENT_OFFICER') {
      if (mine === 'true' || mine === '1') {
        conditions.push('pr.requested_by = ?');
        params.push(user.id);
      } else {
        conditions.push("pr.status IN ('APPROVED', 'ORDERED', 'RETURNED_BY_PROCUREMENT', 'RECEIVED')");
      }
    } else if (user.role === 'STORE_MANAGER') {
      if (mine === 'true' || mine === '1') {
        conditions.push('pr.requested_by = ?');
        params.push(user.id);
      } else {
        conditions.push("pr.status IN ('ORDERED', 'RECEIVED')");
      }
    } else {
      // SUPPLIER has no request visibility
      return formatPaginated([], 0, page, pageSize);
    }

    // Additional query filters
    if (status) {
      conditions.push('pr.status = ?');
      params.push(status);
    }

    if (departmentId && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) {
      conditions.push('pr.department_id = ?');
      params.push(departmentId);
    }

    if (mine === 'true' || mine === '1') {
      conditions.push('pr.requested_by = ?');
      params.push(user.id);
    }

    if (queue === 'true' || queue === '1') {
      if (user.role === 'HOD') {
        conditions.push("pr.status = 'PENDING_HOD' AND pr.requested_by <> ?");
        params.push(user.id);
      } else if (user.role === 'PRINCIPAL') {
        conditions.push("pr.status = 'PENDING_PRINCIPAL'");
      } else if (user.role === 'PROCUREMENT_OFFICER') {
        conditions.push("pr.status = 'APPROVED'");
      }
    }

    if (search) {
      conditions.push('(pr.req_no LIKE ? OR u.name LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM purchase_requests pr
      LEFT JOIN users u ON pr.requested_by = u.id
      ${whereClause}
    `;
    const [countRows] = await query(countSql, params);
    const total = countRows ? countRows.total : 0;

    const dataSql = `
      SELECT pr.id, pr.req_no, pr.department_id, pr.requested_by, pr.priority, pr.status,
             pr.justification, pr.is_demo, pr.created_at, pr.updated_at,
             d.name AS department_name,
             u.name AS requested_by_name,
             COUNT(ri.id) AS item_count
      FROM purchase_requests pr
      JOIN departments d ON pr.department_id = d.id
      LEFT JOIN users u ON pr.requested_by = u.id
      LEFT JOIN request_items ri ON pr.id = ri.request_id
      ${whereClause}
      GROUP BY pr.id
      ORDER BY pr.id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(dataSql, [...params, limit, offset]);

    const data = rows.map((r) => ({
      id: r.id,
      reqNo: r.req_no,
      departmentId: r.department_id,
      departmentName: r.department_name,
      requestedBy: r.requested_by,
      requestedByName: r.requested_by_name,
      priority: r.priority,
      status: r.status,
      justification: r.justification,
      itemCount: Number(r.item_count),
      isDemo: Boolean(r.is_demo),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return formatPaginated(data, total, page, pageSize);
  }

  /**
   * Decide on a request: APPROVED or REJECTED.
   * Single-stage approval: HoD for own dept's requester requests, Principal for HoD-raised requests.
   */
  static async decideRequest(id, user, { decision, reason }) {
    if (decision === 'REJECTED' && (!reason || !reason.trim())) {
      throw new BadRequestError('A reason is required when rejecting a request', 'REASON_REQUIRED');
    }

    const rows = await query(
      `SELECT pr.id, pr.req_no, pr.department_id, pr.requested_by, pr.status, pr.is_demo,
              u.role AS requested_by_role
       FROM purchase_requests pr
       LEFT JOIN users u ON pr.requested_by = u.id
       WHERE pr.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Purchase request not found', 'REQUEST_NOT_FOUND');
    }

    const pr = rows[0];
    let stage;

    if (pr.status === 'PENDING_HOD') {
      // Must be HOD of the request's department
      if (user.role !== 'HOD' || user.departmentId !== pr.department_id) {
        throw new ForbiddenError(
          'Only the Head of Department of this department can decide this request',
          'FORBIDDEN'
        );
      }

      // No self-approval
      if (user.id === pr.requested_by) {
        throw new ForbiddenError(
          'Self-approval is not permitted',
          'SELF_APPROVAL_NOT_ALLOWED'
        );
      }

      stage = 'HOD';
    } else if (pr.status === 'PENDING_PRINCIPAL') {
      // Must be Principal
      if (user.role !== 'PRINCIPAL') {
        throw new ForbiddenError(
          'Only the Principal can decide this request',
          'FORBIDDEN'
        );
      }

      stage = 'PRINCIPAL';
    } else {
      throw new ConflictError(
        `Request is not awaiting approval (current status: ${pr.status})`,
        'INVALID_REQUEST_STATUS'
      );
    }

    // Execute state transition atomically with affectedRows check
    await withTransaction(async (conn) => {
      const [updateResult] = await conn.query(
        'UPDATE purchase_requests SET status = ? WHERE id = ? AND status = ?',
        [decision, id, pr.status]
      );

      if (updateResult.affectedRows === 0) {
        throw new ConflictError(
          'Request status was changed concurrently by another operation',
          'CONCURRENT_MODIFICATION'
        );
      }

      await conn.query(
        `INSERT INTO request_approvals (request_id, decided_by, stage, decision, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [id, user.id, stage, decision, reason ? reason.trim() : null]
      );
    });

    // Notifications per SPEC section 8
    // 1. REQUEST_DECIDED to requester
    await NotificationService.notify({
      userIds: [pr.requested_by],
      type: 'REQUEST_DECIDED',
      message: `Your purchase request ${pr.req_no} has been ${decision.toLowerCase()}.`,
      link: `/requests/${id}`,
      isDemo: pr.is_demo
    });

    // 2. If APPROVED, notify all ACTIVE procurement officers
    if (decision === 'APPROVED') {
      await NotificationService.notify({
        roles: ['PROCUREMENT_OFFICER'],
        type: 'REQUEST_APPROVED',
        message: `Purchase request ${pr.req_no} has been approved and is ready for ordering.`,
        link: `/requests/${id}`,
        isDemo: pr.is_demo
      });
    }

    return this.getRequestById(id, user);
  }

  /**
   * Cancel request: allowed only for the requester while status is pending.
   */
  static async cancelRequest(id, user) {
    const rows = await query(
      'SELECT id, req_no, requested_by, status, is_demo FROM purchase_requests WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Purchase request not found', 'REQUEST_NOT_FOUND');
    }

    const pr = rows[0];

    if (pr.requested_by !== user.id) {
      throw new ForbiddenError('Only the requester can cancel their request', 'FORBIDDEN');
    }

    if (!['PENDING_HOD', 'PENDING_PRINCIPAL'].includes(pr.status)) {
      throw new ConflictError(
        `Cannot cancel request in status ${pr.status}`,
        'CANNOT_CANCEL_REQUEST'
      );
    }

    const [updateResult] = await query(
      "UPDATE purchase_requests SET status = 'CANCELLED' WHERE id = ? AND status IN ('PENDING_HOD', 'PENDING_PRINCIPAL')",
      [id]
    );

    if (updateResult.affectedRows === 0) {
      throw new ConflictError('Request status changed concurrently', 'CONCURRENT_MODIFICATION');
    }

    return this.getRequestById(id, user);
  }

  /**
   * Return request: Procurement Officer returns an approved request with reason.
   */
  static async returnRequest(id, user, { reason }) {
    if (user.role !== 'PROCUREMENT_OFFICER') {
      throw new ForbiddenError(
        'Only procurement officers can return requests',
        'FORBIDDEN'
      );
    }

    if (!reason || !reason.trim()) {
      throw new BadRequestError('Reason is required when returning a request', 'REASON_REQUIRED');
    }

    const rows = await query(
      'SELECT id, req_no, requested_by, status, is_demo FROM purchase_requests WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Purchase request not found', 'REQUEST_NOT_FOUND');
    }

    const pr = rows[0];

    if (pr.status !== 'APPROVED') {
      throw new ConflictError(
        `Only approved requests can be returned (current status: ${pr.status})`,
        'INVALID_REQUEST_STATUS'
      );
    }

    await withTransaction(async (conn) => {
      const [updateResult] = await conn.query(
        "UPDATE purchase_requests SET status = 'RETURNED_BY_PROCUREMENT' WHERE id = ? AND status = 'APPROVED'",
        [id]
      );

      if (updateResult.affectedRows === 0) {
        throw new ConflictError('Request status changed concurrently', 'CONCURRENT_MODIFICATION');
      }

      await conn.query(
        `INSERT INTO request_approvals (request_id, decided_by, stage, decision, reason)
         VALUES (?, ?, 'PROCUREMENT', 'RETURNED', ?)`,
        [id, user.id, reason.trim()]
      );
    });

    // Notify requester
    await NotificationService.notify({
      userIds: [pr.requested_by],
      type: 'REQUEST_RETURNED',
      message: `Purchase request ${pr.req_no} was returned by procurement: ${reason.trim()}`,
      link: `/requests/${id}`,
      isDemo: pr.is_demo
    });

    return this.getRequestById(id, user);
  }
}
