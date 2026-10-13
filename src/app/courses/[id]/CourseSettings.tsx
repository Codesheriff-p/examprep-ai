"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteCourse, updateCourse } from "@/app/actions/courses";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field, Input } from "@/components/ui/Field";

export function CourseSettings({
  courseId,
  title,
  description,
  examDate,
}: {
  courseId: string;
  title: string;
  description: string;
  examDate: string;
}) {
  const [state, action] = useActionState(updateCourse.bind(null, courseId), undefined);
  return (
    <Card>
      <CardHeader title="Course details" />
      <form action={action} className="mt-4 space-y-4">
        <Field label="Name" htmlFor="title">
          <Input id="title" name="title" defaultValue={title} required />
        </Field>
        <Field label="Exam date" htmlFor="examDate">
          <DatePicker id="examDate" name="examDate" defaultValue={examDate} placeholder="Not set" />
        </Field>
        <Field label="Description" htmlFor="description">
          <Input id="description" name="description" defaultValue={description} />
        </Field>
        <FormMessage state={state} />
        <SubmitButton variant="secondary" className="w-full" pendingText="Saving…">Save changes</SubmitButton>
      </form>
      <form
        action={deleteCourse.bind(null, courseId)}
        className="mt-5 border-t border-border pt-4"
        onSubmit={(e) => {
          if (!confirm("Delete this course and all its notes, quizzes, flashcards and plans?")) e.preventDefault();
        }}
      >
        <Button type="submit" variant="danger" size="sm">
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete course
        </Button>
      </form>
    </Card>
  );
}
