# Make Yardstick look less bland, with no fake content

The live site (https://yardstick-two-rose.vercel.app/) is clean, but it looks bland, especially while there are no Yardstick launches yet. Add visual design that makes it look good **without any fake coins, made-up numbers or mockups**. Keep the v3 design system (Geist, ultramarine primary, coral second accent, no greys) and every existing behaviour. Save this as `docs/yardstick-visual-polish-prompt.md`.

## What's wrong now

1. **One colour for everything.** Every section is the same dark navy. The ultramarine appears only on small buttons and the coral on one small icon, so the sharp palette barely shows.
2. **No visuals.** The hero is a full screen of navy with a headline and two buttons. Nothing on the page is a graphic.
3. **Empty states highlight the emptiness.** Six empty dashed boxes under "Today's top coins" and the empty dashed card in "Today's board" read as "nothing here".
4. **Too much blank space** between sections, so the page feels sparse.

## Rules

- **No fake data.** No placeholder coins, sample market caps, invented percentiles or "example dashboard" screenshots. Graphics may be abstract or explanatory, but must never look like real coin data. Any diagram that shows a distribution or a marker has no real-looking numbers on it, or is clearly labelled as an illustration of the method.
- Real data from the pump.fun baseline the site already samples is fine, labelled as pump.fun (not Yardstick launches).
- Original artwork only, made in code (SVG, CSS, canvas). No stock images, no copied illustrations, free libraries only.
- Every effect respects `prefers-reduced-motion`, stays smooth on a mid-range laptop and a phone, and keeps text at WCAG AA. Keep the no-grey test passing.

## Changes

### 1. Colour rhythm across the page
Stop using one background everywhere. Alternate sections between:
- the deep ink (current navy),
- a **full-bleed ultramarine section** (white text) — use it for one big moment, e.g. "Where does your coin stand?" or the steps section,
- a **light section** (the light theme's off-white `#f8f9ff` with ink text) for at least one section, so the page has contrast,
- **coral** as a bold fill for a few highlights (a key word in a headline, a badge, a big numeral, a divider band), not just a tiny icon.

In the light theme, mirror this (mostly light, with one ink section and one ultramarine section). Show me the order before applying it.

### 2. A hero visual
Replace the empty hero background with an original graphic that expresses "measuring where you stand". Options (propose 2–3, recommend one, show me before building):
- A large, slowly animated **abstract scale**: hundreds of thin vertical bars of different heights (like a distribution), with one bar highlighted in coral and a soft ultramarine glow. No axes or numbers, so it's art, not data.
- A **gradient mesh** of ultramarine and coral light drifting slowly behind the headline, with fine grain and a faint grid.
- A **field of tick marks / dots** that subtly lean toward the cursor, with a coral marker that follows it ("you are here").

Also tighten the hero so the headline sits closer to the next section (no full empty screen below it).

### 3. Texture and depth
- Subtle film grain over dark sections (a tiny SVG noise texture, low opacity).
- Soft ultramarine and coral glows behind key cards and headlines.
- A faint grid or tick-mark pattern on one or two sections, fading out at the edges.
- Accent words in headlines: e.g. "See where it **stands**." with the key word in coral or with a coral underline/highlight.

### 4. Explanatory diagrams (not data)
Add 2–3 small animated diagrams that explain the method, in place of plain text:
- **Same-age comparison:** several coin "lines" starting at different times, sliding together so they line up at the same age, then a vertical slice at "1h" picks them out.
- **Percentile:** a row of dots sorting themselves from low to high, with one coral dot finding its place and a bracket showing "the middle half".
- **What we measure (01–04):** a small icon or animated glyph for each of holders, buying/selling, bonding curve, warning signs.

They play once when scrolled into view, are drawn in SVG, and have a text description for screen readers. No real-looking numbers on them.

### 5. Real pump.fun activity, clearly labelled
Use the baseline sampler's real data to give the page life even with zero Yardstick launches:
- A **"Live on pump.fun" strip**: recently sampled real pump.fun coins ($SYMBOL and age, optionally the image), scrolling slowly, each linking to its Yardstick dashboard in external mode. Label it clearly as pump.fun coins, not Yardstick launches.
- A small **live stat row**: e.g. "pump.fun coins tracked this week", "median holders at 1h" from the baseline, using the existing rules (hide a stat if its sample is under 30).
- Safety: these are random memecoins. Filter names and symbols through the existing banned-words list, don't show images by default (or show them blurred until hovered/tapped), and hide anything flagged. Never present them as recommendations.

### 6. Better empty states
- Replace the six empty dashed boxes in "Today's top coins" with one designed empty state: a small original illustration or animated graphic (e.g. an empty podium of bars waiting to rise), the existing message, and the two buttons. When real launches arrive, the cards appear as now.
- In "Today's board", replace the empty dashed card with the same visual language (e.g. the rings with a pulsing coral marker in the centre), so it looks intentional.
- Apply the same approach to empty states on `/today` and the dashboards.

### 7. Spacing
Reduce the large vertical gaps between sections so the page feels full, while keeping it airy. Check at 1440px and 390px.

## Process

1. Show me: the section colour order (both themes), the 2–3 hero visual options as quick prototypes on the dev-only `/design` page, and the diagram sketches. Wait for my OK.
2. Build it, then put screenshots of the full landing page (1440px and 390px, both themes) and short recordings of the hero visual, diagrams and strip on a private review page, with before/after comparisons.
3. Run Lighthouse (production build) on the landing page; keep accessibility at 100 and performance at 90+.
4. Run typecheck, lint, all tests (including contrast and no-grey) and the production build. Don't commit until I approve.
