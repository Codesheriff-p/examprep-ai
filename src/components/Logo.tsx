import Link from "next/link";

/** Brand mark: an answer-sheet row with the chosen bubble filled in. */
export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="var(--accent)" />
      <path d="M7.5 12.2l3 3 6-6.2" fill="none" stroke="var(--on-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-md">
      <LogoMark />
      <span className="font-display text-[17px] font-semibold tracking-[-0.02em]">
        ExamPrep<span className="text-accent"> AI</span>
      </span>
    </Link>
  );
}
