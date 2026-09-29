"use client";

import { motion } from "framer-motion";
import {
  cloneElement,
  useId,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: ReactNode;
  /** A single focusable element (button, link, icon button). */
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Hover/focus tooltip. The bubble stays in the DOM so `aria-describedby`
 * always resolves; visibility is animated. Escape hides it.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const id = useId();
  const reduced = useReducedMotionSafe();
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape") hide();
  };
  const offset = reduced ? 0 : side === "top" ? 4 : -4;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={onKeyDown}
    >
      {cloneElement(children, { "aria-describedby": id })}
      <motion.span
        id={id}
        role="tooltip"
        aria-hidden={!open}
        initial={false}
        animate={{ opacity: open ? 1 : 0, y: open ? 0 : offset }}
        transition={{ duration: reduced ? 0 : 0.15 }}
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-[16rem] -translate-x-1/2 rounded-lg border border-line bg-surface-3 px-3 py-1.5 text-xs leading-snug text-fg shadow-float",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          className,
        )}
      >
        {content}
      </motion.span>
    </span>
  );
}
