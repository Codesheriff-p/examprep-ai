/**
 * Which database to use. Shared by the app (db.ts), startup (instrumentation.ts) and the
 * db:deploy / db:seed scripts, so they always agree.
 *
 * - DATABASE_URL, or TURSO_DATABASE_URL (set by Vercel's Turso integration): a shared
 *   database. Required on Vercel for logins to work, since Vercel runs many server copies.
 * - Otherwise, locally: dev.db in the project.
 * - Otherwise, on Vercel: a temporary SQLite file in /tmp. Each server copy gets its own,
 *   so it only works as a fallback demo.
 */
const configuredUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;

export const DATABASE_URL = configuredUrl ?? (process.env.VERCEL ? "file:/tmp/examprep.db" : "file:./dev.db");
export const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;
export const TEMPORARY_DATABASE = Boolean(process.env.VERCEL) && !configuredUrl;
