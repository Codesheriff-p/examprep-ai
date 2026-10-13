import { redirect } from "next/navigation";
import { ArrowRight, BookOpenCheck, CalendarDays, FileText, Layers, LineChart, MessageSquareText, Timer } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Typography";

const STEPS = [
  { title: "Add your notes", body: "Upload lecture PDFs or paste text. Everything else is built from them." },
  { title: "Practise", body: "Take quizzes written from your material. Short answers are marked with feedback." },
  { title: "Find the gaps", body: "Each answer updates your mastery of every topic, so weak spots surface on their own." },
  { title: "Close them", body: "New quizzes, flashcards and your daily plan focus on the topics you keep missing." },
];

const FEATURES = [
  { icon: BookOpenCheck, title: "Practice quizzes", body: "Multiple choice and short answer at the difficulty you choose." },
  { icon: MessageSquareText, title: "AI tutor", body: "Explanations grounded in your notes, with follow-up questions to check understanding." },
  { icon: Layers, title: "Spaced repetition", body: "Flashcards come back just before you'd forget them." },
  { icon: CalendarDays, title: "Study plan", body: "A daily checklist that runs up to your exam date." },
  { icon: LineChart, title: "Progress", body: "Mastery by topic and your score history in one place." },
  { icon: Timer, title: "Mock exams & focus timer", body: "Timed papers under exam conditions, plus a focus timer that tracks your streak." },
  { icon: FileText, title: "Study guides", body: "A summary, key terms and a plain-language version of every document." },
];

/** A static preview of a quiz question, styled like an answer sheet. */
function AnswerSheetPreview() {
  const options = ["A program stored on disk", "A program in execution", "A unit of CPU scheduling only", "A block of shared memory"];
  return (
    <Card className="relative mx-auto w-full max-w-md p-0 sm:p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <Eyebrow>Question 3 of 10</Eyebrow>
        <Badge tone="accent">Processes</Badge>
      </div>
      <div className="space-y-2.5 px-5 py-5">
        <p className="font-medium">Which statement best defines a process?</p>
        {options.map((opt, i) => {
          const picked = i === 1;
          return (
            <div
              key={opt}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${picked ? "border-good bg-good-soft" : "border-border"}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-semibold ${
                  picked ? "border-good bg-good text-surface" : "border-border text-muted"
                }`}
              >
                {"ABCD"[i]}
              </span>
              {opt}
            </div>
          );
        })}
      </div>
      <div className="border-t border-border bg-surface-2/60 px-5 py-4">
        <Eyebrow className="mb-3">Topic mastery</Eyebrow>
        {[
          ["Processes", 0.86],
          ["Scheduling", 0.62],
          ["Deadlock", 0.38],
        ].map(([topic, value]) => (
          <div key={topic as string} className="mb-2 flex items-center gap-3 text-xs last:mb-0">
            <span className="w-20 shrink-0">{topic}</span>
            <span className="h-1.5 flex-1 rounded-full bg-border">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(value as number) * 100}%` }} />
            </span>
            <span className="w-8 text-right text-muted tabular-nums">{Math.round((value as number) * 100)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <>
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost">Log in</ButtonLink>
          <ButtonLink href="/signup">Get started</ButtonLink>
        </nav>
      </header>

      <main id="main" className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div>
            <Eyebrow>AI exam preparation</Eyebrow>
            <h1 className="mt-4 font-display text-4xl leading-[1.05] font-semibold tracking-[-0.02em] sm:text-5xl lg:text-6xl">
              Revise from{" "}
              <span className="bg-[linear-gradient(transparent_58%,var(--highlight)_58%,var(--highlight)_92%,transparent_92%)] px-[0.08em]">
                your own notes
              </span>
              , not someone else&apos;s.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              Upload your course material and get practice quizzes, flashcards, a day-by-day study plan,
              and a tutor that answers from what you were actually taught.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">
                Create a free account <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" size="lg">Try the demo account</ButtonLink>
            </div>
          </div>
          <AnswerSheetPreview />
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">Each answer you give shapes what you study next.</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative">
                  <span className="flex h-8 w-8 tabular-nums items-center justify-center rounded-full border border-border text-sm font-semibold text-accent">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-display font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em]">Everything for the weeks before an exam</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <Card key={title}>
                <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <h3 className="mt-4 font-display font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted sm:px-6">
          <span>ExamPrep AI · Final year project</span>
          <span>Powered by Claude</span>
        </div>
      </footer>
    </>
  );
}
