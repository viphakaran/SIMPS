import { query } from '../config/db.js';
import { NotFoundError } from '../utils/errors.js';
import { deriveItemStatus } from './itemService.js';

export class ReportService {
  /**
   * Reorder Suggestions per SPEC section 9.
   * Target items: status is LOW or OUT, or days_of_cover < 14.
   */
  static async getReorderSuggestions() {
    // 1. Fetch all active items
    const items = await query(
      `SELECT i.id, i.sku, i.name, i.unit, i.stock_qty, i.min_level, i.unit_cost,
              c.name AS category_name
       FROM items i
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE i.is_active = 1
       ORDER BY i.name ASC`
    );

    if (items.length === 0) {
      return [];
    }

    // 2. Fetch total issues in last 30 days per item
    // Stock movements stores ISSUE quantities as negative numbers per SPEC section 7
    const issueRows = await query(
      `SELECT item_id, ABS(SUM(quantity)) AS total_issued
       FROM stock_movements
       WHERE type = 'ISSUE'
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY item_id`
    );
    const issueMap = new Map(issueRows.map((r) => [r.item_id, Number(r.total_issued)]));

    // 3. Fetch on_order quantities per item for POs in active transit
    const onOrderRows = await query(
      `SELECT poi.item_id, SUM(poi.quantity) AS on_order_qty
       FROM po_items poi
       JOIN purchase_orders po ON poi.po_id = po.id
       WHERE po.status IN ('PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED')
       GROUP BY poi.item_id`
    );
    const onOrderMap = new Map(onOrderRows.map((r) => [r.item_id, Number(r.on_order_qty)]));

    const suggestions = [];

    for (const item of items) {
      const stockQty = Number(item.stock_qty);
      const minLevel = Number(item.min_level);
      const status = deriveItemStatus(stockQty, minLevel);

      const totalIssued = issueMap.get(item.id) || 0;
      const onOrder = onOrderMap.get(item.id) || 0;

      const hasUsage = totalIssued > 0;
      const avgDaily = hasUsage ? totalIssued / 30.0 : 0;
      const daysOfCover = avgDaily > 0 ? stockQty / avgDaily : null;

      // Filter: status is LOW/OUT or days_of_cover < 14
      const isLowOrOut = status === 'LOW' || status === 'OUT';
      const isLowCover = daysOfCover !== null && daysOfCover < 14;

      if (isLowOrOut || isLowCover) {
        let suggestedQty = 0;
        let insufficientData = false;

        if (!hasUsage) {
          insufficientData = true;
          // If no usage, but stock is 0 or low, minimum suggestion is to reach minLevel
          suggestedQty = Math.max(0, minLevel - stockQty - onOrder);
        } else {
          // SPEC: suggested_qty = max(0, ceil(avg_daily * 30) - stock_qty - on_order)
          suggestedQty = Math.max(0, Math.ceil(avgDaily * 30) - stockQty - onOrder);
        }

        suggestions.push({
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          categoryName: item.category_name,
          unit: item.unit,
          stockQty,
          minLevel,
          status,
          avgDaily: Number(avgDaily.toFixed(2)),
          daysOfCover: daysOfCover !== null ? Number(daysOfCover.toFixed(1)) : null,
          onOrder,
          suggestedQty,
          insufficientData,
          insufficientDataMessage: insufficientData ? 'Not enough usage data' : null
        });
      }
    }

    return suggestions;
  }

  /**
   * Supplier performance metrics for a single supplier.
   */
  static async getSupplierPerformance(supplierId) {
    const suppRows = await query(
      'SELECT id, name, email, is_active FROM suppliers WHERE id = ?',
      [supplierId]
    );

    if (suppRows.length === 0) {
      throw new NotFoundError('Supplier not found', 'SUPPLIER_NOT_FOUND');
    }

    const s = suppRows[0];
    const metrics = await this.computeSupplierMetrics(supplierId);

    return {
      supplierId: s.id,
      supplierName: s.name,
      supplierEmail: s.email,
      isActive: Boolean(s.is_active),
      ...metrics
    };
  }

  /**
   * Supplier performance report across all suppliers.
   */
  static async getSuppliersReport() {
    const suppliers = await query(
      'SELECT id, name, email, is_active FROM suppliers ORDER BY name ASC'
    );

    const report = [];
    for (const s of suppliers) {
      const metrics = await this.computeSupplierMetrics(s.id);
      report.push({
        supplierId: s.id,
        supplierName: s.name,
        supplierEmail: s.email,
        isActive: Boolean(s.is_active),
        ...metrics
      });
    }

    return report;
  }

  /**
   * Core metric calculation per SPEC section 9.
   */
  static async computeSupplierMetrics(supplierId) {
    const pos = await query(
      `SELECT id, status, expected_date, delivered_date, created_at
       FROM purchase_orders
       WHERE supplier_id = ?`,
      [supplierId]
    );

    const totalOrders = pos.filter((p) => p.status !== 'CANCELLED').length;
    const deliveredOrders = pos.filter((p) => ['DELIVERED', 'RECEIVED'].includes(p.status));
    const deliveredCount = deliveredOrders.length;

    if (deliveredCount === 0) {
      return {
        totalOrders,
        deliveredCount: 0,
        onTimeRate: null,
        avgLeadDays: null
      };
    }

    // On-time rate: delivered with delivered_date <= expected_date / delivered with expected_date
    const withExpected = deliveredOrders.filter(
      (p) => p.expected_date !== null && p.delivered_date !== null
    );

    let onTimeRate = null;
    if (withExpected.length > 0) {
      const onTimeCount = withExpected.filter((p) => {
        const delDate = new Date(p.delivered_date).toISOString().slice(0, 10);
        const expDate = new Date(p.expected_date).toISOString().slice(0, 10);
        return delDate <= expDate;
      }).length;
      onTimeRate = Number((onTimeCount / withExpected.length).toFixed(2));
    }

    // Lead days: avg(DATEDIFF(delivered_date, DATE(created_at)))
    let totalLeadDays = 0;
    let leadCount = 0;
    for (const p of deliveredOrders) {
      if (p.delivered_date) {
        const dDate = new Date(p.delivered_date);
        const cDate = new Date(p.created_at);
        const diffDays = Math.max(
          0,
          Math.round((dDate.getTime() - cDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        totalLeadDays += diffDays;
        leadCount += 1;
      }
    }

    const avgLeadDays = leadCount > 0 ? Number((totalLeadDays / leadCount).toFixed(1)) : null;

    return {
      totalOrders,
      deliveredCount,
      onTimeRate,
      avgLeadDays
    };
  }

  /**
   * Inventory Valuation Report.
   */
  static async getInventoryReport(queryParams = {}) {
    const { categoryId, status } = queryParams;

    const conditions = ['i.is_active = 1'];
    const params = [];

    if (categoryId) {
      conditions.push('i.category_id = ?');
      params.push(categoryId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const rows = await query(
      `SELECT i.id, i.sku, i.name, i.stock_qty, i.min_level, i.unit, i.unit_cost,
              c.name AS category_name
       FROM items i
       LEFT JOIN categories c ON i.category_id = c.id
       ${whereClause}
       ORDER BY i.name ASC`,
      params
    );

    let items = rows.map((r) => {
      const stockQty = Number(r.stock_qty);
      const minLevel = Number(r.min_level);
      const unitCost = Number(r.unit_cost);
      const derivedStatus = deriveItemStatus(stockQty, minLevel);
      const valuation = Number((stockQty * unitCost).toFixed(2));

      return {
        id: r.id,
        sku: r.sku,
        name: r.name,
        categoryName: r.category_name || 'Uncategorized',
        stockQty,
        minLevel,
        unit: r.unit,
        unitCost,
        status: derivedStatus,
        valuation
      };
    });

    if (status) {
      items = items.filter((i) => i.status === status);
    }

    const totalValuation = items.reduce((acc, i) => acc + i.valuation, 0);

    return {
      items,
      totalCount: items.length,
      totalValuation: Number(totalValuation.toFixed(2))
    };
  }

  /**
   * Procurement Report per SPEC section 9.
   * Scoping: HOD only sees own department.
   */
  static async getProcurementReport(user, queryParams = {}) {
    const { from, to, status, departmentId } = queryParams;

    const conditions = [];
    const params = [];

    // Department isolation
    if (user.role === 'HOD') {
      conditions.push('pr.department_id = ?');
      params.push(user.departmentId);
    } else if (departmentId) {
      conditions.push('pr.department_id = ?');
      params.push(departmentId);
    }

    if (from) {
      conditions.push('pr.created_at >= ?');
      params.push(`${from} 00:00:00`);
    }

    if (to) {
      conditions.push('pr.created_at <= ?');
      params.push(`${to} 23:59:59`);
    }

    if (status) {
      conditions.push('pr.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Request counts by status
    const countRows = await query(
      `SELECT pr.status, COUNT(*) AS count
       FROM purchase_requests pr
       ${whereClause}
       GROUP BY pr.status`,
      params
    );

    const countsByStatus = {};
    for (const r of countRows) {
      countsByStatus[r.status] = Number(r.count);
    }

    // 2. Spend: sum of RECEIVED PO totals by month and department
    const spendConditions = ["po.status = 'RECEIVED'"];
    const spendParams = [];

    if (user.role === 'HOD') {
      spendConditions.push('pr.department_id = ?');
      spendParams.push(user.departmentId);
    } else if (departmentId) {
      spendConditions.push('pr.department_id = ?');
      spendParams.push(departmentId);
    }

    if (from) {
      spendConditions.push('po.created_at >= ?');
      spendParams.push(`${from} 00:00:00`);
    }

    if (to) {
      spendConditions.push('po.created_at <= ?');
      spendParams.push(`${to} 23:59:59`);
    }

    const spendWhere = `WHERE ${spendConditions.join(' AND ')}`;

    const spendRows = await query(
      `SELECT DATE_FORMAT(po.created_at, '%Y-%m') AS month,
              d.name AS department_name,
              SUM(po.total_amount) AS total_spend
       FROM purchase_orders po
       JOIN purchase_requests pr ON po.request_id = pr.id
       JOIN departments d ON pr.department_id = d.id
       ${spendWhere}
       GROUP BY DATE_FORMAT(po.created_at, '%Y-%m'), d.name
       ORDER BY month DESC, d.name ASC`,
      spendParams
    );

    const spendByMonthDepartment = spendRows.map((r) => ({
      month: r.month,
      departmentName: r.department_name,
      totalSpend: Number(Number(r.total_spend).toFixed(2))
    }));

    const totalSpend = spendByMonthDepartment.reduce((acc, r) => acc + r.totalSpend, 0);

    return {
      countsByStatus,
      spendByMonthDepartment,
      totalSpend: Number(totalSpend.toFixed(2))
    };
  }

  /**
   * Role-specific Dashboard Widgets per SPEC section 9.
   */
  static async getDashboard(user) {
    switch (user.role) {
      case 'STORE_MANAGER': {
        // items total/low/out, POs awaiting receipt, recent movements, low-stock list
        const items = await query(
          'SELECT stock_qty, min_level, name, sku FROM items WHERE is_active = 1'
        );
        let total = items.length;
        let low = 0;
        let out = 0;
        const lowStockList = [];

        for (const item of items) {
          const status = deriveItemStatus(item.stock_qty, item.min_level);
          if (status === 'OUT') {
            out += 1;
            lowStockList.push({ ...item, status });
          } else if (status === 'LOW') {
            low += 1;
            lowStockList.push({ ...item, status });
          }
        }

        const [awaitingReceiptRows] = await query(
          "SELECT COUNT(*) AS count FROM purchase_orders WHERE status = 'DELIVERED'"
        );

        const recentMovements = await query(
          `SELECT sm.id, sm.type, sm.quantity, sm.balance_after, sm.created_at,
                  i.name AS item_name, i.sku
           FROM stock_movements sm
           JOIN items i ON sm.item_id = i.id
           ORDER BY sm.created_at DESC
           LIMIT 5`
        );

        return {
          role: 'STORE_MANAGER',
          items: {
            total,
            low,
            out,
            inStock: total - low - out
          },
          posAwaitingReceipt: Number(awaitingReceiptRows?.count || 0),
          recentMovements: recentMovements.map((m) => ({
            id: m.id,
            sku: m.sku,
            itemName: m.item_name,
            type: m.type,
            quantity: m.quantity,
            balanceAfter: m.balance_after,
            createdAt: m.created_at
          })),
          lowStockList: lowStockList.slice(0, 10)
        };
      }

      case 'PROCUREMENT_OFFICER': {
        // approved requests waiting, open POs, overdue POs, reorder suggestion count
        const [apprRows] = await query(
          "SELECT COUNT(*) AS count FROM purchase_requests WHERE status = 'APPROVED'"
        );
        const [openPoRows] = await query(
          "SELECT COUNT(*) AS count FROM purchase_orders WHERE status IN ('PLACED', 'CONFIRMED', 'SHIPPED')"
        );
        const [overdueRows] = await query(
          "SELECT COUNT(*) AS count FROM purchase_orders WHERE expected_date < CURDATE() AND status NOT IN ('DELIVERED', 'RECEIVED', 'CANCELLED')"
        );
        const suggestions = await this.getReorderSuggestions();

        return {
          role: 'PROCUREMENT_OFFICER',
          approvedRequestsWaiting: Number(apprRows?.count || 0),
          openOrders: Number(openPoRows?.count || 0),
          overdueOrders: Number(overdueRows?.count || 0),
          reorderSuggestionsCount: suggestions.length
        };
      }

      case 'HOD': {
        // pending approvals, department requests by status
        const [pendingRows] = await query(
          "SELECT COUNT(*) AS count FROM purchase_requests WHERE status = 'PENDING_HOD' AND department_id = ?",
          [user.departmentId]
        );

        const statusRows = await query(
          `SELECT status, COUNT(*) AS count
           FROM purchase_requests
           WHERE department_id = ?
           GROUP BY status`,
          [user.departmentId]
        );

        const requestsByStatus = {};
        for (const r of statusRows) {
          requestsByStatus[r.status] = Number(r.count);
        }

        return {
          role: 'HOD',
          pendingApprovals: Number(pendingRows?.count || 0),
          requestsByStatus
        };
      }

      case 'PRINCIPAL': {
        // pending approvals, college-wide requests by status, open POs, spend by month/dept
        const [pendingRows] = await query(
          "SELECT COUNT(*) AS count FROM purchase_requests WHERE status = 'PENDING_PRINCIPAL'"
        );
        const statusRows = await query(
          'SELECT status, COUNT(*) AS count FROM purchase_requests GROUP BY status'
        );
        const requestsByStatus = {};
        for (const r of statusRows) {
          requestsByStatus[r.status] = Number(r.count);
        }

        const [openPoRows] = await query(
          "SELECT COUNT(*) AS count FROM purchase_orders WHERE status IN ('PLACED', 'CONFIRMED', 'SHIPPED')"
        );

        const spendReport = await this.getProcurementReport(user);

        return {
          role: 'PRINCIPAL',
          pendingApprovals: Number(pendingRows?.count || 0),
          requestsByStatus,
          openOrders: Number(openPoRows?.count || 0),
          spendByMonthDepartment: spendReport.spendByMonthDepartment,
          totalSpend: spendReport.totalSpend
        };
      }

      case 'REQUESTER': {
        // my requests by status
        const statusRows = await query(
          'SELECT status, COUNT(*) AS count FROM purchase_requests WHERE requested_by = ? GROUP BY status',
          [user.id]
        );
        const requestsByStatus = {};
        for (const r of statusRows) {
          requestsByStatus[r.status] = Number(r.count);
        }

        const recentRequests = await query(
          `SELECT id, req_no, priority, status, created_at
           FROM purchase_requests
           WHERE requested_by = ?
           ORDER BY created_at DESC
           LIMIT 5`,
          [user.id]
        );

        return {
          role: 'REQUESTER',
          requestsByStatus,
          recentRequests
        };
      }

      case 'SUPPLIER': {
        // my open orders by status, overdue deliveries
        if (!user.supplierId) {
          return {
            role: 'SUPPLIER',
            openOrdersByStatus: {},
            overdueDeliveries: 0
          };
        }

        const statusRows = await query(
          `SELECT status, COUNT(*) AS count
           FROM purchase_orders
           WHERE supplier_id = ? AND status IN ('PLACED', 'CONFIRMED', 'SHIPPED')
           GROUP BY status`,
          [user.supplierId]
        );
        const openOrdersByStatus = {};
        for (const r of statusRows) {
          openOrdersByStatus[r.status] = Number(r.count);
        }

        const [overdueRows] = await query(
          `SELECT COUNT(*) AS count
           FROM purchase_orders
           WHERE supplier_id = ? AND expected_date < CURDATE() AND status NOT IN ('DELIVERED', 'RECEIVED', 'CANCELLED')`,
          [user.supplierId]
        );

        return {
          role: 'SUPPLIER',
          openOrdersByStatus,
          overdueDeliveries: Number(overdueRows?.count || 0)
        };
      }

      case 'ADMIN': {
        // pending accounts, users by role, departments without HoD
        const [pendingUsers] = await query(
          "SELECT COUNT(*) AS count FROM users WHERE status = 'PENDING'"
        );
        const roleRows = await query(
          'SELECT role, COUNT(*) AS count FROM users GROUP BY role'
        );
        const usersByRole = {};
        for (const r of roleRows) {
          usersByRole[r.role] = Number(r.count);
        }

        const departmentsWithoutHod = await query(
          'SELECT id, name FROM departments WHERE hod_user_id IS NULL AND is_active = 1'
        );

        return {
          role: 'ADMIN',
          pendingAccounts: Number(pendingUsers?.count || 0),
          usersByRole,
          departmentsWithoutHod
        };
      }

      default:
        return { role: user.role };
    }
  }
}
