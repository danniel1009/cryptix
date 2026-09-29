"use client";

import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

export interface StatementProps {
  children: ReactNode;
  className?: string;
}

/**
 * The reference's "statement section": one large, centred, regular-weight
 * sentence with generous vertical air, closed by a short glowing hairline.
 */
export function Statement({ children, className }: StatementProps) {
  return (
    <Reveal className={cn("py-6 sm:py-10 lg:py-12", className)}>
      <p className="mx-auto max-w-4xl text-balance text-center text-3xl font-normal leading-[1.15] tracking-[-0.02em] text-fg sm:text-4xl lg:text-[2.75rem]">
        {children}
      </p>
      <span
        aria-hidden="true"
        className="mx-auto mt-12 block h-px w-28 bg-linear-to-r from-transparent via-accent/70 to-transparent sm:mt-14"
      />
    </Reveal>
  );
}
