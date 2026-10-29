import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, for the Docker image. Vercel ignores it.
  output: "standalone",
  cacheComponents: true,
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
