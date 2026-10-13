"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { addDays, formatDate, isSameDay, parseISODate, relativeDay, startOfDay, toISODate } from "@/lib/format";
import { inputClasses } from "./Field";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const QUICK_PICKS = [
  { label: "In 1 week", days: 7 },
  { label: "In 2 weeks", days: 14 },
  { label: "In 4 weeks", days: 28 },
];

/** Monday-first 6×7 grid of dates covering the month that contains `month`. */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * Calendar date picker that submits a yyyy-mm-dd value through a hidden input.
 * Keyboard: arrows move by day/week, PageUp/PageDown by month, Enter picks, Escape closes.
 */
export function DatePicker({
  name,
  id,
  defaultValue,
  minToday = false,
  placeholder = "Pick a date",
  className,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  minToday?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const autoId = useId();
  const buttonId = id ?? `date-${autoId}`;
  const [value, setValue] = useState<Date | null>(() => parseISODate(defaultValue));
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [view, setView] = useState<Date>(() => value ?? new Date());
  const [focused, setFocused] = useState<Date>(() => value ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());

  const days = useMemo(() => monthGrid(view), [view]);
  const isDisabled = (d: Date) => minToday && startOfDay(d) < today;

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // Keep keyboard focus on the focused day while the calendar is open.
  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${toISODate(focused)}"]`)?.focus();
  }, [open, focused]);

  function openCalendar() {
    // Open upwards when the calendar (~400px) wouldn't fit below the field.
    const rect = document.getElementById(buttonId)?.getBoundingClientRect();
    setDropUp(!!rect && window.innerHeight - rect.bottom < 410 && rect.top > 410);
    const start = value ?? new Date();
    setView(start);
    setFocused(start);
    setOpen(true);
  }

  function pick(date: Date) {
    if (isDisabled(date)) return;
    setValue(date);
    setOpen(false);
    document.getElementById(buttonId)?.focus();
  }

  function moveFocus(next: Date) {
    setFocused(next);
    if (next.getMonth() !== view.getMonth() || next.getFullYear() !== view.getFullYear()) setView(next);
  }

  function onGridKey(e: React.KeyboardEvent) {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in map) {
      e.preventDefault();
      moveFocus(addDays(focused, map[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const d = new Date(focused);
      d.setMonth(d.getMonth() + (e.key === "PageUp" ? -1 : 1));
      moveFocus(d);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      document.getElementById(buttonId)?.focus();
    }
  }

  function shiftMonth(step: number) {
    const d = new Date(view.getFullYear(), view.getMonth() + step, 1, 12);
    setView(d);
    setFocused(d);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={toISODate(value)} />
      <div className="relative">
        <button
          id={buttonId}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openCalendar())}
          className={cn(
            inputClasses,
            "flex h-10 cursor-pointer items-center gap-2.5 pr-10 text-left",
            open && "border-accent ring-4 ring-accent/15",
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          {value ? (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate">{formatDate(value, "medium")}</span>
              <span className="truncate text-xs text-muted">{relativeDay(value)}</span>
            </span>
          ) : (
            <span className="text-muted/70">{placeholder}</span>
          )}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => setValue(null)}
            aria-label="Clear date"
            className="absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Choose a date"
          className={cn(
            "absolute left-0 z-40 w-[19rem] max-w-[calc(100vw-2rem)] animate-pop-in rounded-2xl border border-border bg-surface p-3 shadow-xl shadow-black/10",
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="font-display text-sm font-semibold" aria-live="polite">{formatDate(view, "month-year")}</p>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted">
            {WEEKDAYS.map((d) => <span key={d} className="py-1">{d}</span>)}
          </div>
          <div ref={gridRef} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const inMonth = d.getMonth() === view.getMonth();
              const selected = value && isSameDay(d, value);
              const isToday = isSameDay(d, today);
              const disabled = isDisabled(d);
              const isFocused = isSameDay(d, focused);
              return (
                <button
                  key={toISODate(d)}
                  type="button"
                  data-date={toISODate(d)}
                  tabIndex={isFocused ? 0 : -1}
                  disabled={disabled}
                  onClick={() => pick(d)}
                  aria-pressed={!!selected}
                  aria-label={formatDate(d, "long")}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "relative flex h-9 cursor-pointer items-center justify-center rounded-lg text-sm tabular-nums transition-colors duration-100",
                    inMonth ? "text-foreground" : "text-muted/50",
                    !selected && !disabled && "hover:bg-surface-2",
                    isToday && !selected && "font-semibold text-accent",
                    selected && "bg-accent font-semibold text-on-accent",
                    disabled && "cursor-not-allowed opacity-30",
                    "focus-visible:outline-2 focus-visible:outline-accent",
                  )}
                >
                  {d.getDate()}
                  {isToday && !selected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            {QUICK_PICKS.map((q) => (
              <button
                key={q.days}
                type="button"
                onClick={() => pick(addDays(today, q.days))}
                className="cursor-pointer rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
