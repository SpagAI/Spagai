import type { NextConfig } from "next";

// GitHub Codespaces serves the app from https://<codespace>-3000.<domain>.
// Trust exactly that address (and nothing broader) for the dev server and Server Actions.
const codespaceHost =
  process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : null;

const nextConfig: NextConfig = {
  ...(codespaceHost && { allowedDevOrigins: [codespaceHost] }),
  experimental: {
    serverActions: {
      // Lead CSV uploads can be up to 2 MB (checked again in the import action).
      bodySizeLimit: "2100kb",
      ...(codespaceHost && { allowedOrigins: [codespaceHost] }),
    },
  },
  // packages/core ships TypeScript source; Next compiles it for us.
  transpilePackages: ["@spagai/core"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
