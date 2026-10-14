import { Router } from 'express';
import { SupplierController } from '../controllers/supplierController.js';
import { ReportController } from '../controllers/reportController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createSupplierSchema,
  updateSupplierSchema
} from '../schemas/masterSchemas.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER'),
  SupplierController.list
);

router.get(
  '/:id/performance',
  authorize('ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER'),
  ReportController.getSupplierPerformance
);

router.get(
  '/:id',
  authorize('ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER'),
  SupplierController.getById
);

router.post(
  '/',
  authorize('ADMIN', 'PROCUREMENT_OFFICER'),
  validate({ body: createSupplierSchema }),
  SupplierController.create
);

router.patch(
  '/:id',
  authorize('ADMIN', 'PROCUREMENT_OFFICER'),
  validate({ body: updateSupplierSchema }),
  SupplierController.update
);

export default router;
