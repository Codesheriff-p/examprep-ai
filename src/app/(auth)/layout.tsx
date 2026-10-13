import { CalendarDays, Layers, MessageSquareText } from "lucide-react";
import { Logo } from "@/components/Logo";

const POINTS = [
  { icon: Layers, text: "Quizzes and flashcards written from your own notes" },
  { icon: MessageSquareText, text: "A tutor that explains what you got wrong" },
  { icon: CalendarDays, text: "A daily plan that runs up to your exam" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink p-10 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Faint answer-sheet grid in the background. */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.045]" aria-hidden="true">
          <defs>
            <pattern id="bubbles" width="44" height="44" patternUnits="userSpaceOnUse">
              <circle cx="22" cy="22" r="9" fill="none" stroke="white" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bubbles)" />
        </svg>
        <div className="relative [&_a]:text-white [&_span]:text-white">
          <Logo />
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl leading-tight font-semibold tracking-[-0.02em]">Know what to study tonight.</h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-white/80">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4 text-white" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/50">Powered by Claude</p>
      </aside>
      <main id="main" className="flex items-center justify-center px-4 py-12 sm:px-8">
        {children}
      </main>
    </div>
  );
}
