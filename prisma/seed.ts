/**
 * Seeds the demo account shown on the login page with two sample courses, so every
 * screen (study guides, mock exams, tutor chats, planner, focus streak) has content
 * even before an API key is configured. The data lives in src/lib/demo-seed.ts.
 *
 * Run with: npm run db:seed   (safe to re-run; it rebuilds the demo account)
 */
import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedDemoAccount } from "../src/lib/demo-seed";

const db = new PrismaClient({
  adapter: new PrismaLibSql({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  }),
});

seedDemoAccount(db)
  .then(({ email, courses }) => console.log(`Seeded demo account ${email} with ${courses.map((c) => `"${c}"`).join(" and ")}.`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
