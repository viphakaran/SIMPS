import { ReportService } from '../services/reportService.js';
import { formatCsv } from '../utils/csv.js';

export class ReportController {
  static async getDashboard(req, res, next) {
    try {
      const data = await ReportService.getDashboard(req.user);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getInventoryReport(req, res, next) {
    try {
      const result = await ReportService.getInventoryReport(req.query);

      if (req.query.format === 'csv') {
        const columns = [
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Item Name' },
          { key: 'categoryName', label: 'Category' },
          { key: 'stockQty', label: 'Stock Quantity' },
          { key: 'minLevel', label: 'Min Level' },
          { key: 'unit', label: 'Unit' },
          { key: 'unitCost', label: 'Unit Cost' },
          { key: 'status', label: 'Status' },
          { key: 'valuation', label: 'Valuation' }
        ];
        const csv = formatCsv(result.items, columns);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory-report.csv"');
        return res.send(csv);
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getProcurementReport(req, res, next) {
    try {
      const result = await ReportService.getProcurementReport(req.user, req.query);

      if (req.query.format === 'csv') {
        const columns = [
          { key: 'month', label: 'Month' },
          { key: 'departmentName', label: 'Department' },
          { key: 'totalSpend', label: 'Spend' }
        ];
        const csv = formatCsv(result.spendByMonthDepartment, columns);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="procurement-report.csv"');
        return res.send(csv);
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getSuppliersReport(req, res, next) {
    try {
      const result = await ReportService.getSuppliersReport();

      if (req.query.format === 'csv') {
        const columns = [
          { key: 'supplierName', label: 'Supplier Name' },
          { key: 'supplierEmail', label: 'Email' },
          { key: 'totalOrders', label: 'Total Orders' },
          { key: 'deliveredCount', label: 'Delivered Orders' },
          { key: 'onTimeRate', label: 'On-Time Rate' },
          { key: 'avgLeadDays', label: 'Avg Lead Days' }
        ];
        const csv = formatCsv(result, columns);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="supplier-performance-report.csv"');
        return res.send(csv);
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getReorderSuggestions(req, res, next) {
    try {
      const result = await ReportService.getReorderSuggestions();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getSupplierPerformance(req, res, next) {
    try {
      const result = await ReportService.getSupplierPerformance(Number(req.params.id));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
