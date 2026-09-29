import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";

/**
 * Minimal branded 404. Rendered inside the root layout (navbar/footer present).
 * The copy is a short bilingual line: 404 has no dictionary namespace.
 */
export default function NotFound() {
  return (
    <section className="grid-bg relative flex min-h-[70svh] w-full items-center py-24">
      <Container className="flex flex-col items-center text-center">
        <Logo size={44} />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.24em] text-accent">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Page not found
          <span className="mx-3 text-faint" aria-hidden="true">
            ·
          </span>
          Halaman tidak ditemukan
        </h1>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-full border border-line-strong bg-white/[0.03] px-5 text-sm font-semibold text-fg transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <span lang="en">Back to home</span>
          <span className="mx-2 text-faint" aria-hidden="true">
            ·
          </span>
          <span lang="id">Kembali ke beranda</span>
        </Link>
      </Container>
    </section>
  );
}
