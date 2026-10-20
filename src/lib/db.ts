import "server-only";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Where the data lives. Locally: dev.db in the project. On Vercel, with no DATABASE_URL set,
 * a SQLite file in /tmp (the only writable folder). That file is temporary: it's wiped when
 * the server instance restarts, so it suits testing. It's created and seeded on startup by
 * src/instrumentation.ts.
 */
export const DATABASE_URL =
  process.env.DATABASE_URL ?? (process.env.VERCEL ? "file:/tmp/examprep.db" : "file:./dev.db");
export const TEMPORARY_DATABASE = Boolean(process.env.VERCEL) && !process.env.DATABASE_URL;

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaLibSql({
    url: DATABASE_URL,
    // Only needed for a hosted libSQL database (libsql://…); ignored for local files.
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
