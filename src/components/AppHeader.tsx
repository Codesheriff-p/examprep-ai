import Link from "next/link";
import { Flame, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Logo } from "./Logo";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function AppHeader({ userName, streak }: { userName: string; streak?: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo href="/dashboard" />
          <nav className="hidden sm:block">
            <Link href="/dashboard" className="rounded-md text-sm text-muted transition-colors hover:text-foreground">
              My courses
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {streak !== undefined && streak > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn tabular-nums"
              title={`${streak}-day study streak`}
            >
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              {streak}
              <span className="sr-only">-day study streak</span>
            </span>
          )}
          <Link
            href="/account"
            className="flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 transition-colors hover:bg-surface-2"
            title="Account settings"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent"
              aria-hidden="true"
            >
              {initials(userName)}
            </span>
            <span className="hidden text-sm font-medium sm:inline">{userName}</span>
            <span className="sr-only sm:hidden">Account settings</span>
          </Link>
          <span className="h-5 w-px bg-border" aria-hidden="true" />
          <form action={logout}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Log out" title="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
