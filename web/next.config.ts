import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiBackend = process.env.API_URL || "http://localhost:3405";
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
    ];
  },
};

export default nextConfig;
