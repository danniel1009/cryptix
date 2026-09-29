"use client";

import { Handshake } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { useI18n } from "@/lib/i18n/provider";

/** Quiet closing row: no custody on this website, every exchange is confirmed by the team. */
export function SecurityNote({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Reveal className={className}>
      <div className="mx-auto flex max-w-3xl items-start gap-4 rounded-2xl border border-line bg-surface/60 p-5 sm:items-center sm:gap-5 sm:p-6">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-accent"
        >
          <Handshake className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <p className="text-sm leading-relaxed text-muted sm:text-base">{t.security.note}</p>
      </div>
    </Reveal>
  );
}
