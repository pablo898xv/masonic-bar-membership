import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const defaultCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const qrScanCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:",
  "style-src 'self' 'unsafe-inline' https: http:",
  'img-src * data: blob:',
  'font-src * data:',
  'connect-src *',
  'frame-src https: http:',
  'media-src *',
  "object-src 'none'",
  "base-uri 'self'",
  'form-action *',
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  poweredByHeader: false,
  serverExternalPackages: ['passkit-generator'],
  async redirects() {
    return [
      { source: '/admin/tenants', destination: '/admin/platform/venues', permanent: false },
    ]
  },
  async headers() {
    const defaultHeaders = [
      ...securityHeaders,
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: defaultCsp },
    ]
    const scanHeaders = [
      ...securityHeaders,
      { key: 'Permissions-Policy', value: 'camera=*, microphone=(), geolocation=*' },
      { key: 'Content-Security-Policy', value: qrScanCsp },
    ]
    return [
      { source: '/q', headers: scanHeaders },
      { source: '/q/:path*', headers: scanHeaders },
      { source: '/', headers: defaultHeaders },
      { source: '/((?!q/).*)', headers: defaultHeaders },
    ]
  },
};

// Standalone output is only for the local Hosting-mirror image.
// Live `firebase deploy` keeps the default Next.js build that Web Frameworks expects.
if (process.env.DOCKER_BUILD === '1') {
  nextConfig.output = 'standalone';
}

export default nextConfig;
