"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Route-level error boundary (renders inside the root layout, so providers are
 * available). Never shows the error message itself — nothing user-facing here
 * should leak internals. A digest is logged for support.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("[app] route error", error.digest ?? error.message);
  }, [error]);

  return (
    <section className="grid-bg relative flex min-h-[70svh] w-full items-center py-24">
      <Container className="flex flex-col items-center text-center">
        <Logo size={44} />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.24em] text-danger">Error</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          <span lang="en">Something went wrong</span>
          <span className="mx-3 text-faint" aria-hidden="true">
            ·
          </span>
          <span lang="id">Terjadi kesalahan</span>
        </h1>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-faint">{error.digest}</p>
        ) : null}
        <Button variant="secondary" className="mt-8" onClick={() => reset()}>
          {t.common.retry}
        </Button>
      </Container>
    </section>
  );
}
