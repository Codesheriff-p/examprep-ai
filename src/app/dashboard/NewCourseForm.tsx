"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createCourse } from "@/app/actions/courses";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field, Input } from "@/components/ui/Field";

export function NewCourseForm() {
  const [state, action] = useActionState(createCourse, undefined);
  return (
    <Card>
      <CardHeader title="New course" description="One course per exam you're preparing for." />
      <form action={action} className="mt-5 space-y-4">
        <Field label="Course name" htmlFor="title">
          <Input id="title" name="title" placeholder="e.g. Operating Systems" required />
        </Field>
        <Field label="Exam date" htmlFor="examDate" optional hint="Used for your countdown, study plan and calendar.">
          <DatePicker id="examDate" name="examDate" minToday placeholder="When is the exam?" />
        </Field>
        <Field label="Description" htmlFor="description" optional>
          <Input id="description" name="description" placeholder="Course code, lecturer, exam format…" />
        </Field>
        <FormMessage state={state} />
        <SubmitButton className="w-full" pendingText="Creating…">
          <Plus className="h-4 w-4" aria-hidden="true" /> Create course
        </SubmitButton>
      </form>
    </Card>
  );
}
