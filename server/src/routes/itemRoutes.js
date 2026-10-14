import { Router } from 'express';
import { ItemController } from '../controllers/itemController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createItemSchema,
  updateItemSchema,
  issueStockSchema,
  adjustStockSchema
} from '../schemas/itemSchemas.js';

const router = Router();

router.use(authenticate);

// All roles except SUPPLIER can view items and their history
const nonSupplierRoles = [
  'ADMIN',
  'PRINCIPAL',
  'HOD',
  'REQUESTER',
  'PROCUREMENT_OFFICER',
  'STORE_MANAGER'
];

router.get('/', authorize(...nonSupplierRoles), ItemController.list);
router.get('/:id', authorize(...nonSupplierRoles), ItemController.getById);
router.get('/:id/movements', authorize(...nonSupplierRoles), ItemController.getItemMovements);

// Store Manager actions
router.post(
  '/',
  authorize('STORE_MANAGER'),
  validate({ body: createItemSchema }),
  ItemController.create
);

router.patch(
  '/:id',
  authorize('STORE_MANAGER'),
  validate({ body: updateItemSchema }),
  ItemController.update
);

router.post(
  '/:id/issue',
  authorize('STORE_MANAGER'),
  validate({ body: issueStockSchema }),
  ItemController.issue
);

router.post(
  '/:id/adjust',
  authorize('STORE_MANAGER'),
  validate({ body: adjustStockSchema }),
  ItemController.adjust
);

export default router;
