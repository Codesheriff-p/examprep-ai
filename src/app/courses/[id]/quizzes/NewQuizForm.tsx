"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { createQuiz } from "@/app/actions/quizzes";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Label } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";

export function NewQuizForm({ courseId, hasNotes, weakTopics }: { courseId: string; hasNotes: boolean; weakTopics: string[] }) {
  const [state, action] = useActionState(createQuiz.bind(null, courseId), undefined);
  const hasWeak = weakTopics.length > 0;
  return (
    <Card>
      <CardHeader title="Practice quiz" description="Written from your notes in about a minute. Untimed, with explanations." />
      <form action={action} className="mt-5 space-y-5">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Questions</legend>
          <Segmented name="count" defaultValue="10" options={["5", "10", "15", "20"].map((n) => ({ value: n, label: n }))} />
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Difficulty</legend>
          <Segmented
            name="difficulty"
            defaultValue="medium"
            options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]}
          />
        </fieldset>
        <Field label="Question type" htmlFor="quiz-format">
          <Select
            id="quiz-format"
            name="format"
            defaultValue="mixed"
            options={[
              { value: "mixed", label: "Mixed", description: "Mostly multiple choice, some written" },
              { value: "mcq", label: "Multiple choice", description: "Four options, marked instantly" },
              { value: "short", label: "Written answers", description: "Marked by AI with feedback" },
            ]}
          />
        </Field>
        <div>
          <Label htmlFor="quiz-focus">Focus</Label>
          <Select
            id="quiz-focus"
            name="focus"
            defaultValue={hasWeak ? "weak" : "all"}
            options={[
              { value: "all", label: "Whole course", description: "Questions across all your notes" },
              {
                value: "weak",
                label: "My weak topics",
                description: hasWeak ? weakTopics.slice(0, 3).join(", ") : "Unlocks after your first quiz",
                disabled: !hasWeak,
              },
            ]}
          />
        </div>
        <FormMessage state={state} />
        {!hasNotes && <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">Upload notes first. Questions are written from them.</p>}
        <SubmitButton className="w-full" pendingText="Writing questions…">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Generate quiz
        </SubmitButton>
      </form>
    </Card>
  );
}
