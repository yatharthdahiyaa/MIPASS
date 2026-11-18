import type { NextConfig } from "next";

// Keep in sync with src/config/api.ts. 127.0.0.1 (not localhost) so Node never resolves to ::1,
// where another local service (e.g. a Docker container) may own port 8080.
// For server-side rewrites, use API_ORIGIN (no NEXT_PUBLIC_ prefix). For client-side, use NEXT_PUBLIC_API_ORIGIN.
const BACKEND_ORIGIN = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://127.0.0.1:8080';

// Patient assistant chat service (apps/agents/chat_server.py).
const CHAT_ORIGIN = process.env.MIPAAS_CHAT_ORIGIN ?? 'http://127.0.0.1:8200';

// Portals removed in the auth consolidation; old links land on the account page
// (which sends signed-out visitors to /login). /admin is live again (src/app/admin).
const RETIRED_PORTALS = ['/emr', '/eka', '/openemr'];

// Sent with every page. The API sets its own (app/middleware/security_headers.py).
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the container image (infra/deploy).
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  experimental: {
    // Rewrites give up after 30 s by default; an assistant turn that analyses an X-ray can take minutes.
    proxyTimeout: 600_000,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${BACKEND_ORIGIN}/api/v1/:path*`,
      },
      {
        source: '/api/chat/:path*',
        destination: `${CHAT_ORIGIN}/:path*`,
      },
    ];
  },
  async redirects() {
    return RETIRED_PORTALS.flatMap((source) => [
      { source, destination: '/account', permanent: false },
      { source: `${source}/:path*`, destination: '/account', permanent: false },
    ]);
  },
};

export default nextConfig;
