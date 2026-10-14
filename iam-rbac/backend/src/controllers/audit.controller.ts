import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';

// GET /audit-logs
export async function listAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
  const skip = (page - 1) * limit;

  const actionFilter = req.query.action as string;
  const effectFilter = req.query.effect as string;

  const whereClause: any = { accountId };
  if (actionFilter) {
    whereClause.action = { contains: actionFilter, mode: 'insensitive' };
  }
  if (effectFilter) {
    whereClause.effect = effectFilter;
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where: whereClause }),
    prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  res.json({
    success: true,
    data: {
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        resource: l.resource,
        effect: l.effect,
        ipAddress: l.ipAddress || 'unknown',
        userAgent: l.userAgent || 'unknown',
        timestamp: l.timestamp,
        user: l.user ? { id: l.user.id, username: l.user.username, email: l.user.email } : null,
        details: l.details,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
}
