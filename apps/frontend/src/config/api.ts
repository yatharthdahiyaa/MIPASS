/**
 * Backend endpoints, defined once.
 *
 * Browser calls try the direct origin first and fall back to the Next.js
 * rewrites in next.config.ts (same env vars), so the two must stay in sync.
 */
export const API_PREFIX = '/api/v1';

/** Flask API (apps/backend). */
export const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:8080';

/** IAM-RBAC Node service (apps/iam-rbac/backend). */
export const IAM_ORIGIN = process.env.NEXT_PUBLIC_IAM_ORIGIN ?? 'http://localhost:5000';

export const BACKEND_API_URL = `${BACKEND_ORIGIN}${API_PREFIX}`;
