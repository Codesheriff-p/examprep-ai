import { cn } from "@/lib/cn";

/** Placeholder block shown while a page loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} aria-hidden="true" />;
}
