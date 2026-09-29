# Cryptix — Design System

**Mood:** premium dark fintech / crypto OTC desk. Apple-style restraint + live-terminal accents.
Expensive, calm, trustworthy. Not a generic crypto template, no cartoon coins, no rainbow gradients.

## Reference analysis (the "Cryptix — Crypto SaaS Template" screenshot)
What the reference does — and we adopt — while redesigning the UX for a manual exchange desk:
- **Typography is light, large and sentence case.** Hero headline ≈ 72–88px, weight 400–500, tracking ≈ -0.03em, line-height ≈ 1.02, white. Section titles ≈ 40–44px, weight 400–500, sentence case ("Why choose Cryptix?"). Body copy is small (15–16px) and grey. **No heavy uppercase display headings.** Uppercase is reserved for tiny mono labels (eyebrows, badges, "LIVE", "+5% FROM MARKET").
- **Hero silhouette:** centred headline → short grey sub-copy → ONE neon-green pill CTA with a green glow + a quieter secondary link → small trust line → a thin **horizontal glowing light line** (a 1px bright emerald line with a wide soft glow, fading at both ends) → a large dark **product panel** that starts right under it. For us the product panel IS the **Rate Checker** ("Quick swap"-style card: two stacked amount rows with a currency chip + chevron, a circular swap/arrow icon between them, then a dark full-width action button) side by side with a compact **Live Market** table (coin icon, pair, price, change coloured green/red).
- **Buttons:** pill (`rounded-full`), primary = neon green bg (#22E58A) + near-black text + soft green glow; secondary = dark bg (#121419) + 1px border (#262A33) + white text. Arrow icon (↗) allowed on the primary.
- **Navbar:** logo mark + wordmark on the left, small grey links, a pill button on the right; on a transparent background that gains a subtle glass tint on scroll.
- **Cards:** #111318–#121419 fill, 1px border #23262E, `rounded-2xl`, generous inner padding, muted labels in 12–13px, values in mono. Tables have hairline row dividers, no zebra.
- **Statement section:** one big centred 3-line sentence in regular weight (~40px) with lots of vertical air around it.
- **Ruled feature grid:** a full-bleed 4-column grid whose columns are separated by 1px vertical lines and bounded by a top and bottom hairline; each cell has a **circular icon well** (48px dark circle with a 1px border, white/accent icon), a medium-weight title and a grey body. Use it for "Why choose us" and the Security items.
- **Depth:** near-black page, subtle radial emerald glow behind the hero and behind the panel edge; light comes from the glowing line. Faint grid/noise allowed at ≤4% opacity.

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

Fonts: `--font-geist-sans` (UI + headings at **weight 400–500**, tight tracking), `--font-geist-mono` (prices, rates, numbers, badges, tiny labels like "01").

## Utilities (globals.css)
`.glass` (translucent surface + backdrop blur + 1px line), `.glow-accent` (soft emerald box-shadow), `.text-glow`, `.grid-bg` (faint grid), `.noise` (very subtle), `.scrollbar-thin`, `.hide-scrollbar`.

## Layout
- Sections are **full-width** (`w-full`) with an inner `<Container>` = `mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 2xl:px-16`. Never wrap the whole page in a narrow column.
- Vertical rhythm: `py-20 sm:py-28 lg:py-32` per section. Hero is `min-h-[92svh]` on desktop.
- Headings: eyebrow (mono, accent, uppercase, tracking-[0.2em], text-xs) → h2 (`text-3xl sm:text-4xl lg:text-[2.75rem] font-normal tracking-[-0.02em] leading-[1.1]`, sentence case) → description (`text-muted text-base sm:text-lg max-w-2xl`).
- Hero h1: `text-[2.75rem] sm:text-6xl lg:text-7xl xl:text-[5.5rem] font-normal tracking-[-0.03em] leading-[1.02]`, sentence case, centred, max-w ≈ 14ch.
- Cards: `rounded-2xl border border-line bg-surface/80` + hover `border-line-strong` + slight lift. Important cards get `.glow-accent`.
- Buttons: `rounded-full`; primary = accent background, near-black text, `font-medium`, sentence case, soft glow; secondary = `border border-line-strong bg-white/[0.03] hover:bg-white/[0.06]`; ghost = text only. Hero CTAs use size `lg`/`xl`.
- Badge "+5% FROM MARKET": mono uppercase, accent text on accent-soft background, 1px accent/30 border, rounded-full.
- Live indicator: 8px dot; live = accent with pulsing halo; reconnecting = hollow ring, warning colour; unavailable = faint, no pulse.
- Icon wells: 48px circle, `bg-surface-2 border border-line`, icon 20px.

## Motion (Framer Motion)
Fade-up reveal `{opacity:0,y:24} → {opacity:1,y:0}`, `duration 0.6`, `ease [0.22,1,0.36,1]`, `viewport once, margin -80px`. Stagger children 0.08s. Hover: `y:-2`, border brightens. Numbers: animate on change with a brief green/red flash. Reduced motion: disable transforms.

## Responsive
Mobile is a real mobile layout: stacked rate checker (send → arrow → receive), market rows as stacked cards (or horizontal snap-scroll), full-screen slide-in mobile menu, 44px+ tap targets, inputs `text-base` (avoid iOS zoom), floating WhatsApp button `bottom-5 right-5` above safe-area. Ruled grids collapse to 2 columns (sm) and 1 column (mobile) with horizontal hairlines instead of vertical ones.

## Copy case rule
Dictionary strings for headings, titles, buttons and links are **sentence case** ("Check exchange rate", "Request exchange", "Send exchange request"). Only tiny mono labels stay uppercase: "LIVE", "RECONNECTING", "+5% FROM MARKET", "MARKET PRICE + 5%", step numbers "01". Proper nouns keep their case (WhatsApp, USDT, BTC, Cryptix).
