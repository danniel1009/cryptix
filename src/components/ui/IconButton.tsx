import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  /** Accessible name — required because the button has no visible text. */
  label: string;
  icon: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "secondary" | "outline";
  ref?: Ref<HTMLButtonElement>;
}

const SIZES = {
  sm: "h-9 w-9 [&>svg]:h-4 [&>svg]:w-4",
  md: "h-11 w-11 [&>svg]:h-5 [&>svg]:w-5",
  lg: "h-12 w-12 [&>svg]:h-6 [&>svg]:w-6",
} as const;

const VARIANTS = {
  ghost: "text-muted hover:bg-white/[0.06] hover:text-fg",
  secondary: "border border-line-strong bg-white/[0.03] text-fg hover:bg-white/[0.07]",
  outline: "border border-accent/40 text-accent hover:bg-accent-soft",
} as const;

/** Square, 44px+ tap-target icon button with a mandatory aria-label. */
export function IconButton({
  label,
  icon,
  size = "md",
  variant = "ghost",
  className,
  type = "button",
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,border-color,transform] duration-200",
        "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:pointer-events-none disabled:opacity-50",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
