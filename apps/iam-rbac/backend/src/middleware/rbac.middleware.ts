import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { evaluatePermission } from '../utils/policyEvaluator';
import { recordAuditLog } from '../services/audit.service';

/**
 * Enforces that the authenticated user possesses explicit permission for the requested action and resource.
 */
export function requirePermission(action: string, resource: string = '*') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required before permission verification.',
      });
      return;
    }

    // Root user always has universal bypass
    if (user.isRoot) {
      return next();
    }

    const isAuthorized = evaluatePermission(user.policies, action, resource);

    if (!isAuthorized) {
      // Audit log the authorization failure
      await recordAuditLog({
        accountId: user.accountId,
        userId: user.id,
        action: `rbac:access_denied:${action}`,
        resource,
        effect: 'DENY',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: {
          attemptedAction: action,
          attemptedResource: resource,
          userRoles: user.roles,
        },
      });

      res.status(403).json({
        success: false,
        error: 'AccessDenied',
        message: `User '${user.username}' is not authorized to perform: ${action} on resource: ${resource}`,
        requiredPermission: action,
        resource,
      });
      return;
    }

    next();
  };
}

/**
 * Enforces that the user has at least one role from the allowed roles list.
 */
export function requireRole(allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
      return;
    }

    if (user.isRoot || user.roles.includes('Root')) {
      return next();
    }

    const hasMatchingRole = user.roles.some((r) => allowedRoles.includes(r));

    if (!hasMatchingRole) {
      res.status(403).json({
        success: false,
        error: 'AccessDenied',
        message: `Requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
