import { prisma } from '../config/prisma';
import { AuditLogInput } from '../types';

export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    // Sanitize sensitive fields from details
    const sanitizedDetails = input.details ? { ...input.details } : {};
    delete (sanitizedDetails as any).password;
    delete (sanitizedDetails as any).token;
    delete (sanitizedDetails as any).secret;

    await prisma.auditLog.create({
      data: {
        accountId: input.accountId,
        userId: input.userId || null,
        action: input.action,
        resource: input.resource,
        effect: input.effect,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        details: sanitizedDetails,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
