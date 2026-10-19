import type { NextConfig } from "next";

// The pump SDK and anchor must load through Node's require (their ESM build breaks),
// so keep them out of the server bundle and make sure their files ship with the routes that use them.
const pumpPackages = ["@pump-fun/pump-sdk", "@pump-fun/pump-swap-sdk", "@coral-xyz/anchor"];
const traced = pumpPackages.map((p) => `./node_modules/${p}/**/*`);

const nextConfig: NextConfig = {
  serverExternalPackages: [...pumpPackages, "sharp"],
  outputFileTracingIncludes: {
    "/api/**/*": traced,
    "/coin/*": traced,
  },
  poweredByHeader: false,
  // Tailwind v4 runs as a Turbopack loader (no PostCSS config).
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
