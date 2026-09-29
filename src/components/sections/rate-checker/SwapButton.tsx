"use client";

import { motion } from "framer-motion";
import { ArrowDownUp } from "lucide-react";
import { useState } from "react";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { cn } from "@/lib/utils";

export interface SwapButtonProps {
  /** Accessible name (the button has no visible text). */
  label: string;
  /** No reverse pair: shown faint, announced as disabled, click is a no-op. */
  disabled?: boolean;
  onSwap: () => void;
  className?: string;
}

const SPRING = { type: "spring" as const, stiffness: 260, damping: 18, mass: 0.8 };

/**
 * The circular 48px emerald swap button that sits exactly between the two
 * converter panels. `ring-4 ring-bg` cuts a halo out of both panels; the
 * ⇅ icon turns another 180° with a spring on every click (instant under
 * reduced motion). Focus is shown with an outline just outside the halo.
 */
export function SwapButton({ label, disabled = false, onSwap, className }: SwapButtonProps) {
  const reduced = useReducedMotionSafe();
  const [turns, setTurns] = useState(0);

  const handleClick = () => {
    if (disabled) return;
    onSwap();
    setTurns((n) => n + 1);
  };

  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={handleClick}
      className={cn(
        "inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg ring-4 ring-bg",
        "shadow-[0_8px_24px_-8px_rgba(34,229,138,0.6)]",
        "transition-[background-color,box-shadow,opacity,transform] duration-200 ease-out-expo",
        "hover:bg-[#3AF29B] hover:shadow-[0_10px_28px_-8px_rgba(34,229,138,0.75)] active:scale-95",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent/70",
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:shadow-none aria-disabled:hover:bg-accent aria-disabled:active:scale-100",
        className,
      )}
    >
      <motion.span
        aria-hidden="true"
        className="inline-flex"
        animate={{ rotate: turns * 180 }}
        transition={reduced ? { duration: 0 } : SPRING}
      >
        <ArrowDownUp className="h-5 w-5" strokeWidth={2.25} />
      </motion.span>
    </button>
  );
}
