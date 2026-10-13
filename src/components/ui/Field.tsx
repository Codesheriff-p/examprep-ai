import { cn } from "@/lib/cn";

export const inputClasses =
  "w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:opacity-50";

export function Label({ className, optional, children, ...props }: React.ComponentProps<"label"> & { optional?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium", className)} {...props}>
      {children}
      {optional && <span className="font-normal text-muted"> (optional)</span>}
    </label>
  );
}

export function Hint({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("mt-1.5 text-xs text-muted", className)} {...props} />;
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(inputClasses, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(inputClasses, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

/** Label + control + optional hint, stacked. */
export function Field({
  label,
  htmlFor,
  hint,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} optional={optional}>{label}</Label>
      {children}
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}
