import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';
import { hashPassword, validatePasswordRules } from '../utils/password';
import { recordAuditLog } from '../services/audit.service';

// GET /users
export async function listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;

  const users = await prisma.user.findMany({
    where: { accountId },
    include: {
      userRoles: {
        include: { role: true },
      },
      userGroups: {
        include: { group: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formatted = users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    isRoot: u.isRoot,
    isSuspended: u.isSuspended,
    isMfaEnabled: u.isMfaEnabled,
    failedLoginAttempts: u.failedLoginAttempts,
    isLocked: !!(u.lockUntil && u.lockUntil > new Date()),
    createdAt: u.createdAt,
    roles: (u.userRoles || []).map((ur: any) => ({ id: ur.role?.id || ur.roleId || 'role', name: ur.role?.name || 'Role' })),
    groups: (u.userGroups || []).map((ug: any) => ({ id: ug.group?.id || ug.groupId || 'group', name: ug.group?.name || 'Group' })),
  }));

  res.json({ success: true, data: formatted });
}

// POST /users
export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { username, email, password, roleIds, groupIds, forceMfa } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ success: false, message: 'Username, email, and password are required.' });
    return;
  }

  const passwordVal = validatePasswordRules(password);
  if (!passwordVal.isValid) {
    res.status(400).json({
      success: false,
      error: 'WeakPassword',
      message: 'Password does not meet AWS IAM complexity criteria.',
      errors: passwordVal.errors,
    });
    return;
  }

  // Check unique username in account
  const existingUser = await prisma.user.findUnique({
    where: { accountId_username: { accountId, username } },
  });

  if (existingUser) {
    res.status(400).json({
      success: false,
      error: 'UsernameConflict',
      message: `User '${username}' already exists in this account.`,
    });
    return;
  }

  const passwordHash = await hashPassword(password);

  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        accountId,
        username,
        email,
        passwordHash,
        isRoot: false,
        isMfaEnabled: false,
      },
    });

    // Attach roles
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      await tx.userRole.createMany({
        data: roleIds.map((roleId: string) => ({
          userId: user.id,
          roleId,
        })),
      });
    }

    // Attach groups
    if (Array.isArray(groupIds) && groupIds.length > 0) {
      await tx.userGroup.createMany({
        data: groupIds.map((groupId: string) => ({
          userId: user.id,
          groupId,
        })),
      });
    }

    return user;
  });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'users:create',
    resource: `user:${newUser.id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { username, email, roleCount: roleIds?.length || 0 },
  });

  res.status(201).json({
    success: true,
    message: `IAM user '${username}' created successfully.`,
    data: { id: newUser.id, username: newUser.username, email: newUser.email },
  });
}

// GET /users/:id
export async function getUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { id } = req.params;

  const user = await prisma.user.findFirst({
    where: { id, accountId },
    include: {
      userRoles: { include: { role: true } },
      userGroups: { include: { group: true } },
    },
  });

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      isRoot: user.isRoot,
      isSuspended: user.isSuspended,
      isMfaEnabled: user.isMfaEnabled,
      createdAt: user.createdAt,
      roles: (user.userRoles || []).map((ur: any) => ur.role || { id: ur.roleId, name: 'Role' }),
      groups: (user.userGroups || []).map((ug: any) => ug.group || { id: ug.groupId, name: 'Group' }),
    },
  });
}

// PUT /users/:id
export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { id } = req.params;
  const { email, isSuspended, roleIds, groupIds } = req.body;

  const existing = await prisma.user.findFirst({ where: { id, accountId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }

  if (existing.isRoot && isSuspended) {
    res.status(400).json({ success: false, message: 'Cannot disable the Root account.' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        email: email || existing.email,
        isSuspended: isSuspended !== undefined ? isSuspended : existing.isSuspended,
      },
    });

    if (Array.isArray(roleIds)) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId: string) => ({ userId: id, roleId })),
        });
      }
    }

    if (Array.isArray(groupIds)) {
      await tx.userGroup.deleteMany({ where: { userId: id } });
      if (groupIds.length > 0) {
        await tx.userGroup.createMany({
          data: groupIds.map((groupId: string) => ({ userId: id, groupId })),
        });
      }
    }
  });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'users:update',
    resource: `user:${id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'User updated successfully.' });
}

// DELETE /users/:id
export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { id } = req.params;

  const existing = await prisma.user.findFirst({ where: { id, accountId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }

  if (existing.isRoot) {
    res.status(400).json({
      success: false,
      error: 'ProtectedAccount',
      message: 'The Root user account cannot be deleted.',
    });
    return;
  }

  await prisma.user.delete({ where: { id } });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'users:delete',
    resource: `user:${id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { deletedUsername: existing.username },
  });

  res.json({ success: true, message: `User '${existing.username}' deleted successfully.` });
}

// POST /users/:id/reset-password
export async function adminResetUserPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    res.status(400).json({ success: false, message: 'New password is required.' });
    return;
  }

  const val = validatePasswordRules(newPassword);
  if (!val.isValid) {
    res.status(400).json({ success: false, errors: val.errors });
    return;
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockUntil: null,
    },
  });

  // Revoke all existing sessions
  await prisma.refreshToken.updateMany({
    where: { userId: id },
    data: { isRevoked: true },
  });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'users:admin_password_reset',
    resource: `user:${id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'Password reset successfully.' });
}
