import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DividerProps extends ComponentPropsWithoutRef<"div"> {
  /** Optional centred label (mono, faint). */
  label?: ReactNode;
  orientation?: "horizontal" | "vertical";
}

export function Divider({ label, orientation = "horizontal", className, ...rest }: DividerProps) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn("h-full w-px self-stretch bg-line", className)}
        {...rest}
      />
    );
  }
  if (!label) {
    return <div role="separator" className={cn("h-px w-full bg-line", className)} {...rest} />;
  }
  return (
    <div role="separator" className={cn("flex items-center gap-4", className)} {...rest}>
      <span className="h-px flex-1 bg-line" />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
