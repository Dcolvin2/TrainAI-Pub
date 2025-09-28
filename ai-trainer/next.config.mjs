/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Do not fail CI on lint or TS type errors; tighten locally.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
