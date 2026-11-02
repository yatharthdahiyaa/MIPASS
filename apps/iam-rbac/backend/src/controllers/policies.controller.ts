import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';
import { recordAuditLog } from '../services/audit.service';

// GET /policies
export async function listPolicies(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;

  const policies = await prisma.policy.findMany({
    where: { accountId },
    include: {
      _count: { select: { rolePolicies: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const formatted = policies.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isSystem: p.isSystem,
    document: p.document,
    attachedRolesCount: p._count?.rolePolicies || 0,
    createdAt: p.createdAt,
  }));

  res.json({ success: true, data: formatted });
}

// POST /policies
export async function createPolicy(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { name, description, document } = req.body;

  if (!name || !document) {
    res.status(400).json({ success: false, message: 'Policy name and document are required.' });
    return;
  }

  // Validate Statement structure
  if (!document.Statement || !Array.isArray(document.Statement) || document.Statement.length === 0) {
    res.status(400).json({
      success: false,
      message: 'Policy document must contain a non-empty Statement array.',
    });
    return;
  }

  for (const s of document.Statement) {
    if (!['Allow', 'Deny'].includes(s.Effect) || !Array.isArray(s.Action) || !Array.isArray(s.Resource)) {
      res.status(400).json({
        success: false,
        message: 'Each Statement must have Effect ("Allow" | "Deny"), Action array, and Resource array.',
      });
      return;
    }
  }

  const existing = await prisma.policy.findUnique({
    where: { accountId_name: { accountId, name } },
  });

  if (existing) {
    res.status(400).json({ success: false, message: `Policy '${name}' already exists.` });
    return;
  }

  const policy = await prisma.policy.create({
    data: {
      accountId,
      name,
      description: description || null,
      document,
      isSystem: false,
    },
  });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'policies:create',
    resource: `policy:${policy.id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { policyName: name },
  });

  res.status(201).json({ success: true, message: `Policy '${name}' created.`, data: policy });
}

// PUT /policies/:id
export async function updatePolicy(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { id } = req.params;
  const { name, description, document } = req.body;

  const existing = await prisma.policy.findFirst({ where: { id, accountId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Policy not found.' });
    return;
  }

  if (existing.isSystem) {
    res.status(400).json({ success: false, message: 'System policies cannot be modified.' });
    return;
  }

  const updated = await prisma.policy.update({
    where: { id },
    data: {
      name: name || existing.name,
      description: description !== undefined ? description : existing.description,
      document: document || existing.document,
    },
  });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'policies:update',
    resource: `policy:${id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'Policy updated successfully.', data: updated });
}

// DELETE /policies/:id
export async function deletePolicy(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = req.user!.accountId;
  const { id } = req.params;

  const existing = await prisma.policy.findFirst({ where: { id, accountId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Policy not found.' });
    return;
  }

  if (existing.isSystem) {
    res.status(400).json({ success: false, message: 'System policies cannot be deleted.' });
    return;
  }

  await prisma.policy.delete({ where: { id } });

  await recordAuditLog({
    accountId,
    userId: req.user!.id,
    action: 'policies:delete',
    resource: `policy:${id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { deletedPolicy: existing.name },
  });

  res.json({ success: true, message: `Policy '${existing.name}' deleted.` });
}
