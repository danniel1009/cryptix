"use client";

import { useI18n } from "@/lib/i18n/provider";

/**
 * Accessible "skip to content" link. Client component so its label follows
 * the active language after a client-side switch (the layout is a server
 * component and would otherwise keep the label rendered at request time).
 */
export function SkipLink() {
  const { t } = useI18n();
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-bg focus:outline-none"
    >
      {t.common.skipToContent}
    </a>
  );
}
