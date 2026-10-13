import { SearchX } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Logo href="/dashboard" />
      <span className="mt-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <SearchX className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        This page doesn&apos;t exist, or it belongs to a course that was deleted or isn&apos;t yours.
      </p>
      <ButtonLink href="/dashboard" className="mt-6">Back to my courses</ButtonLink>
    </main>
  );
}
