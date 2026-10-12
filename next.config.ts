import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: nearly every page is per-user and permission-gated, so pages
  // render at request time. Revisit for public pages (catalog) later.
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
