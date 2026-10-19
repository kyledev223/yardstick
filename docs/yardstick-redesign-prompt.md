# Redesign Yardstick using the design language of mindrobotics.com

Yardstick is our free Solana tool: creators launch a coin on pump.fun through the site, then see how it compares with other coins of the same age. The product, pages and data are specified in `yardstick-build-prompt.md`. This prompt **replaces Section 7 (Design)** of that file. Everything else (functionality, data, constraints) stays the same.

I like the look of https://www.mindrobotics.com/: it's bold, I like its colours and fonts, and I especially like the effect that follows the cursor around the page and blends into the background. Adopt that **design language** for Yardstick.

## Ground rules

- Take the style, not the property. Match the feel (palette, type style, scale, spacing, layout rhythm, cursor effect behaviour), but:
  - don't copy their logo, wordmark, images, photography, illustrations or text
  - don't copy their source code, shaders or CSS files; write our own implementation of anything you observe
  - don't hotlink or download their assets or font files
- Yardstick keeps its own name and its own logo. Redesign the wordmark to fit the new style.
- **Fonts must be free.** If their fonts are commercial or custom (likely), pick the closest free equivalents from Google Fonts or Fontsource and tell me what you chose and why. The project must cost $0.
- Yardstick is a data product. The bold style must not hurt readability of numbers, tables and charts.

## Step 1: Study the reference site and write down what you find

Open https://www.mindrobotics.com/ in a real browser (Playwright, or whatever browser tooling you have) at desktop width (1440px) and phone width (390px). If you can't reach it, stop and tell me; I'll send screenshots and a screen recording of the cursor effect instead.

Record, in `docs/design-reference.md`:

1. **Colours:** background(s), text colours, accent colour(s), border/line colours. Use `getComputedStyle` on `body`, headings, paragraphs, links, buttons and section backgrounds, and read any CSS custom properties on `:root`. List hex values and where each is used.
2. **Typography:** font families (from computed styles and `document.fonts`), weights, sizes for each heading level and body text, letter-spacing, line-height, text-transform. Note how headings use line breaks and scale. Then name the free font you'll use for each and why it's the closest match.
3. **Layout:** grid and column structure, max widths, section spacing, how text and images are arranged, how numbered lists and section labels are styled, how the header and footer look.
4. **Cursor effect:** describe precisely what happens when the pointer moves:
   - what it looks like (a glow, blob, spotlight, distortion, gradient, particles, trail)
   - its size, colour, softness, and how it blends with the background (blend mode, opacity)
   - how it moves (follows instantly or eases behind, lingers, fades)
   - what it does on hover over text, images and buttons
   - what happens on phones/touch and with reduced motion
   - which technology it seems to use (canvas, WebGL, CSS gradient, SVG filter), judged from the DOM and network requests. **Don't copy the code**; just understand the technique.
5. **Motion:** scroll reveals, image transitions, hover states, page transitions, and their timing.
6. Take screenshots of the hero, a mid-page section and the footer at both widths for reference. Keep them in `docs/` only (don't commit them to the public site; add them to `.gitignore` if the repo is public).

Then show me the summary and your proposed free fonts, and **wait for my OK** before changing the site.

## Step 2: Build a Yardstick design system from it

Create design tokens in one place (CSS custom properties on `:root` plus the Tailwind theme):

- colours (backgrounds, text, accent, lines, and data colours for "your coin", "median", "comparison range", "up", "down")
- type scale, font families, weights, letter-spacing
- spacing scale, max widths, radii, border styles
- motion durations and easing

Theming:
- Follow the reference site's main colour scheme as the default.
- Also provide the opposite theme (light or dark) for readability, keeping the same accent and character. Respect `prefers-color-scheme`, add a toggle, and give `body` an explicit background.
- Check text and data colours meet WCAG AA contrast in both themes.

## Step 3: Build our own cursor effect

Write an original implementation that recreates the behaviour you described in Step 1:

- One reusable component (e.g. `<CursorField />`) mounted once behind the page content, so it blends with the background the way the reference does.
- Use the lightest technique that achieves the look: CSS radial gradients with a blend mode if that's enough; a small canvas or WebGL shader only if needed. No paid libraries.
- Smooth easing toward the pointer using `requestAnimationFrame`; no layout thrashing.
- Performance: pause when the tab is hidden, cap device pixel ratio, keep it under a few percent of CPU on a mid-range laptop.
- Text must stay readable wherever the effect passes; never let it lower contrast below AA.
- Touch devices: a gentle ambient version (slow drift, or reacting to scroll), or off. Pick whichever looks better and tell me.
- `prefers-reduced-motion`: a static version of the background.
- Behind data-heavy areas (dashboard metric grid, tables, charts), tone it down so it doesn't distract from numbers.

## Step 4: Apply it to every Yardstick page

Restyle all pages from `yardstick-build-prompt.md` (landing, launch, coin dashboard, today, creator profile, how it works, health/error states):

- **Landing:** a big, bold hero in the reference style ("Launch on pump.fun. See where you stand."), with the cursor effect at full strength. Use large type and strong layout instead of photos; Yardstick doesn't need imagery. Section labels and numbered steps (Launch → Measure → Improve) styled like the reference's numbered sections.
- **Launch page:** form and pre-launch check panel in the new style. Keep inputs clearly labelled, with large touch targets and obvious focus states.
- **Coin dashboard:** the standing percentile is the hero number, set big in the display font. Metric cards, percentile bars and the trajectory chart use the new tokens. Numbers use tabular figures (a monospace or a font with `font-variant-numeric: tabular-nums`) so they line up.
- **Tables (today, creator):** clean, bold headers in the new style; stacked cards on phones.
- **Header/footer:** restyled in the reference's spirit, with our own links, the "Solana mainnet · real SOL" badge and the risk disclaimer kept.
- **Loading, empty and error states:** designed in the new style. Never show fake numbers.
- **Open Graph share card:** regenerate with `next/og` in the new style.
- Remove leftovers from the old design (the ruler/tick motif, old palette and fonts) unless they fit the new look; ask me if unsure.

Layout rules: works at 390px with 16px side gutters and no horizontal scroll; keyboard reachable with visible focus rings; motion respects `prefers-reduced-motion`.

## Step 5: Verify

- Screenshot every page at 1440px and 390px in both themes and show me them next to the reference screenshots.
- Record or describe the cursor effect on our landing page and the dashboard.
- Run a Lighthouse check (performance and accessibility) on the landing page and a coin dashboard; report the scores and fix anything below 90 for accessibility.
- Confirm no assets, fonts, text or code from mindrobotics.com ended up in the repo (search for their domain and file names).
- Run the production build and the existing tests from `yardstick-build-prompt.md`.

## Hand-off

Update `docs/YARDSTICK.md` with a Design section: tokens, fonts and their sources/licences, how `<CursorField />` works and how to tune it (size, colour, strength, easing), and how to switch themes.
