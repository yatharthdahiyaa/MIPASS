/**
 * Demo authentication is explicit and environment-gated.
 * It is available in development by default, and must be opted into in
 * production with NEXT_PUBLIC_DEMO_AUTH=true. When disabled, the IAM backend
 * is the only authentication authority.
 */
const explicitDemoFlag = process.env.NEXT_PUBLIC_DEMO_AUTH;

export const DEMO_AUTH_ENABLED =
  explicitDemoFlag === 'true' ||
  (explicitDemoFlag !== 'false' && process.env.NODE_ENV !== 'production');
