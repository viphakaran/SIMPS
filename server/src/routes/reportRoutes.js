import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ReportController } from '../controllers/reportController.js';

const router = Router();

router.use(authenticate);

// Role-specific dashboard (any authenticated user)
router.get('/dashboard', ReportController.getDashboard);

// Inventory valuation report (ADMIN, PRINCIPAL, PROCUREMENT_OFFICER, STORE_MANAGER)
router.get(
  '/inventory',
  authorize('ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER'),
  ReportController.getInventoryReport
);

// Procurement spend and status report (ADMIN, PRINCIPAL, PROCUREMENT_OFFICER, STORE_MANAGER, HOD)
router.get(
  '/procurement',
  authorize('ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'HOD'),
  ReportController.getProcurementReport
);

// Supplier performance table (ADMIN, PRINCIPAL, PROCUREMENT_OFFICER)
router.get(
  '/suppliers',
  authorize('ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER'),
  ReportController.getSuppliersReport
);

export default router;
