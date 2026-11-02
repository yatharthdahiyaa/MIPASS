import { Router } from 'express';
import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
} from '../controllers/groups.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('groups:read'), listGroups);
router.post('/', requirePermission('groups:create'), createGroup);
router.put('/:id', requirePermission('groups:update'), updateGroup);
router.delete('/:id', requirePermission('groups:delete'), deleteGroup);

export default router;
