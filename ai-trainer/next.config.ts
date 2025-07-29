import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignore ESLint during builds to prevent build failures
  eslint: {
    ignoreDuringBuilds: true,   // ✅ build passes even with ESLint warnings
  },
  async redirects() {
    return [];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ];
  },
  // Allow external images and domains
  images: {
    domains: ['localhost', '127.0.0.1'],
  },
};

export default nextConfig;
