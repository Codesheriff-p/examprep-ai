"use client";

import { useActionState, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { addNotes } from "@/app/actions/notes";
import type { ActionState } from "@/app/actions/types";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";

export function NotesUpload({ courseId }: { courseId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [state, action] = useActionState(async (prev: ActionState, data: FormData) => {
    const result = await addNotes(courseId, prev, data);
    if (result?.ok) {
      formRef.current?.reset();
      setFileNames([]);
    }
    return result;
  }, undefined);

  return (
    <Card>
      <CardHeader title="Add notes" description="Lecture slides, textbook chapters, past papers." />
      <form ref={formRef} action={action} className="mt-5 space-y-5">
        <label
          htmlFor="files"
          className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-border px-4 py-7 text-center transition-colors hover:border-accent/60 hover:bg-accent-soft/40 has-focus-visible:border-accent"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="mt-3 text-sm font-medium">
            {fileNames.length ? `${fileNames.length} file${fileNames.length > 1 ? "s" : ""} selected` : "Choose files to upload"}
          </span>
          <span className="mt-1 text-xs text-muted">
            {fileNames.length ? fileNames.join(", ") : "PDF, .txt or .md · up to 20 MB in total"}
          </span>
          <input
            id="files"
            name="files"
            type="file"
            multiple
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            className="sr-only"
            onChange={(e) => setFileNames([...(e.target.files ?? [])].map((f) => f.name))}
          />
        </label>

        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />or paste text<span className="h-px flex-1 bg-border" />
        </div>

        <Field label="Title" htmlFor="title">
          <Input id="title" name="title" placeholder="e.g. Week 3: Memory management" />
        </Field>
        <Field label="Notes" htmlFor="text">
          <Textarea className="min-h-36" id="text" name="text" placeholder="Paste your notes here" />
        </Field>
        <FormMessage state={state} />
        <SubmitButton className="w-full" pendingText="Reading your notes…">Add to course</SubmitButton>
      </form>
    </Card>
  );
}
