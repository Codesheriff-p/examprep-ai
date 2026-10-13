import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";

/** The signed-in user, or null. Memoised per request. */
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  });
});

/**
 * The signed-in user; redirects to /login when there is none.
 * A cookie can outlive its account (e.g. after the database is reset or re-seeded). The
 * proxy would then bounce /login back here forever, so stale cookies are cleared first.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect((await readSession()) ? "/auth/signout" : "/login");
  return user;
}

/**
 * Loads a course owned by the signed-in user. Every course-scoped page and action
 * goes through this so one student can never read or change another's data.
 */
export const requireCourse = cache(async (courseId: string) => {
  const user = await requireUser();
  const course = await db.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) notFound();
  return { user, course };
});
