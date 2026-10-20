# Design reference v3: tryzero.dev

Study notes for the v3 redesign (`docs/yardstick-redesign-v3-prompt.md`). Observed in Chromium (Playwright) at 1440×900 and 390×844 on 2026-10-19: slow scroll through the whole page, hover on every interactive element, keyboard (⌘K / Ctrl+K), typing into the creator form, waiting on the countdown, `prefers-reduced-motion: reduce`. Data comes from computed styles, `:root` variables, `document.fonts`, `document.getAnimations()`, the DOM and the network list.

**Nothing from the site (code, CSS, fonts, images, logos, text, contract address) is copied into this repo.** The screenshots are in `docs/design-reference-v3/`, which is gitignored because they contain the site's agent images, logo and text.

## How it's built (judged from the DOM and network only)

- Next.js (App Router, Turbopack chunks) with Tailwind CSS 4 and shadcn/ui-style tokens (`--background`, `--card`, `--muted`, `--ring`, `--radius`…) and components (`data-slot` fields, `group/button`).
- **Geist** and **Geist Mono** through `next/font`. A DM Sans stylesheet is requested from Google Fonts but no element uses it.
- **No animation library.** The only animations are one CSS `@keyframes` (the floating cards) and Tailwind `transition-*` utilities. No Framer Motion, no GSAP, no Lenis, no scroll-linked JS.
- Smooth anchor scrolling is the native `scroll-behavior: smooth` on `<html>`.
- Light theme only: there is no dark theme, no `.dark` block and no theme toggle.

## 1. Colours

All values are from `:root`. The page is warm off-white paper and near-black ink, plus two accents (cyan, orange) that are used very sparingly.

| Token | Hex | Grey? | Where it's used |
|---|---|---|---|
| `--agent-paper` / `--background` | `#fbfaf7` | Warm off-white (not grey) | Page background; header panel at 85% with backdrop blur; text on ink panels |
| `--agent-ink` / `--foreground` / `--primary` | `#050607` | Near-black (neutral) | All text, primary buttons, the "safe evolution" panel, the full-bleed agents section |
| `--card` / `--popover` | `#ffffff` | White | Creator-studio form side, floating hero cards, arena stat chips |
| `--muted` | `#efeeeb` | **Grey** (warm) | Search pill, CA pill, launch-preview panel, the whole footer band, hover fill of the X pill |
| `--secondary` | `#ecebe8` | **Grey** | Hover fill of the search and CA pills; hover fill of ghost buttons (shows as `#efeeeb`) |
| `--muted-foreground` | `#595e63` | **Grey** (cool) | Secondary text, eyebrows, step numbers, tickers, footer links |
| `--border` / `--input` | `#d5d4d0` | **Grey** | Card border, input borders, section rules (the line above the 01–04 steps, arena stat rules, footer rule), arena rings |
| `--ring` | `#53a299` (focus ring at 50%) | Muted teal | Focus: border turns `#53a299` plus a 3px ring at 50% |
| `--accent` / `--agent-cyan` | `#41dfcf` | No | Declared accent; on the page it's only visible through the focus-ring hue |
| `--agent-orange` | `#ff8d50` | No | Arena trophy circle and the "Creator fees" stat chip (ink text on orange) |
| `--destructive` | `#df2321` | No | Field errors |
| `--shadow` | `#05060724` (ink at 14%) | Ink | Soft drop shadows on floating cards, preview image, arena image and chips |
| `--chart-3/4/5` | `#595e63`, `#94999e`, `#bfc5ca` | **Grey** | Declared, not visible on the landing page |
| Ink-panel text | paper at 55%, 60%, 70% | Tinted by opacity | Secondary text and eyebrows on the ink panels |

Hover colours: ghost buttons fill `#efeeeb`; the primary button goes to ink at 80% opacity; nav links drop to 50% opacity; pills shift from `#efeeeb` to `#ecebe8`, and the CA pill's text darkens to ink.

**Greys to replace in Step 3:** `--muted`, `--secondary`, `--muted-foreground`, `--border` / `--input`, `--ring`, the chart greys, and the opacity-faded paper on ink panels.

## 2. Typography

Two families, both **free (SIL OFL 1.1)**, so we use the same ones; no substitute is needed:

| Family | Weights used | Where |
|---|---|---|
| **Geist** (variable 100–900) | 400 body, 500 headings, buttons and labels, 600 footer wordmark | Everything that isn't a label |
| **Geist Mono** (variable) | 400, 500 for the X pill | Eyebrows, step numbers, tickers, prices on cards, pills, kbd, badges, footer links |

| Role | Desktop | Phone | Line height | Tracking | Case |
|---|---|---|---|---|---|
| Hero h1 | 96px (`text-8xl`), w500 | 48px | 0.94 | −0.06em | Sentence; deliberate line break after the first sentence |
| Manifesto h2 | 96px, w500 | 48px | 0.98 | −0.06em | Sentence |
| Closing CTA h2 | 72px, w500 | 48px | 1.0 | −0.06em | Sentence, centred |
| Section h2 | 60px (`text-6xl`), w500 | 36px | 1.0 | −0.05em | Sentence |
| Studio title h3 | 24px, w500 | 24px | 32px | −0.025em | Sentence |
| Preview name | 30px, w500 | 30px | 36px | −0.04em | |
| Big stat (pool, countdown) | 30px Geist, w500 | 30px | 36px | −0.025em | Proportional figures |
| Body / lead | 16px, w400 | 14px | 24px | normal | Muted colour |
| Small body (steps, captions) | 14px, w400 | 14px | 24px | normal | |
| Nav links | 12px, w500 | n/a | 16px | normal | |
| Buttons | 14px w500 (header buttons 12.8px) | | 20px | normal | |
| Field label | 14px, w500 | | | | |
| Eyebrow | 10px Geist Mono, w400 | | 15px | +0.16em | UPPERCASE |
| Step number ("01 / IMAGINE") | 10px Geist Mono | | | normal | Uppercase label |
| Card ticker / price | 9px Geist Mono, muted | | 16px | normal | `$TICKER`, `$84.2K` |
| Footer links | 9px Geist Mono | | | +0.12em | UPPERCASE |
| Footer wordmark | 26vw (374px at 1440), w600 | 26vw | 0.7 | −0.08em | Lowercase, clipped at the bottom of the page |

Numbers: no `tabular-nums` anywhere. Tickers and market caps are mono at 9px; the large stats are Geist medium. **For Yardstick** we keep their scale and add `tabular-nums` to metric values and table columns so the numbers line up (a readability rule in the prompt).

## 3. Layout, section by section (1440px, then phones)

Page width: content sits in `max-w-6xl` (1152px) for the text sections and `max-w-7xl` (1280px) for the agents grid, arena and footer. Outer padding is 20px; section padding is 144px top and bottom (96px on phones). Radii: inputs and buttons 12.8px (`--radius: .8rem`), pills fully round, cards 16–24px, the big panels 24px (`rounded-3xl`).

1. **Header** (`desktop-00-top.png`). Fixed, inset 16px from the top and 28px from the sides; a 48px-tall rounded-2xl panel, paper at 85% with `backdrop-blur-xl`, max 1600px wide. Left to right: an 80×28 ink logo tile; an outlined mono pill "@handle" (X link); a muted mono "CA · BWLW…Zero" pill with a copy icon; nav (12px medium, 20px gaps). Centre-right: a 256px search pill (muted, magnifier, placeholder, `⌘K` kbd). Right: "Sign in" (ghost) and "Create agent" (ink), both 28px tall.
   *Phone:* two rows inside the same panel. Row 1: logo, Sign in, Create agent. Row 2 (above a hairline): the X and CA pills. **The nav and the search are hidden entirely; there is no menu button.**
2. **Hero + floating agent cards** (`desktop-00-top.png`). Full viewport height, centred text. Six white "polaroid" cards (image + mono name and ticker; 128px wide, 6px padding, rounded-xl, ink shadow at 14%) are scattered around the headline at fixed percentage positions, each tilted between −6° and +6°. Headline (2 lines), a 2-line muted lead (max 448px), then two buttons: ink "Create for 0.1 SOL ↗" and a ghost "Explore agents". A small mono "HOW IT WORKS ↓" link sits 24px from the bottom.
   *Phone:* the cards are hidden (`hidden md:block`); the buttons stack.
   *Note:* this is the "strip of agent avatars with tickers". It is not a marquee.
3. **Manifesto + 01–04 steps** (`desktop-01.png`). A full-height section: mono eyebrow, 96px two-line statement, a 1px rule, then a four-column grid. Each column has "01 / IMAGINE" in 10px mono muted and one 14px sentence (max 320px). *Phone:* one column, 40px gaps.
4. **Creator studio** (`desktop-02.png`, `form-1-filled.png`). Section heading on the left (60px) and a muted note on the right (320px), aligned to the bottom. Below: one rounded-3xl bordered card split 1.15 : 0.85. **Left** (white): mono eyebrow, a 24px title, a "0.1 SOL" mono pill top-right, then labelled fields (32px inputs, auto-growing textareas), muted help text under each field, and a disabled ink button with a sparkle icon (50% opacity until valid). **Right** (muted panel): a "LAUNCH PREVIEW … SOLANA" mono header row, a 208px rounded-3xl image with a large shadow, the name at 30px, "$TICKER · pump.fun" in mono, the description in muted 14px (clamped to 3 lines), and a mono status line at the bottom.
   *Phone:* the two halves stack (form first, then preview).
5. **"Safe evolution" panel** (`desktop-03.png`). An ink rounded-3xl panel inside the 1152px column, 56px padding. Eyebrow at 60% opacity, 60px headline in paper, a 70%-opacity line, and a paper pill button (40px, fully round). *Phone:* 32px padding.
6. **Ranked agent cards** (`desktop-04.png`). A **full-bleed ink section**. Eyebrow at 55%, a 60px headline, and a "Create yours ↗" link on the right. Then a 6-column grid (3 on tablets, 2 on phones) with 12px gutters and 32px between rows. Each card: a square rounded-2xl image with a mono rank chip ("01") top-left (ink at 75% plus blur); under it the name (14px medium) and role (12px at 55%) on the left, and the ticker and market cap (9px mono at 55%) right-aligned.
7. **Arena panel** (`desktop-05.png`). Two columns. **Left:** a square stage with two concentric circles (outer dashed, inner solid, 1px border colour), the leader's image (224px, rotated 3°, big shadow) in the centre, a white "TRADES 12,408" chip top-left and an orange "CREATOR FEES 18.42 SOL" chip bottom-right. **Right:** a 44px orange circle with a trophy icon, an eyebrow, a 60px headline, a muted 16px paragraph, then a two-column stat row between 1px rules ("CURRENT POOL 184.6 SOL" and "RESETS IN 02:18:41", 30px), then a ghost "Enter the arena ↗" button.
   *Phone:* the stage comes first, then the text.
8. **Closing CTA + footer** (`desktop-06.png`). The footer is one muted band: a centred eyebrow, a 72px headline, a muted line, and an ink button. Then a 1px rule with a mono uppercase row (left "BUILT ON SOLANA", right "X / TWITTER", "TERMS"). Then the giant lowercase wordmark at 26vw, cropped by the page bottom.

## 4. Motion and interaction

| Effect | What it does | Timing | Technique |
|---|---|---|---|
| Page load | **Nothing animates in.** Frames at 150, 400, 800 and 1500 ms show the page fully drawn (`load-*.png`). No preloader | n/a | n/a |
| Scroll reveals | **None.** No element starts hidden or offset, and nothing is scroll-linked | n/a | n/a |
| Floating hero cards | Each card bobs `translateY(0 → −14px → 0)` and keeps its tilt | 7s per cycle, `ease-in-out`, infinite; delays 0, −1.3, −2.6, −3.9, −5.2 and −6.5s so the six are out of phase | CSS `@keyframes`, `animation-delay` inline |
| Nav links | Opacity 1 → 0.5 | 150ms `cubic-bezier(0.4,0,0.2,1)` | CSS transition |
| Primary (ink) button | Background → ink at 80% | 150ms, same curve | CSS |
| Ghost buttons ("Sign in", "Explore agents", "Enter the arena") | Background transparent → muted fill | 150ms | CSS |
| X pill | Background → muted | 150ms | CSS |
| CA pill / search pill | Muted → secondary; CA text muted → ink | 150ms | CSS |
| Agent card | Image scales to 1.03 inside its rounded clip | 500ms, same curve | CSS `group-hover` |
| Text links ("Create yours", footer) | No hover change | n/a | n/a |
| Focus | Inputs and buttons: border → `--ring` plus a 3px ring at 50% | 150ms | CSS |
| Disabled submit | 50% opacity until every field is valid | n/a | n/a |
| Live preview | Name, `$TICKER` (forced uppercase as you type) and mandate update on every keystroke with no animation; placeholders return when a field is cleared. The status line stays the same | instant | React state |
| Countdown | **Static.** "02:18:41" didn't change over 5+ seconds or a reload. It looks like a placeholder | n/a | n/a |
| ⌘K search | **Opens nothing.** Ctrl+K and Meta+K do nothing; clicking the pill only focuses it (focus ring). There is no dialog in the DOM | n/a | n/a |
| Mobile menu | **None.** The nav and search are hidden below 768px | n/a | n/a |
| Custom cursor | None (`cursor: auto`) | n/a | n/a |
| Anchor scrolling | Header nav and "How it works" jump smoothly (0 → 3673px in about 1s) | Browser default | `scroll-behavior: smooth` |
| Header | Always the same translucent blurred panel; no hide-on-scroll or shrink | n/a | n/a |
| `prefers-reduced-motion` | The float animation is removed (0 animations) and `scroll-behavior` falls back to `auto` (instant jumps) | n/a | `motion-safe:` utilities |

## 5. Screenshots

`docs/design-reference-v3/` (gitignored):

- `desktop-00-top.png` to `desktop-07.png`, `desktop-full.png`: 1440px, one per viewport while scrolling
- `mobile-00-top.png` to `mobile-09.png`, `mobile-full.png`: 390px
- `load-150ms.png` … `load-1500ms.png`: page-load frames
- `hover-*.png`: hover states (nav link, primary button, CA pill, search pill, agent card)
- `form-0-empty.png`, `form-1-filled.png`, `form-focus.png`: creator studio and live preview
- `cmdk-*.png`: the search pill after Ctrl/⌘K and a click (focus ring only)

## 6. Parity checklist

Status is filled in at Step 5 (matched / different + reason). "Different" items below are where the v3 prompt asks for more than the reference does.

| # | Reference effect / component | Yardstick component | Where |
|---|---|---|---|
| 1 | Fixed, inset, rounded, blurred header panel | `SiteHeader` | Every page |
| 2 | Ink logo tile | `Logo`: new lowercase "yardstick" wordmark in a tile (our own design) | Header, footer, OG card |
| 3 | X and CA pills (mono, round) | `Badge` pill "Solana mainnet · real SOL" in that slot. No CA pill | Header |
| 4 | Nav links, 50% opacity on hover | `MainNav`: Launch, Today, How it works, Status | Header |
| 5 | Search pill with ⌘K | `CommandSearch`: the same pill plus a **working** dialog (paste a mint or search $SYMBOL). *Different: the reference's opens nothing* | Header |
| 6 | Ghost "Sign in" + ink "Create agent" | `WalletButton` (ghost) + "Launch a coin" (primary) | Header |
| 7 | Two-row phone header, no nav | Same two rows plus a `MobileMenu` button for the nav, wallet and theme. *Different: otherwise there'd be no nav on phones* | Header < 1024px (second row < 640px) |
| 8 | Floating tilted polaroid cards, 7s bob | `CoinStrip`: real recent coins (image + $SYMBOL), linking to dashboards; hidden if fewer than 6 | Landing hero |
| 9 | Cards hidden on phones | A compact scrolling row of the same cards under the buttons. *Different: they're links, so they shouldn't vanish* | Landing < 768px |
| 10 | Hero headline, muted lead, ink + ghost buttons | Landing hero | Landing |
| 11 | Mono "HOW IT WORKS ↓" scroll cue | Same, to `#how` | Landing |
| 12 | Manifesto statement + rule + 01–04 grid | `StepList` | Landing; reused on /how |
| 13 | Split studio card: form / muted preview panel | `LaunchStudio` = `LaunchForm` + `LaunchPreviewCard` + pre-launch checks | Landing `#launch` and /launch |
| 14 | Preview updates on every keystroke, ticker forced uppercase | `LaunchPreviewCard` | Same |
| 15 | Submit at 50% opacity until valid | Launch button | Same |
| 16 | Ink rounded-3xl statement panel | `InkPanel` "What we measure" | Landing; /how |
| 17 | Full-bleed ink section with a 6-column ranked card grid | `CoinCard` grid "Today's top coins" + empty state | Landing; creator page (/today keeps its sortable table) |
| 18 | Card image scales to 1.03 on hover (500ms) | `CoinCard` (also on keyboard focus) | Same |
| 19 | Mono rank chip on the image | `CoinCard` | Same |
| 20 | Arena stage: dashed and solid rings, tilted image, stat chips | `BoardPanel` "Today's board" (#1 by standing) | Landing |
| 21 | Stat pair between 1px rules, 30px figures | `StatRow` | BoardPanel; coin dashboard |
| 22 | "Resets in 02:18:41" | `Countdown` to UTC midnight, ticking every second. *Different: theirs is frozen* | BoardPanel |
| 23 | Orange icon circle + orange stat chip | accent-2 circle + chip (no trophy, no "winner" wording) | BoardPanel |
| 24 | Section head: 60px title left, muted note right | `PageHead` / `SectionHead` | Every inner page |
| 25 | Mono uppercase eyebrows | `Eyebrow` | Everywhere |
| 26 | White rounded-3xl bordered card | `Card` | Dashboard, /today, /status, creator, /how |
| 27 | Inputs: 32px, round 12.8px, ring on focus | Field styles | /launch, check form, /setup |
| 28 | Buttons: ink (80% on hover), ghost (tint fill), pill | `Button` variants (primary is the accent) | Everywhere |
| 29 | Footer band: centred CTA, rule row, giant cropped wordmark | `SiteFooter` = `FooterCta` + giant "yardstick" | Every page |
| 30 | Soft ink shadows | `--shadow` token | Floating cards, preview image, board image |
| 31 | Smooth anchor scroll; instant under reduced motion | CSS `scroll-behavior` in `motion-safe` | Global |
| 32 | Float stops under reduced motion | `motion-safe` on `CoinStrip` | Landing |
| 33 | No page-load animation, no scroll reveals | Remove Preloader, RevealLines, Lenis, odometer, scramble text | Global |
| 34 | (none: light only) | Dark theme + `ThemeToggle`. *Different: the prompt requires both themes* | Header |

Pages with no counterpart in the reference (coin dashboard, /today table, /status, /how, creator, 404, error, OG card) are built only from the parts above.
