import { PolicyDocument, PolicyStatement } from '../types';

/**
 * Checks if a glob-like pattern (e.g. 'users:*', '*', '*:read') matches a target string.
 */
export function matchPattern(pattern: string, target: string): boolean {
  if (pattern === '*' || pattern === target) {
    return true;
  }

  // Escape special regex characters except '*'
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(target);
}

/**
 * Evaluates whether a requested action on a given resource is authorized by an array of IAM policies.
 * 
 * AWS IAM Evaluation Rules:
 * 1. By default, all requests are implicitly denied (Default Deny).
 * 2. An explicit Deny in ANY policy statement overrides ANY Allow (Explicit Deny > Explicit Allow).
 * 3. If no explicit Deny applies and at least one explicit Allow matches, the request is allowed.
 */
export function evaluatePermission(
  policies: PolicyDocument[],
  requestedAction: string,
  requestedResource: string = '*'
): boolean {
  let hasExplicitAllow = false;

  for (const policy of policies) {
    if (!policy.Statement || !Array.isArray(policy.Statement)) {
      continue;
    }

    for (const statement of policy.Statement) {
      const actionMatches = statement.Action.some((actionPattern) =>
        matchPattern(actionPattern, requestedAction)
      );

      const resourceMatches = statement.Resource.some((resourcePattern) =>
        matchPattern(resourcePattern, requestedResource)
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

  return hasExplicitAllow;
}

/**
 * Flattens all statements from an array of policies into allowed and denied actions.
 */
export function extractActionsSummary(policies: PolicyDocument[]): {
  allowed: string[];
  denied: string[];
} {
  const allowed = new Set<string>();
  const denied = new Set<string>();

  for (const policy of policies) {
    if (!policy.Statement) continue;
    for (const statement of policy.Statement) {
      if (statement.Effect === 'Allow') {
        statement.Action.forEach((a) => allowed.add(a));
      } else if (statement.Effect === 'Deny') {
        statement.Action.forEach((a) => denied.add(a));
      }
    }
  }

  return {
    allowed: Array.from(allowed),
    denied: Array.from(denied),
  };
}
