import { Router } from 'express';
import { listAuditLogs } from '../controllers/audit.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('audit:read'), listAuditLogs);

export default router;
