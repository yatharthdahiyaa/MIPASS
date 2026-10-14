import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';
import { recordAuditLog } from '../services/audit.service';

// GET /groups
export async function listGroups(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;

  const groups = await prisma.group.findMany({
    where: { accountId },
    include: {
      groupRoles: { include: { role: true } },
      userGroups: { include: { user: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const formatted = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    createdAt: g.createdAt,
    roles: g.groupRoles.map((gr) => ({ id: gr.role.id, name: gr.role.name })),
    users: g.userGroups.map((ug) => ({ id: ug.user.id, username: ug.user.username })),
  }));

  res.json({ success: true, data: formatted });
}

// POST /groups
export async function createGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { name, description, roleIds, userIds } = req.body;

  if (!name) {
    res.status(400).json({ success: false, message: 'Group name is required.' });
    return;
  }

  const existing = await prisma.group.findUnique({
    where: { accountId_name: { accountId, name } },
  });

  if (existing) {
    res.status(400).json({ success: false, message: `Group '${name}' already exists.` });
    return;
  }

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.group.create({
      data: {
        accountId,
        name,
        description: description || null,
      },
    });

    if (Array.isArray(roleIds) && roleIds.length > 0) {
      await tx.groupRole.createMany({
        data: roleIds.map((roleId: string) => ({ groupId: g.id, roleId })),
      });
    }

    if (Array.isArray(userIds) && userIds.length > 0) {
      await tx.userGroup.createMany({
        data: userIds.map((userId: string) => ({ groupId: g.id, userId })),
      });
    }

    return g;
  });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'groups:create',
    resource: `group:${group.id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { groupName: name },
  });

  res.status(201).json({ success: true, message: `Group '${name}' created.`, data: group });
}

// PUT /groups/:id
export async function updateGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { id } = req.params;
  const { name, description, roleIds, userIds } = req.body;

  const existing = await prisma.group.findFirst({ where: { id, accountId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Group not found.' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.group.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
      },
    });

    if (Array.isArray(roleIds)) {
      await tx.groupRole.deleteMany({ where: { groupId: id } });
      if (roleIds.length > 0) {
        await tx.groupRole.createMany({
          data: roleIds.map((roleId: string) => ({ groupId: id, roleId })),
        });
      }
    }

    if (Array.isArray(userIds)) {
      await tx.userGroup.deleteMany({ where: { groupId: id } });
      if (userIds.length > 0) {
        await tx.userGroup.createMany({
          data: userIds.map((userId: string) => ({ groupId: id, userId })),
        });
      }
    }
  });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'groups:update',
    resource: `group:${id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'Group updated successfully.' });
}

// DELETE /groups/:id
export async function deleteGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { id } = req.params;

  const existing = await prisma.group.findFirst({ where: { id, accountId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Group not found.' });
    return;
  }

  await prisma.group.delete({ where: { id } });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'groups:delete',
    resource: `group:${id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { deletedGroup: existing.name },
  });

  res.json({ success: true, message: `Group '${existing.name}' deleted.` });
}
