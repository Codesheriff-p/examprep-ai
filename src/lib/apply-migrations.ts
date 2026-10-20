import type { Client } from "@libsql/client";

export type Migration = { name: string; sql: string };

/**
 * Applies the Prisma migrations a libSQL database hasn't had yet, in order. Shared by
 * `npm run db:deploy` and the temporary database set up on Vercel (src/instrumentation.ts).
 */
export async function applyMigrations(db: Client, migrations: Migration[]) {
  await db.execute("CREATE TABLE IF NOT EXISTS _deploy_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set((await db.execute("SELECT name FROM _deploy_migrations")).rows.map((r) => String(r.name)));
  // A database set up with `prisma migrate dev` records its migrations in Prisma's own table.
  const prismaTable = await db.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'");
  if (prismaTable.rows.length) {
    const rows = await db.execute("SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL");
    for (const r of rows.rows) applied.add(String(r.migration_name));
  }

  const pending = migrations.filter((m) => !applied.has(m.name)).sort((a, b) => a.name.localeCompare(b.name));
  for (const m of pending) {
    await db.executeMultiple(m.sql);
    await db.execute({
      sql: "INSERT INTO _deploy_migrations (name, applied_at) VALUES (?, ?)",
      args: [m.name, new Date().toISOString()],
    });
  }
  return pending.map((m) => m.name);
}
