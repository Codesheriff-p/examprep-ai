import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // `prisma generate` doesn't need a database, so a missing DATABASE_URL (e.g. during
  // `npm install` on Vercel) mustn't fail. Hosted databases are migrated with `npm run db:deploy`.
  datasource: {
    url: process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./dev.db",
  },
});
