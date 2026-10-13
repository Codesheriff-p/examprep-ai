"use client";

import { useActionState, useState } from "react";
import { GraduationCap } from "lucide-react";
import { createMockExam } from "@/app/actions/quizzes";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";

const LENGTHS = {
  short: { count: 10, minutes: 20, label: "Short paper", description: "10 questions · 20 minutes" },
  standard: { count: 20, minutes: 40, label: "Standard paper", description: "20 questions · 40 minutes" },
  full: { count: 30, minutes: 60, label: "Full paper", description: "30 questions · 60 minutes" },
} as const;

export function NewMockExamForm({ courseId, hasNotes }: { courseId: string; hasNotes: boolean }) {
  const [state, action] = useActionState(createMockExam.bind(null, courseId), undefined);
  const [length, setLength] = useState<keyof typeof LENGTHS>("standard");
  const chosen = LENGTHS[length];
  return (
    <Card id="mock-exam" className="scroll-mt-24">
      <CardHeader
        title="Mock exam"
        description="A timed paper across the whole syllabus. Answers and explanations appear only after you hand it in."
      />
      <form action={action} className="mt-5 space-y-5">
        <input type="hidden" name="count" value={chosen.count} />
        <input type="hidden" name="timeLimit" value={chosen.minutes} />
        <Field label="Paper length" htmlFor="mock-length">
          <Select
            id="mock-length"
            value={length}
            onChange={(v) => setLength(v as keyof typeof LENGTHS)}
            options={Object.entries(LENGTHS).map(([value, l]) => ({ value, label: l.label, description: l.description }))}
          />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Difficulty</legend>
          <Segmented name="difficulty" defaultValue="hard" options={[{ value: "medium", label: "Standard" }, { value: "hard", label: "Challenging" }]} />
        </fieldset>
        <FormMessage state={state} />
        <SubmitButton className="w-full" pendingText="Setting your paper…" variant={hasNotes ? "primary" : "secondary"}>
          <GraduationCap className="h-4 w-4" aria-hidden="true" /> Create {chosen.minutes}-minute exam
        </SubmitButton>
      </form>
    </Card>
  );
}
