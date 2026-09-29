# Cryptix — Design System

**Mood:** premium dark fintech / crypto OTC desk. Apple-style minimalism + live-terminal accents.
Expensive, calm, trustworthy. Not a generic crypto template, no cartoon coins, no rainbow gradients.

## Tokens (defined in `src/app/globals.css`, exposed to Tailwind via `@theme inline`)
| token | value | Tailwind |
|---|---|---|
| background | `#050608` | `bg-bg` |
| surface (card) | `#0B0E12` | `bg-surface` |
| surface-2 (elevated / inputs) | `#11151B` | `bg-surface-2` |
| surface-3 (hover) | `#171C24` | `bg-surface-3` |
| line (border) | `rgba(255,255,255,0.08)` | `border-line` |
| line-strong | `rgba(255,255,255,0.14)` | `border-line-strong` |
| foreground | `#F2F4F7` | `text-fg` |
| muted | `#9AA3B2` | `text-muted` |
| faint | `#5F6B7A` | `text-faint` |
| accent (emerald/neon) | `#22E58A` | `text-accent` / `bg-accent` |
| accent-strong | `#10B981` | `bg-accent-strong` |
| accent-soft (tint) | `rgba(34,229,138,0.10)` | `bg-accent-soft` |
| accent-glow | `rgba(34,229,138,0.35)` | shadows |
| danger | `#F0525F` | `text-danger` |
| warning | `#F5B942` | `text-warning` |

Fonts: `--font-geist-sans` (UI, headings — tight tracking, `font-semibold`/`font-medium`), `--font-geist-mono` (prices, rates, numbers, badges, labels like "01").

## Utilities (globals.css)
`.glass` (translucent surface + backdrop blur + 1px line), `.glow-accent` (soft emerald box-shadow), `.text-glow`, `.grid-bg` (faint grid), `.noise` (very subtle), `.ring-accent` focus ring, `.scrollbar-thin`.

## Layout
- Sections are **full-width** (`w-full`) with an inner `<Container>` = `mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 2xl:px-16`. Never wrap the whole page in a narrow column.
- Vertical rhythm: `py-20 sm:py-28 lg:py-32` per section. Hero is `min-h-[92svh]`.
- Headings: eyebrow (mono, accent, uppercase, tracking-[0.2em], text-xs) → h2 (`text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight`) → description (`text-muted text-base sm:text-lg max-w-2xl`).
- Hero h1: `text-4xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] font-semibold tracking-[-0.03em] leading-[0.95] uppercase`.
- Cards: `rounded-2xl border border-line bg-surface/80` + hover `border-line-strong` + slight lift. Important cards get `.glow-accent`.
- Buttons: primary = accent background, black text, `rounded-full` or `rounded-xl`, `font-semibold`, `uppercase tracking-wider text-sm` for hero CTAs; secondary = `border border-line-strong bg-white/[0.03] hover:bg-white/[0.06]`; ghost = text only.
- Badge "+5% FROM MARKET": mono, accent text on accent-soft background, 1px accent/30 border, rounded-full.
- Live indicator: 8px dot; live = accent with pulsing halo; reconnecting = hollow ring, warning colour; unavailable = faint, no pulse.

## Motion (Framer Motion)
Fade-up reveal `{opacity:0,y:24} → {opacity:1,y:0}`, `duration 0.6`, `ease [0.22,1,0.36,1]`, `viewport once, margin -80px`. Stagger children 0.08s. Hover: `y:-2`, border brightens. Numbers: animate on change with a brief green/red flash. Reduced motion: disable transforms.

## Responsive
Mobile is a real mobile layout: stacked rate checker (send → arrow → receive), market rows as stacked cards (or horizontal snap-scroll), full-screen slide-in mobile menu, 44px+ tap targets, inputs `text-base` (avoid iOS zoom), floating WhatsApp button `bottom-5 right-5` above safe-area.
