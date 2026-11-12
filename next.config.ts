import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, for the Docker image. Vercel ignores it.
  output: "standalone",
  cacheComponents: true,
  // The phone opens the dev server by its LAN address; without this Next treats those requests as
  // cross-origin and the dev assets (HMR) are blocked. Update the address when the network changes.
  allowedDevOrigins: ["192.168.0.119"],
  partialPrefetching: true,
  agentRules: false,
  // The landing page comes later; until then "/" opens the dashboard.
  redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
