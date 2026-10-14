import { Router } from 'express';
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from '../controllers/policies.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('policies:read'), listPolicies);
router.post('/', requirePermission('policies:create'), createPolicy);
router.put('/:id', requirePermission('policies:update'), updatePolicy);
router.delete('/:id', requirePermission('policies:delete'), deletePolicy);

export default router;
