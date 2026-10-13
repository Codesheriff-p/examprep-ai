import { cn } from "@/lib/cn";

export type SegmentOption = { value: string; label: React.ReactNode; disabled?: boolean };

/** A radio group styled as a segmented control. Works inside plain forms. */
export function Segmented({
  name,
  options,
  defaultValue,
  className,
}: {
  name: string;
  options: SegmentOption[];
  defaultValue: string;
  className?: string;
}) {
  return (
    <div
      className={cn("grid rounded-xl bg-surface-2 p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className="cursor-pointer rounded-lg px-2 py-1.5 text-center text-sm text-muted transition-colors duration-150 has-checked:bg-surface has-checked:font-medium has-checked:text-foreground has-checked:shadow-sm has-disabled:cursor-not-allowed has-disabled:opacity-40 has-focus-visible:outline-2 has-focus-visible:outline-accent"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={o.value === defaultValue}
            disabled={o.disabled}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
