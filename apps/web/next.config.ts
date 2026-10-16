import type { NextConfig } from "next";

// GitHub Codespaces serves the app from https://<codespace>-3000.<domain>, and its proxy
// can pass the browser's Origin on as "localhost:3000" while forwarding the codespace host.
// Inside a codespace only, trust exactly those two hosts for the dev server and Server Actions.
const codespaceHost =
  process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : null;

const nextConfig: NextConfig = {
  ...(codespaceHost && { allowedDevOrigins: [codespaceHost] }),
  experimental: {
    // Keep visited pages for 30 seconds, so going back and forth between pages is instant.
    // Saving anything (a Server Action) still refreshes the affected pages straight away.
    staleTimes: { dynamic: 30 },
    serverActions: {
      // Lead CSV uploads can be up to 2 MB (checked again in the import action).
      bodySizeLimit: "2100kb",
      // The Codespaces proxy can pass the browser Origin on as "localhost:3000" (see DECISIONS D52).
      ...(codespaceHost && { allowedOrigins: [codespaceHost, "localhost:3000"] }),
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
