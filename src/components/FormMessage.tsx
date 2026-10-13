import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ActionState } from "@/app/actions/types";

export function FormMessage({ state }: { state: ActionState }) {
  if (state?.error) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2.5 text-sm text-bad" role="alert">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-good-soft px-3 py-2.5 text-sm text-good" role="status">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {state.ok}
      </p>
    );
  }
  return null;
}
