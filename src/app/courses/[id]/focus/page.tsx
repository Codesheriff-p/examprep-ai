import { CalendarDays, Clock, Flame, Layers, Target, Timer } from "lucide-react";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { studyStats } from "@/lib/study";
import { WeekBars } from "@/components/WeekBars";
import { Card, CardHeader, Stat } from "@/components/ui/Card";
import { addDays, formatDate, formatMinutes, formatTime, relativeDay, startOfDay } from "@/lib/format";
import { FocusTimer } from "./FocusTimer";

const KIND_LABEL: Record<string, { label: string; icon: typeof Timer }> = {
  focus: { label: "Focus session", icon: Timer },
  quiz: { label: "Practice quiz", icon: Target },
  mock: { label: "Mock exam", icon: CalendarDays },
  flashcards: { label: "Flashcards", icon: Layers },
};

export default async function FocusPage({ params }: PageProps<"/courses/[id]/focus">) {
  const { id } = await params;
  const { user } = await requireCourse(id);
  const today = startOfDay(new Date());
  const [stats, sessions, tasks] = await Promise.all([
    studyStats(user.id, id, 14),
    db.studySession.findMany({ where: { courseId: id, userId: user.id }, orderBy: { startedAt: "desc" }, take: 8 }),
    db.studyTask.findMany({
      where: { plan: { courseId: id }, done: false, date: { gte: today, lt: addDays(today, 3) } },
      orderBy: { date: "asc" },
      select: { title: true },
    }),
  ]);
  const overall = await studyStats(user.id);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <FocusTimer courseId={id} suggestions={tasks.map((t) => t.title)} />
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Streak" value={`${overall.streak} day${overall.streak === 1 ? "" : "s"}`} icon={Flame} hint="Across all courses" />
          <Stat label="Today" value={formatMinutes(stats.todayMinutes)} icon={Clock} />
          <Stat label="Last 7 days" value={formatMinutes(stats.weekMinutes)} icon={CalendarDays} />
          <Stat label="Focus time" value={formatMinutes(stats.byKind.focus ?? 0)} icon={Timer} hint="Last 4 months" />
        </dl>
      </div>
      <aside className="space-y-6">
        <Card>
          <CardHeader title="Study time" description="Minutes per day over the last two weeks, for this course." />
          <WeekBars days={stats.lastDays} height="h-32" className="mt-5" />
        </Card>
        <Card>
          <CardHeader title="Recent sessions" />
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Start the timer, take a quiz or review flashcards. Your sessions will appear here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {sessions.map((s) => {
                const kind = KIND_LABEL[s.kind] ?? { label: s.kind, icon: Timer };
                const Icon = kind.icon;
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{kind.label}</span>
                      <span className="block text-xs text-muted">
                        {relativeDay(s.startedAt) === "today" ? "Today" : formatDate(s.startedAt, "medium")} · {formatTime(s.startedAt)}
                      </span>
                    </span>
                    <span className="text-sm font-medium tabular-nums">{formatMinutes(s.minutes)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  );
}
