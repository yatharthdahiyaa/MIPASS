import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/iam_rbac?schema=public'),
  JWT_ACCESS_SECRET: z.string().min(16).default('super-secret-access-token-key-change-in-production-min-32-chars'),
  JWT_REFRESH_SECRET: z.string().min(16).default('super-secret-refresh-token-key-change-in-production-min-32-chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  MAX_FAILED_LOGIN_ATTEMPTS: z.string().default('5').transform((v) => parseInt(v, 10)),
  ACCOUNT_LOCKOUT_DURATION_MINUTES: z.string().default('15').transform((v) => parseInt(v, 10)),
  COOKIE_SECURE: z.string().default('false').transform((v) => v === 'true'),
  MFA_APP_NAME: z.string().default('AWS Console IAM'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
