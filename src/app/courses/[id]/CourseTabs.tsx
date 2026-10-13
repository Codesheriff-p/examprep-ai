"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, CalendarDays, FileText, LayoutGrid, Layers, LineChart, MessageSquareText, Timer } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "", label: "Overview", icon: LayoutGrid },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/quizzes", label: "Quizzes & exams", icon: BookOpenCheck },
  { href: "/tutor", label: "AI Tutor", icon: MessageSquareText },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/plan", label: "Planner", icon: CalendarDays },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/progress", label: "Progress", icon: LineChart },
];

export function CourseTabs({ courseId, dueCards }: { courseId: string; dueCards: number }) {
  const pathname = usePathname();
  const base = `/courses/${courseId}`;
  return (
    <nav
      aria-label="Course sections"
      className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] max-lg:[mask-image:linear-gradient(to_right,black_85%,transparent)]"
    >
      {TABS.map(({ href: suffix, label, icon: Icon }) => {
        const href = base + suffix;
        const active = suffix === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-t-md border-b-2 px-3 py-3 text-sm transition-colors duration-150",
              active ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4", active && "text-accent")} aria-hidden="true" />
            {label}
            {suffix === "/flashcards" && dueCards > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[10px] leading-4 font-semibold text-on-accent tabular-nums">
                {dueCards}
                <span className="sr-only"> due</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
