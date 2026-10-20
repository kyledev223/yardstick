# Redesign Yardstick (v3) using the design of tryzero.dev, with sharper colours

The two previous redesigns (mindrobotics.com and aspensearch.com) are dropped. **This prompt replaces both.** Save it as `docs/yardstick-redesign-v3-prompt.md`. The product, pages, data, behaviour and earlier decisions in `docs/yardstick-build-prompt.md` stay exactly the same. This is a visual and interaction redesign only.

The new reference is **https://tryzero.dev/**. Make Yardstick look and feel like it: same layout style, type style, components, spacing, motion and interactions, applied to our pages and content. One deliberate difference: **colour** (see Step 3). I don't want grey. The colours should be sharp and confident.

## Ground rules

- **Copy the design, not their property.** Match the look and behaviour closely, but:
  - don't copy their logo, wordmark, agent images, text or contract address
  - don't copy their source code, CSS or scripts; write our own implementation
  - don't hotlink or download their assets or font files
- **Don't copy their product mechanics.** Yardstick has no 0.1 SOL launch fee, no weekly creator-fee pool, no prize, no "arena" competition. Where their page shows those, use the Yardstick equivalent in Step 2.
- Yardstick keeps its own name and logo; redesign the wordmark in the new style.
- **Never invent content.** No placeholder coins, made-up market caps or sample numbers on the live site. Every number is real Yardstick data, or a designed empty state.
- **Free fonts only** (Google Fonts or Fontsource). If theirs are commercial, pick the closest free match and say why.
- Keep numbers, tables and charts easy to read.
- **Remove the aspensearch-derived design** (flat grey panels, mint, Geist if it isn't the best match, Lenis, the odometer and roll-text components unless the reference has the same effects). Leave old code in git history only.

## Step 1: Study the reference

Open https://tryzero.dev/ in a real browser at 1440px and 390px. **Scroll slowly through the whole page** so every scroll animation plays, then interact with everything: hover every link, button, card and row; open the search (⌘K); open the mobile menu; type into the creator-studio form and watch the live preview update; watch the countdown and counters.

If you can't reach the site, stop and tell me; I'll send screenshots and recordings.

Write `docs/design-reference-v3.md` covering:

1. **Colours:** every background, surface, text, border, accent and hover colour, with hex values and where each is used (computed styles and `:root` variables). Note which are greys, since those get replaced in Step 3.
2. **Typography:** families, weights, sizes for every level, letter-spacing, line-height, case, how numbers and tickers are set. Free matches and why.
3. **Layout section by section,** in order, including at least:
   - the header (logo, X link, contract-address pill, nav, ⌘K search, sign-in, primary button)
   - the strip of agent avatars with tickers
   - the hero headline, line and two buttons
   - the numbered 01–04 steps ("01 / IMAGINE" style)
   - the creator studio: form on one side, live launch preview card on the other
   - the "safe evolution" section
   - the grid of ranked agent cards (number, image, name, role, ticker, market cap)
   - the arena panel (leader, stats, pool, countdown)
   - the closing call to action and footer
   - and how each changes on phones
4. **Motion and interaction,** precisely: scroll reveals (what, how, timing, easing, stagger), the avatar strip (marquee? speed?), hover states on every element type, card hover effects, the live preview update, the countdown, the ⌘K search dialog, the mobile menu, any custom cursor, page-load animation, anchor scrolling, and what happens with `prefers-reduced-motion`. Note the techniques used (CSS, Framer Motion, etc.) without copying code.
5. **Screenshots** of every section at both widths, in a gitignored `docs/design-reference-v3/` folder.

Then build a **parity checklist**: every effect and component in the reference, and the Yardstick page/component where it will appear. Show me the study summary, proposed fonts, the colour palette from Step 3 and the checklist, and **wait for my OK**.

## Step 2: Map their sections to Yardstick

| Reference | Yardstick version |
|---|---|
| Header with CA pill, nav, ⌘K search, sign in, primary button | Logo; nav: Launch, Today, How it works, Status; **⌘K "Check a coin" search** (paste a mint or search $SYMBOL among coins we track); wallet connect; **Launch a coin** button; the "Solana mainnet · real SOL" badge. No contract-address pill (we have no token) unless I add one later |
| Avatar strip with tickers | "Recently launched on Yardstick": real coin images + $SYMBOL, linking to dashboards. Hidden if fewer than ~6 coins |
| Hero headline + two buttons | "Launch a coin. See where it stands." with a short line ("Free. No fees. Your coin lives on pump.fun.") and buttons **Launch a coin** / **Check a coin** |
| 01 / IMAGINE … 04 / COMPETE | 01 / LAUNCH · 02 / MEASURE · 03 / COMPARE · 04 / IMPROVE, one sentence each about what Yardstick really does |
| Creator studio: form + live preview card | The launch form + a **live preview card** of the coin (image, name, $SYMBOL, description) with the **pre-launch checks** under it, updating as the user types. This is the real `/launch` flow, embedded on the landing page or linked to it (choose whichever matches the reference better and tell me) |
| "Safe evolution" section | "What we measure": holders and distribution, buying and selling, bonding curve, warning signs |
| Ranked agent cards | **Today's top coins**: rank, image, name, $SYMBOL, age, market cap and standing (Top X%), from `/today` data. Empty state if none |
| Arena panel with pool and countdown | **"Today's board"**: the current #1 coin by standing, its key stats, and "Board resets in HH:MM:SS" (UTC midnight). No pool, no prize, no "winner" wording |
| Closing call to action | "Where does your coin stand?" with **Launch a coin** / **Check a coin** |
| Footer | Our links, the badge, "Data, not advice", "Free. No fees." |

## Step 3: Colour — sharp, no grey

This is the main change from the reference. Build a palette that keeps the reference's structure (where light/dark surfaces, borders and accents go) but replaces every neutral grey with something with colour and intent:

- **No neutral greys** for backgrounds, surfaces, borders or secondary text. If something needs to be quieter, use a **tinted** neutral (e.g. a cool ink-blue or a warm paper tone) or reduce emphasis with weight and size instead.
- **A crisp base:** a clean near-white (or the reference's off-white if it's not grey) and a deep, saturated ink (e.g. a blue-black or violet-black), not a washed-out charcoal.
- **One strong primary accent** used boldly for primary buttons, the user's coin, the standing number and key highlights. Propose 2–3 options (for example electric blue, vivid violet, signal orange) and recommend one. It should feel at home on Solana and pump.fun without copying either brand.
- **One secondary accent** for contrast moments (a tag, a badge, a hover), and clear data colours: up (▲, +) and down (▼, −) that are vivid but readable, and a median/range style that isn't grey (e.g. a tint of the ink or the primary).
- **Both themes:** light and dark, each equally sharp. The dark theme uses a deep coloured ink background, not grey-black.
- **Contrast:** every text and data colour passes WCAG AA in both themes. Keep and update the existing contrast tests and the test that both dark copies stay in sync.

Show the palette as swatches (both themes) on the `/design` page and in the Step 1 summary before applying it.

## Step 4: Design system and pages

- Replace the tokens in `src/app/globals.css` (CSS variables exposed as Tailwind classes): colours from Step 3, type scale, spacing, radii, borders, shadows, motion durations and easing matching the reference.
- Build reusable components for every item on the parity checklist (e.g. `CoinStrip`, `StepList`, `LaunchPreviewCard`, `CoinCard`, `BoardPanel`, `Countdown`, `CommandSearch`, `MobileMenu`, scroll-reveal wrapper). Each respects `prefers-reduced-motion`, works with keyboard and screen readers, and doesn't depend on hover alone.
- Restyle **every page** from the build spec: landing (full Step 2 mapping), launch, coin dashboard, today, creator profile, how it works, status, not-found and error pages, and the Open Graph share card. Dashboards use the reference's card style; the standing ("Top X%") is the hero number in the primary accent; metric cards, percentile bars and the hand-drawn SVG chart use the new tokens.
- Keep every existing behaviour and decision: fixed age filter, one comparison group with a toggle, notes rules, "Not enough data yet", `/setup` local only, `/design` dev only, `/status` page.
- Free libraries only. If the reference relies on one (e.g. Framer Motion) and it matters to the feel, it's fine to use a free equivalent.
- Works at 390px with 16px gutters and no horizontal scroll; visible focus rings.

Then carry on to Step 5 without waiting for me.

## Step 5: Verify

- A private review page with: every page at 1440px and 390px in both themes, next to the matching reference screenshots; and side-by-side recordings (reference vs ours) for each effect on the parity checklist, marked **matched** or **different** with the reason.
- Lighthouse on the landing page and a coin dashboard (production build); fix anything under 90 accessibility.
- Confirm no code, fonts, images, logos or text from tryzero.dev are in the repo (search their domain, names and file names).
- Typecheck, lint, all tests, production build, and the strict-Node pump SDK load check.

## Hand-off

Update the Design section of `docs/YARDSTICK.md` (tokens, palette and the no-grey rule, fonts and licences, components and how to tune them, themes). Don't commit until I approve the review page.
