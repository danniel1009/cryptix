"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

export type LanguageSwitcherVariant = "navbar" | "footer" | "mobile";

export interface LanguageSwitcherProps {
  /**
   * navbar — compact "EN | ID" segmented pill (mono, uppercase).
   * footer — "English | Bahasa Indonesia" text buttons.
   * mobile — two large full-width buttons for the slide-in menu.
   */
  variant?: LanguageSwitcherVariant;
  className?: string;
}

/**
 * Language switcher bound to the i18n context. Renders one toggle button per
 * locale inside a `role="group"` labelled with `t.nav.language`; the active
 * option is exposed with `aria-pressed`. Buttons are natively keyboard
 * operable (Enter / Space); Arrow keys, Home and End additionally move focus
 * between the options so the group behaves like a segmented control.
 *
 * Language names come from `LOCALE_LABELS` (proper nouns, never translated).
 */
export function LanguageSwitcher({ variant = "navbar", className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const groupRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;
    if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return;
    const options = Array.from(
      groupRef.current?.querySelectorAll<HTMLButtonElement>("button[data-locale]") ?? [],
    );
    if (options.length === 0) return;
    const current = options.findIndex((el) => el === document.activeElement);
    let next = 0;
    if (current !== -1) {
      if (key === "Home") next = 0;
      else if (key === "End") next = options.length - 1;
      else if (key === "ArrowRight") next = (current + 1) % options.length;
      else next = (current - 1 + options.length) % options.length;
    }
    event.preventDefault();
    options[next]?.focus();
  }, []);

  const select = useCallback(
    (next: Locale) => {
      if (next !== locale) setLocale(next);
    },
    [locale, setLocale],
  );

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

  const groupClass = {
    navbar:
      "inline-flex items-center rounded-full border border-line bg-surface-2/70 p-0.5 font-mono text-xs uppercase tracking-wider",
    footer: "inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm",
    mobile: "grid w-full grid-cols-2 gap-3",
  }[variant];

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={t.nav.language}
      className={cn(groupClass, className)}
      onKeyDown={onKeyDown}
    >
      {LOCALES.map((code, index) => {
        const active = code === locale;
        const label = LOCALE_LABELS[code];
        const showDivider = index > 0 && variant !== "mobile";
        return (
          <div key={code} className="contents">
            {showDivider && (
              <span
                aria-hidden="true"
                className={cn(
                  variant === "navbar" ? "mx-0.5 h-3 w-px bg-line-strong" : "text-faint select-none",
                )}
              >
                {variant === "footer" ? "|" : null}
              </span>
            )}
            <button
              type="button"
              data-locale={code}
              lang={code}
              aria-pressed={active}
              aria-label={variant === "navbar" ? label.long : undefined}
              onClick={() => select(code)}
              className={cn(
                "transition-colors duration-200",
                focusRing,
                variant === "navbar" && [
                  "rounded-full px-3 py-1 leading-none min-h-11 lg:min-h-0 lg:px-2.5",
                  active ? "bg-accent-soft text-accent" : "text-muted hover:text-fg",
                ],
                variant === "footer" && [
                  "rounded-md px-1 py-0.5",
                  active ? "font-medium text-fg" : "text-muted hover:text-fg",
                ],
                variant === "mobile" && [
                  "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl border px-4 py-3 text-base font-medium",
                  active
                    ? "border-accent/40 bg-accent-soft text-accent"
                    : "border-line-strong bg-white/[0.03] text-fg hover:bg-white/[0.06]",
                ],
              )}
            >
              {variant === "navbar" ? (
                label.short
              ) : variant === "footer" ? (
                label.long
              ) : (
                <>
                  <span>{label.long}</span>
                  <span className="font-mono text-xs uppercase tracking-wider opacity-70">
                    {label.short}
                  </span>
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
