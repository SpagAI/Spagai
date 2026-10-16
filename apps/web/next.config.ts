import type { NextConfig } from "next";

// GitHub Codespaces serves the app from https://<codespace>-3000.<domain>, and its proxy
// can pass the browser's Origin on as "localhost:3000" while forwarding the codespace host.
// Inside a codespace only, trust exactly those two hosts for the dev server and Server Actions.
const codespaceHost =
  process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : null;

const nextConfig: NextConfig = {
  ...(codespaceHost && {
    allowedDevOrigins: [codespaceHost],
    experimental: { serverActions: { allowedOrigins: [codespaceHost, "localhost:3000"] } },
  }),
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
