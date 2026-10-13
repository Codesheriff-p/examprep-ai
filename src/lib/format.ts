/** Date and number formatting shared by server and client components. */

const LOCALE = "en-GB";
const DAY_MS = 86_400_000;

export function percent(x: number) {
  return `${Math.round(x * 100)}%`;
}

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Whole calendar days from today to `date` (negative if in the past). */
export function daysUntil(date: Date, now = new Date()) {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

/** "today", "tomorrow", "in 5 days", "in 3 weeks", "2 days ago"… */
export function relativeDay(date: Date, now = new Date()) {
  const days = daysUntil(date, now);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  const abs = Math.abs(days);
  const phrase = abs < 14 ? `${abs} days` : abs < 60 ? `${Math.round(abs / 7)} weeks` : `${Math.round(abs / 30)} months`;
  return days > 0 ? `in ${phrase}` : `${phrase} ago`;
}

type DateStyle = "short" | "medium" | "long" | "weekday" | "day-month" | "month-year";

const STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short" }, // 25 Oct
  medium: { weekday: "short", day: "numeric", month: "short" }, // Sun 25 Oct
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" }, // Sunday 25 October 2026
  weekday: { weekday: "long" }, // Sunday
  "day-month": { day: "numeric", month: "long" }, // 25 October
  "month-year": { month: "long", year: "numeric" }, // October 2026
};

/** Formats a date; adds the year only when it isn't the current year (for short/medium). */
export function formatDate(date: Date, style: DateStyle = "medium") {
  const opts = { ...STYLES[style] };
  if ((style === "short" || style === "medium") && date.getFullYear() !== new Date().getFullYear()) {
    opts.year = "numeric";
  }
  return new Intl.DateTimeFormat(LOCALE, opts).format(date).replace(",", "");
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** yyyy-mm-dd in local time (for date inputs and grouping by day). */
export function toISODate(date: Date | null) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses yyyy-mm-dd as a local date (midday, so DST shifts never change the day). */
export function parseISODate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
