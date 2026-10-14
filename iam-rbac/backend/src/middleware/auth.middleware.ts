import { Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';
import { verifyAccessToken, ACCESS_TOKEN_COOKIE_NAME } from '../utils/jwt';
import { getUserResolvedRbac } from '../services/rbac.service';

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Extract token from cookie or Authorization header
    let token = req.cookies?.[ACCESS_TOKEN_COOKIE_NAME];

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication token is missing. Please sign in.',
      });
      return;
    }

    // 2. Verify token
    const decoded = verifyAccessToken(token);

    if (decoded.type !== 'access') {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token type.',
      });
      return;
    }

    // 3. Verify user in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { account: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User account no longer exists.',
      });
      return;
    }

    if (user.isSuspended) {
      res.status(403).json({
        success: false,
        error: 'AccountSuspended',
        message: 'This account has been disabled by an administrator.',
      });
      return;
    }

    // Check account lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMin = Math.ceil((user.lockUntil.getTime() - Date.now()) / (1000 * 60));
      res.status(423).json({
        success: false,
        error: 'AccountLocked',
        message: `Account is temporarily locked. Please try again in ${remainingMin} minute(s).`,
      });
      return;
    }

    // 4. Resolve effective RBAC policies and permissions
    const rbac = await getUserResolvedRbac(user.id, user.isRoot);

    req.user = {
      id: user.id,
      accountId: user.accountId,
      username: user.username,
      email: user.email,
      isRoot: user.isRoot,
      roles: rbac.roles,
      permissions: rbac.permissions,
      policies: rbac.policies,
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: 'TokenExpired',
        message: 'Your session has expired. Please refresh your token or sign in again.',
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid authentication credentials.',
    });
  }
}
