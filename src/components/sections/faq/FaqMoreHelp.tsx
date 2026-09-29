"use client";

import type { MouseEvent } from "react";
import { useSmoothScrollTo } from "@/hooks/useSmoothScrollTo";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export interface FaqMoreHelpProps {
  className?: string;
}

/**
 * "Still have a question? Contact our team" — the quiet line under the
 * accordion. The link targets #contact with the header-aware smooth scroll and
 * degrades to the native anchor jump when that section is not on the page.
 */
export function FaqMoreHelp({ className }: FaqMoreHelpProps) {
  const { t } = useI18n();
  const scrollTo = useSmoothScrollTo();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (scrollTo("contact")) event.preventDefault();
  };

  return (
    <p className={cn("text-sm text-muted", className)}>
      {t.faq.moreHelp}{" "}
      <a
        href="#contact"
        onClick={onClick}
        className={cn(
          "inline-flex min-h-11 items-center font-medium text-fg underline decoration-line-strong underline-offset-4",
          "transition-colors hover:text-accent hover:decoration-accent/60",
          "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-4 focus-visible:ring-offset-bg",
        )}
      >
        {t.faq.moreHelpCta}
      </a>
    </p>
  );
}
