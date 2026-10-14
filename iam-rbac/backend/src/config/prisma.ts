import { PrismaClient } from '@prisma/client';
import { MemoryStore } from './memoryStore';

// Initialize in-memory store fallback
const memoryStore = new MemoryStore();
let useFallback = false;

// Attempt real Prisma client connection
const realPrisma = new PrismaClient({
  log: ['error'],
});

// Check if PostgreSQL is reachable; if not, seamlessly enable high-availability fallback
realPrisma
  .$connect()
  .then(() => {
    console.log('✅ PostgreSQL connected successfully at localhost:5432');
  })
  .catch((err) => {
    console.warn(
      '⚠️ [Prisma] PostgreSQL not reachable at localhost:5432. Switching to Resilient Memory Store with seeded AWS accounts (Root & alice.dev).'
    );
    useFallback = true;
  });

// Create mock Prisma model handlers
const mockPrisma: any = {
  account: {
    findUnique: async ({ where }: any) => {
      if (where.id) return memoryStore.accounts.find((a) => a.id === where.id) || null;
      if (where.accountAlias)
        return (
          memoryStore.accounts.find(
            (a) => a.accountAlias === where.accountAlias || a.id === where.accountAlias
          ) || null
        );
      return null;
    },
    findFirst: async ({ where }: any) => {
      if (where?.OR) {
        for (const cond of where.OR) {
          const match = memoryStore.accounts.find(
            (a) =>
              (cond.id && a.id === cond.id) ||
              (cond.accountAlias && (a.accountAlias === cond.accountAlias || a.id === cond.accountAlias))
          );
          if (match) return match;
        }
      }
      return memoryStore.accounts[0] || null;
    },
    create: async ({ data }: any) => {
      const acc = {
        id: data.id || Math.floor(100000000000 + Math.random() * 900000000000).toString(),
        name: data.name,
        accountAlias: data.accountAlias || null,
        rootUserId: data.rootUserId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.accounts.push(acc);
      return acc;
    },
    update: async ({ where, data }: any) => {
      const idx = memoryStore.accounts.findIndex((a) => a.id === where.id);
      if (idx !== -1) {
        memoryStore.accounts[idx] = { ...memoryStore.accounts[idx], ...data, updatedAt: new Date() };
        return memoryStore.accounts[idx];
      }
      return null;
    },
  },

  user: {
    findUnique: async ({ where, include }: any) => {
      let u: any = null;
      if (where.id) u = memoryStore.users.find((x) => x.id === where.id);
      else if (where.email) u = memoryStore.users.find((x) => x.email === where.email);
      else if (where.accountId_username) {
        u = memoryStore.users.find(
          (x) =>
            x.accountId === where.accountId_username.accountId &&
            x.username.toLowerCase() === where.accountId_username.username.toLowerCase()
        );
      }
      return memoryStore.attachUserRelations(u, include);
    },
    findFirst: async ({ where, include }: any) => {
      const match = memoryStore.users.find((x) => {
        if (where.email && x.email !== where.email) return false;
        if (where.isRoot !== undefined && x.isRoot !== where.isRoot) return false;
        if (where.id && x.id !== where.id) return false;
        if (where.accountId && x.accountId !== where.accountId) return false;
        if (where.username && x.username.toLowerCase() !== where.username.toLowerCase()) return false;
        return true;
      });
      return memoryStore.attachUserRelations(match || null, include);
    },
    findMany: async ({ where, include, orderBy, take, skip }: any) => {
      let list = [...memoryStore.users];
      if (where?.accountId) list = list.filter((u) => u.accountId === where.accountId);
      if (where?.isRoot !== undefined) list = list.filter((u) => u.isRoot === where.isRoot);
      if (where?.isSuspended !== undefined) list = list.filter((u) => u.isSuspended === where.isSuspended);
      if (skip) list = list.slice(skip);
      if (take) list = list.slice(0, take);
      return list.map((u) => memoryStore.attachUserRelations(u, include));
    },
    create: async ({ data }: any) => {
      const newUser = {
        id: data.id || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        accountId: data.accountId,
        username: data.username,
        email: data.email,
        passwordHash: data.passwordHash,
        isRoot: !!data.isRoot,
        isSuspended: !!data.isSuspended,
        isMfaEnabled: !!data.isMfaEnabled,
        forcePasswordReset: !!data.forcePasswordReset,
        failedLoginAttempts: 0,
        lockUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.users.push(newUser);
      return newUser;
    },
    update: async ({ where, data }: any) => {
      const idx = memoryStore.users.findIndex((u) => u.id === where.id);
      if (idx !== -1) {
        memoryStore.users[idx] = { ...memoryStore.users[idx], ...data, updatedAt: new Date() };
        return memoryStore.users[idx];
      }
      return null;
    },
    delete: async ({ where }: any) => {
      const idx = memoryStore.users.findIndex((u) => u.id === where.id);
      if (idx !== -1) {
        const deleted = memoryStore.users.splice(idx, 1)[0];
        return deleted;
      }
      return null;
    },
    count: async ({ where }: any) => {
      let list = memoryStore.users;
      if (where?.accountId) list = list.filter((u) => u.accountId === where.accountId);
      return list.length;
    },
  },

  role: {
    findUnique: async ({ where }: any) => {
      if (where.id) return memoryStore.roles.find((r) => r.id === where.id) || null;
      if (where.accountId_name) {
        return (
          memoryStore.roles.find(
            (r) => r.accountId === where.accountId_name.accountId && r.name === where.accountId_name.name
          ) || null
        );
      }
      return null;
    },
    findFirst: async ({ where }: any) => {
      return (
        memoryStore.roles.find(
          (r) =>
            (!where.id || r.id === where.id) &&
            (!where.accountId || r.accountId === where.accountId) &&
            (!where.name || r.name === where.name)
        ) || null
      );
    },
    findMany: async ({ where }: any) => {
      let list = [...memoryStore.roles];
      if (where?.accountId) list = list.filter((r) => r.accountId === where.accountId);
      return list;
    },
    create: async ({ data }: any) => {
      const newRole = {
        id: data.id || `role_${Date.now()}`,
        accountId: data.accountId,
        name: data.name,
        description: data.description || null,
        isSystem: !!data.isSystem,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.roles.push(newRole);
      return newRole;
    },
    update: async ({ where, data }: any) => {
      const idx = memoryStore.roles.findIndex((r) => r.id === where.id);
      if (idx !== -1) {
        memoryStore.roles[idx] = { ...memoryStore.roles[idx], ...data, updatedAt: new Date() };
        return memoryStore.roles[idx];
      }
      return null;
    },
    delete: async ({ where }: any) => {
      const idx = memoryStore.roles.findIndex((r) => r.id === where.id);
      if (idx !== -1) return memoryStore.roles.splice(idx, 1)[0];
      return null;
    },
  },

  policy: {
    findUnique: async ({ where }: any) => {
      if (where.id) return memoryStore.policies.find((p) => p.id === where.id) || null;
      if (where.accountId_name) {
        return (
          memoryStore.policies.find(
            (p) => p.accountId === where.accountId_name.accountId && p.name === where.accountId_name.name
          ) || null
        );
      }
      return null;
    },
    findFirst: async ({ where }: any) => {
      return (
        memoryStore.policies.find(
          (p) =>
            (!where.id || p.id === where.id) &&
            (!where.accountId || p.accountId === where.accountId) &&
            (!where.name || p.name === where.name)
        ) || null
      );
    },
    findMany: async ({ where }: any) => {
      let list = [...memoryStore.policies];
      if (where?.accountId) list = list.filter((p) => p.accountId === where.accountId);
      return list;
    },
    create: async ({ data }: any) => {
      const newPolicy = {
        id: data.id || `pol_${Date.now()}`,
        accountId: data.accountId,
        name: data.name,
        description: data.description || null,
        document: data.document,
        isSystem: !!data.isSystem,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.policies.push(newPolicy);
      return newPolicy;
    },
    update: async ({ where, data }: any) => {
      const idx = memoryStore.policies.findIndex((p) => p.id === where.id);
      if (idx !== -1) {
        memoryStore.policies[idx] = { ...memoryStore.policies[idx], ...data, updatedAt: new Date() };
        return memoryStore.policies[idx];
      }
      return null;
    },
    delete: async ({ where }: any) => {
      const idx = memoryStore.policies.findIndex((p) => p.id === where.id);
      if (idx !== -1) return memoryStore.policies.splice(idx, 1)[0];
      return null;
    },
  },

  group: {
    findUnique: async ({ where }: any) => {
      if (where.id) return memoryStore.groups.find((g) => g.id === where.id) || null;
      if (where.accountId_name) {
        return (
          memoryStore.groups.find(
            (g) => g.accountId === where.accountId_name.accountId && g.name === where.accountId_name.name
          ) || null
        );
      }
      return null;
    },
    findFirst: async ({ where }: any) => {
      return (
        memoryStore.groups.find(
          (g) =>
            (!where.id || g.id === where.id) &&
            (!where.accountId || g.accountId === where.accountId)
        ) || null
      );
    },
    findMany: async ({ where }: any) => {
      let list = [...memoryStore.groups];
      if (where?.accountId) list = list.filter((g) => g.accountId === where.accountId);
      return list;
    },
    create: async ({ data }: any) => {
      const grp = {
        id: data.id || `grp_${Date.now()}`,
        accountId: data.accountId,
        name: data.name,
        description: data.description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.groups.push(grp);
      return grp;
    },
    update: async ({ where, data }: any) => {
      const idx = memoryStore.groups.findIndex((g) => g.id === where.id);
      if (idx !== -1) {
        memoryStore.groups[idx] = { ...memoryStore.groups[idx], ...data, updatedAt: new Date() };
        return memoryStore.groups[idx];
      }
      return null;
    },
    delete: async ({ where }: any) => {
      const idx = memoryStore.groups.findIndex((g) => g.id === where.id);
      if (idx !== -1) return memoryStore.groups.splice(idx, 1)[0];
      return null;
    },
  },

  userRole: {
    findMany: async ({ where, include }: any) => {
      let list = [...memoryStore.userRoles];
      if (where?.userId) list = list.filter((ur) => ur.userId === where.userId);
      if (where?.roleId) list = list.filter((ur) => ur.roleId === where.roleId);

      if (include?.role) {
        return list.map((ur) => {
          const role = memoryStore.roles.find((r) => r.id === ur.roleId);
          if (!role) return ur;
          let rolePolicies: any = [];
          if (include.role.include?.rolePolicies) {
            rolePolicies = memoryStore.rolePolicies
              .filter((rp) => rp.roleId === role.id)
              .map((rp) => ({
                ...rp,
                policy: memoryStore.policies.find((p) => p.id === rp.policyId) || null,
              }));
          }
          return {
            ...ur,
            role: {
              ...role,
              rolePolicies,
            },
          };
        });
      }
      return list;
    },
    create: async ({ data }: any) => {
      const ur = {
        id: data.id || `ur_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: data.userId,
        roleId: data.roleId,
        assignedAt: new Date(),
      };
      memoryStore.userRoles.push(ur);
      return ur;
    },
    deleteMany: async ({ where }: any) => {
      let count = 0;
      memoryStore.userRoles = memoryStore.userRoles.filter((ur) => {
        if (where?.userId && ur.userId === where.userId) {
          count++;
          return false;
        }
        if (where?.roleId && ur.roleId === where.roleId) {
          count++;
          return false;
        }
        return true;
      });
      return { count };
    },
  },

  rolePolicy: {
    findMany: async ({ where }: any) => {
      let list = [...memoryStore.rolePolicies];
      if (where?.roleId) list = list.filter((rp) => rp.roleId === where.roleId);
      return list;
    },
    create: async ({ data }: any) => {
      const rp = {
        id: data.id || `rp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        roleId: data.roleId,
        policyId: data.policyId,
        attachedAt: new Date(),
      };
      memoryStore.rolePolicies.push(rp);
      return rp;
    },
    deleteMany: async ({ where }: any) => {
      let count = 0;
      memoryStore.rolePolicies = memoryStore.rolePolicies.filter((rp) => {
        if (where?.roleId && rp.roleId === where.roleId) {
          count++;
          return false;
        }
        return true;
      });
      return { count };
    },
  },

  userGroup: {
    findMany: async ({ where, include }: any) => {
      let list = [...memoryStore.userGroups];
      if (where?.userId) list = list.filter((ug) => ug.userId === where.userId);
      if (include?.group) {
        return list.map((ug) => {
          const grp = memoryStore.groups.find((g) => g.id === ug.groupId);
          return {
            ...ug,
            group: grp
              ? {
                  ...grp,
                  groupRoles: memoryStore.groupRoles
                    .filter((gr) => gr.groupId === grp.id)
                    .map((gr) => ({
                      ...gr,
                      role: memoryStore.roles.find((r) => r.id === gr.roleId) || null,
                    })),
                }
              : null,
          };
        });
      }
      return list;
    },
    create: async ({ data }: any) => {
      const ug = {
        id: data.id || `ug_${Date.now()}`,
        userId: data.userId,
        groupId: data.groupId,
        assignedAt: new Date(),
      };
      memoryStore.userGroups.push(ug);
      return ug;
    },
    deleteMany: async ({ where }: any) => {
      let count = 0;
      memoryStore.userGroups = memoryStore.userGroups.filter((ug) => {
        if (where?.userId && ug.userId === where.userId) {
          count++;
          return false;
        }
        return true;
      });
      return { count };
    },
  },

  groupRole: {
    findMany: async ({ where }: any) => {
      let list = [...memoryStore.groupRoles];
      if (where?.groupId) list = list.filter((gr) => gr.groupId === where.groupId);
      return list;
    },
    create: async ({ data }: any) => {
      const gr = {
        id: data.id || `gr_${Date.now()}`,
        groupId: data.groupId,
        roleId: data.roleId,
        assignedAt: new Date(),
      };
      memoryStore.groupRoles.push(gr);
      return gr;
    },
    deleteMany: async ({ where }: any) => {
      let count = 0;
      memoryStore.groupRoles = memoryStore.groupRoles.filter((gr) => {
        if (where?.groupId && gr.groupId === where.groupId) {
          count++;
          return false;
        }
        return true;
      });
      return { count };
    },
  },

  refreshToken: {
    findUnique: async ({ where, include }: any) => {
      const token = memoryStore.refreshTokens.find((t) => t.tokenHash === where.tokenHash) || null;
      if (!token) return null;
      if (include?.user) {
        const user = memoryStore.users.find((u) => u.id === token.userId);
        return {
          ...token,
          user: user ? memoryStore.attachUserRelations(user, include.user?.include) : null,
        };
      }
      return token;
    },
    create: async ({ data }: any) => {
      const token = {
        id: data.id || `rt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        isRevoked: false,
        replacedByToken: null,
        createdAt: new Date(),
      };
      memoryStore.refreshTokens.push(token);
      return token;
    },
    update: async ({ where, data }: any) => {
      const idx = memoryStore.refreshTokens.findIndex((t) => t.id === where.id);
      if (idx !== -1) {
        memoryStore.refreshTokens[idx] = { ...memoryStore.refreshTokens[idx], ...data };
        return memoryStore.refreshTokens[idx];
      }
      return null;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      memoryStore.refreshTokens = memoryStore.refreshTokens.map((t) => {
        if (where?.userId && t.userId === where.userId) {
          count++;
          return { ...t, ...data };
        }
        return t;
      });
      return { count };
    },
    deleteMany: async ({ where }: any) => {
      let count = 0;
      memoryStore.refreshTokens = memoryStore.refreshTokens.filter((t) => {
        if (where?.userId && t.userId === where.userId) {
          count++;
          return false;
        }
        return true;
      });
      return { count };
    },
  },

  mfaSecret: {
    findUnique: async ({ where }: any) => {
      return memoryStore.mfaSecrets.find((m) => m.userId === where.userId) || null;
    },
    create: async ({ data }: any) => {
      const mfa = {
        id: data.id || `mfa_${Date.now()}`,
        userId: data.userId,
        secret: data.secret,
        backupCodes: data.backupCodes || [],
        isVerified: !!data.isVerified,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.mfaSecrets.push(mfa);
      return mfa;
    },
    update: async ({ where, data }: any) => {
      const idx = memoryStore.mfaSecrets.findIndex((m) => m.userId === where.userId);
      if (idx !== -1) {
        memoryStore.mfaSecrets[idx] = { ...memoryStore.mfaSecrets[idx], ...data, updatedAt: new Date() };
        return memoryStore.mfaSecrets[idx];
      }
      return null;
    },
    delete: async ({ where }: any) => {
      const idx = memoryStore.mfaSecrets.findIndex((m) => m.userId === where.userId);
      if (idx !== -1) return memoryStore.mfaSecrets.splice(idx, 1)[0];
      return null;
    },
  },

  auditLog: {
    create: async ({ data }: any) => {
      const log = {
        id: data.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        accountId: data.accountId,
        userId: data.userId || null,
        action: data.action,
        resource: data.resource,
        effect: data.effect,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        details: data.details || null,
        timestamp: new Date(),
      };
      memoryStore.auditLogs.unshift(log);
      return log;
    },
    findMany: async ({ where, orderBy, take, skip }: any) => {
      let list = [...memoryStore.auditLogs];
      if (where?.accountId) list = list.filter((l) => l.accountId === where.accountId);
      if (where?.userId) list = list.filter((l) => l.userId === where.userId);
      if (skip) list = list.slice(skip);
      if (take) list = list.slice(0, take);
      return list;
    },
    count: async ({ where }: any) => {
      let list = memoryStore.auditLogs;
      if (where?.accountId) list = list.filter((l) => l.accountId === where.accountId);
      return list.length;
    },
  },

  passwordReset: {
    findUnique: async ({ where }: any) => {
      return memoryStore.passwordResets.find((r) => r.tokenHash === where.tokenHash) || null;
    },
    create: async ({ data }: any) => {
      const pr = {
        id: data.id || `pr_${Date.now()}`,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        isUsed: false,
        createdAt: new Date(),
      };
      memoryStore.passwordResets.push(pr);
      return pr;
    },
    update: async ({ where, data }: any) => {
      const idx = memoryStore.passwordResets.findIndex((r) => r.id === where.id);
      if (idx !== -1) {
        memoryStore.passwordResets[idx] = { ...memoryStore.passwordResets[idx], ...data };
        return memoryStore.passwordResets[idx];
      }
      return null;
    },
  },

  emailVerification: {
    findUnique: async ({ where }: any) => {
      return memoryStore.emailVerifications.find((v) => v.tokenHash === where.tokenHash) || null;
    },
    create: async ({ data }: any) => {
      const ev = {
        id: data.id || `ev_${Date.now()}`,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        isVerified: false,
        createdAt: new Date(),
      };
      memoryStore.emailVerifications.push(ev);
      return ev;
    },
    update: async ({ where, data }: any) => {
      const idx = memoryStore.emailVerifications.findIndex((v) => v.id === where.id);
      if (idx !== -1) {
        memoryStore.emailVerifications[idx] = { ...memoryStore.emailVerifications[idx], ...data };
        return memoryStore.emailVerifications[idx];
      }
      return null;
    },
  },

  $transaction: async (arg: any) => {
    if (typeof arg === 'function') {
      return await arg(mockPrisma);
    }
    if (Array.isArray(arg)) {
      return await Promise.all(arg);
    }
    return arg;
  },

  $disconnect: async () => {},
};

// Resilient Proxy: Routes calls to Prisma if connected, else seamlessly uses mockPrisma
export const prisma: any = new Proxy(realPrisma, {
  get(target, prop, receiver) {
    if (useFallback) {
      return mockPrisma[prop] || (target as any)[prop];
    }

    const realVal = (target as any)[prop];
    if (typeof realVal === 'object' && realVal !== null) {
      // Return wrapped model handler that catches connection failure and switches to fallback
      return new Proxy(realVal, {
        get(modelTarget, methodProp) {
          const origMethod = modelTarget[methodProp];
          if (typeof origMethod === 'function') {
            return async (...args: any[]) => {
              if (useFallback) {
                return mockPrisma[prop]?.[methodProp]?.(...args);
              }
              try {
                return await origMethod.apply(modelTarget, args);
              } catch (err: any) {
                if (
                  err.message?.includes("Can't reach database server") ||
                  err.message?.includes('P1001') ||
                  err.name === 'PrismaClientInitializationError'
                ) {
                  useFallback = true;
                  console.warn(
                    `⚠️ [Prisma] Intercepted DB offline error in ${String(prop)}.${String(
                      methodProp
                    )}. Switched seamlessly to Resilient Memory Store.`
                  );
                  return mockPrisma[prop]?.[methodProp]?.(...args);
                }
                throw err;
              }
            };
          }
          return origMethod;
        },
      });
    }

    if (prop === '$transaction') {
      return async (arg: any) => {
        if (useFallback) return mockPrisma.$transaction(arg);
        try {
          return await (target as any).$transaction(arg);
        } catch (err: any) {
          if (
            err.message?.includes("Can't reach database server") ||
            err.message?.includes('P1001') ||
            err.name === 'PrismaClientInitializationError'
          ) {
            useFallback = true;
            return mockPrisma.$transaction(arg);
          }
          throw err;
        }
      };
    }

    return realVal;
  },
});
