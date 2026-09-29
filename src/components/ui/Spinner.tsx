import { cn } from "@/lib/utils";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg" | number;
  className?: string;
  /** Accessible label (e.g. t.common.loading). Without it the spinner is decorative. */
  label?: string;
}

const SIZES = { sm: 16, md: 20, lg: 28 } as const;

/** Circular indeterminate spinner (track + arc), inherits `currentColor`. */
export function Spinner({ size = "md", className, label }: SpinnerProps) {
  const px = typeof size === "number" ? size : SIZES[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      focusable="false"
      className={cn("shrink-0 animate-spin", className)}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
