import path from "node:path";
import type { NextConfig } from "next";

// GitHub Codespaces serves the app from https://<codespace>-3000.<domain>.
// Trust exactly that address (and nothing broader) for the dev server and Server Actions.
const codespaceHost =
  process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : null;

const nextConfig: NextConfig = {
  // This app lives in a monorepo: trace files from the repository root, so the deployed site
  // (e.g. on Vercel) includes everything it needs, such as the database engine and packages/core.
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  ...(codespaceHost && { allowedDevOrigins: [codespaceHost] }),
  experimental: {
    // Keep visited pages for 30 seconds, so going back and forth between pages is instant.
    // Saving anything (a Server Action) still refreshes the affected pages straight away.
    staleTimes: { dynamic: 30 },
    serverActions: {
      // Lead CSV uploads can be up to 2 MB (checked again in the import action).
      bodySizeLimit: "2100kb",
      ...(codespaceHost && { allowedOrigins: [codespaceHost] }),
    },
  },
  // Hide Next.js's round "N" badge in the corner while developing. Errors still show as normal.
  devIndicators: false,
  // packages/core ships TypeScript source; Next compiles it for us.
  transpilePackages: ["@spagai/core"],
  poweredByHeader: false,
  // The Simulator is now called the Lab; old links still work.
  async redirects() {
    return [
      { source: "/simulator", destination: "/lab", permanent: true },
      { source: "/simulator/:agentId", destination: "/lab/:agentId", permanent: true },
    ];
  },
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
