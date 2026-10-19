# Build Yardstick: launch on pump.fun, see where you stand

You are building **Yardstick**, a free, non-custodial website for Solana creators. A creator launches a token through Yardstick (the token is created on pump.fun, mainnet), then gets a live dashboard that compares their coin against other coins of the **same age**: coins launched through Yardstick and a sampled baseline of pump.fun overall.

**Tagline:** "Launch on pump.fun. See where you stand."

The pitch in one line: most creators stare at a chart with no idea whether 140 holders after two hours is good. Yardstick tells them ("top 18% of coins at this age") and tells them what to look at next.

This prompt covers the whole product. The token-launch feature itself is specified in the attached `token-launch-prompt.md`; follow it in full, with the overrides in Section 3.

---

## 0. Hard constraints

- **Mainnet only.** No devnet, no network switch, no `SOLANA_NETWORK` toggle. Hard-code mainnet. Show a small persistent "Solana mainnet · real SOL" badge in the header.
- **No fees, ever.** The site takes no platform fee, no fee share, no referral cut. Users pay only Solana network fees and pump.fun's own creation costs, from their own wallet. Say this plainly on the landing page and the launch page.
- **$0 to run.** Use only free tiers: Vercel Hobby, a free Postgres (Neon or Supabase), a free RPC plan (Helius free) with the public RPC as fallback, pump.fun's IPFS endpoint for metadata, cron-job.org (free) for scheduled pings. No paid APIs, no paid fonts, no paid icons. Domain: the free `*.vercel.app` subdomain unless I add one later.
- **Non-custodial.** The site never holds private keys or funds, never asks for seed phrases. The mint keypair is generated in the browser.
- **Data, not advice.** Never predict prices or say a coin "will" do anything. Comparisons are descriptive ("coins like yours", "at this age"), with a short risk disclaimer in the footer and on the launch page.
- **Original.** Do not copy the look, copy text, or mechanics of other launchpads. There is no fee-pool competition, no hourly prize, no "winners". Yardstick is a measuring tool.

---

## 1. Phase 0: look before building

1. Read the existing codebase if there is one (framework, ORM, hosting config, wallet code). If starting fresh, use **Next.js (App Router, TypeScript) + Prisma + Postgres + Tailwind CSS**, deployed to Vercel.
2. If the framework version is newer than what you know, read its bundled docs in `node_modules/<framework>/dist/docs` (or equivalent) before writing code.
3. Check the installed `@pump-fun/pump-sdk` types for the current create/buy instructions. Don't rely on memory.
4. Ask me only what you can't work out yourself. Defaults already decided: mainnet, no fees, wallets Phantom + Solflare + OKX, dev buy optional and off by default.
5. Give me a short plan (pages, API routes, DB models, background jobs, accounts I need) and wait for my OK.

---

## 2. Pages

### 2.1 Landing (`/`)
- Hero: tagline, one-sentence explanation, two buttons: **Launch a coin** and **Check a coin** (paste any pump.fun mint address).
- A live "Today on Yardstick" strip: number of launches today, median holders at 1h, how many have graduated. If there's no data yet, show a clean empty state ("No launches yet today. Be the first."). Never show fake numbers.
- A three-step explainer: Launch → Measure → Improve, each with a small illustration of the actual UI (a percentile bar, a metric card).
- "Free. No fees. Your coin lives on pump.fun." trust block.

### 2.2 Launch (`/launch`)
- The form from `token-launch-prompt.md` (name, symbol, description, image, twitter, telegram, website), plus an optional **dev buy (SOL)** field, default 0.
- **Pre-launch check panel** beside the form that updates as the user types. Each check is a row with a status (good / worth a look / info) and one sentence of why. Checks:
  - **Name/symbol collision:** other coins with the same symbol or near-identical name in the last 7 days (from Yardstick DB plus the baseline sample).
  - **Completeness:** image present, description length, socials filled in. Compare to completeness of coins that graduated.
  - **Dev buy size:** percentile of the entered dev buy vs coins in the baseline.
  - **Timing:** how busy pump.fun launches are right now vs the 7-day hourly average (more competition for attention).
  - Phrase everything descriptively. Example: "Coins that graduated in the last 7 days had a website 41% of the time. Yours doesn't yet."
- Launch flow, signing, relay checks and error messages: exactly as in `token-launch-prompt.md`.
- After confirmation, redirect to the coin's dashboard with a "Launched" banner and links to pump.fun and Solscan.

### 2.3 Coin dashboard (`/coin/[mint]`)
This is the core of the product. Works for coins launched through Yardstick and, in a lighter "external" mode, for any pump.fun mint someone pastes in.

- **Header:** image, name, symbol, age ("2h 14m old"), market cap (SOL and USD), bonding-curve progress bar, links to pump.fun and Solscan, a "Launched on Yardstick" tag when applicable, and a share button.
- **Standing card:** one big percentile ("Top 18% of coins at 2h") from the composite score (Section 5), with the comparison group selectable: *Yardstick launches* / *pump.fun baseline*.
- **Metric grid** (each card shows value, percentile at the same age, a horizontal percentile bar with the median marked, and a tiny sparkline):
  - Holders (wallets with a non-zero balance, excluding the bonding curve account)
  - Unique buyers
  - Net SOL inflow (buys minus sells)
  - Buy/sell ratio (by count and by SOL)
  - Curve progress %
  - Top-10 holder concentration (excluding the curve)
  - Dev wallet: % of supply held, whether it has sold, how much
  - Sniper share: % of supply bought in the first few slots after creation
  - Fresh-wallet share: % of buyers whose wallets are very new or have almost no history (sample this; don't check every wallet if it busts free limits)
- **Trajectory chart:** this coin's holders (or market cap, toggle) over time, plotted against the median and the 25th–75th percentile band of the comparison group at each age. Use a lightweight free chart library.
- **What to look at:** 2–4 rule-based notes generated from the coin's weakest metrics vs graduated coins. Examples: "Top 10 wallets hold 46%. Coins that graduated had a median of 22% at this age." "No sells from the dev wallet so far." Descriptive only; no "buy/sell" language.
- **Milestones:** first 50 holders, 25% curve, 50% curve, graduated, with timestamps.
- External mode (coin not launched here): same metrics, but label it clearly and only snapshot it while someone is viewing, so it doesn't eat the free RPC budget.

### 2.4 Today (`/today`)
- Table of today's Yardstick launches ranked by composite score: rank, coin, age, holders, net inflow, curve %, percentile. Sortable, filterable by age bucket.
- Toggle for "last 7 days" and "graduated".
- This is a ranking for curiosity, not a prize. No rewards attached.

### 2.5 Creator profile (`/creator/[wallet]`)
- Every coin this wallet launched through Yardstick with outcome (graduated / active / faded), peak market cap, best percentile reached.
- Simple aggregate: launches, graduation rate.
- A signed-in creator sees "My coins" from the header.

### 2.6 How it works (`/how`)
- Plain-English explanation of every metric, the comparison groups, the composite score formula, sampling limits, and what "same age" means. Being open about the method is part of the product.
- FAQ: Is it free? (yes) Do you hold my keys? (no) Does my coin appear on pump.fun? (yes) Is this financial advice? (no).

---

## 3. Overrides to `token-launch-prompt.md`

- Remove devnet entirely: drop `SOLANA_NETWORK`, any network switch, and the devnet end-to-end test. Hard-code mainnet everywhere, including RPC defaults and explorer links.
- Platform fee: none. Don't add any fee instruction or fee field.
- Dev buy: optional, default 0, capped (e.g. 2 SOL) with a clear warning. If > 0, build create + buy in the same transaction using the SDK's current instructions, and extend the relay check to allow exactly one buy instruction for this mint, from the fee payer, at the entered amount (within slippage).
- Keep everything else: browser-side mint keypair, wallet signs first then mint partial-signs, server-side build/simulate/relay with strict instruction checks, idempotent finalize, wallet sign-in with nonce, all the packaging and RPC pitfalls.

---

## 4. Data collection (fit in free tiers)

### 4.1 Snapshots of Yardstick coins
- After finalize, record a snapshot of each Yardstick coin at fixed ages: 5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h, 24h, 48h, 7d. Snapshots at exact ages make comparisons fair. Also keep a "latest" snapshot refreshed at most every 2 minutes while someone views the dashboard.
- Stop snapshotting a coin after 7 days, or once it graduates (record the graduation, then one final snapshot).
- Sources:
  - Bonding curve account: reserves → market cap, curve progress, graduation flag.
  - Holders: token accounts for the mint (Helius DAS `getTokenAccounts` by mint, paginated, or `getProgramAccounts` with mint filter as fallback). Exclude the curve's account. Top-10 concentration from the same data.
  - Trades: parse pump program transactions for the mint (signatures for the bonding curve address, then fetch and decode buys/sells) to get unique buyers, buy/sell counts, net SOL inflow, dev sells and sniper share. Store a cursor per coin so each tick only fetches new signatures.

### 4.2 pump.fun baseline (sampled)
- Thousands of coins launch daily; tracking all of them won't fit free limits. Instead:
  - Each tick, discover a small batch of recently created pump.fun coins (e.g. recent create transactions on the pump program, via signatures for the program address), and enroll a random sample, e.g. up to ~300 new coins per day.
  - Snapshot sampled coins at the same fixed ages as Yardstick coins, with the same metrics. Fresh-wallet checks only on a small random subset of buyers.
- Put discovery behind a `BaselineSource` interface so another source can be swapped in later. If you add any unofficial pump.fun HTTP API, it must be optional, behind a flag, with the onchain path as the default.
- Show the sample size wherever baseline percentiles appear ("compared with 1,240 sampled coins, last 7 days").

### 4.3 Distributions
- Per age bucket and metric, precompute percentile breakpoints (p5, p10…p95) for each comparison group over a rolling 7-day window, plus "graduated coins only" medians. Store them in a table; refresh hourly. Dashboards read breakpoints instead of scanning raw rows.
- If a bucket has fewer than ~30 coins, show "Not enough data yet" instead of a percentile.

### 4.4 Background work on Vercel Hobby
- No long-running workers. One `tick()` function guarded by a DB lock does: finalize pending launches, due snapshots, baseline discovery/snapshots, distribution refresh (hourly), SOL price refresh.
- Trigger it from:
  - `GET /api/cron` protected by `CRON_SECRET`, pinged every 5 minutes by **cron-job.org** (free). Document the setup.
  - `after()` on busy page loads.
  - The launching user's status polling (finalize only).
- Each tick has a time budget (e.g. stop after ~8 seconds of work) and an RPC request budget, and resumes from cursors next time. Track daily RPC usage in the DB and slow baseline sampling automatically when nearing the free plan's limit.

---

## 5. Composite score

- For a coin at age bucket A, score = weighted average of its percentiles (vs the selected group at A):
  - Holders 25%, unique buyers 20%, net SOL inflow 20%, curve progress 15%, top-10 concentration (inverted: lower is better) 10%, sniper share (inverted) 5%, fresh-wallet share (inverted) 5%.
- Volume alone is never a factor; that keeps wash trading from topping the board.
- Keep the weights in one config file and show them on `/how`.

---

## 6. Database (Prisma)

At least: `User` (wallet, session), `Session` (hashed token), `Launch` (pending/confirmed/failed, reason), `Coin` (mint, creator, source: yardstick | baseline | external, metadata, createdAt, graduatedAt), `Snapshot` (coinId, ageBucket or "latest", all metrics, takenAt), `TradeCursor`, `Distribution` (group, ageBucket, metric, breakpoints, sampleSize, window), `JobLock`, `JobRun`, `RpcUsage`, `SolPrice`. Index by mint, creator, createdAt, and (group, ageBucket, metric).

Migrations run on deploy (`vercel-build`: `prisma generate && prisma migrate deploy && next build`).

---

## 7. Design

Yardstick should look like a precise measuring instrument crossed with a clean financial scorecard, not a neon casino.

- **Mood:** calm, confident, readable. Light theme by default (warm off-white paper background, near-black ink text), with a full dark theme (deep graphite, not pure black) that follows the system setting and has a toggle.
- **Colour:** one signal accent (a confident amber/orange) used for the user's own coin, the standing number and primary buttons. Muted greys for comparison bands. Green/red only for directional changes, never as the main palette. Check contrast meets WCAG AA in both themes.
- **Type:** a characterful free grotesk for headings (e.g. Space Grotesk or Bricolage Grotesque via Google Fonts), a clean sans for body (e.g. Inter), and tabular monospace numerals (e.g. JetBrains Mono or IBM Plex Mono) for all figures so columns align.
- **Signature motif:** a ruler/tick-mark scale. Percentile bars look like rulers with fine ticks, the median marked with a small notch, and the user's coin marked with the accent. Reuse it subtly (section dividers, loading states, logo).
- **Logo:** a simple wordmark "yardstick" with a few ruler ticks under it, as inline SVG. Favicon derived from it.
- **Layout:** generous whitespace, 12-column grid on desktop, single column on phones with 16px gutters and no horizontal scroll. Metric cards in a grid; tables become stacked cards on mobile.
- **Motion:** minimal and purposeful: percentile bars animate in once, numbers tick on update. Respect `prefers-reduced-motion`.
- **States:** every data view has designed loading (skeletons with tick marks), empty and error states. Never show placeholder or fake data.
- **Share card:** dynamic Open Graph image per coin via `next/og`: coin image, symbol, age, standing percentile on the ruler motif. Free and generated on the fly.
- **Accessibility:** keyboard reachable, visible focus rings, labels on all inputs, charts have text summaries.
- Use free icons only (e.g. Lucide).

---

## 8. Health check

Extend `/api/health` from the launch prompt with: last tick time and duration, snapshots due vs done, baseline sample size per group over 7 days, distribution freshness, RPC usage today vs budget. Plain-English hints for anything off ("Baseline has fewer than 30 coins in the 1h bucket; percentiles will show 'Not enough data' until more are sampled.").

---

## 9. Verify before saying it's done

- **Unit tests:** relay checker (including dev-buy cases), RPC fail-over, curve maths, trade parsing on real recorded transactions (save fixtures), percentile/breakpoint calculation, composite score, pre-launch checks.
- **Production build** plus `node --no-experimental-require-module -e "require('@pump-fun/pump-sdk')"`.
- **Local click-through** with a real wallet on mainnet: prepare, upload, build and simulate must work. With an empty wallet, the user must see "not enough SOL" before anything is sent.
- **External mode:** paste a real recent pump.fun mint and confirm the dashboard fills in.
- **Tick:** run it against mainnet locally and confirm baseline coins are discovered and snapshotted within the time and RPC budgets.
- **Real launch:** don't send a real launch yourself. Tell me it's ready for a small test launch from my wallet (about 0.03–0.05 SOL), and list what you verified vs didn't.

---

## 10. Hand-off report (always finish with this)

Write `docs/YARDSTICK.md` and update `.env.example` (placeholders only), then print the same summary:

1. **Environment variables** table: name, required/optional, purpose, example, where to get it. At least `DATABASE_URL`, `SOLANA_RPC_URL` (comma-separated, Helius first, public last), `HELIUS_API_KEY` if used separately, `SITE_URL`, `CRON_SECRET`, `PINATA_JWT` (optional), `COINGECKO_API_KEY` (optional), `RPC_DAILY_BUDGET`, `BASELINE_DAILY_SAMPLE`. Say which go in local `.env` vs Vercel → Project → Settings → Environment Variables, and that changes need a redeploy.
2. **Free accounts to create:** Vercel, Neon or Supabase, Helius, cron-job.org: sign-up URL, which free plan, exactly what value to copy.
3. **Generated secrets:** a command for each (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), and a reminder never to commit them.
4. **Host settings:** Node 22.x, build command, database region close to the Vercel region, cron-job.org schedule (every 5 minutes, with the secret).
5. **After deploying:** open `/api/health` (expect `ok: true`), check a pasted external coin, do one small test launch, confirm it appears on pump.fun and on `/today`.
6. **Troubleshooting:** every error code the UI can show, cause, what to check.
7. **Customise later:** composite weights, snapshot ages, baseline sample size, dev-buy cap, banned words, socials, a custom domain.

## Rules throughout
- Never ask for private keys or seed phrases.
- Never commit `.env` or keypairs.
- Secrets server-side only (no `NEXT_PUBLIC_` on keys).
- Never show fake or placeholder numbers in production.
- Always show "Solana mainnet" clearly in the UI.
