import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createCategorySchema,
  updateCategorySchema
} from '../schemas/masterSchemas.js';

const router = Router();

router.use(authenticate);

router.get('/', CategoryController.list);
router.post(
  '/',
  authorize('ADMIN'),
  validate({ body: createCategorySchema }),
  CategoryController.create
);
router.patch(
  '/:id',
  authorize('ADMIN'),
  validate({ body: updateCategorySchema }),
  CategoryController.update
);

export default router;
