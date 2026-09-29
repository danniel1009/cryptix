import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "accent" | "neutral" | "success" | "danger" | "warning" | "outline";

export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  /** Leading status dot in the badge colour. */
  dot?: boolean;
}

const VARIANTS: Record<BadgeVariant, string> = {
  accent: "border-accent/30 bg-accent-soft text-accent",
  neutral: "border-line bg-white/[0.04] text-muted",
  success: "border-accent-strong/40 bg-accent-strong/10 text-accent",
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
  outline: "border-line-strong bg-transparent text-fg",
};

const SIZES = {
  sm: "px-2 py-[3px] text-[10px]",
  md: "px-2.5 py-1 text-[11px]",
} as const;

/** Mono, uppercase pill — e.g. "+5% FROM MARKET", "LIVE", "TRC20". */
export function Badge({ variant = "accent", size = "md", dot = false, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-mono font-medium uppercase leading-none tracking-[0.14em]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {dot ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
