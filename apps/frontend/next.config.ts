import type { NextConfig } from "next";

// Keep in sync with src/config/api.ts
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:8080';
const IAM_ORIGIN = process.env.NEXT_PUBLIC_IAM_ORIGIN ?? 'http://localhost:5000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/iam-auth/:path*',
        destination: `${IAM_ORIGIN}/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${BACKEND_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
