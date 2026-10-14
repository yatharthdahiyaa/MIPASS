import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import {
  hashPassword,
  verifyPassword,
  validatePasswordRules,
} from '../utils/password';
import {
  signAccessToken,
  verifyAccessToken,
  signMfaPendingToken,
  generateRefreshTokenString,
  hashToken,
  setAuthCookies,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../utils/jwt';
import {
  generateMfaSetup,
  verifyTotpToken,
  verifyAndConsumeBackupCode,
} from '../services/mfa.service';
import { getUserResolvedRbac } from '../services/rbac.service';
import { recordAuditLog } from '../services/audit.service';
import { AuthenticatedRequest } from '../types';

// ==========================================
// 1. SIGN-UP (Create Account + Root User)
// ==========================================
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  confirmPassword: z.string(),
  accountName: z.string().min(2, 'Account name must be at least 2 characters'),
  accountAlias: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export async function signup(req: Request, res: Response): Promise<void> {
  const { email, password, accountName, accountAlias } = req.body;

  // Validate strict password complexity rules
  const passwordValidation = validatePasswordRules(password);
  if (!passwordValidation.isValid) {
    res.status(400).json({
      success: false,
      error: 'WeakPassword',
      message: 'Password does not meet AWS IAM complexity requirements.',
      errors: passwordValidation.errors,
    });
    return;
  }

  // Check if alias already taken
  if (accountAlias) {
    const existingAlias = await prisma.account.findUnique({
      where: { accountAlias },
    });
    if (existingAlias) {
      res.status(400).json({
        success: false,
        error: 'AliasUnavailable',
        message: 'Account alias is already in use. Please select a different alias.',
      });
      return;
    }
  }

  // Generate random 12-digit AWS Account ID
  const randomAccountId = Math.floor(100000000000 + Math.random() * 900000000000).toString();

  // Create Account, Root User, Default Roles & Policies in transaction
  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Account
    const account = await tx.account.create({
      data: {
        id: randomAccountId,
        name: accountName,
        accountAlias: accountAlias || null,
      },
    });

    // 2. Create Root User
    const rootUser = await tx.user.create({
      data: {
        accountId: account.id,
        username: 'root',
        email,
        passwordHash,
        isRoot: true,
        isMfaEnabled: false,
      },
    });

    await tx.account.update({
      where: { id: account.id },
      data: { rootUserId: rootUser.id },
    });

    // 3. Create Root Role & Administrator Policy
    const adminPolicy = await tx.policy.create({
      data: {
        accountId: account.id,
        name: 'AdministratorAccess',
        description: 'Provides full superuser access to AWS services and resources.',
        isSystem: true,
        document: {
          Version: '2026-10-17',
          Statement: [{ Effect: 'Allow', Action: ['*'], Resource: ['*'] }],
        },
      },
    });

    const rootRole = await tx.role.create({
      data: {
        accountId: account.id,
        name: 'Root',
        description: 'Account Owner superuser role.',
        isSystem: true,
      },
    });

    await tx.rolePolicy.create({
      data: {
        roleId: rootRole.id,
        policyId: adminPolicy.id,
      },
    });

    await tx.userRole.create({
      data: {
        userId: rootUser.id,
        roleId: rootRole.id,
      },
    });

    // 4. Create Email Verification token
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = hashToken(rawVerificationToken);

    await tx.emailVerification.create({
      data: {
        userId: rootUser.id,
        tokenHash: verificationTokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        isVerified: false,
      },
    });

    return {
      account,
      rootUser,
      verificationToken: rawVerificationToken,
    };
  });

  // Record audit log
  await recordAuditLog({
    accountId: result.account.id,
    userId: result.rootUser.id,
    action: 'auth:signup_root_account',
    resource: `account:${result.account.id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { email, accountName, accountId: result.account.id },
  });

  res.status(201).json({
    success: true,
    message: 'Account created successfully. Please verify your email before logging in.',
    data: {
      accountId: result.account.id,
      accountAlias: result.account.accountAlias,
      email: result.rootUser.email,
      username: result.rootUser.username,
      verificationToken: result.verificationToken, // Returned for testing / development link
    },
  });
}

// ==========================================
// 2. VERIFY EMAIL
// ==========================================
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.body;

  if (!token) {
    res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Verification token is required.',
    });
    return;
  }

  const tokenHash = hashToken(token);

  const verification = await prisma.emailVerification.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!verification || verification.expiresAt < new Date()) {
    res.status(400).json({
      success: false,
      error: 'InvalidToken',
      message: 'Verification token is invalid or has expired.',
    });
    return;
  }

  await prisma.emailVerification.update({
    where: { id: verification.id },
    data: { isVerified: true },
  });

  await recordAuditLog({
    accountId: verification.user.accountId,
    userId: verification.user.id,
    action: 'auth:email_verified',
    resource: `user:${verification.user.id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    message: 'Email address verified successfully. You may now sign in.',
  });
}

// ==========================================
// 3. SIGN-IN STEP 1 (Identifier validation)
// ==========================================
export const signinStep1Schema = z.object({
  userType: z.enum(['root', 'iam']),
  email: z.string().email().optional(),
  accountIdOrAlias: z.string().optional(),
  username: z.string().optional(),
});

export async function signinStep1(req: Request, res: Response): Promise<void> {
  const { userType, email, accountIdOrAlias, username } = req.body;

  if (userType === 'root') {
    if (!email) {
      res.status(400).json({ success: false, message: 'Root user email is required.' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { email, isRoot: true },
      include: { account: true },
    });

    // Check account lockout
    if (user && user.lockUntil && user.lockUntil > new Date()) {
      const remainingMin = Math.ceil((user.lockUntil.getTime() - Date.now()) / (1000 * 60));
      res.status(423).json({
        success: false,
        error: 'AccountLocked',
        message: `Account is temporarily locked. Please try again in ${remainingMin} minute(s).`,
      });
      return;
    }

    // Always return clean response without disclosing whether account exists
    res.json({
      success: true,
      data: {
        userType: 'root',
        identifier: email,
        accountName: user?.account.name || 'AWS Console',
        requiresMfa: user?.isMfaEnabled || false,
      },
    });
    return;
  }

  if (userType === 'iam') {
    if (!accountIdOrAlias || !username) {
      res.status(400).json({
        success: false,
        message: 'Account ID/Alias and IAM username are required.',
      });
      return;
    }

    const account = await prisma.account.findFirst({
      where: {
        OR: [{ id: accountIdOrAlias }, { accountAlias: accountIdOrAlias }],
      },
    });

    const user = account
      ? await prisma.user.findUnique({
          where: {
            accountId_username: {
              accountId: account.id,
              username,
            },
          },
        })
      : null;

    if (user && user.lockUntil && user.lockUntil > new Date()) {
      const remainingMin = Math.ceil((user.lockUntil.getTime() - Date.now()) / (1000 * 60));
      res.status(423).json({
        success: false,
        error: 'AccountLocked',
        message: `Account is temporarily locked. Please try again in ${remainingMin} minute(s).`,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        userType: 'iam',
        identifier: username,
        accountId: account?.id || accountIdOrAlias,
        accountAlias: account?.accountAlias,
        accountName: account?.name || 'AWS Console',
        requiresMfa: user?.isMfaEnabled || false,
      },
    });
    return;
  }

  res.status(400).json({ success: false, message: 'Invalid user type' });
}

// ==========================================
// 4. SIGN-IN STEP 2 (Password validation)
// ==========================================
export const signinStep2Schema = z.object({
  userType: z.enum(['root', 'iam']),
  email: z.string().optional(),
  accountIdOrAlias: z.string().optional(),
  username: z.string().optional(),
  password: z.string(),
  rememberDevice: z.boolean().optional(),
});

export async function signinStep2(req: Request, res: Response): Promise<void> {
  const { userType, email, accountIdOrAlias, username, password, rememberDevice } = req.body;

  let user: any = null;

  if (userType === 'root') {
    user = await prisma.user.findFirst({
      where: { email, isRoot: true },
      include: { account: true },
    });
  } else if (userType === 'iam') {
    const account = await prisma.account.findFirst({
      where: {
        OR: [{ id: accountIdOrAlias }, { accountAlias: accountIdOrAlias }],
      },
    });

    if (account && username) {
      user = await prisma.user.findUnique({
        where: {
          accountId_username: {
            accountId: account.id,
            username,
          },
        },
        include: { account: true },
      });
    }
  }

  // Generic credential error helper
  const handleFailedAttempt = async (targetUser?: any) => {
    if (targetUser) {
      const newAttempts = targetUser.failedLoginAttempts + 1;
      let lockUntil: Date | null = targetUser.lockUntil;

      if (newAttempts >= env.MAX_FAILED_LOGIN_ATTEMPTS) {
        lockUntil = new Date(Date.now() + env.ACCOUNT_LOCKOUT_DURATION_MINUTES * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockUntil,
        },
      });

      await recordAuditLog({
        accountId: targetUser.accountId,
        userId: targetUser.id,
        action: 'auth:login_failed',
        resource: `user:${targetUser.id}`,
        effect: 'DENY',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { attempts: newAttempts, locked: !!lockUntil },
      });
    }

    res.status(401).json({
      success: false,
      error: 'InvalidCredentials',
      message: 'Incorrect credentials. Please verify your information and try again.',
    });
  };

  if (!user) {
    await handleFailedAttempt();
    return;
  }

  // Check account suspension
  if (user.isSuspended) {
    res.status(403).json({
      success: false,
      error: 'AccountSuspended',
      message: 'This user account has been disabled by an administrator.',
    });
    return;
  }

  // Check account lockout
  if (user.lockUntil && user.lockUntil > new Date()) {
    const remainingMin = Math.ceil((user.lockUntil.getTime() - Date.now()) / (1000 * 60));
    res.status(423).json({
      success: false,
      error: 'AccountLocked',
      message: `Account is temporarily locked due to multiple failed attempts. Try again in ${remainingMin} minute(s).`,
    });
    return;
  }

  // Verify password
  const isMatch = await verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    await handleFailedAttempt(user);
    return;
  }

  // Reset failed login attempts on correct password
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
    },
  });

  // Check if MFA is required
  if (user.isMfaEnabled) {
    const mfaPendingToken = signMfaPendingToken({
      userId: user.id,
      accountId: user.accountId,
      username: user.username,
      email: user.email,
      isRoot: user.isRoot,
    });

    res.json({
      success: true,
      requiresMfa: true,
      mfaSessionToken: mfaPendingToken,
      message: 'Multi-factor authentication required.',
    });
    return;
  }

  // Issue Access & Refresh tokens
  const accessToken = signAccessToken({
    userId: user.id,
    accountId: user.accountId,
    username: user.username,
    email: user.email,
    isRoot: user.isRoot,
  });

  const rawRefreshToken = generateRefreshTokenString();
  const refreshTokenHash = hashToken(rawRefreshToken);

  const refreshExpiresAt = new Date(
    Date.now() + (rememberDevice ? 30 : 7) * 24 * 60 * 60 * 1000
  );

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiresAt,
    },
  });

  setAuthCookies(res, accessToken, rawRefreshToken, rememberDevice);

  // Audit log login success
  await recordAuditLog({
    accountId: user.accountId,
    userId: user.id,
    action: 'auth:login_success',
    resource: `user:${user.id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { userType, isRoot: user.isRoot },
  });

  const rbac = await getUserResolvedRbac(user.id, user.isRoot);

  res.json({
    success: true,
    message: 'Signed in successfully.',
    data: {
      accessToken,
      user: {
        id: user.id,
        accountId: user.accountId,
        accountName: user.account.name,
        accountAlias: user.account.accountAlias,
        username: user.username,
        email: user.email,
        isRoot: user.isRoot,
        roles: rbac.roles,
        permissions: rbac.permissions,
      },
    },
  });
}

// ==========================================
// 5. MFA VERIFY (TOTP or Backup Code)
// ==========================================
export const mfaVerifySchema = z.object({
  mfaSessionToken: z.string(),
  code: z.string().min(6),
  isBackupCode: z.boolean().optional(),
});

export async function mfaVerify(req: Request, res: Response): Promise<void> {
  const { mfaSessionToken, code, isBackupCode } = req.body;

  let decoded: any;
  try {
    decoded = verifyAccessToken(mfaSessionToken);
    if (decoded.type !== 'mfa_pending') {
      throw new Error('Invalid token');
    }
  } catch {
    res.status(401).json({
      success: false,
      error: 'InvalidSession',
      message: 'MFA session has expired. Please sign in again.',
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { mfaSecret: true, account: true },
  });

  if (!user || !user.mfaSecret) {
    res.status(400).json({ success: false, message: 'MFA is not configured for this user.' });
    return;
  }

  let isVerified = false;

  if (isBackupCode) {
    const storedBackupCodes = (user.mfaSecret.backupCodes as string[]) || [];
    const check = verifyAndConsumeBackupCode(code, storedBackupCodes);

    if (check.isValid) {
      isVerified = true;
      // Update consumed codes
      await prisma.mfaSecret.update({
        where: { id: user.mfaSecret.id },
        data: { backupCodes: check.remainingHashedCodes },
      });
    }
  } else {
    isVerified = verifyTotpToken(code, user.mfaSecret.secret);
  }

  if (!isVerified) {
    await recordAuditLog({
      accountId: user.accountId,
      userId: user.id,
      action: 'auth:mfa_failed',
      resource: `user:${user.id}`,
      effect: 'DENY',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { isBackupCode: !!isBackupCode },
    });

    res.status(401).json({
      success: false,
      error: 'InvalidMfaCode',
      message: 'Invalid verification code. Please check your authenticator and try again.',
    });
    return;
  }

  // Issue Access & Refresh tokens
  const accessToken = signAccessToken({
    userId: user.id,
    accountId: user.accountId,
    username: user.username,
    email: user.email,
    isRoot: user.isRoot,
  });

  const rawRefreshToken = generateRefreshTokenString();
  const refreshTokenHash = hashToken(rawRefreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  setAuthCookies(res, accessToken, rawRefreshToken);

  await recordAuditLog({
    accountId: user.accountId,
    userId: user.id,
    action: 'auth:mfa_success',
    resource: `user:${user.id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { usedBackupCode: !!isBackupCode },
  });

  const rbac = await getUserResolvedRbac(user.id, user.isRoot);

  res.json({
    success: true,
    message: 'MFA verified successfully.',
    data: {
      accessToken,
      user: {
        id: user.id,
        accountId: user.accountId,
        accountName: user.account.name,
        accountAlias: user.account.accountAlias,
        username: user.username,
        email: user.email,
        isRoot: user.isRoot,
        roles: rbac.roles,
        permissions: rbac.permissions,
      },
    },
  });
}

// ==========================================
// 6. REFRESH TOKEN (Rotation)
// ==========================================
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;

  if (!rawToken) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Refresh token is missing.',
    });
    return;
  }

  const tokenHash = hashToken(rawToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { account: true } } },
  });

  // Reuse detection: if revoked token used, potential breach!
  if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
    clearAuthCookies(res);
    res.status(401).json({
      success: false,
      error: 'TokenRevoked',
      message: 'Session has expired or token was revoked. Please sign in again.',
    });
    return;
  }

  // Token rotation: Revoke current token and generate new refresh token
  const newRawRefreshToken = generateRefreshTokenString();
  const newRefreshTokenHash = hashToken(newRawRefreshToken);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        isRevoked: true,
        replacedByToken: newRefreshTokenHash,
      },
    }),
    prisma.refreshToken.create({
      data: {
        userId: storedToken.userId,
        tokenHash: newRefreshTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  if (!storedToken.user) {
    clearAuthCookies(res);
    res.status(401).json({
      success: false,
      error: 'UserNotFound',
      message: 'User associated with refresh token could not be found.',
    });
    return;
  }

  const newAccessToken = signAccessToken({
    userId: storedToken.user.id,
    accountId: storedToken.user.accountId,
    username: storedToken.user.username,
    email: storedToken.user.email,
    isRoot: storedToken.user.isRoot,
  });

  setAuthCookies(res, newAccessToken, newRawRefreshToken);

  res.json({
    success: true,
    data: {
      accessToken: newAccessToken,
    },
  });
}

// ==========================================
// 7. LOGOUT
// ==========================================
export async function logout(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    }).catch(() => {});
  }

  clearAuthCookies(res);

  res.json({
    success: true,
    message: 'Signed out successfully.',
  });
}

// ==========================================
// 8. FORGOT PASSWORD & RESET PASSWORD
// ==========================================
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ success: false, message: 'Email address is required.' });
    return;
  }

  const user = await prisma.user.findFirst({ where: { email } });

  let resetToken = '';
  if (user) {
    resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(resetToken);

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    await recordAuditLog({
      accountId: user.accountId,
      userId: user.id,
      action: 'auth:password_reset_requested',
      resource: `user:${user.id}`,
      effect: 'INFO',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // Consistent generic response to prevent user enumeration
  res.json({
    success: true,
    message: 'If an account exists with that email, instructions have been sent.',
    data: resetToken ? { resetToken } : undefined, // Returned for dev testing
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword, confirmPassword } = req.body;

  if (!token || !newPassword) {
    res.status(400).json({ success: false, message: 'Token and new password are required.' });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ success: false, message: 'Passwords do not match.' });
    return;
  }

  const validation = validatePasswordRules(newPassword);
  if (!validation.isValid) {
    res.status(400).json({
      success: false,
      error: 'WeakPassword',
      message: 'New password does not meet complexity requirements.',
      errors: validation.errors,
    });
    return;
  }

  const tokenHash = hashToken(token);

  const resetRecord = await prisma.passwordReset.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetRecord || resetRecord.isUsed || resetRecord.expiresAt < new Date()) {
    res.status(400).json({
      success: false,
      error: 'InvalidToken',
      message: 'Password reset token is invalid or has expired.',
    });
    return;
  }

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: {
        passwordHash: newHash,
        failedLoginAttempts: 0,
        lockUntil: null,
      },
    }),
    prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { isUsed: true },
    }),
    // Invalidate all existing sessions on password change
    prisma.refreshToken.updateMany({
      where: { userId: resetRecord.userId },
      data: { isRevoked: true },
    }),
  ]);

  await recordAuditLog({
    accountId: resetRecord.user.accountId,
    userId: resetRecord.user.id,
    action: 'auth:password_reset_completed',
    resource: `user:${resetRecord.user.id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    message: 'Password reset successfully. You may now sign in with your new password.',
  });
}

// ==========================================
// 9. GET CURRENT USER & RESOLVED PERMISSIONS
// ==========================================
export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;

  const account = await prisma.account.findUnique({
    where: { id: user.accountId },
  });

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        accountId: user.accountId,
        accountName: account?.name || 'AWS Console',
        accountAlias: account?.accountAlias,
        username: user.username,
        email: user.email,
        isRoot: user.isRoot,
        roles: user.roles,
        permissions: user.permissions,
        policies: user.policies,
      },
    },
  });
}

// ==========================================
// 10. SETUP & ENABLE MFA (Authenticated)
// ==========================================
export async function setupMfa(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;

  const mfaSetup = await generateMfaSetup(user.email);

  // Upsert unverified secret into database
  await prisma.mfaSecret.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      secret: mfaSetup.secret,
      backupCodes: mfaSetup.hashedBackupCodes,
      isVerified: false,
    },
    update: {
      secret: mfaSetup.secret,
      backupCodes: mfaSetup.hashedBackupCodes,
      isVerified: false,
    },
  });

  res.json({
    success: true,
    data: {
      secret: mfaSetup.secret,
      qrCodeUrl: mfaSetup.qrCodeUrl,
      backupCodes: mfaSetup.backupCodes, // Plaintext backup codes to show user ONCE
    },
  });
}

export async function enableMfa(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  const { code } = req.body;

  if (!code) {
    res.status(400).json({ success: false, message: 'Verification code is required.' });
    return;
  }

  const mfaSecret = await prisma.mfaSecret.findUnique({
    where: { userId: user.id },
  });

  if (!mfaSecret) {
    res.status(400).json({ success: false, message: 'MFA setup not initialized.' });
    return;
  }

  const isValid = verifyTotpToken(code, mfaSecret.secret);
  if (!isValid) {
    res.status(400).json({
      success: false,
      error: 'InvalidCode',
      message: 'Invalid TOTP code. Please verify the code displayed in your authenticator app.',
    });
    return;
  }

  await prisma.$transaction([
    prisma.mfaSecret.update({
      where: { id: mfaSecret.id },
      data: { isVerified: true },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { isMfaEnabled: true },
    }),
  ]);

  await recordAuditLog({
    accountId: user.accountId,
    userId: user.id,
    action: 'mfa:enabled',
    resource: `user:${user.id}`,
    effect: 'ALLOW',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    message: 'Multi-factor authentication (MFA) enabled successfully.',
  });
}
