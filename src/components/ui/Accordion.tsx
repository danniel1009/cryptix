"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { cn } from "@/lib/utils";

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Allow several panels open at once. Default false (opening one closes the rest). */
  allowMultiple?: boolean;
  /** Ids open on first render. */
  defaultOpen?: string[];
  /** Heading level wrapping each trigger (WAI-ARIA pattern). Default h3. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
  itemClassName?: string;
  onToggle?: (id: string, open: boolean) => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Accessible accordion: <hN><button aria-expanded aria-controls></button></hN>
 * + role="region" panel. Enter/Space toggle (native button), ArrowUp/Down move
 * focus between triggers, Home/End jump to first/last.
 */
export function Accordion({
  items,
  allowMultiple = false,
  defaultOpen = [],
  headingLevel = 3,
  className,
  itemClassName,
  onToggle,
}: AccordionProps) {
  const uid = useId();
  const reduced = useReducedMotionSafe();
  const [openIds, setOpenIds] = useState<string[]>(defaultOpen);
  const triggersRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const Heading = `h${headingLevel}` as const;

  const toggle = useCallback(
    (id: string) => {
      setOpenIds((current) => {
        const isOpen = current.includes(id);
        onToggle?.(id, !isOpen);
        if (isOpen) return current.filter((x) => x !== id);
        return allowMultiple ? [...current, id] : [id];
      });
    },
    [allowMultiple, onToggle],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const count = items.length;
    let next = index;
    if (event.key === "ArrowDown") next = (index + 1) % count;
    if (event.key === "ArrowUp") next = (index - 1 + count) % count;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = count - 1;
    triggersRef.current.get(items[next].id)?.focus();
  };

  return (
    <div className={cn("divide-y divide-line border-y border-line", className)}>
      {items.map((item, index) => {
        const isOpen = openIds.includes(item.id);
        const triggerId = `${uid}-${item.id}-trigger`;
        const panelId = `${uid}-${item.id}-panel`;
        return (
          <div key={item.id} className={cn("group", itemClassName)}>
            <Heading className="m-0">
              <button
                ref={(el) => {
                  if (el) triggersRef.current.set(item.id, el);
                  else triggersRef.current.delete(item.id);
                }}
                type="button"
                id={triggerId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                onKeyDown={(e) => onKeyDown(e, index)}
                className={cn(
                  "flex w-full items-center justify-between gap-6 py-5 text-left text-base font-medium transition-colors sm:text-lg",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-4 focus-visible:ring-offset-bg rounded-sm",
                  isOpen ? "text-fg" : "text-fg/90 hover:text-accent",
                )}
              >
                <span>{item.title}</span>
                <motion.span
                  aria-hidden="true"
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: reduced ? 0 : 0.25, ease: EASE }}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                    isOpen ? "border-accent/50 bg-accent-soft text-accent" : "border-line text-muted group-hover:border-line-strong",
                  )}
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </motion.span>
              </button>
            </Heading>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  key="panel"
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.32, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="pb-6 pr-14 text-sm leading-relaxed text-muted sm:text-base">{item.content}</div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
