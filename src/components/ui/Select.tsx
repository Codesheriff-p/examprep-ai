"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClasses } from "./Field";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

/**
 * Accessible custom dropdown (WAI-ARIA "select-only combobox" pattern).
 * Renders a hidden input so it works inside ordinary <form action={…}> forms.
 */
export function Select({
  name,
  id,
  options,
  defaultValue,
  value: controlled,
  onChange,
  placeholder = "Select…",
  className,
  "aria-label": ariaLabel,
}: {
  name?: string;
  id?: string;
  options: SelectOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const autoId = useId();
  const buttonId = id ?? `select-${autoId}`;
  const listId = `${buttonId}-list`;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const value = controlled ?? uncontrolled;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const typeahead = useRef({ text: "", timer: 0 });

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function openList() {
    const rect = buttonRef.current?.getBoundingClientRect();
    setDropUp(!!rect && window.innerHeight - rect.bottom < 280 && rect.top > 280);
    const index = options.findIndex((o) => o.value === value);
    setActive(index >= 0 ? index : options.findIndex((o) => !o.disabled));
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    if (controlled === undefined) setUncontrolled(option.value);
    onChange?.(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function move(from: number, step: 1 | -1) {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + step + options.length) % options.length;
      if (!options[i].disabled) return i;
    }
    return from;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => move(a, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => move(a, -1));
        break;
      case "Home":
        e.preventDefault();
        setActive(move(-1, 1));
        break;
      case "End":
        e.preventDefault();
        setActive(move(options.length, -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (e.key.length === 1) {
          const t = typeahead.current;
          window.clearTimeout(t.timer);
          t.text += e.key.toLowerCase();
          t.timer = window.setTimeout(() => (t.text = ""), 500);
          const i = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(t.text));
          if (i >= 0) setActive(i);
        }
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          inputClasses,
          "flex h-10 cursor-pointer items-center justify-between gap-2 text-left",
          open && "border-accent ring-4 ring-accent/15",
        )}
      >
        <span className={cn("truncate", !selected && "text-muted/70")}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          tabIndex={-1}
          className={cn(
            "absolute z-40 max-h-64 w-full min-w-44 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-xl shadow-black/10 animate-pop-in",
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={o.disabled || undefined}
                onPointerEnter={() => !o.disabled && setActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-sm",
                  i === active && !o.disabled && "bg-surface-2",
                  o.disabled && "cursor-not-allowed opacity-40",
                )}
              >
                <Check className={cn("mt-0.5 h-4 w-4 shrink-0 text-accent", !isSelected && "invisible")} aria-hidden="true" />
                <span className="min-w-0">
                  <span className={cn("block", isSelected && "font-medium")}>{o.label}</span>
                  {o.description && <span className="block text-xs text-muted">{o.description}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
