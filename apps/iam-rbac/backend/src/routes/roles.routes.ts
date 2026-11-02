import { Router } from 'express';
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} from '../controllers/roles.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('roles:read'), listRoles);
router.post('/', requirePermission('roles:create'), createRole);
router.put('/:id', requirePermission('roles:update'), updateRole);
router.delete('/:id', requirePermission('roles:delete'), deleteRole);

export default router;
