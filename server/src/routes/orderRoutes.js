import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { OrderController } from '../controllers/orderController.js';
import { updateOrderStatusSchema } from '../schemas/procurementSchemas.js';

const router = Router();

router.use(authenticate);

// List orders (ADMIN, PRINCIPAL, PROCUREMENT_OFFICER, STORE_MANAGER, SUPPLIER for own)
router.get(
  '/',
  authorize('ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'SUPPLIER'),
  OrderController.listOrders
);

// Detail of order (scoped)
router.get(
  '/:id',
  authorize('ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'SUPPLIER'),
  OrderController.getOrderById
);

// Supplier status updates (CONFIRMED, SHIPPED, DELIVERED) or Procurement cancel (CANCELLED)
router.patch(
  '/:id/status',
  authorize('SUPPLIER', 'PROCUREMENT_OFFICER'),
  validateBody(updateOrderStatusSchema),
  OrderController.updateOrderStatus
);

// Receive order (STORE_MANAGER, DELIVERED -> RECEIVED, increments stock)
router.post(
  '/:id/receive',
  authorize('STORE_MANAGER'),
  OrderController.receiveOrder
);

export default router;
