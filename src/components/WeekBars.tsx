import { formatDate, formatMinutes, parseISODate } from "@/lib/format";
import type { DayTotal } from "@/lib/study";
import { cn } from "@/lib/cn";

/** Minutes studied per day as a small single-series bar chart, with a text summary for screen readers. */
export function WeekBars({ days, height = "h-24", className }: { days: DayTotal[]; height?: string; className?: string }) {
  const max = Math.max(30, ...days.map((d) => d.minutes));
  const summary = days.map((d) => `${formatDate(parseISODate(d.date)!, "medium")}: ${formatMinutes(d.minutes)}`).join("; ");
  return (
    <div className={className}>
      <div className={cn("flex items-end gap-1.5", height)} role="img" aria-label={`Minutes studied per day. ${summary}`}>
        {days.map((d, i) => {
          const date = parseISODate(d.date)!;
          const isToday = i === days.length - 1;
          return (
            <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className={cn("w-full rounded-t-[4px] transition-opacity group-hover:opacity-80", d.minutes ? "bg-accent" : "bg-surface-2", isToday && d.minutes && "bg-good")}
                style={{ height: d.minutes ? `${Math.max((d.minutes / max) * 100, 6)}%` : "4px" }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-lg group-hover:block">
                <span className="font-semibold tabular-nums">{formatMinutes(d.minutes)}</span>
                <span className="text-muted"> · {formatDate(date, "medium")}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {days.map((d, i) => (
          <span key={d.date} className={cn("flex-1 text-center text-[10px] text-muted", i === days.length - 1 && "font-semibold text-foreground")}>
            {formatDate(parseISODate(d.date)!, "weekday").slice(0, 2)}
          </span>
        ))}
      </div>
    </div>
  );
}
