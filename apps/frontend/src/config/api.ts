/**
 * Backend endpoints, defined once.
 *
 * Browser code should call `${API_PREFIX}/...` (same origin, proxied by the
 * rewrite in next.config.ts) so the session cookie is first-party.
 * BACKEND_ORIGIN is for server-side calls (route handlers) only.
 */
export const API_PREFIX = '/api/v1';

/** Flask API (apps/backend). */
export const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://127.0.0.1:8080';

export const BACKEND_API_URL = `${BACKEND_ORIGIN}${API_PREFIX}`;
