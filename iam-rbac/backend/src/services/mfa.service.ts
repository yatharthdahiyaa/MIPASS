import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import crypto from 'crypto';
import { env } from '../config/env';
import { hashToken } from '../utils/jwt';

export interface GeneratedMfaSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[]; // Plaintext backup codes to show user once
  hashedBackupCodes: string[]; // Hashed codes to store in DB
}

export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

export async function generateMfaSetup(email: string, appName: string = env.MFA_APP_NAME): Promise<GeneratedMfaSetup> {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, appName, secret);
  const qrCodeUrl = await qrcode.toDataURL(otpauth);

  // Generate 8 random one-time backup codes
  const backupCodes: string[] = [];
  const hashedBackupCodes: string[] = [];

  for (let i = 0; i < 8; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    backupCodes.push(formatted);
    hashedBackupCodes.push(hashToken(formatted));
  }

  return {
    secret,
    qrCodeUrl,
    backupCodes,
    hashedBackupCodes,
  };
}

export function verifyTotpToken(token: string, secret: string): boolean {
  return authenticator.check(token, secret);
}

export function verifyAndConsumeBackupCode(
  providedCode: string,
  storedHashedCodes: string[]
): { isValid: boolean; remainingHashedCodes: string[] } {
  const normalized = providedCode.trim().toUpperCase();
  const hashedAttempt = hashToken(normalized);

  const matchIndex = storedHashedCodes.indexOf(hashedAttempt);
  if (matchIndex === -1) {
    return { isValid: false, remainingHashedCodes: storedHashedCodes };
  }

  const remainingHashedCodes = storedHashedCodes.filter((_, idx) => idx !== matchIndex);
  return { isValid: true, remainingHashedCodes };
}
