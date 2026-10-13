"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, PartyPopper } from "lucide-react";
import { reviewCard } from "@/app/actions/flashcards";
import type { Grade } from "@/lib/srs";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { SectionTitle } from "@/components/ui/Typography";
import { cn } from "@/lib/cn";

type Card = { id: string; front: string; back: string; topic: string };

const GRADES: { grade: Grade; label: string; hint: string; className: string }[] = [
  { grade: "again", label: "Again", hint: "Forgot it", className: "hover:border-bad hover:bg-bad-soft hover:text-bad" },
  { grade: "hard", label: "Hard", hint: "Struggled", className: "hover:border-warn hover:bg-warn-soft hover:text-warn" },
  { grade: "good", label: "Good", hint: "Remembered", className: "hover:border-accent hover:bg-accent-soft hover:text-accent" },
  { grade: "easy", label: "Easy", hint: "Instantly", className: "hover:border-good hover:bg-good-soft hover:text-good" },
];

export function ReviewDeck({ courseId, cards }: { courseId: string; cards: Card[] }) {
  // Snapshot the due cards when the session starts so the queue doesn't reshuffle mid-review.
  const [queue] = useState(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [pending, startTransition] = useTransition();
  const done = queue.length === 0 || index >= queue.length;

  // Keyboard: Space flips the card, 1–4 rate it once the answer is showing.
  useEffect(() => {
    if (done) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=combobox], [role=listbox]")) return;
      if (e.key === " " && !target.closest("button")) {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && !pending && ["1", "2", "3", "4"].includes(e.key)) {
        grade(GRADES[Number(e.key) - 1].grade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (done) {
    const finished = queue.length > 0;
    const Icon = finished ? PartyPopper : CheckCircle2;
    return (
      <Card className="flex flex-col items-center py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-good-soft text-good">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <SectionTitle className="mt-4">{finished ? "Session complete" : "You're all caught up"}</SectionTitle>
        <p className="mt-1 text-sm text-muted">
          {finished
            ? `You reviewed ${queue.length} card${queue.length > 1 ? "s" : ""}. They'll come back when they're due.`
            : "No cards are due right now. Come back later or make more cards."}
        </p>
      </Card>
    );
  }

  const card = queue[Math.min(index, queue.length - 1)];
  function grade(g: Grade) {
    startTransition(async () => {
      await reviewCard(courseId, card.id, g);
      setFlipped(false);
      setIndex((i) => i + 1);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Progress value={index / queue.length} label="Cards reviewed" className="flex-1" />
        <span className="text-xs text-muted tabular-nums">{index + 1} / {queue.length}</span>
      </div>
      <button
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Hide answer" : "Show answer"}
        className="flex min-h-72 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-border bg-surface p-6 text-center shadow-sm transition-colors duration-150 hover:border-accent/50"
      >
        <Badge tone="accent">{card.topic}</Badge>
        <span className="mt-5 max-w-lg font-display text-xl font-semibold leading-snug">{card.front}</span>
        {flipped ? (
          <span className="mt-6 max-w-lg border-t border-border pt-6 text-[15px] leading-relaxed">{card.back}</span>
        ) : (
          <span className="mt-6 text-sm text-muted">Click or press Space to show the answer</span>
        )}
      </button>
      {flipped && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="How well did you remember?">
          {GRADES.map((g, i) => (
            <button
              key={g.grade}
              disabled={pending}
              onClick={() => grade(g.grade)}
              className={cn("flex cursor-pointer flex-col items-center rounded-xl border border-border bg-surface py-2.5 transition-colors duration-150 disabled:opacity-50", g.className)}
            >
              <span className="text-sm font-medium">{g.label}</span>
              <span className="text-xs opacity-70">{g.hint} · <kbd className="font-mono">{i + 1}</kbd></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
