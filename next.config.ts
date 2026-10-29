import type { NextConfig } from "next";

// Every page here reads the session cookie and live wallet data, so Cache Components (static shells) buy nothing.
const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: { serverActions: { bodySizeLimit: "5mb" } }, // agency images from the admin panel
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
