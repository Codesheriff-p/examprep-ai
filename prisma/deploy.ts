/**
 * Applies prisma/migrations/* to the database in DATABASE_URL, including hosted Turso
 * databases (libsql://…), which `prisma migrate deploy` can't connect to directly.
 *
 * Run with: npm run db:deploy   (safe to re-run; applied migrations are skipped)
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const MIGRATIONS = join(import.meta.dirname, "migrations");

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

  await db.execute(
    "CREATE TABLE IF NOT EXISTS _deploy_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    (await db.execute("SELECT name FROM _deploy_migrations")).rows.map((r) => String(r.name)),
  );
  // A database set up with `prisma migrate dev` records its migrations in Prisma's own table.
  const prismaTable = await db.execute(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'",
  );
  if (prismaTable.rows.length) {
    const rows = await db.execute("SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL");
    for (const r of rows.rows) applied.add(String(r.migration_name));
  }

  const pending = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !applied.has(e.name))
    .map((e) => e.name)
    .sort();

  for (const name of pending) {
    await db.executeMultiple(readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8"));
    await db.execute({
      sql: "INSERT INTO _deploy_migrations (name, applied_at) VALUES (?, ?)",
      args: [name, new Date().toISOString()],
    });
    console.log(`Applied ${name}`);
  }
  console.log(pending.length ? `Done: ${pending.length} migration(s) applied to ${url.split("?")[0]}` : "Database is up to date.");
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
