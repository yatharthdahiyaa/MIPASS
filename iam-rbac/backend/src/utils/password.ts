import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 to 100
  label: 'Very Weak' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong';
  errors: string[];
  rules: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
}

export function validatePasswordRules(password: string): PasswordValidationResult {
  const minLength = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const errors: string[] = [];
  if (!minLength) errors.push('Password must be at least 12 characters long');
  if (!hasUppercase) errors.push('Password must contain at least one uppercase letter');
  if (!hasLowercase) errors.push('Password must contain at least one lowercase letter');
  if (!hasNumber) errors.push('Password must contain at least one number');
  if (!hasSymbol) errors.push('Password must contain at least one symbol (!@#$%^&*...)');

  let points = 0;
  if (password.length >= 12) points += 25;
  if (password.length >= 16) points += 15;
  if (hasUppercase) points += 15;
  if (hasLowercase) points += 15;
  if (hasNumber) points += 15;
  if (hasSymbol) points += 15;

  const score = Math.min(100, points);

  let label: PasswordValidationResult['label'] = 'Very Weak';
  if (score >= 85) label = 'Very Strong';
  else if (score >= 70) label = 'Strong';
  else if (score >= 50) label = 'Medium';
  else if (score >= 30) label = 'Weak';

  return {
    isValid: errors.length === 0,
    score,
    label,
    errors,
    rules: {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSymbol,
    },
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

