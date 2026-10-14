import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';
import { recordAuditLog } from '../services/audit.service';

// GET /roles
export async function listRoles(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;

  const roles = await prisma.role.findMany({
    where: { accountId },
    include: {
      rolePolicies: { include: { policy: true } },
      _count: { select: { userRoles: true, groupRoles: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const formatted = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    createdAt: r.createdAt,
    userCount: r._count.userRoles,
    groupCount: r._count.groupRoles,
    policies: r.rolePolicies.map((rp) => ({
      id: rp.policy.id,
      name: rp.policy.name,
      description: rp.policy.description,
    })),
  }));

  res.json({ success: true, data: formatted });
}

// POST /roles
export async function createRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { name, description, policyIds } = req.body;

  if (!name) {
    res.status(400).json({ success: false, message: 'Role name is required.' });
    return;
  }

  const existing = await prisma.role.findUnique({
    where: { accountId_name: { accountId, name } },
  });

  if (existing) {
    res.status(400).json({ success: false, message: `Role '${name}' already exists.` });
    return;
  }

  const role = await prisma.$transaction(async (tx) => {
    const r = await tx.role.create({
      data: {
        accountId,
        name,
        description: description || null,
        isSystem: false,
      },
    });

    if (Array.isArray(policyIds) && policyIds.length > 0) {
      await tx.rolePolicy.createMany({
        data: policyIds.map((policyId: string) => ({
          roleId: r.id,
          policyId,
        })),
      });
    }

    return r;
  });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'roles:create',
    resource: `role:${role.id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { roleName: name },
  });

  res.status(201).json({ success: true, message: `Role '${name}' created.`, data: role });
}

// PUT /roles/:id
export async function updateRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { id } = req.params;
  const { name, description, policyIds } = req.body;

  const existing = await prisma.role.findFirst({ where: { id, accountId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Role not found.' });
    return;
  }

  if (existing.isSystem && name && name !== existing.name) {
    res.status(400).json({ success: false, message: 'Cannot rename built-in system roles.' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
      },
    });

    if (Array.isArray(policyIds)) {
      await tx.rolePolicy.deleteMany({ where: { roleId: id } });
      if (policyIds.length > 0) {
        await tx.rolePolicy.createMany({
          data: policyIds.map((policyId: string) => ({ roleId: id, policyId })),
        });
      }
    }
  });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'roles:update',
    resource: `role:${id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'Role updated successfully.' });
}

// DELETE /roles/:id
export async function deleteRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { id } = req.params;

  const existing = await prisma.role.findFirst({ where: { id, accountId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Role not found.' });
    return;
  }

  if (existing.isSystem) {
    res.status(400).json({ success: false, message: 'System roles cannot be deleted.' });
    return;
  }

  await prisma.role.delete({ where: { id } });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'roles:delete',
    resource: `role:${id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: `Role '${existing.name}' deleted.` });
}
