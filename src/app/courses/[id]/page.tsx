import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  Clock,
  FileText,
  GraduationCap,
  Layers,
  MessageSquareText,
  Target,
  Timer,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { courseSummary, weakTopics } from "@/lib/progress";
import { studyStats } from "@/lib/study";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, Stat } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { addDays, formatMinutes, percent, startOfDay, toISODate } from "@/lib/format";
import { CourseSettings } from "./CourseSettings";

export default async function CourseOverview({ params }: PageProps<"/courses/[id]">) {
  const { id } = await params;
  const { user, course } = await requireCourse(id);

  const today = startOfDay(new Date());
  const [summary, weak, todaysTasks, planCount, stats, conversations] = await Promise.all([
    courseSummary(id),
    weakTopics(id),
    db.studyTask.findMany({
      where: { plan: { courseId: id }, date: { gte: today, lt: addDays(today, 1) } },
      orderBy: { title: "asc" },
    }),
    db.studyPlan.count({ where: { courseId: id } }),
    studyStats(user.id, id),
    db.conversation.findMany({ where: { courseId: id }, orderBy: { updatedAt: "desc" }, take: 3 }),
  ]);
  const base = `/courses/${id}`;

  const steps = [
    { done: summary.docs > 0, label: "Upload your notes", href: `${base}/notes` },
    { done: summary.attempts.length > 0, label: "Take a practice quiz", href: `${base}/quizzes` },
    { done: summary.totalCards > 0, label: "Generate flashcards", href: `${base}/flashcards` },
    { done: planCount > 0, label: "Build a study plan", href: `${base}/plan` },
  ];
  const minutesToday = todaysTasks.reduce((sum, t) => sum + t.minutes, 0);

  const quickActions = [
    { href: `${base}/focus`, icon: Timer, label: "Start a focus session", hint: "25-minute timer" },
    { href: `${base}/quizzes#mock-exam`, icon: GraduationCap, label: "Sit a mock exam", hint: "Timed, exam conditions" },
    { href: `${base}/flashcards`, icon: Layers, label: "Review flashcards", hint: `${summary.dueCards} due now` },
    { href: `${base}/tutor?c=new`, icon: MessageSquareText, label: "Ask the tutor", hint: "Explain, quiz or coach" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Documents" value={summary.docs} icon={FileText} />
          <Stat label="Quizzes taken" value={summary.attempts.length} icon={BookOpenCheck} />
          <Stat label="Average score" value={summary.average === null ? "—" : percent(summary.average)} icon={Target} />
          <Stat label="Studied this week" value={formatMinutes(stats.weekMinutes)} icon={Clock} />
        </dl>

        {steps.some((s) => !s.done) && (
          <Card>
            <CardHeader title="Set up this course" description={`${steps.filter((s) => s.done).length} of ${steps.length} done`} />
            <ol className="mt-4 divide-y divide-border">
              {steps.map((s, i) => (
                <li key={s.label}>
                  <Link href={s.href} className="group flex items-center gap-3 py-3 text-sm">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                        s.done ? "bg-good text-surface" : "border border-border text-muted",
                      )}
                    >
                      {s.done ? <Check className="h-3.5 w-3.5" aria-label="Done" /> : i + 1}
                    </span>
                    <span className={cn("flex-1", s.done ? "text-muted line-through" : "font-medium")}>{s.label}</span>
                    {!s.done && <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />}
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Today"
            description={todaysTasks.length ? `${formatMinutes(minutesToday)} planned · ${formatMinutes(stats.todayMinutes)} studied so far` : undefined}
            action={<ButtonLink href={`${base}/plan`} variant="secondary" size="sm">Open planner</ButtonLink>}
          />
          {todaysTasks.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing scheduled for today. Build a study plan to get a daily checklist.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {todaysTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2/70 px-3.5 py-2.5 text-sm">
                  <span className={cn("flex items-center gap-2.5", t.done && "text-muted line-through")}>
                    {t.done ? (
                      <Check className="h-4 w-4 shrink-0 text-good" aria-label="Done" />
                    ) : (
                      <CalendarDays className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    )}
                    {t.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">{t.minutes} min</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {quickActions.map(({ href, icon: Icon, label, hint }) => (
            <Link
              key={label}
              href={href}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader
            title="Focus areas"
            description={weak.length ? "Topics where you're scoring under 70%." : "Take a quiz and the topics you find hardest will show up here."}
          />
          {weak.length > 0 && (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {weak.map((t) => <Badge key={t} tone="bad" className="py-1">{t}</Badge>)}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <ButtonLink href={`${base}/quizzes`}>Practise these topics</ButtonLink>
                <ButtonLink href={`${base}/tutor?c=new&mode=socratic`} variant="secondary">Work through them with the tutor</ButtonLink>
              </div>
            </>
          )}
        </Card>

        {conversations.length > 0 && (
          <Card>
            <CardHeader title="Recent tutor chats" action={<ButtonLink href={`${base}/tutor`} variant="ghost" size="sm">All chats</ButtonLink>} />
            <ul className="mt-3 divide-y divide-border">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link href={`${base}/tutor?c=${c.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-accent">
                    <MessageSquareText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted">{toISODate(c.updatedAt) === toISODate(new Date()) ? "Today" : c.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <aside>
        <CourseSettings
          courseId={course.id}
          title={course.title}
          description={course.description ?? ""}
          examDate={toISODate(course.examDate)}
        />
      </aside>
    </div>
  );
}
