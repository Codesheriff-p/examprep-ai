import "server-only";
import { db } from "@/lib/db";
import { addDays, startOfDay, toISODate } from "@/lib/format";

export type SessionKind = "focus" | "quiz" | "mock" | "flashcards";

export async function logSession(userId: string, courseId: string | null, kind: SessionKind, minutes: number) {
  if (minutes <= 0) return;
  await db.studySession.create({ data: { userId, courseId, kind, minutes: Math.round(minutes) } });
}

/** Flashcard reviews add a minute to today's single "flashcards" session for the course. */
export async function logFlashcardReview(userId: string, courseId: string) {
  const today = startOfDay(new Date());
  const existing = await db.studySession.findFirst({
    where: { userId, courseId, kind: "flashcards", startedAt: { gte: today } },
  });
  if (existing) {
    await db.studySession.update({ where: { id: existing.id }, data: { minutes: { increment: 1 } } });
  } else {
    await logSession(userId, courseId, "flashcards", 1);
  }
}

export type DayTotal = { date: string; minutes: number };

/**
 * Study statistics for a user, optionally limited to one course.
 * The streak counts consecutive days with any study ending today, or yesterday when
 * nothing has been logged yet today (so a streak isn't "lost" first thing in the morning).
 */
export async function studyStats(userId: string, courseId?: string, days = 7) {
  const since = addDays(startOfDay(new Date()), -120);
  const sessions = await db.studySession.findMany({
    where: { userId, ...(courseId ? { courseId } : {}), startedAt: { gte: since } },
    select: { minutes: true, startedAt: true, kind: true },
  });

  const byDay = new Map<string, number>();
  const byKind = new Map<string, number>();
  for (const s of sessions) {
    const key = toISODate(s.startedAt);
    byDay.set(key, (byDay.get(key) ?? 0) + s.minutes);
    byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + s.minutes);
  }

  const today = startOfDay(new Date());
  let cursor = byDay.get(toISODate(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (byDay.get(toISODate(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const lastDays: DayTotal[] = Array.from({ length: days }, (_, i) => {
    const date = toISODate(addDays(today, i - days + 1));
    return { date, minutes: byDay.get(date) ?? 0 };
  });

  return {
    streak,
    todayMinutes: byDay.get(toISODate(today)) ?? 0,
    weekMinutes: lastDays.slice(-7).reduce((sum, d) => sum + d.minutes, 0),
    lastDays,
    byKind: Object.fromEntries(byKind) as Partial<Record<SessionKind, number>>,
    /** Minutes per yyyy-mm-dd over the last ~4 months. */
    minutesByDay: Object.fromEntries(byDay) as Record<string, number>,
  };
}
