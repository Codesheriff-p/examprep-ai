import { LineChart } from "lucide-react";
import { requireCourse } from "@/lib/auth";
import { courseSummary, topicMastery } from "@/lib/progress";
import { studyStats } from "@/lib/study";
import { EmptyState } from "@/components/EmptyState";
import { WeekBars } from "@/components/WeekBars";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, Stat } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatDate, formatMinutes, percent } from "@/lib/format";

function masteryLabel(accuracy: number): { text: string; tone: BadgeTone } {
  if (accuracy >= 0.8) return { text: "Strong", tone: "good" };
  if (accuracy >= 0.6) return { text: "Improving", tone: "warn" };
  return { text: "Needs work", tone: "bad" };
}

const ACTIVITIES = [
  { kind: "focus", label: "Focus timer" },
  { kind: "quiz", label: "Practice quizzes" },
  { kind: "mock", label: "Mock exams" },
  { kind: "flashcards", label: "Flashcards" },
] as const;

export default async function ProgressPage({ params }: PageProps<"/courses/[id]/progress">) {
  const { id } = await params;
  const { user } = await requireCourse(id);
  const [mastery, summary, stats] = await Promise.all([topicMastery(id), courseSummary(id), studyStats(user.id, id, 14)]);

  if (summary.attempts.length === 0) {
    return (
      <EmptyState icon={LineChart} title="No results yet" action={<ButtonLink href={`/courses/${id}/quizzes`}>Take a quiz</ButtonLink>}>
        Your scores and how well you know each topic will appear here after your first quiz.
      </EmptyState>
    );
  }

  const recent = summary.attempts.slice(-12);
  const first = summary.attempts[0].score;
  const last = summary.attempts[summary.attempts.length - 1].score;
  const change = Math.round((last - first) * 100);
  const activityTotal = ACTIVITIES.reduce((sum, a) => sum + (stats.byKind[a.kind] ?? 0), 0);

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Quizzes taken" value={summary.attempts.length} />
        <Stat label="Average score" value={summary.average === null ? "—" : percent(summary.average)} />
        <Stat label="Latest score" value={percent(last)} />
        <Card className="p-4 sm:p-5">
          <dt className="text-xs text-muted">Since first quiz</dt>
          <dd className={cn("mt-2 text-2xl font-semibold tabular-nums", change > 0 ? "text-good" : change < 0 ? "text-bad" : "")}>
            {change > 0 ? "+" : change < 0 ? "−" : "±"}{Math.abs(change)} pts
          </dd>
        </Card>
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Mastery by topic" description="Share of quiz answers you got right, weakest first." />
          <ul className="mt-5 space-y-4">
            {mastery.map((m) => {
              const label = masteryLabel(m.accuracy);
              return (
                <li key={m.topic}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{m.topic}</span>
                      <Badge tone={label.tone}>{label.text}</Badge>
                    </span>
                    <span className="tabular-nums">
                      {percent(m.accuracy)} <span className="text-xs text-muted">({m.correct}/{m.total})</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(m.accuracy * 100, 2)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Quiz scores" description={`Your last ${recent.length} attempt${recent.length > 1 ? "s" : ""}, oldest to newest.`} />
          <div className="relative mt-6 pl-9">
            {[100, 50, 0].map((tick) => (
              <span key={tick} className="absolute left-0 -translate-y-1/2 text-[11px] text-muted tabular-nums" style={{ top: `${100 - tick}%` }}>{tick}%</span>
            ))}
            <div className="relative flex h-48 items-end gap-[2px] border-b border-border" role="img" aria-label={`Bar chart of your last ${recent.length} quiz scores. The table below lists each score.`}>
              <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border" aria-hidden="true" />
              {recent.map((a, i) => (
                <div key={i} className="group relative flex h-full flex-1 items-end">
                  <div className="w-full rounded-t-[4px] bg-accent transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(a.score * 100, 2)}%` }} />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg group-hover:block">
                    <p className="font-semibold tabular-nums">{percent(a.score)}</p>
                    <p className="text-muted">{a.quiz.title} · {formatDate(a.createdAt, "short")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-normal">Quiz</th>
                <th className="pb-2 font-normal">Date</th>
                <th className="pb-2 text-right font-normal">Score</th>
              </tr>
            </thead>
            <tbody>
              {[...recent].reverse().map((a, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2 pr-2">{a.quiz.title}</td>
                  <td className="py-2 pr-2 text-muted">{formatDate(a.createdAt, "short")}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{percent(a.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader title="Study time" description={`${formatMinutes(stats.weekMinutes)} in the last 7 days. Hover a bar for the day's total.`} />
          <WeekBars days={stats.lastDays} height="h-32" className="mt-5" />
        </Card>

        <Card>
          <CardHeader title="Time by activity" description="Where your study time has gone over the last four months." />
          {activityTotal === 0 ? (
            <p className="mt-4 text-sm text-muted">No study time logged yet.</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {ACTIVITIES.map((a) => {
                const minutes = stats.byKind[a.kind] ?? 0;
                return (
                  <li key={a.kind}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{a.label}</span>
                      <span className="tabular-nums">{formatMinutes(minutes)} <span className="text-xs text-muted">({percent(minutes / activityTotal)})</span></span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max((minutes / activityTotal) * 100, minutes ? 2 : 0)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
