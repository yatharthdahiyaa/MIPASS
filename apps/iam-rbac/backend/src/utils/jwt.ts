import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Response, CookieOptions } from 'express';
import { env } from '../config/env';
import { TokenPayload } from '../types';

export const ACCESS_TOKEN_COOKIE_NAME = 'aws_iam_access_token';
export const REFRESH_TOKEN_COOKIE_NAME = 'aws_iam_refresh_token';

export function signAccessToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any }
  );
}

export function signMfaPendingToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'mfa_pending' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '5m' }
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function generateRefreshTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string,
  rememberDevice: boolean = false
) {
  // Access token cookie: 15 minutes
  res.cookie(
    ACCESS_TOKEN_COOKIE_NAME,
    accessToken,
    getCookieOptions(15 * 60 * 1000)
  );

  // Refresh token cookie: 7 days or session
  if (refreshToken) {
    const refreshMaxAge = rememberDevice
      ? 30 * 24 * 60 * 60 * 1000 // 30 days if remembered
      : 7 * 24 * 60 * 60 * 1000;  // 7 days default

    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      getCookieOptions(refreshMaxAge)
    );
  }
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, { path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' });
}
