import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Prisma 7.x generates an ESM-first client using import.meta.url.
  // Marking these as external prevents Turbopack from trying to bundle them.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-mariadb",
    "prisma",
  ],
};

export default nextConfig;
