import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { RequestController } from '../controllers/requestController.js';
import {
  createRequestSchema,
  decisionRequestSchema,
  returnRequestSchema,
  createOrdersSchema
} from '../schemas/procurementSchemas.js';

const router = Router();

router.use(authenticate);

// List requests (scoped per SPEC section 4)
router.get('/', RequestController.listRequests);

// Detail of a request (scoped)
router.get('/:id', RequestController.getRequestById);

// Create request (HOD or REQUESTER)
router.post(
  '/',
  authorize('HOD', 'REQUESTER'),
  validateBody(createRequestSchema),
  RequestController.createRequest
);

// Decide on request (HOD or PRINCIPAL)
router.post(
  '/:id/decision',
  authorize('HOD', 'PRINCIPAL'),
  validateBody(decisionRequestSchema),
  RequestController.decideRequest
);

// Cancel request (while pending, by requester)
router.post('/:id/cancel', RequestController.cancelRequest);

// Return request (PROCUREMENT_OFFICER, APPROVED -> RETURNED_BY_PROCUREMENT)
router.post(
  '/:id/return',
  authorize('PROCUREMENT_OFFICER'),
  validateBody(returnRequestSchema),
  RequestController.returnRequest
);

// Create POs for approved request (PROCUREMENT_OFFICER, APPROVED -> ORDERED)
router.post(
  '/:id/orders',
  authorize('PROCUREMENT_OFFICER'),
  validateBody(createOrdersSchema),
  RequestController.createOrders
);

export default router;
