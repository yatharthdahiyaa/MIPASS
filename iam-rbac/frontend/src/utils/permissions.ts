import { UserProfile } from '../types/auth';

export function matchPattern(pattern: string, target: string): boolean {
  if (pattern === '*' || pattern === target) return true;

  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(target);
}

export function hasPermission(
  user: UserProfile | null,
  action: string,
  resource: string = '*'
): boolean {
  if (!user) return false;

  // Root user bypasses all checks
  if (user.isRoot || user.roles.includes('Root')) {
    return true;
  }

  const policies = user.policies || [];
  let hasExplicitAllow = false;

  for (const policy of policies) {
    if (!policy.Statement || !Array.isArray(policy.Statement)) continue;

    for (const statement of policy.Statement) {
      const actionMatches = statement.Action?.some((act: string) =>
        matchPattern(act, action)
      );
      const resourceMatches = statement.Resource?.some((res: string) =>
        matchPattern(res, resource)
      );

      if (actionMatches && resourceMatches) {
        // Explicit Deny takes absolute precedence
        if (statement.Effect === 'Deny') {
          return false;
        }

        if (statement.Effect === 'Allow') {
          hasExplicitAllow = true;
        }
      }
    }
  }

  // Also check user's flattened permissions list if policies not expanded
  if (!hasExplicitAllow && user.permissions) {
    hasExplicitAllow = user.permissions.some((p) => matchPattern(p, action));
  }

  return hasExplicitAllow;
}

export function hasRole(user: UserProfile | null, roles: string | string[]): boolean {
  if (!user) return false;
  if (user.isRoot) return true;

  const roleList = Array.isArray(roles) ? roles : [roles];
  return roleList.some((r) => user.roles.includes(r));
}
