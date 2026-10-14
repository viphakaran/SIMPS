import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../schemas/masterSchemas.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/', UserController.list);
router.post('/', validate({ body: createUserSchema }), UserController.create);
router.patch('/:id', validate({ body: updateUserSchema }), UserController.update);
router.post('/:id/approve', UserController.approve);
router.post('/:id/disable', UserController.disable);
router.post('/:id/enable', UserController.enable);

export default router;
