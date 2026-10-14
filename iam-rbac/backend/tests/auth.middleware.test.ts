import { validatePasswordRules } from '../src/utils/password';
import { verifyAndConsumeBackupCode } from '../src/services/mfa.service';
import { hashToken, signAccessToken, verifyAccessToken } from '../src/utils/jwt';

describe('Auth & Password Security Unit Tests', () => {
  describe('Password Complexity Validator (min 12 chars, upper, lower, number, symbol)', () => {
    it('rejects short passwords under 12 characters', () => {
      const result = validatePasswordRules('Short1!Aa');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long');
    });

    it('rejects passwords without numbers', () => {
      const result = validatePasswordRules('PasswordWithoutNumber!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('rejects passwords without symbols', () => {
      const result = validatePasswordRules('Password123456789');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one symbol (!@#$%^&*...)');
    });

    it('accepts compliant passwords meeting all AWS IAM criteria', () => {
      const result = validatePasswordRules('SecureAdmin@2026!');
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.label).toBe('Very Strong');
    });
  });

  describe('JWT Token Signing and Verification', () => {
    it('signs and verifies valid access tokens with 15m expiration', () => {
      const payload = {
        userId: 'usr_123',
        accountId: 'acc_456',
        username: 'alice',
        email: 'alice@example.com',
        isRoot: false,
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
      expect(decoded.type).toBe('access');
    });

    it('throws error for tampered tokens', () => {
      const token = signAccessToken({
        userId: 'usr_123',
        accountId: 'acc_456',
        username: 'alice',
        email: 'alice@example.com',
        isRoot: false,
      });

      const tampered = token + 'tampered';
      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });

  describe('MFA Backup Code Verification and One-Time Consumption', () => {
    it('validates a correct backup code and removes it from remaining list', () => {
      const rawCode = 'A1B2-C3D4';
      const storedHashed = [hashToken('A1B2-C3D4'), hashToken('E5F6-G7H8')];

      const result = verifyAndConsumeBackupCode(rawCode, storedHashed);
      expect(result.isValid).toBe(true);
      expect(result.remainingHashedCodes.length).toBe(1);
      expect(result.remainingHashedCodes).not.toContain(hashToken(rawCode));
    });

    it('rejects an invalid backup code without consuming any', () => {
      const storedHashed = [hashToken('A1B2-C3D4')];
      const result = verifyAndConsumeBackupCode('WRONG-CODE', storedHashed);

      expect(result.isValid).toBe(false);
      expect(result.remainingHashedCodes.length).toBe(1);
    });
  });
});
