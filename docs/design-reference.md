# Design reference: mindrobotics.com

Study notes for the Yardstick redesign. We take the **style** of the reference, not its property:
no logo, wordmark, imagery, text, code, shaders, CSS or font files from the reference are copied
into this repo. Everything below was observed in a browser (Playwright/Chromium, 1440×900 and
390×844, studied 2026-10-19) using computed styles, `document.fonts`, the DOM and the network log.

Screenshots live in `docs/design-reference/`. That folder is **gitignored**, because the images
contain their logo and artwork. Keep them local.

| File | What it shows |
|---|---|
| `desktop-1440-hero.png`, `phone-390-hero.png` | Hero: wordmark, header, cursor field |
| `desktop-1440-headline.png` | Pill-highlighted display headline + body copy |
| `desktop-1440-mid.png`, `phone-390-mid.png` | Mid-page sections |
| `desktop-1440-footer.png`, `phone-390-footer.png` | Closing section + footer |
| `cursor-moving.jpg`, `cursor-after-stop.jpg` | Cursor field; the red ring is our debug marker for the real pointer position |
| `cursor-sequence-line.png`, `cursor-sequence-circle.png` | Contact sheets, about 375 ms apart, during and after pointer movement |
| `reduced-motion-static.png` | The field under `prefers-reduced-motion: reduce` |
| `headline-pill-wipe.jpg` | Pill reveal animation, mid-wipe |
| `font-comparison.png` | Reference type vs. free candidates |

---

## 1. Colours

Read from `:root` custom properties and computed styles.

| Token (theirs) | Hex | Where it's used |
|---|---|---|
| `--color-grey-50` | `#e8e5e0` | Page background (set on `html`). Warm light grey, not white. |
| `--color-grey-10` | `#f6f4f0` | Footer bar background; the round "dot" glyphs in the cursor field |
| `--color-grey-100` | `#dbd7ca` | Alternate section background (scroll-story section, carousel), tag chips, progress-pill track, the square glyphs in the cursor field |
| `--color-white` | `#ffffff` | Cards (rounded panels), large decorative stadium/circle shapes, "outline" pill highlight |
| `--color-black` (ink) | `#061a1e` | All text, 1px card borders, "ink" pill highlight. A deep teal-black, not neutral black. |
| `--color-accent-primary` | `#299093` | Teal. Header buttons, primary pill highlight, × glyphs, active progress fill, link hover |
| `--color-accent-secondary` | `#ffbd00` | Yellow. Pill highlight, decorative dot, link hover |
| `--color-accent-tertiary` | `#ef6156` | Coral. Pill highlight, small artwork accents |
| (sampled) | `#8f8c83` | Warm-grey pill highlight (one headline) |

The site is **light only**: no dark theme, and nothing changes under `prefers-color-scheme`.

**Contrast (WCAG 2.x), measured:**

| Pair | Ratio | AA verdict |
|---|---|---|
| Ink `#061a1e` on page `#e8e5e0` | 14.23 | Pass |
| Ink on white card | 17.88 | Pass |
| Ink on grey-100 `#dbd7ca` | 12.42 | Pass |
| White on teal `#299093` (their buttons) | **3.81** | Large text only (they use 24px bold, so OK there). Fails for small text. |
| Ink on teal | 4.69 | Pass |
| Teal as text on page | **3.04** | Fails for body text. We need a darker teal for links and small text. |
| Ink on coral `#ef6156` | 5.55 | Pass |
| Ink on yellow `#ffbd00` | 10.67 | Pass |
| Cursor-field dots/squares on page | 1.14–1.15 | Decorative. This low contrast is *why* the effect blends into the page. |
| Cursor-field teal × on page | 3.04 | Decorative accent |

## 2. Typography

**Family:** `CentraNo2` (weights 400, 500, 700), self-hosted woff2. Centra No.2 is a **commercial**
typeface from the Displaay foundry. We can't use it. `font-mono` is declared but not used anywhere visible.

**Root size:** `html { font-size: 62.5% }`, so 1rem = 10px. Everything below is in px.

| Role | Desktop (1440) | Phone (390) | Weight | Tracking | Line-height |
|---|---|---|---|---|---|
| Hero wordmark | ~170px cap height | ~95px | n/a | n/a | Custom SVG, not a font (see Motion) |
| Display headline (h1/h2) | 80px | 36px | 700 | −0.04em (−3.2px) | 1.4 (112px), phone 1.3 |
| Closing giant type (3 short words) | 270px | ~78px | 700 | −0.04em | 0.8 (lines overlap tightly) |
| Statement h3 | 44px | 28px | 500 | −0.03em | 1.3 |
| Card title h3 | 32px | 20px | 500 | −0.02em | 1.4 |
| Body / lead | 20px | 18px | 400 (opening phrase in 700) | normal | 1.5 |
| Card body | 16px | 13px | 400 | normal | 1.5 |
| Button | 24px | 24px | 700 | −0.04em | 1.2 |
| Tag chip | ~15px | ~13px | 400 | normal | n/a |
| Footer | 13px | 13px | 400 | normal | 1.4 |

Characteristics:
- **No uppercase** anywhere except the hero wordmark. `text-transform: none` throughout.
- **Headlines are set line by line.** Each line is a deliberate short phrase of one to three words. At 1440 the headline spans about 10 of 12 columns; on phones each phrase gets its own line.
- **Pill highlights inside headlines.** Key words sit inside a full-height, fully rounded pill (padding-inline 20px, pill height = line box − 8px). Colours alternate: teal with white text, white with a hairline border, coral, ink with white text, yellow, warm grey. A plain coloured circle (same height as the pill) sometimes leads the line.
- **Body copy opens with a bold two- or three-word phrase**, set in about 5 of 12 columns (~560px).
- Very tight negative tracking on display sizes; normal tracking on text sizes.

### Proposed free fonts

| Use | Font | Licence / source | Why |
|---|---|---|---|
| **Everything** (display, text, UI, numbers) | **Figtree** (variable 300–900) | SIL OFL 1.1, Google Fonts via `next/font/google` (self-hosted at build, $0) | Closest match to Centra No.2: same geometric skeleton, round bowls, double-storey `a`, single-storey `g`, angled `t` terminal, straight-tailed `y`. At **800** it matches Centra Bold's stroke weight and width at 80px (see `font-comparison.png`). Its 400 has the same calm, open body-text texture. **Tabular figures confirmed working** (`1111` and `0000` both 101.1px wide at 40px with `tabular-nums`), so one family covers the data too. |
| Wallet addresses, mint addresses, tx signatures only | IBM Plex Mono (already in the repo) | SIL OFL 1.1, Google Fonts | The reference has no monospace. Base58 strings still read better in mono (`l`/`1`, `O`/`0`). I'd keep it for these strings only, not for numbers. |

Runner-up: **Outfit** (OFL). Its silhouette at display sizes is also very close, slightly heavier and tighter. But it has a quirky default `ti` ligature and a narrower body texture, so it's less suited to a data-heavy UI.

Rejected:
- **DM Sans** and **Albert Sans**: tabular figures don't work as served by Google Fonts.
- **Plus Jakarta Sans**: too condensed and sharp.
- **Gabarito**: too soft and round.
- **Manrope** and **Red Hat Display**: more grotesque, less geometric.

## 3. Layout

- **Grid:** 12 columns on tablet and desktop, 6 on phones. Outer gutter 32px (24px on phone); inner gutter 24px (16px on phone). Content runs full-bleed to the gutters; no centred max-width container.
- **Breakpoints:** 768, 1280, 1680px.
- **Vertical rhythm** (section padding):

  | Spacer | Desktop | Phone |
  |---|---|---|
  | small | 112px | 64px |
  | medium | 200px | 96px |
  | large | 256px | 168px |
  | extra-large | 256px | 240px |

  Sections are very airy. One idea per screen.
- **Text and visuals:** text on the left half (columns 1–5), a visual on the right half (columns 7–12). Statement sections put a big h3 on the left and body text on the right, inside a white card.
- **Shape language:** everything is a **pill, stadium or circle**.
  - Fully rounded buttons, highlight pills and tags.
  - Huge white stadium and circle shapes as decoration, echoing how the logo is built.
  - Rounded cards and images (radius tokens: 24 / 40 / 72px).
  - Cards are white, either borderless or with a **1px ink border**.
- **Header:** fixed, transparent, `pointer-events: none` wrapper (only children are clickable).
  - Logo mark on the left (80×64).
  - Two teal pill buttons on the right (24px bold white text, 40px tall).
  - No nav bar, no background, no hamburger on phones (the same two pills shrink to fit).
  - Header height 128px (64px + 32px padding × 2).
- **Footer:** one rounded bar in `#f6f4f0`, inset by the outer gutter.
  - Desktop: logo mark, location/phone/email with thin line icons, then legal links and © on the right, all 13px.
  - Phone: becomes a rounded card with the items stacked.
- **Numbered lists / section labels:** the reference has **none**. No eyebrow labels, no "01 / 02" numbering. It structures content with pill-highlighted headlines and, in the 4-step scroll story, a card with a title, a short paragraph and a **progress-pill indicator**. Inactive steps show as dots; the active step stretches into a bar that fills with teal. For Yardstick's Launch → Measure → Improve I propose building the numbering from that vocabulary: a number set in a circle or pill token, coloured like the headline pills, plus the dot-to-bar indicator. That's our own construction, consistent with their language.
- **Carousel:** full-bleed images with the same dot-to-bar progress indicator (autoplaying, the teal fill tracks time).

## 4. Cursor effect

**What it looks like:** not a glow or a blob. It's a **field of small glyphs on a 32px grid** that light up in irregular clusters ("pixel dust"):
- Round dots, ~16px across, in `#f6f4f0` (near-white).
- Squares, ~16px, in `#dbd7ca` (warm grey).
- A few **× marks**, ~16px with a ~3px stroke, in teal `#299093` (roughly 1 in 10 lit cells).
- Cell centres sit at 32k + 16px. Glyphs are crisp (no blur, no glow).

**How it blends:** no blend mode (`mix-blend-mode: normal`), no opacity layer, no filters. It reads as part of the background because the dots and squares are only **1.14–1.15:1** against the page colour. Only the sparse teal × marks stand out. The canvas sits at `z-index: -1` *behind* all content: the text, the white shapes and the 3D arm all paint over it. Text contrast is never reduced, because ink text on top of pale glyphs stays at 12–14:1.

**How it moves:**
- **It's a trail, not a follower.** Pointer movement seeds clusters along the path the pointer has just travelled.
- A cluster **grows cell by cell** over about 0.3–0.8 s, **holds** briefly, then **dissolves cell by cell**: each cell winks out with a short opacity ramp. It's fully gone about 1.5–2.5 s after the pointer moves on. While the pointer moves, the newest cluster appears roughly 0.5–1 s behind it.
- Clusters are **irregular, noise-shaped regions**, about 150–450px across, and can extend 200–300px away from the path. They aren't neat circles around the pointer.
- **Strength scales with movement.** A pointer that jumps once barely triggers anything. Continuous movement leaves a steady trail. A still pointer creates nothing new.
- **There's an ambient mode.** With no pointer at all, clusters still bloom and fade at random spots every second or two, so the field never looks dead.
- When the pointer leaves the window, existing clusters finish fading and the ambient blooms continue.

**Over text, images and buttons:** no special reaction. The canvas is behind everything; there's no hover magnification or cursor replacement, and the system cursor stays as it is. The header pill buttons show no computed-style change on hover.

**Scope:** only the **hero section** and the **closing section** have a field. Each section has its own canvas (`position: absolute; inset: 0`), so the effect is not page-wide. Mid-page sections are plain.

**Touch / phones:** the field keeps running in **ambient mode only**. Taps and scrolling don't trigger clusters. The canvas is smaller because the hero section is shorter.

**Reduced motion:** the field draws **one static frame**: a fixed scatter of dots, squares and a few teal × marks, slightly denser than a typical animated frame. After that nothing animates and nothing reacts to the pointer. The headline and wordmark reveals are also gated behind `(prefers-reduced-motion: no-preference)`.

**Technology:**
- The field is **`<canvas>` with a 2D context**, not WebGL. Confirmed by observing which `getContext` type each canvas requested.
- The backing store matched CSS pixels (1440 × 1907 at DPR 1).
- The robot arm is a separate **three.js WebGL2** canvas that loads a `.glb` model. It's scroll-driven artwork, not part of the cursor effect.
- **Implication for us:** a small 2D canvas with a grid of cell intensities, noise-shaped deposits and per-cell decay achieves this look. No WebGL, no libraries. CSS radial gradients can't produce a crisp glyph grid, so canvas is the lightest technique that fits.

## 5. Motion

| Element | Behaviour | Timing |
|---|---|---|
| Hero wordmark | Each letter's outline **draws** (stroke-dashoffset → 0), then the fill fades in while the stroke fades out | 0.8s per phase, staggered 60ms per letter. Draw uses ease-in-out, fill uses ease-out (fill starts at 0.8s + stagger). |
| Headline words | Plain words fade in one after another as the headline enters the viewport | 0.3s linear, per-word delay |
| Headline pills | A **stack of coloured layers** (e.g. ink, yellow, teal) wipes left to right like a deck of discs sliding out, settling on the pill's final colour; then the word appears | ~0.6–0.7s, ease-out |
| Tag chips | "Fan" reveal: fade in plus transform back to rest, staggered | 0.3s fade; 0.6s ease-in-out transform, +50ms per chip |
| 3D arm (hero) | Rotates and translates with scroll | Scroll-linked |
| Scroll story | 400lvh sticky section; the scene and the step card change as you scroll; the progress pill fills | Scroll-linked |
| Carousel indicator | Active dot stretches into a bar; teal fill tracks autoplay time | Linear over each slide's duration |
| Links | Text colour changes to teal or yellow on hover | 0.15s default |
| Fades | Opacity transitions on overlays and content swaps | 0.7s ease-out |
| Page transitions | None observed (single long page) | n/a |

Easing tokens:
- `--ease-out: cubic-bezier(.14, 1, .34, 1)`: a strong, springy deceleration.
- `--ease-in-out: cubic-bezier(.645, .045, .355, 1)`.
- Default: `cubic-bezier(.4, 0, .2, 1)`.

Durations used: 0.15, 0.2, 0.3, 0.35, 0.6, 0.7 and 0.8s.

## 6. What this means for Yardstick (proposal, pending approval)

These are proposals for Steps 2–4; nothing has changed in the app yet.

- **Palette:** default **light** theme on a warm grey page with deep teal-black ink, teal as the primary accent, and yellow and coral as secondary highlight colours. We'll define our own token values in this family; they're generic colours, not brand assets.
  - Teal: use a **darker teal** for small text and links (to reach ≥ 4.5:1), and use ink text on teal fills for small buttons.
  - Data colours: "your coin" = teal, "median" = ink, "comparison range" = grey-100 band, "up" = teal, "down" = coral. Every data colour gets an AA check.
- **Dark theme:** ink-based background (around `#061a1e`), page grey as the text colour, the same accents brightened to pass AA.
- **Type:** Figtree 800 for display with −0.04em tracking, line-by-line phrasing and pill-highlighted key words. Figtree 400/500/700 for text. `tabular-nums` for all numbers.
- **Wordmark:** our own: "yardstick" in lowercase, set bold, with "stick" (or a dot) in a teal pill. The mark would be a stadium bar with a dot sitting at a position along it: "where you stand". It uses the pill and dot language without copying their glyph construction.
- **Cursor field:** our own `<CursorField />` on a 2D canvas: glyph grid, noise-shaped trail deposits, per-cell decay and ambient blooms.
  - **Our glyph set:** dot, square and a teal **+** (not their ×).
  - Full strength on the landing hero.
  - Lower density and paler glyphs behind dashboards, tables and charts; off directly under the metric grid.
  - Touch: ambient only, matching the reference.
  - Reduced motion: one static frame.
