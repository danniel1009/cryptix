import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** Keyboard key chip, e.g. <Kbd>Esc</Kbd>. */
export function Kbd({ className, children, ...rest }: ComponentPropsWithoutRef<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-line bg-surface-2 px-1.5 font-mono text-[11px] font-medium text-muted shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}
