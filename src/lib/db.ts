import "server-only";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { DATABASE_AUTH_TOKEN, DATABASE_URL } from "@/lib/db-config";

export { DATABASE_URL, TEMPORARY_DATABASE } from "@/lib/db-config";

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaLibSql({
    url: DATABASE_URL,
    // Only needed for a hosted libSQL database (libsql://…); ignored for local files.
    authToken: DATABASE_AUTH_TOKEN,
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
