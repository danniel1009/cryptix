"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { CurrencyIcon } from "@/components/ui/CurrencyIcon";
import { REVEAL_EASE } from "@/components/ui/Reveal";
import { CURRENCIES, type CurrencyCode } from "@/config/exchange";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export interface CurrencySelectProps {
  /** id of the trigger button; derived ids are built from it. */
  id: string;
  /** Accessible name of the control (rendered visually hidden). */
  label: string;
  value: CurrencyCode;
  options: readonly CurrencyCode[];
  onChange: (code: CurrencyCode) => void;
  /** Which edge of the trigger the popover aligns to. */
  align?: "left" | "right";
  className?: string;
}

/**
 * The converter's coin chip (CurrencyIcon + ticker + chevron) that sits on the
 * right of each panel, with an accessible listbox popover. Trigger = `button[aria-haspopup=listbox]`; popover = `ul[role=listbox]`
 * with `aria-activedescendant`, ArrowUp/Down/Home/End/Enter/Space/Escape,
 * type-ahead on the currency code, click-outside to close. Only the currencies
 * passed in `options` (always a subset of SUPPORTED_PAIRS) are selectable.
 */
export function CurrencySelect({ id, label, value, options, onChange, align = "right", className }: CurrencySelectProps) {
  const { t } = useI18n();
  const reduced = useReducedMotionSafe();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const labelId = `${id}-label`;
  const listId = `${id}-listbox`;
  const optionId = (code: CurrencyCode) => `${id}-option-${code}`;
  const selectedIndex = Math.max(0, options.indexOf(value));

  const openList = (index = selectedIndex) => {
    setActiveIndex(index);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
  };
  const select = (code: CurrencyCode) => {
    if (code !== value) onChange(code);
    close();
  };

  // Focus moves into the listbox once it is rendered; Escape/select return it to the trigger.
  useEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Click / tap outside closes without stealing focus.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openList(event.key === "ArrowDown" ? selectedIndex : Math.max(0, selectedIndex));
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => Math.min(last, i + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(last);
        return;
      case "Enter":
      case " ": {
        event.preventDefault();
        const code = options[Math.min(activeIndex, Math.max(0, options.length - 1))];
        if (code) select(code);
        return;
      }
      case "Escape":
        event.preventDefault();
        close();
        return;
      case "Tab":
        // Let focus move on naturally; just fold the list.
        setOpen(false);
        return;
      default: {
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const needle = event.key.toUpperCase();
          const found = options.findIndex((code) => code.startsWith(needle));
          if (found !== -1) setActiveIndex(found);
        }
      }
    }
  };

  const safeActiveIndex = Math.min(activeIndex, Math.max(0, options.length - 1));
  const activeCode = options[safeActiveIndex];

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${id}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface-3 pl-1.5 pr-3 text-sm text-fg",
          "transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-white/[0.08]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2",
          open && "border-line-strong bg-white/[0.08]",
        )}
      >
        <CurrencyIcon code={value} size={28} decorative />
        <span className="font-mono text-sm font-semibold tracking-tight">{value}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 text-muted transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={activeCode ? optionId(activeCode) : undefined}
            onKeyDown={onListKeyDown}
            initial={{ opacity: 0, y: reduced ? 0 : -6, scale: reduced ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : -4, scale: reduced ? 1 : 0.98 }}
            transition={{ duration: reduced ? 0 : 0.16, ease: REVEAL_EASE }}
            className={cn(
              "absolute top-full z-30 mt-2 w-72 max-w-[calc(100vw-2.5rem)] origin-top rounded-2xl border border-line bg-surface-2 p-1.5 shadow-float outline-none",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {options.map((code, index) => {
              const meta = CURRENCIES[code];
              const selected = code === value;
              const active = index === safeActiveIndex;
              return (
                <li
                  key={code}
                  id={optionId(code)}
                  role="option"
                  aria-selected={selected}
                  onClick={() => select(code)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-150",
                    active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
                  )}
                >
                  <CurrencyIcon code={code} size={30} decorative />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-fg">{code}</span>
                      {meta.network ? (
                        <Badge variant="neutral" size="sm">
                          {meta.network}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted">{t.common.currencyNames[meta.code]}</span>
                  </span>
                  {selected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" /> : null}
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
