import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: { cpus: 2 },
  serverExternalPackages: ['node:sqlite'],
};
export default nextConfig;
