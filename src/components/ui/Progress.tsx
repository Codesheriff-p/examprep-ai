import { cn } from "@/lib/cn";

export function Progress({
  value,
  tone = "accent",
  className,
  label,
}: {
  value: number; // 0..1
  tone?: "accent" | "good";
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-surface-2", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", tone === "good" ? "bg-good" : "bg-accent")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
