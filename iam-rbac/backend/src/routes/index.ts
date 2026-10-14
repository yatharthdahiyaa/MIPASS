import { Router } from 'express';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import rolesRoutes from './roles.routes';
import policiesRoutes from './policies.routes';
import groupsRoutes from './groups.routes';
import auditRoutes from './audit.routes';
import { authenticate } from '../middleware/auth.middleware';
import { getMe } from '../controllers/auth.controller';

const router = Router();

// Root-level /me compatibility
router.get('/me', authenticate, getMe);

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/roles', rolesRoutes);
router.use('/policies', policiesRoutes);
router.use('/groups', groupsRoutes);
router.use('/audit-logs', auditRoutes);

export default router;
