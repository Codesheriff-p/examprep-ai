import Link from "next/link";
import { CalendarClock, ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { studyStats } from "@/lib/study";
import { AppHeader } from "@/components/AppHeader";
import { PageTitle } from "@/components/ui/Typography";
import { cn } from "@/lib/cn";
import { daysUntil, formatDate } from "@/lib/format";
import { CourseTabs } from "./CourseTabs";

export default async function CourseLayout({ children, params }: LayoutProps<"/courses/[id]">) {
  const { id } = await params;
  const { user, course } = await requireCourse(id);
  const [stats, dueCards] = await Promise.all([
    studyStats(user.id),
    db.flashcard.count({ where: { courseId: id, dueAt: { lte: new Date() } } }),
  ]);
  const days = course.examDate ? daysUntil(course.examDate) : null;

  return (
    <>
      <AppHeader userName={user.name} streak={stats.streak} />
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
          <Link href="/dashboard" className="inline-flex items-center gap-1 rounded-md text-sm text-muted transition-colors hover:text-foreground">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> My courses
          </Link>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <PageTitle>{course.title}</PageTitle>
              {course.description && <p className="mt-1 text-sm text-muted">{course.description}</p>}
            </div>
            {course.examDate && days !== null && (
              <div className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2">
                <CalendarClock className={cn("h-4 w-4", days <= 7 && days >= 0 ? "text-bad" : "text-accent")} aria-hidden="true" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold tabular-nums">
                    {days > 1 ? `${days} days to go` : days === 1 ? "Exam tomorrow" : days === 0 ? "Exam today" : "Exam passed"}
                  </p>
                  <p className="text-xs text-muted">{formatDate(course.examDate, "long")}</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4">
            <CourseTabs courseId={course.id} dueCards={dueCards} />
          </div>
        </div>
      </div>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
