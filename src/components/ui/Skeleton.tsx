import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends ComponentPropsWithoutRef<"div"> {
  /** Render N stacked text lines (last one shorter). */
  lines?: number;
}

/** Loading placeholder with a soft shimmer. Decorative (aria-hidden). */
export function Skeleton({ lines, className, ...rest }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div aria-hidden="true" className={cn("space-y-2.5", className)} {...rest}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={cn("h-3.5 rounded-md shimmer animate-shimmer", i === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    );
  }
  return <div aria-hidden="true" className={cn("rounded-lg shimmer animate-shimmer", className)} {...rest} />;
}
