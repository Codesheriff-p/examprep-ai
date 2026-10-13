import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, Clock, MessageSquareText, RotateCcw, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { Markdown } from "@/components/Markdown";
import { ScoreRing } from "@/components/ScoreRing";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Eyebrow, SectionTitle } from "@/components/ui/Typography";
import { cn } from "@/lib/cn";
import { formatDate, formatDuration, formatTime } from "@/lib/format";

export default async function AttemptPage({
  params,
}: PageProps<"/courses/[id]/quizzes/[quizId]/attempts/[attemptId]">) {
  const { id, quizId, attemptId } = await params;
  const { user } = await requireCourse(id);
  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, quizId, userId: user.id, quiz: { courseId: id } },
    include: {
      quiz: true,
      answers: { include: { question: true }, orderBy: { question: { position: "asc" } } },
    },
  });
  if (!attempt) notFound();

  const correct = attempt.answers.filter((a) => a.correct).length;
  const missedTopics = [...new Set(attempt.answers.filter((a) => !a.correct).map((a) => a.question.topic))];
  const verdict =
    attempt.score >= 0.85 ? "Excellent work." : attempt.score >= 0.7 ? "Solid result." : attempt.score >= 0.5 ? "Getting there." : "Worth another pass.";
  const isExam = attempt.quiz.mode === "exam";
  const tutorBase = `/courses/${id}/tutor?c=new`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/courses/${id}/quizzes`} className="inline-flex items-center gap-1 rounded-md text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Quizzes & exams
      </Link>

      <Card className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <ScoreRing score={attempt.score} />
        <div className="flex-1">
          <Eyebrow>{attempt.quiz.title}{isExam ? " · mock exam" : ""}</Eyebrow>
          <SectionTitle className="mt-1">{verdict}</SectionTitle>
          <p className="mt-0.5 text-sm text-muted tabular-nums">
            {correct} of {attempt.answers.length} correct · {formatDate(attempt.createdAt, "medium")} at {formatTime(attempt.createdAt)}
          </p>
          {attempt.durationSec != null && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted tabular-nums">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDuration(attempt.durationSec)}
              {attempt.quiz.timeLimit ? ` of ${attempt.quiz.timeLimit}:00 used` : " taken"}
            </p>
          )}
          {missedTopics.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Revise:</span>
              {missedTopics.map((t) => <Badge key={t} tone="bad">{t}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex gap-2 sm:flex-col">
          <ButtonLink href={`${tutorBase}&review=${attempt.id}`}>
            <MessageSquareText className="h-4 w-4" aria-hidden="true" /> Review with tutor
          </ButtonLink>
          <ButtonLink href={`/courses/${id}/quizzes/${quizId}`} variant="secondary">
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Retake
          </ButtonLink>
        </div>
      </Card>

      {attempt.answers.map((a, i) => {
        const q = a.question;
        const options = q.options as string[];
        return (
          <Card key={a.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            <article>
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>Question {i + 1} · {q.topic}</Eyebrow>
                <Badge tone={a.correct ? "good" : "bad"}>
                  {a.correct ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                  {a.correct ? "Correct" : "Incorrect"}
                </Badge>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed font-medium">{q.prompt}</p>
              {q.type === "mcq" ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {options.map((opt, j) => {
                    const isAnswer = String(j) === q.answer;
                    const isPicked = String(j) === a.response;
                    return (
                      <li
                        key={j}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3.5 py-2.5",
                          isAnswer ? "border-good bg-good-soft" : isPicked ? "border-bad bg-bad-soft" : "border-border",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] font-mono text-xs font-semibold",
                            isAnswer ? "border-good bg-good text-surface" : isPicked ? "border-bad bg-bad text-surface" : "border-border text-muted",
                          )}
                        >
                          {"ABCDEFGH"[j]}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {isPicked && <span className="text-xs text-muted">Your answer</span>}
                        {isAnswer && !isPicked && <span className="text-xs text-good">Correct answer</span>}
                      </li>
                    );
                  })}
                  {!a.response && <li className="text-muted">You didn&apos;t answer this one.</li>}
                </ul>
              ) : (
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="rounded-xl border border-border px-3.5 py-2.5">
                    <dt className="text-xs text-muted">Your answer</dt>
                    <dd className="mt-0.5">{a.response || <em className="text-muted">No answer</em>}</dd>
                  </div>
                  <div className="rounded-xl border border-good/40 bg-good-soft px-3.5 py-2.5">
                    <dt className="text-xs text-good">Model answer</dt>
                    <dd className="mt-0.5">{q.answer}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Feedback</dt>
                    <dd className="mt-0.5">{a.feedback}</dd>
                  </div>
                </dl>
              )}
              <div className="mt-4 rounded-xl bg-surface-2 p-4">
                <Eyebrow className="mb-2">Explanation</Eyebrow>
                <Markdown>{q.explanation}</Markdown>
              </div>
              <div className="mt-3 flex justify-end">
                <ButtonLink href={`${tutorBase}&explain=${a.id}`} variant={a.correct ? "ghost" : "soft"} size="sm">
                  <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                  {a.correct ? "Discuss with tutor" : "Explain my mistake"}
                </ButtonLink>
              </div>
            </article>
          </Card>
        );
      })}
    </div>
  );
}
