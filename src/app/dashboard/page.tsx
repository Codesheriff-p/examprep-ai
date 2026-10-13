import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookMarked, CalendarCheck, CalendarClock, Flame, Layers } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { studyStats } from "@/lib/study";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { WeekBars } from "@/components/WeekBars";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Eyebrow, PageTitle } from "@/components/ui/Typography";
import { addDays, daysUntil, formatDate, formatMinutes, percent, relativeDay, startOfDay } from "@/lib/format";
import { NewCourseForm } from "./NewCourseForm";

export const metadata = { title: "My courses · ExamPrep AI" };

function Countdown({ date }: { date: Date }) {
  const days = daysUntil(date);
  if (days < 0) return <Badge>Exam passed</Badge>;
  return (
    <Badge tone={days <= 7 ? "bad" : "accent"}>
      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
      {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
    </Badge>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const today = startOfDay(now);
  const [courses, stats, todaysTasks] = await Promise.all([
    db.course.findMany({
      where: { userId: user.id },
      orderBy: [{ examDate: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { documents: true } },
        flashcards: { where: { dueAt: { lte: now } }, select: { id: true } },
        quizzes: { select: { attempts: { select: { score: true } } } },
      },
    }),
    studyStats(user.id),
    db.studyTask.findMany({
      where: { plan: { course: { userId: user.id } }, date: { gte: today, lt: addDays(today, 1) } },
      orderBy: [{ done: "asc" }, { title: "asc" }],
      include: { plan: { select: { course: { select: { id: true, title: true } } } } },
    }),
  ]);
  const dueDecks = courses.filter((c) => c.flashcards.length > 0);
  const plannedMinutes = todaysTasks.reduce((sum, t) => sum + t.minutes, 0);
  const doneCount = todaysTasks.filter((t) => t.done).length;
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const nextExam = courses.find((c) => c.examDate && daysUntil(c.examDate) >= 0);

  return (
    <>
      <AppHeader userName={user.name} streak={stats.streak} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Eyebrow>{formatDate(now, "long")}</Eyebrow>
        <PageTitle className="mt-2">{greeting}, {user.name.split(" ")[0]}</PageTitle>
        {nextExam?.examDate && (
          <p className="mt-2 text-sm text-muted">
            Next exam: <span className="font-medium text-foreground">{nextExam.title}</span>{" "}
            {relativeDay(nextExam.examDate)} ({formatDate(nextExam.examDate, "medium")}).
          </p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section aria-labelledby="courses-heading">
            <h2 id="courses-heading" className="sr-only">Your courses</h2>
            {courses.length === 0 ? (
              <EmptyState icon={BookMarked} title="No courses yet">
                Create a course for each exam, upload your notes, and ExamPrep AI will build quizzes,
                flashcards and a study plan from them.
              </EmptyState>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {courses.map((course) => {
                  const scores = course.quizzes.flatMap((q) => q.attempts.map((a) => a.score));
                  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
                  return (
                    <Link
                      key={course.id}
                      href={`/courses/${course.id}`}
                      className="group block rounded-2xl focus-visible:outline-offset-4"
                    >
                      <Card className="flex h-full flex-col transition-[border-color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-accent/50">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-display text-lg leading-snug font-semibold">{course.title}</h3>
                          {course.examDate ? (
                            <Countdown date={course.examDate} />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-muted transition-colors group-hover:text-accent" aria-hidden="true" />
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {course.examDate ? `Exam ${formatDate(course.examDate, "medium")}` : "No exam date set"}
                        </p>
                        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-4">
                          {[
                            ["Notes", course._count.documents],
                            ["Avg. score", avg === null ? "—" : percent(avg)],
                            ["Cards due", course.flashcards.length],
                          ].map(([label, value]) => (
                            <div key={label as string}>
                              <dt className="text-xs text-muted">{label}</dt>
                              <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}

            {courses.length > 0 && (
              <Card className="mt-6">
                <CardHeader
                  title="Today"
                  description={
                    todaysTasks.length
                      ? `${doneCount} of ${todaysTasks.length} tasks done · ${formatMinutes(plannedMinutes)} planned across your courses`
                      : "No study plan tasks for today."
                  }
                />
                {todaysTasks.length > 0 ? (
                  <ul className="mt-5 space-y-3">
                    {todaysTasks.map((t) => (
                      <li key={t.id} className="flex gap-3">
                        <TaskCheckbox courseId={t.plan.course.id} taskId={t.id} done={t.done} label={t.title} />
                        <div className="min-w-0 flex-1 text-sm">
                          <p className={t.done ? "text-muted line-through" : "font-medium"}>{t.title}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            {t.plan.course.title} · <span className="tabular-nums">{t.minutes} min</span>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                    <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                    Open a course and build a study plan to get a daily checklist here.
                  </p>
                )}
                {dueDecks.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                    {dueDecks.map((c) => (
                      <Link
                        key={c.id}
                        href={`/courses/${c.id}/flashcards`}
                        className="group inline-flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm transition-colors hover:bg-accent-soft hover:text-accent"
                      >
                        <Layers className="h-4 w-4 text-accent" aria-hidden="true" />
                        <span>
                          <span className="font-medium tabular-nums">{c.flashcards.length}</span> cards due in {c.title}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </section>
          <aside className="space-y-6">
            <Card>
              <CardHeader
                title="Study streak"
                description={
                  stats.streak
                    ? `${stats.todayMinutes ? "You've studied today." : "Study today to keep it going."}`
                    : "Study any course today to start a streak."
                }
                action={
                  <span className="flex items-center gap-1.5 rounded-xl bg-warn-soft px-3 py-1.5 text-warn">
                    <Flame className="h-4 w-4" aria-hidden="true" />
                    <span className="text-lg font-semibold tabular-nums">{stats.streak}</span>
                    <span className="sr-only">day streak</span>
                  </span>
                }
              />
              <WeekBars days={stats.lastDays} className="mt-5" />
              <p className="mt-4 text-sm text-muted">
                <span className="font-medium text-foreground tabular-nums">{formatMinutes(stats.weekMinutes)}</span> studied in the last 7 days
              </p>
            </Card>
            <NewCourseForm />
          </aside>
        </div>
      </main>
    </>
  );
}
