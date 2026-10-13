import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Notes are uploaded through Server Actions; allow PDFs up to ~20 MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  // unpdf ships a bundled pdf.js build that should be loaded from node_modules.
  serverExternalPackages: ["unpdf", "@libsql/client", "@prisma/adapter-libsql"],
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
