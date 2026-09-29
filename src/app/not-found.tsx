import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { getServerDictionary } from "@/lib/i18n/server";

/**
 * Branded 404, rendered inside the root layout (navbar/footer present) in the
 * visitor's language (cookie locale, resolved on the server).
 */
export default async function NotFound() {
  const { t } = await getServerDictionary();
  return (
    <section className="grid-bg relative flex min-h-[70svh] w-full items-center py-24">
      <Container className="flex flex-col items-center text-center">
        <Logo size={44} />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.24em] text-accent">{t.system.notFoundEyebrow}</p>
        <h1 className="mt-3 text-3xl font-normal tracking-tight text-fg sm:text-4xl">{t.system.notFoundTitle}</h1>
        <p className="mt-3 max-w-md text-sm text-muted">{t.system.notFoundBody}</p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-full border border-line-strong bg-white/[0.03] px-5 text-sm font-medium text-fg transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {t.system.backHome}
        </Link>
      </Container>
    </section>
  );
}
