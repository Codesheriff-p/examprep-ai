"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { createPlan } from "@/app/actions/plans";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Hint } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

const BUDGETS = [
  { value: "30", label: "30 minutes", description: "Light revision" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour", description: "Recommended" },
  { value: "90", label: "1½ hours" },
  { value: "120", label: "2 hours", description: "Intensive" },
  { value: "180", label: "3 hours", description: "Final push" },
];

export function NewPlanForm({ courseId, hasPlan, examLabel }: { courseId: string; hasPlan: boolean; examLabel: string | null }) {
  const [state, action] = useActionState(createPlan.bind(null, courseId), undefined);
  return (
    <Card>
      <CardHeader
        title={hasPlan ? "Rebuild your plan" : "Build a study plan"}
        description={
          examLabel
            ? `Runs from today to your exam (${examLabel}), up to four weeks. Weak topics get more time.`
            : "No exam date is set, so the plan covers the next two weeks. Set one under Overview."
        }
      />
      <form action={action} className="mt-5 space-y-4">
        <Field label="Study time per day" htmlFor="plan-budget">
          <Select id="plan-budget" name="minutesPerDay" defaultValue="60" options={BUDGETS} />
        </Field>
        <FormMessage state={state} />
        {hasPlan && <Hint>Rebuilding replaces your current plan and its ticks.</Hint>}
        <SubmitButton className="w-full" pendingText="Planning your days…">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> {hasPlan ? "Rebuild plan" : "Build plan"}
        </SubmitButton>
      </form>
    </Card>
  );
}
