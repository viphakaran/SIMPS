import { Router } from 'express';
import { ItemController } from '../controllers/itemController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('STORE_MANAGER', 'PROCUREMENT_OFFICER', 'PRINCIPAL', 'ADMIN'),
  ItemController.getAllMovements
);

export default router;
