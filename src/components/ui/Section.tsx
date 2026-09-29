import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export interface SectionProps extends ComponentPropsWithoutRef<"section"> {
  /** DOM id — must match a NAV_ITEMS href for nav targets. */
  id?: string;
  tone?: "default" | "raised" | "bordered";
}

const TONES = {
  default: "",
  raised: "bg-surface/40",
  bordered: "border-t border-line",
} as const;

/**
 * Full-width page section with the site's vertical rhythm. Put a <Container>
 * inside for the content column. `scroll-mt` adds breathing room on top of the
 * html `scroll-padding-top` (which already clears the sticky header).
 */
export function Section({ id, tone = "default", className, children, ...rest }: SectionProps) {
  return (
    <section
      id={id}
      className={cn("relative w-full scroll-mt-4 py-20 sm:py-28 lg:py-32", TONES[tone], className)}
      {...rest}
    >
      {children}
    </section>
  );
}
