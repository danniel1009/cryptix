"use client";

import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { IconButton } from "@/components/ui/IconButton";
import { Logo } from "@/components/ui/Logo";
import { siteConfig } from "@/config/site";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { useScrolled } from "@/hooks/useScrolled";
import { useSmoothScrollTo } from "@/hooks/useSmoothScrollTo";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { useExchangeRequest } from "@/providers/ExchangeRequestProvider";

const SECTION_IDS = siteConfig.nav.map((item) => item.id);
const MOBILE_MENU_ID = "mobile-menu";
const EASE = [0.22, 1, 0.36, 1] as const;

const HEADER_VARIANTS = {
  top: {
    backgroundColor: "rgba(5, 6, 8, 0)",
    borderBottomColor: "rgba(255, 255, 255, 0)",
    boxShadow: "0 0 0 0 rgba(0, 0, 0, 0)",
  },
  scrolled: {
    backgroundColor: "rgba(5, 6, 8, 0.72)",
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    boxShadow: "0 12px 40px -24px rgba(0, 0, 0, 0.8)",
  },
} as const;

/**
 * Sticky site header. Transparent over the top of the page; turns into a glass
 * bar once scrolled. Desktop: logo · section links (scroll-spied) · language ·
 * Request Exchange. Mobile: logo · language · hamburger → <MobileMenu>.
 */
export function Navbar() {
  const { t } = useI18n();
  const { open: openExchangeRequest } = useExchangeRequest();
  const scrolled = useScrolled(12);
  const activeId = useScrollSpy(SECTION_IDS);
  const scrollTo = useSmoothScrollTo();
  const reduced = useReducedMotionSafe();
  const [menuOpen, setMenuOpen] = useState(false);

  const onNavClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    scrollTo(id);
  };

  return (
    <>
      <motion.header
        initial={false}
        animate={scrolled ? "scrolled" : "top"}
        variants={HEADER_VARIANTS}
        transition={{ duration: reduced ? 0 : 0.35, ease: EASE }}
        style={{
          backdropFilter: scrolled ? "blur(20px) saturate(140%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(140%)" : "none",
        }}
        className="sticky top-0 z-50 w-full border-b border-transparent"
      >
        <Container>
          <div className="flex h-16 items-center justify-between gap-4 lg:h-[72px]">
            {/* Brand */}
            <a
              href="#"
              onClick={(event) => onNavClick(event, "top")}
              aria-label={siteConfig.name}
              className="-ml-1 rounded-lg px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <Logo size={30} withWordmark className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
            </a>

            {/* Desktop navigation */}
            <nav aria-label={t.nav.menu} className="hidden items-center gap-1 lg:flex">
              {siteConfig.nav.map((item) => {
                const active = activeId === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={(event) => onNavClick(event, item.id)}
                    aria-current={active ? "location" : undefined}
                    className={cn(
                      "relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                      active ? "text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    {t.nav[item.id]}
                    {active ? (
                      <motion.span
                        layoutId="nav-active-dot"
                        aria-hidden="true"
                        transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
                        className="absolute bottom-0 left-[calc(50%-2px)] h-1 w-1 rounded-full bg-accent shadow-[0_0_8px_rgba(34,229,138,0.9)]"
                      />
                    ) : null}
                  </a>
                );
              })}
            </nav>

            {/* Desktop actions */}
            <div className="hidden items-center gap-3 lg:flex">
              <LanguageSwitcher variant="navbar" />
              <Button size="sm" onClick={() => openExchangeRequest()}>
                {t.nav.requestExchange}
              </Button>
            </div>

            {/* Mobile actions */}
            <div className="flex items-center gap-1 lg:hidden">
              <LanguageSwitcher variant="navbar" className="mr-1" />
              <IconButton
                label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
                icon={menuOpen ? <X /> : <Menu />}
                aria-expanded={menuOpen}
                aria-controls={MOBILE_MENU_ID}
                onClick={() => setMenuOpen((value) => !value)}
                className="-mr-2"
              />
            </div>
          </div>
        </Container>
      </motion.header>

      <MobileMenu id={MOBILE_MENU_ID} open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
