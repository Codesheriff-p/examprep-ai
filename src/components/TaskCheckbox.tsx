"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleTask } from "@/app/actions/plans";
import { cn } from "@/lib/cn";

export function TaskCheckbox({ courseId, taskId, done, label }: { courseId: string; taskId: string; done: boolean; label: string }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={`Mark "${label}" ${optimistic ? "not done" : "done"}`}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await toggleTask(courseId, taskId, !optimistic);
        })
      }
      className={cn(
        "mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-[1.5px] transition-colors duration-150",
        optimistic ? "border-good bg-good text-surface" : "border-border hover:border-accent",
      )}
    >
      {optimistic && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
    </button>
  );
}
