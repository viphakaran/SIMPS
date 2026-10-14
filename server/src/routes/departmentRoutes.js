import { Router } from 'express';
import { DepartmentController } from '../controllers/departmentController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  assignHodSchema
} from '../schemas/masterSchemas.js';

const router = Router();

// Public list for registration form
router.get('/public', DepartmentController.listPublic);

// Authenticated routes
router.use(authenticate);

router.get('/', DepartmentController.list);
router.post(
  '/',
  authorize('ADMIN'),
  validate({ body: createDepartmentSchema }),
  DepartmentController.create
);
router.patch(
  '/:id',
  authorize('ADMIN'),
  validate({ body: updateDepartmentSchema }),
  DepartmentController.update
);
router.put(
  '/:id/hod',
  authorize('ADMIN'),
  validate({ body: assignHodSchema }),
  DepartmentController.assignHod
);

export default router;
