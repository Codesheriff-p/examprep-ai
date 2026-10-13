import { cn } from "@/lib/cn";

export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("font-mono text-[11px] font-medium tracking-[0.12em] text-muted uppercase", className)} {...props} />;
}

export function PageTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return <h1 className={cn("font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl", className)} {...props} />;
}

export function SectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("font-display text-lg font-semibold tracking-tight", className)} {...props} />;
}

export function Muted({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}
