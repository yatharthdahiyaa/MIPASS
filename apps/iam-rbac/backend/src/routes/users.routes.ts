import { Router } from 'express';
import {
  listUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  adminResetUserPassword,
} from '../controllers/users.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('users:read'), listUsers);
router.post('/', requirePermission('users:create'), createUser);
router.get('/:id', requirePermission('users:read'), getUser);
router.put('/:id', requirePermission('users:update'), updateUser);
router.delete('/:id', requirePermission('users:delete'), deleteUser);
router.post('/:id/reset-password', requirePermission('users:update'), adminResetUserPassword);

export default router;
