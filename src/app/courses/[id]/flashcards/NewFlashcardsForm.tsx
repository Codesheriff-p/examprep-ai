"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { createFlashcards } from "@/app/actions/flashcards";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

export function NewFlashcardsForm({ courseId, weakTopics }: { courseId: string; weakTopics: string[] }) {
  const [state, action] = useActionState(createFlashcards.bind(null, courseId), undefined);
  return (
    <Card>
      <CardHeader title="Make flashcards" description="New cards skip anything already in your deck." />
      <form action={action} className="mt-5 space-y-4">
        <Field label="How many" htmlFor="fc-count">
          <Select
            id="fc-count"
            name="count"
            defaultValue="15"
            options={[
              { value: "10", label: "10 cards", description: "A quick top-up" },
              { value: "15", label: "15 cards" },
              { value: "20", label: "20 cards" },
              { value: "30", label: "30 cards", description: "A full topic sweep" },
            ]}
          />
        </Field>
        <Field label="Focus" htmlFor="fc-focus">
          <Select
            id="fc-focus"
            name="focus"
            defaultValue="all"
            options={[
              { value: "all", label: "Whole course" },
              {
                value: "weak",
                label: "Weak topics",
                description: weakTopics.length ? weakTopics.slice(0, 3).join(", ") : "Unlocks after your first quiz",
                disabled: weakTopics.length === 0,
              },
            ]}
          />
        </Field>
        <FormMessage state={state} />
        <SubmitButton className="w-full" pendingText="Making cards…">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Generate cards
        </SubmitButton>
      </form>
    </Card>
  );
}
