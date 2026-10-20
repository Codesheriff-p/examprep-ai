/**
 * Runs once when a server instance starts, before it handles requests. On Vercel without a
 * DATABASE_URL, the app uses a temporary SQLite file in /tmp: create its tables and the demo
 * account here so the site works straight away.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { TEMPORARY_DATABASE, DATABASE_URL, db } = await import("@/lib/db");
  if (!TEMPORARY_DATABASE) return;

  const { createClient } = await import("@libsql/client");
  const { applyMigrations } = await import("@/lib/apply-migrations");
  const { MIGRATIONS } = await import("@/generated/migrations");
  const { seedDemoAccount } = await import("@/lib/demo-seed");
  const demo = (await import("@/lib/demo-account.json")).default;

  const sqlite = createClient({ url: DATABASE_URL });
  try {
    await applyMigrations(sqlite, MIGRATIONS);
  } finally {
    sqlite.close();
  }
  if (!(await db.user.count({ where: { email: demo.email } }))) {
    await seedDemoAccount(db);
    console.log(`Temporary database ready at ${DATABASE_URL} with the demo account.`);
  }
}
