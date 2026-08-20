import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  serverExternalPackages: ['passkit-generator'],
  async redirects() {
    return [
      { source: '/admin/tenants', destination: '/admin/platform/venues', permanent: false },
    ]
  },
};

// Standalone output is only for the local Hosting-mirror image.
// Live `firebase deploy` keeps the default Next.js build that Web Frameworks expects.
if (process.env.DOCKER_BUILD === '1') {
  nextConfig.output = 'standalone';
}

export default nextConfig;
