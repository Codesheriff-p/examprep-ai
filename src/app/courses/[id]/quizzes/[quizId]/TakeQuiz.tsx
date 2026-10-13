"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlarmClock } from "lucide-react";
import { submitAttempt } from "@/app/actions/quizzes";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Progress } from "@/components/ui/Progress";
import { Eyebrow } from "@/components/ui/Typography";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";

type Q = { id: string; type: string; prompt: string; options: string[]; topic: string };

/** When this attempt started. Kept in sessionStorage so a reload doesn't reset an exam's clock. */
function readStartTime(key: string) {
  try {
    const saved = Number(sessionStorage.getItem(key));
    if (saved && Date.now() - saved < 4 * 3600_000) return saved;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {}
  return Date.now();
}

export function TakeQuiz({
  courseId,
  quizId,
  questions,
  timeLimit,
}: {
  courseId: string;
  quizId: string;
  questions: Q[];
  timeLimit: number | null; // minutes; null = untimed practice
}) {
  const [state, action] = useActionState(submitAttempt.bind(null, courseId, quizId), undefined);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const storageKey = `quiz-start-${quizId}`;
  // The clock only exists in the browser; both values stay null during server rendering.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const submitted = useRef(false);

  const elapsed = startedAt && now ? Math.floor((now - startedAt) / 1000) : 0;
  const remaining = timeLimit && startedAt ? Math.max(0, timeLimit * 60 - elapsed) : null;

  useEffect(() => {
    const tick = () => {
      setStartedAt((s) => s ?? readStartTime(storageKey));
      setNow(Date.now());
    };
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [storageKey]);

  // Time's up: hand the paper in automatically.
  useEffect(() => {
    if (remaining === 0 && !submitted.current) {
      submitted.current = true;
      formRef.current?.requestSubmit();
    }
  }, [remaining]);

  // Warn before leaving a timed exam part-way through.
  useEffect(() => {
    if (!timeLimit) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!submitted.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [timeLimit]);

  function mark(id: string, value: string) {
    setAnswered((prev) => {
      const next = new Set(prev);
      if (value.trim()) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function onSubmit() {
    submitted.current = true;
    if (durationRef.current && startedAt) durationRef.current.value = String(Math.floor((Date.now() - startedAt) / 1000));
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
  }

  const lowTime = remaining !== null && remaining <= 300;

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} className="space-y-4">
      <input ref={durationRef} type="hidden" name="durationSec" defaultValue="0" />

      {timeLimit && (
        <div
          className={cn(
            "sticky top-16 z-20 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur transition-colors",
            lowTime ? "border-bad/40 bg-bad-soft/95 text-bad" : "border-border bg-surface/95",
          )}
          role="timer"
          aria-live={lowTime ? "assertive" : "off"}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <AlarmClock className={cn("h-4 w-4", lowTime && "animate-pulse")} aria-hidden="true" />
            {lowTime ? "Less than 5 minutes left" : "Time remaining"}
          </span>
          <span className="font-mono text-xl font-semibold tabular-nums">{remaining === null ? "--:--" : formatDuration(remaining)}</span>
        </div>
      )}

      {questions.map((q, i) => (
        <Card key={q.id} id={`q-${i + 1}`} className="scroll-mt-36">
          <fieldset>
            <legend className="sr-only">Question {i + 1}</legend>
            <div className="flex items-center justify-between gap-3">
              <Eyebrow>Question {i + 1}{q.type === "short" ? " · written" : ""}</Eyebrow>
              <Badge tone="accent">{q.topic}</Badge>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed font-medium">{q.prompt}</p>
            {q.type === "mcq" ? (
              <div className="mt-4 space-y-2">
                {q.options.map((opt, j) => (
                  <label
                    key={j}
                    className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-sm transition-colors duration-150 hover:bg-surface-2 has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent"
                  >
                    <input type="radio" name={`q_${q.id}`} value={j} className="sr-only" onChange={() => mark(q.id, "x")} />
                    {/* Answer-sheet bubble: fills with ink when chosen. */}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border font-mono text-xs font-semibold text-muted transition-colors duration-150 group-has-checked:border-accent group-has-checked:bg-accent group-has-checked:text-on-accent">
                      {"ABCDEFGH"[j]}
                    </span>
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <>
                <label htmlFor={`q_${q.id}`} className="sr-only">Your answer</label>
                <Textarea
                  id={`q_${q.id}`}
                  name={`q_${q.id}`}
                  className="mt-4 min-h-28"
                  placeholder="Answer in a few sentences"
                  onChange={(e) => mark(q.id, e.target.value)}
                />
              </>
            )}
          </fieldset>
        </Card>
      ))}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <nav aria-label="Jump to question" className="mb-3 flex flex-wrap gap-1">
          {questions.map((q, i) => (
            <a
              key={q.id}
              href={`#q-${i + 1}`}
              aria-label={`Question ${i + 1}${answered.has(q.id) ? ", answered" : ""}`}
              className={cn(
                "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums transition-colors",
                answered.has(q.id) ? "bg-accent text-on-accent" : "border border-border text-muted hover:border-accent",
              )}
            >
              {i + 1}
            </a>
          ))}
        </nav>
        <Progress value={answered.size / questions.length} label="Questions answered" className="mb-3 h-1" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted tabular-nums">
            {answered.size} / {questions.length} answered
            {!timeLimit && startedAt && <> · {formatDuration(elapsed)} elapsed</>}
          </p>
          <div className="flex items-center gap-3">
            <FormMessage state={state} />
            <SubmitButton pendingText="Marking your answers…">{timeLimit ? "Hand in paper" : "Submit answers"}</SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}
