import { evaluatePermission, matchPattern } from '../src/utils/policyEvaluator';
import { PolicyDocument } from '../src/types';

describe('AWS IAM Policy Evaluator Engine', () => {
  describe('Pattern Matching', () => {
    it('matches exact strings', () => {
      expect(matchPattern('users:read', 'users:read')).toBe(true);
      expect(matchPattern('users:read', 'users:write')).toBe(false);
    });

    it('matches wildcard * to everything', () => {
      expect(matchPattern('*', 'users:create')).toBe(true);
      expect(matchPattern('*', 'billing:modify')).toBe(true);
      expect(matchPattern('*', 'arn:aws:iam::123:user/alice')).toBe(true);
    });

    it('matches prefix wildcard e.g. users:*', () => {
      expect(matchPattern('users:*', 'users:create')).toBe(true);
      expect(matchPattern('users:*', 'users:delete')).toBe(true);
      expect(matchPattern('users:*', 'billing:read')).toBe(false);
    });

    it('matches suffix wildcard e.g. *:read', () => {
      expect(matchPattern('*:read', 'users:read')).toBe(true);
      expect(matchPattern('*:read', 'billing:read')).toBe(true);
      expect(matchPattern('*:read', 'users:write')).toBe(false);
    });
  });

  describe('Evaluation Rules: Explicit Deny > Explicit Allow > Default Deny', () => {
    it('rule 1: default deny when no matching statements exist', () => {
      const policies: PolicyDocument[] = [
        {
          Statement: [
            {
              Effect: 'Allow',
              Action: ['users:read'],
              Resource: ['*'],
            },
          ],
        },
      ];

      // Requesting an action not in allow list
      const isAllowed = evaluatePermission(policies, 'billing:read', '*');
      expect(isAllowed).toBe(false);
    });

    it('rule 2: explicit allow permits action when no deny applies', () => {
      const policies: PolicyDocument[] = [
        {
          Statement: [
            {
              Effect: 'Allow',
              Action: ['users:*', 'compute:start'],
              Resource: ['*'],
            },
          ],
        },
      ];

      expect(evaluatePermission(policies, 'users:create', '*')).toBe(true);
      expect(evaluatePermission(policies, 'users:read', '*')).toBe(true);
      expect(evaluatePermission(policies, 'compute:start', '*')).toBe(true);
    });

    it('rule 3: explicit Deny in any statement overrides any Allow', () => {
      const policies: PolicyDocument[] = [
        {
          Statement: [
            // Broad allow
            {
              Effect: 'Allow',
              Action: ['*'],
              Resource: ['*'],
            },
            // Specific deny
            {
              Effect: 'Deny',
              Action: ['billing:*'],
              Resource: ['*'],
            },
          ],
        },
      ];

      // General action is allowed
      expect(evaluatePermission(policies, 'users:create', '*')).toBe(true);
      // Denied action is blocked even though Allow: ['*'] exists!
      expect(evaluatePermission(policies, 'billing:read', '*')).toBe(false);
      expect(evaluatePermission(policies, 'billing:pay', '*')).toBe(false);
    });

    it('rule 4: explicit Deny in a separate policy document still overrides Allow in another', () => {
      const policyA: PolicyDocument = {
        Statement: [
          {
            Effect: 'Allow',
            Action: ['users:*'],
            Resource: ['*'],
          },
        ],
      };

      const policyB: PolicyDocument = {
        Statement: [
          {
            Effect: 'Deny',
            Action: ['users:delete'],
            Resource: ['*'],
          },
        ],
      };

      const policies = [policyA, policyB];

      expect(evaluatePermission(policies, 'users:read', '*')).toBe(true);
      expect(evaluatePermission(policies, 'users:create', '*')).toBe(true);
      expect(evaluatePermission(policies, 'users:delete', '*')).toBe(false);
    });

    it('handles resource constraints properly', () => {
      const policies: PolicyDocument[] = [
        {
          Statement: [
            {
              Effect: 'Allow',
              Action: ['storage:read'],
              Resource: ['bucket:public-assets'],
            },
          ],
        },
      ];

      expect(evaluatePermission(policies, 'storage:read', 'bucket:public-assets')).toBe(true);
      expect(evaluatePermission(policies, 'storage:read', 'bucket:secret-keys')).toBe(false);
    });
  });
});
