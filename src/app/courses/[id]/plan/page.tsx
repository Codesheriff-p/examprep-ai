import Link from "next/link";
import {
  BookOpenCheck,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Layers,
  List,
  NotebookPen,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { studyStats } from "@/lib/study";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/cn";
import { addDays, daysUntil, formatDate, formatMinutes, isSameDay, parseISODate, relativeDay, startOfDay, toISODate } from "@/lib/format";
import { NewPlanForm } from "./NewPlanForm";
import { TaskCheckbox } from "@/components/TaskCheckbox";

const KINDS: Record<string, { label: string; icon: typeof BookOpenCheck; dot: string }> = {
  review: { label: "Review", icon: NotebookPen, dot: "bg-accent" },
  practice: { label: "Practice", icon: BookOpenCheck, dot: "bg-warn" },
  flashcards: { label: "Flashcards", icon: Layers, dot: "bg-violet" },
  mock: { label: "Mock exam", icon: GraduationCap, dot: "bg-bad" },
};
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Task = { id: string; title: string; details: string; topic: string; minutes: number; kind: string; done: boolean; date: Date };

function TaskItem({ courseId, task }: { courseId: string; task: Task }) {
  const kind = KINDS[task.kind] ?? { label: task.kind, icon: NotebookPen, dot: "bg-muted" };
  const Icon = kind.icon;
  return (
    <li className="flex gap-3">
      <TaskCheckbox courseId={courseId} taskId={task.id} done={task.done} label={task.title} />
      <div className="min-w-0 flex-1 text-sm">
        <p className={cn("font-medium", task.done && "text-muted line-through")}>{task.title}</p>
        <p className="mt-0.5 leading-relaxed text-muted">{task.details}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge><Icon className="h-3 w-3" aria-hidden="true" />{kind.label}</Badge>
          <Badge>{task.topic}</Badge>
          <Badge className="tabular-nums">{task.minutes} min</Badge>
        </p>
      </div>
    </li>
  );
}

export default async function PlanPage({ params, searchParams }: PageProps<"/courses/[id]/plan">) {
  const { id } = await params;
  const sp = await searchParams;
  const view = sp.view === "calendar" ? "calendar" : "list";
  const { user, course } = await requireCourse(id);

  const [plan, docCount, stats, cardsDue] = await Promise.all([
    db.studyPlan.findFirst({
      where: { courseId: id },
      orderBy: { createdAt: "desc" },
      include: { tasks: { orderBy: [{ date: "asc" }, { title: "asc" }] } },
    }),
    db.document.count({ where: { courseId: id } }),
    studyStats(user.id, id, 7),
    db.flashcard.findMany({ where: { courseId: id }, select: { dueAt: true } }),
  ]);

  const tasks: Task[] = plan?.tasks ?? [];
  const byDay = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = toISODate(task.date);
    byDay.set(key, [...(byDay.get(key) ?? []), task]);
  }
  const today = startOfDay(new Date());
  const todayKey = toISODate(today);
  const done = tasks.filter((t) => t.done).length;
  const base = `/courses/${id}/plan`;

  // Calendar state from the URL: ?view=calendar&month=2026-10&day=2026-10-14
  const monthParam = typeof sp.month === "string" ? parseISODate(`${sp.month}-01`) : null;
  const month = monthParam ?? (byDay.size && !byDay.has(todayKey) && tasks[0].date > today ? tasks[0].date : today);
  const selectedDay = (typeof sp.day === "string" && parseISODate(sp.day)) || today;
  const monthKey = toISODate(month).slice(0, 7);
  const shiftMonth = (n: number) => toISODate(new Date(month.getFullYear(), month.getMonth() + n, 1, 12)).slice(0, 7);
  const dueByDay = new Map<string, number>();
  for (const c of cardsDue) {
    const key = toISODate(c.dueAt < today ? today : c.dueAt);
    dueByDay.set(key, (dueByDay.get(key) ?? 0) + 1);
  }
  const studied = new Map(Object.entries(stats.minutesByDay));

  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const gridStart = addDays(first, -((first.getDay() + 6) % 7));
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const weeks = Math.ceil((((first.getDay() + 6) % 7) + lastOfMonth.getDate()) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const selectedKey = toISODate(selectedDay);
  const selectedTasks = byDay.get(selectedKey) ?? [];
  const isExamDay = (d: Date) => !!course.examDate && isSameDay(d, course.examDate);

  const viewSwitch = (
    <div className="inline-flex rounded-xl bg-surface-2 p-1" role="tablist" aria-label="Planner view">
      {[
        { v: "list", label: "List", icon: List, href: base },
        { v: "calendar", label: "Calendar", icon: CalendarDays, href: `${base}?view=calendar` },
      ].map(({ v, label, icon: Icon, href }) => (
        <Link
          key={v}
          href={href}
          role="tab"
          aria-selected={view === v}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
            view === v ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
        </Link>
      ))}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {viewSwitch}
          {plan && (
            <a href={`/api/courses/${id}/calendar`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" /> Add to my calendar
            </a>
          )}
        </div>

        {plan && (
          <Card>
            <CardHeader title="Your plan" action={<span className="text-sm text-muted tabular-nums">{done} / {tasks.length} done</span>} />
            <Progress value={tasks.length ? done / tasks.length : 0} tone="good" label="Plan progress" className="mt-3" />
            <p className="mt-4 text-[15px] leading-relaxed">{plan.summary}</p>
          </Card>
        )}

        {view === "calendar" ? (
          <Card className="p-3 sm:p-4">
            <div className="flex items-center justify-between px-1 pb-3">
              <h2 className="font-display text-lg font-semibold">{formatDate(month, "month-year")}</h2>
              <div className="flex items-center gap-1">
                <ButtonLink href={`${base}?view=calendar&month=${shiftMonth(-1)}&day=${selectedKey}`} variant="ghost" size="icon-sm" aria-label="Previous month" scroll={false}>
                  <ChevronLeft className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href={`${base}?view=calendar&day=${todayKey}`} variant="secondary" size="sm" scroll={false}>Today</ButtonLink>
                <ButtonLink href={`${base}?view=calendar&month=${shiftMonth(1)}&day=${selectedKey}`} variant="ghost" size="icon-sm" aria-label="Next month" scroll={false}>
                  <ChevronRight className="h-4 w-4" />
                </ButtonLink>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
              {WEEKDAYS.map((d) => <span key={d} className="py-1">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d) => {
                const key = toISODate(d);
                const dayTasks = byDay.get(key) ?? [];
                const inMonth = d.getMonth() === month.getMonth();
                const isToday = key === todayKey;
                const selected = key === selectedKey;
                const exam = isExamDay(d);
                const minutes = dayTasks.reduce((s, t) => s + t.minutes, 0);
                const allDone = dayTasks.length > 0 && dayTasks.every((t) => t.done);
                const due = d >= today ? (dueByDay.get(key) ?? 0) : 0;
                const studiedMin = studied.get(key) ?? 0;
                return (
                  <Link
                    key={key}
                    href={`${base}?view=calendar&month=${monthKey}&day=${key}`}
                    scroll={false}
                    aria-current={selected ? "date" : undefined}
                    aria-label={`${formatDate(d, "long")}${exam ? ", exam day" : ""}${dayTasks.length ? `, ${dayTasks.length} tasks` : ""}`}
                    className={cn(
                      "flex min-h-16 flex-col rounded-xl border p-1.5 text-left transition-colors sm:min-h-24 sm:p-2",
                      selected ? "border-accent ring-2 ring-accent/20" : "border-transparent hover:border-border",
                      exam ? "bg-bad-soft" : inMonth ? "bg-surface-2/60" : "bg-transparent",
                      !inMonth && "opacity-45",
                    )}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                          isToday ? "bg-accent font-semibold text-on-accent" : "font-medium",
                        )}
                      >
                        {d.getDate()}
                      </span>
                      {studiedMin > 0 && d <= today && <span className="h-1.5 w-1.5 rounded-full bg-good" title="Studied" aria-hidden="true" />}
                    </span>
                    {exam && <span className="mt-1 truncate text-[11px] font-semibold text-bad">Exam</span>}
                    {dayTasks.length > 0 && (
                      <span className="mt-auto hidden flex-col gap-0.5 sm:flex">
                        <span className="flex gap-0.5">
                          {dayTasks.slice(0, 4).map((t) => (
                            <span key={t.id} className={cn("h-1.5 flex-1 rounded-full", t.done ? "bg-good" : (KINDS[t.kind]?.dot ?? "bg-muted"))} />
                          ))}
                        </span>
                        <span className={cn("text-[10px] tabular-nums", allDone ? "text-good" : "text-muted")}>
                          {allDone ? "Done" : `${minutes} min`}
                        </span>
                      </span>
                    )}
                    {dayTasks.length > 0 && <span className="mt-auto h-1.5 w-1.5 self-center rounded-full bg-accent sm:hidden" aria-hidden="true" />}
                    {due > 0 && !dayTasks.length && <span className="mt-auto hidden text-[10px] text-muted sm:block">{due} cards</span>}
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted">
              {Object.values(KINDS).map((k) => (
                <span key={k.label} className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", k.dot)} />{k.label}</span>
              ))}
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-good" />Studied / done</span>
            </div>
          </Card>
        ) : !plan ? (
          <EmptyState icon={CalendarDays} title="No study plan yet">
            Build one and you&apos;ll get a checklist for every day until your exam.
          </EmptyState>
        ) : (
          <ol className="space-y-4">
            {[...byDay.entries()].map(([day, dayTasks]) => {
              const date = dayTasks[0].date;
              const isToday = day === todayKey;
              const isPast = day < todayKey;
              const minutes = dayTasks.reduce((sum, t) => sum + t.minutes, 0);
              const allDone = dayTasks.every((t) => t.done);
              return (
                <li key={day} aria-current={isToday ? "date" : undefined}>
                  <Card className={cn(isToday && "border-accent ring-4 ring-accent/10", isPast && allDone && "opacity-60")}>
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl", isToday ? "bg-accent text-on-accent" : "bg-surface-2")}>
                        <span className="text-sm leading-none font-semibold tabular-nums">{date.getDate()}</span>
                        <span className="mt-0.5 text-[10px] leading-none uppercase opacity-80">{formatDate(date, "short").split(" ")[1]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display font-semibold">
                          {isToday ? "Today" : formatDate(date, "weekday")}
                          <span className="ml-2 text-xs font-normal text-muted">{isToday ? "" : relativeDay(date)}</span>
                        </h3>
                        <p className="text-xs text-muted tabular-nums">{formatMinutes(minutes)} · {dayTasks.length} task{dayTasks.length > 1 ? "s" : ""}</p>
                      </div>
                      {allDone && <Badge tone="good">Done</Badge>}
                    </div>
                    <ul className="mt-4 space-y-3 border-t border-border pt-4">
                      {dayTasks.map((t) => <TaskItem key={t.id} courseId={id} task={t} />)}
                    </ul>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        {view === "calendar" && (
          <Card>
            <CardHeader
              title={isSameDay(selectedDay, today) ? "Today" : formatDate(selectedDay, "weekday")}
              description={`${formatDate(selectedDay, "long")} · ${relativeDay(selectedDay)}`}
            />
            {isExamDay(selectedDay) && (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-bad-soft px-3 py-2.5 text-sm font-medium text-bad">
                <GraduationCap className="h-4 w-4" aria-hidden="true" /> {course.title} exam
              </p>
            )}
            {selectedTasks.length ? (
              <ul className="mt-4 space-y-3">
                {selectedTasks.map((t) => <TaskItem key={t.id} courseId={id} task={t} />)}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">Nothing planned for this day.</p>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Studied</dt>
                <dd className="font-semibold tabular-nums">{selectedDay <= today ? formatMinutes(studied.get(selectedKey) ?? 0) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Cards due</dt>
                <dd className="font-semibold tabular-nums">{selectedDay >= today ? (dueByDay.get(selectedKey) ?? 0) : "—"}</dd>
              </div>
            </dl>
            {course.examDate && daysUntil(course.examDate) >= 0 && (
              <p className="mt-3 text-xs text-muted">Exam {relativeDay(course.examDate)} · {formatDate(course.examDate, "medium")}</p>
            )}
          </Card>
        )}
        {docCount === 0 ? (
          <EmptyState icon={FileText} title="Add notes first">The plan is built around what your notes cover.</EmptyState>
        ) : (
          <NewPlanForm courseId={id} hasPlan={!!plan} examLabel={course.examDate ? `${formatDate(course.examDate, "medium")}, ${relativeDay(course.examDate)}` : null} />
        )}
      </aside>
    </div>
  );
}
