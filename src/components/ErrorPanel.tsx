"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";

/** Shared body for error boundaries: says what happened and offers a way forward. */
export function ErrorPanel({ error, retry, homeHref = "/dashboard" }: { error: Error & { digest?: string }; retry: () => void; homeHref?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center" role="alert">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bad-soft text-bad">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">This page didn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted">
        Something went wrong while loading it. Your data is safe. Try again, or go back to your courses.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
        </Button>
        <ButtonLink href={homeHref} variant="secondary">My courses</ButtonLink>
      </div>
    </div>
  );
}
