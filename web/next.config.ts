import type { NextConfig } from "next";
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' https:",
      "connect-src 'self' https://agentstamp.org",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          ...securityHeaders,
        ],
      },
    ];
  },
  async rewrites() {
    const apiBackend = process.env.API_URL || "http://localhost:4005";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBackend}/api/:path*`,
      },
      {
        source: "/.well-known/:path*",
        destination: `${apiBackend}/.well-known/:path*`,
      },
      {
        source: "/health",
        destination: `${apiBackend}/health`,
      },
      {
        source: "/llms.txt",
        destination: `${apiBackend}/llms.txt`,
      },
      {
        source: "/robots.txt",
        destination: `${apiBackend}/robots.txt`,
      },
      {
        source: "/og-image.png",
        destination: `${apiBackend}/og-image.png`,
      },
      {
        source: "/mcp",
        destination: `${apiBackend}/mcp`,
      },
    ];
  },
};

export default nextConfig;
