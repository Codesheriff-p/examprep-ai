/**
 * Applies prisma/migrations/* to the database in DATABASE_URL. Unlike `prisma migrate dev`
 * it also works on a hosted libSQL database (libsql://…).
 *
 * Run with: npm run db:deploy   (safe to re-run; applied migrations are skipped)
 */
import "dotenv/config";
import { DATABASE_AUTH_TOKEN, DATABASE_URL } from "../src/lib/db-config";
import { createClient } from "@libsql/client";
import { applyMigrations } from "../src/lib/apply-migrations";
import { MIGRATIONS } from "../src/generated/migrations";

const url = DATABASE_URL;
const db = createClient({ url, authToken: DATABASE_AUTH_TOKEN });

applyMigrations(db, MIGRATIONS)
  .then((applied) =>
    console.log(applied.length ? `Applied ${applied.join(", ")} to ${url.split("?")[0]}` : "Database is up to date."),
  )
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.close());
