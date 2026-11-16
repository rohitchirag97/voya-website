import type { NextConfig } from "next";

// Every page here reads the session cookie and live wallet data, so Cache Components (static shells) buy nothing.
const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: { serverActions: { bodySizeLimit: "70mb" } }, // admin panel uploads: gift animations (max 15 MB), karaoke songs (two tracks up to 30 MB)
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
