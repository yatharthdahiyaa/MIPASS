import { prisma } from '../config/prisma';
import { PolicyDocument } from '../types';
import { extractActionsSummary } from '../utils/policyEvaluator';

export interface UserResolvedRbac {
  roles: string[];
  policies: PolicyDocument[];
  permissions: string[];
  deniedPermissions: string[];
}

export async function getUserResolvedRbac(userId: string, isRoot: boolean = false): Promise<UserResolvedRbac> {
  // If user is root, they automatically have unconstrained superuser policy
  if (isRoot) {
    const rootPolicy: PolicyDocument = {
      Version: '2026-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['*'],
          Resource: ['*'],
        },
      ],
    };

    return {
      roles: ['Root'],
      policies: [rootPolicy],
      permissions: ['*'],
      deniedPermissions: [],
    };
  }

  // 1. Fetch direct user roles
  const directUserRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePolicies: {
            include: {
              policy: true,
            },
          },
        },
      },
    },
  });

  // 2. Fetch group roles inherited via user's groups
  const userGroups = await prisma.userGroup.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          groupRoles: {
            include: {
              role: {
                include: {
                  rolePolicies: {
                    include: {
                      policy: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const rolesSet = new Set<string>();
  const policiesMap = new Map<string, PolicyDocument>();

  // Process direct roles
  for (const ur of directUserRoles) {
    rolesSet.add(ur.role.name);
    for (const rp of ur.role.rolePolicies) {
      if (rp.policy.document) {
        policiesMap.set(rp.policy.id, rp.policy.document as unknown as PolicyDocument);
      }
    }
  }

  // Process inherited group roles
  for (const ug of userGroups) {
    for (const gr of ug.group.groupRoles) {
      rolesSet.add(gr.role.name);
      for (const rp of gr.role.rolePolicies) {
        if (rp.policy.document) {
          policiesMap.set(rp.policy.id, rp.policy.document as unknown as PolicyDocument);
        }
      }
    }
  }

  const policies = Array.from(policiesMap.values());
  const summary = extractActionsSummary(policies);

  return {
    roles: Array.from(rolesSet),
    policies,
    permissions: summary.allowed,
    deniedPermissions: summary.denied,
  };
}
