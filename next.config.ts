import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the E2E server build into its own folder while the regular dev server runs.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Cache Components is off: nearly every page is per-user and permission-gated, so pages
  // render at request time. Revisit for public pages (catalog) later.
  experimental: {
    // Room for 10 MB document uploads plus multipart overhead.
    serverActions: { bodySizeLimit: "11mb" },
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
