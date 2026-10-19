# Yardstick: setup and operations

Yardstick launches coins on pump.fun (Solana mainnet) from the creator's own wallet and compares every coin with others of the same age. It takes no fees and runs on free tiers: Vercel Hobby, Neon, Helius free, cron-job.org.

- Stack: Next.js 16 (App Router), Prisma 7 + Postgres (Neon), Tailwind 4, `@pump-fun/pump-sdk` 4.1.0, Solana wallet adapter.
- Network: mainnet only, hard-coded. There is no devnet switch.
- Open `/status` (readable) or `/api/health` (JSON) first after every deploy.

---

## 1. Environment variables

| Name | Required | Purpose | Example | Where to get it |
|---|---|---|---|---|
| `DATABASE_URL` | Yes | Pooled Postgres connection used at runtime | `postgres://…-pooler….neon.tech/neondb?sslmode=require` | Set automatically by Vercel's Neon integration |
| `DATABASE_URL_UNPOOLED` | Yes (prod) | Direct connection used by `prisma migrate deploy` during the build | `postgres://…neon.tech/neondb?sslmode=require` | Set automatically by Vercel's Neon integration |
| `SOLANA_RPC_URL` | Strongly recommended | Comma-separated RPC URLs, best first. The public RPC is always added last as a fallback | `https://mainnet.helius-rpc.com/?api-key=…` | Helius dashboard → RPCs → Mainnet URL |
| `HELIUS_API_KEY` | Optional | Alternative to putting the Helius URL in `SOLANA_RPC_URL` | `1a2b3c…` | Helius dashboard → API Keys |
| `SITE_URL` | Yes (prod) | Public URL; used in the wallet sign-in message and share images | `https://yardstick.vercel.app` | Your Vercel domain |
| `CRON_SECRET` | Yes | Protects `/api/cron` | 64 hex characters | Generate (section 3) |
| `PUMP_LOOKUP_TABLE` | Needed for dev buys | The site's frozen address lookup table | `7xKX…` | Create once at `/setup` (section 4) |
| `PINATA_JWT` | Optional | Fallback for metadata uploads if pump.fun's IPFS endpoint is unreachable | `eyJhbGci…` | pinata.cloud → API Keys → New key (JWT) |
| `COINGECKO_API_KEY` | Optional | SOL/USD from CoinGecko; Coinbase and Kraken are fallbacks | `CG-…` | coingecko.com → Developer dashboard (Demo, free) |
| `RPC_DAILY_BUDGET` | Optional | RPC credits Yardstick may spend per UTC day (default 30000) | `30000` | Helius free = 1M/month ≈ 33k/day |
| `BASELINE_DAILY_SAMPLE` | Optional | pump.fun coins sampled into the baseline per day (default 150) | `150` | Your choice; see section 7 |

**Local vs Vercel.** For local development put the values in `.env.local` (run `vercel env pull .env.local` once the project is linked; it's gitignored). For production set them in Vercel → Project → Settings → Environment Variables, for Production (and Preview if you use it). Changing any of them requires a redeploy.

Secrets are only read on the server. Nothing uses a `NEXT_PUBLIC_` prefix, and the RPC key never reaches the browser: the browser doesn't need an RPC to launch.

## 2. Free accounts to create

| Service | Sign-up | Plan | What to copy |
|---|---|---|---|
| Vercel | https://vercel.com/signup | Hobby (free) | Nothing; import the Git repo as a project |
| Neon (through Vercel) | Vercel → Project → Storage → Create Database → Neon | Free | Nothing; the integration adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` |
| Helius | https://dashboard.helius.dev/signup | Free (1M credits/month) | Dashboard → RPCs → Mainnet URL, into `SOLANA_RPC_URL` |
| cron-job.org | https://console.cron-job.org/signup | Free | Nothing to copy; you create a job (section 4) |
| Pinata (optional) | https://app.pinata.cloud/register | Free | API Keys → New key → JWT, into `PINATA_JWT` |
| CoinGecko (optional) | https://www.coingecko.com/en/developers/dashboard | Demo (free) | API key, into `COINGECKO_API_KEY` |

## 3. Generated secrets

```sh
# CRON_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never commit secrets. `.env*` (except `.env.example`) and keypair files are gitignored. Never paste a wallet's recovery phrase or private key anywhere; nothing in Yardstick needs one.

## 4. Host settings and deployment

1. **Push the repo** to GitHub and import it in Vercel. Framework preset: Next.js.
2. **Node version:** `package.json` pins `"engines": { "node": "22.x" }`; Vercel picks this up. (Settings → Build and Deployment → Node.js Version should show 22.x.)
3. **Build command:** Vercel runs the `vercel-build` script automatically: `prisma generate && prisma migrate deploy && next build`. Migrations run on every deploy. `postinstall` also runs `prisma generate`.
4. **Database region:** when creating the Neon database, pick the region closest to your Vercel functions region (default Vercel region is `iad1`, Washington DC → choose Neon `us-east-1`).
5. **Environment variables:** add the ones in section 1, then redeploy.
6. **cron-job.org:** create a job:
   - URL: `https://YOUR-SITE/api/cron`
   - Schedule: every 5 minutes
   - Advanced → Headers: `Authorization: Bearer YOUR_CRON_SECRET` (or use the URL `https://YOUR-SITE/api/cron?secret=YOUR_CRON_SECRET`)
   - Request timeout: 60 seconds (the free maximum is enough; each tick stops itself after about 8 seconds)
   - Vercel Hobby's built-in cron runs at most once a day, which is why cron-job.org is used. Busy page loads also trigger a tick, and a launching user's status polling finalizes their launch, so nothing depends on cron alone.
7. **Lookup table (once, for dev buys):** `/setup` only works on a local copy of the site (the deployed site returns 404 for it and for `/api/setup/lookup-table`). Run `npm run dev`, open `http://localhost:3000/setup`, connect the wallet you want to pay from, click **Create lookup table**, approve three small transactions (about 0.006 SOL of rent in total, which isn't refundable because the table is frozen). The table lives on mainnet, so the deployed site can use it: copy the address it shows into `PUMP_LOOKUP_TABLE` in Vercel and redeploy. (The status box on that page reads your local `.env.local`; run `vercel env pull .env.local` first if you want it to show the production table.)
   - Why: a create + dev buy transaction is about 1,280 bytes as a basic (legacy) transaction, over Solana's 1,232-byte limit. With the table it's about 900 bytes.
   - Without it, launches without a dev buy work normally; a launch with a dev buy shows `tx-too-large` before anything is signed.

## 5. After deploying

1. Open `/status` (or `/api/health` for JSON). Expect "Yardstick is working" (`"ok": true`). Read every note: early on you'll see "Baseline has N coins in the 1h bucket…" until enough coins are sampled, which takes about a day of cron runs for the early ages and a week for 7d. `/status` never shows hostnames, keys or raw errors; `/api/health` has the details (per-host RPC counts, the tick error).
   - To decide whether to raise `BASELINE_DAILY_SAMPLE`, look at "Data use, last 7 days" on `/status` (`checks.rpcUsage.last7Days` in JSON): credits used per day against `RPC_DAILY_BUDGET`, and baseline coins sampled per day against the target.
2. Paste a real, recent pump.fun mint into "Check a coin" on the home page. The dashboard fills in within a few seconds (market cap, holders, buys and sells).
3. Do one small test launch from your own wallet with about 0.03–0.05 SOL (create costs about 0.02 SOL in rent plus fees). Leave dev buy at 0 for the first test.
4. Confirm the coin appears on pump.fun (the banner links to it), on Solscan, and on `/today`.
5. If you set up the lookup table, do a second test with a small dev buy (for example 0.01 SOL).

## 6. Troubleshooting: error codes the UI can show

| Code | What it means | What to check |
|---|---|---|
| `not-signed-in` | No valid session | Connect the wallet and approve the sign-in message (free, no transaction) |
| `session-wallet-mismatch` | Connected wallet ≠ signed-in wallet | Switch back, or sign in again with the new wallet |
| `validation-failed` | A form field is invalid | The message lists the field |
| `image-invalid` | Image couldn't be decoded | PNG/JPEG/WebP/GIF under 4 MB |
| `banned-word` | Name/symbol/description has a blocked word | `LAUNCH.bannedWords` in `src/lib/config.ts` |
| `rate-limited` | Too many prepares per wallet/IP per hour, or too many new-coin lookups per IP | Limits in `src/lib/config.ts`; wait an hour |
| `metadata-upload-failed` | pump.fun IPFS (and Pinata, if set) failed | `/api/health` → `pumpIpfs`; set `PINATA_JWT` as a fallback |
| `launch-not-found` / `launch-wrong-state` / `launch-expired` | The launch record isn't usable (already sent, or unsigned for 30 minutes) | Start the launch again |
| `insufficient-sol` | The wallet can't cover rent + fees + dev buy | Top up the wallet; nothing was sent |
| `simulation-failed` | The dry run failed | Expand "Program logs" in the error; usually a pump program change, so check for a newer `@pump-fun/pump-sdk` |
| `tx-too-large` | Dev-buy transaction too big | Set up `PUMP_LOOKUP_TABLE` (section 4.7) |
| `invalid-transaction` | The signed transaction didn't match what was built | Usually a wallet modifying the transaction; try another wallet |
| `blockhash-expired` | Approval took too long | Click Try again; nothing was charged |
| `wallet-rejected` / `wallet-error` / `wallet-not-installed` | Wallet cancelled, failed or missing | The wallet dialog shows install steps |
| `tx-failed` | Landed but failed on-chain | Check the Solscan link |
| `confirm-timeout` | No confirmation within 2 minutes | Check Solscan; refresh the page. Finalize also runs on the next cron tick |
| `rpc-rate-limited` / `rpc-forbidden` / `rpc-timeout` / `rpc-network` / `rpc-unsupported` / `rpc-error` | RPC trouble | `/api/health` → `rpc`; make sure `SOLANA_RPC_URL` has the Helius URL first. The public RPC often refuses Vercel |
| `pump-sdk-unavailable` | The SDK failed to load on the server | `serverExternalPackages` in `next.config.ts` and the `uuid` override in `package.json` |
| `invalid-mint` / `not-a-pump-coin` / `unsupported-quote` | Pasted address isn't a SOL-priced pump.fun coin | Check the address |
| `server-error` | Unexpected failure | Vercel → Project → Logs |

## 7. How data collection fits in the free tiers

- **Ticks.** `/api/cron` → `tick()` (`src/lib/jobs/tick.ts`) takes a DB lock, then, within about 8 seconds and 600 credits: finalizes launches, takes due snapshots of Yardstick coins, discovers and samples baseline coins, snapshots baseline coins, fetches coin metadata from IPFS, refreshes distributions (hourly), the SOL price (every 10 minutes) and prunes old rows (daily).
- **Snapshots** are taken at fixed ages (5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h, 24h, 48h, 7d), within a window after each. Coins stop being tracked after 7 days or at graduation; a graduated coin's final values are carried forward to the later ages so later comparisons don't drop the best coins.
- **Discovery** reads pump's mint-authority account (touched only by create transactions) to see new coins and the launch rate, then samples `BASELINE_DAILY_SAMPLE` per day. About 40% of pump.fun creates are currently "mayhem mode" and a few are priced in non-SOL tokens; those are skipped so the baseline matches what Yardstick launches.
- **Trades** come from Helius `getTransactionsForAddress` (100 transactions per 10 credits) when the plan allows it, else `getSignaturesForAddress` + `getTransaction` (1 credit per trade). The code detects which one works. Trades are capped per coin (5,000 Yardstick, 1,000 baseline, 2,000 looked-up; 600 on standard RPC) and capped metrics are labelled.
- **Holders** come from Helius DAS `getTokenAccounts` (10 credits per page) or `getProgramAccounts` as a fallback; quiet coins reuse their previous holder reading.
- **Budget.** Credits are counted per host in `RpcUsage`. Baseline sampling slows when the day's spend runs ahead of the clock and stops at 90% of `RPC_DAILY_BUDGET`, leaving room for Yardstick coins.

## 8. Customise later

| What | Where |
|---|---|
| Composite weights | `COMPOSITE_WEIGHTS` in `src/lib/config.ts` (also shown on `/how`) |
| Snapshot ages and windows | `AGE_BUCKETS`, `snapshotWindowSeconds` in `src/lib/config.ts` |
| Baseline sample size | `BASELINE_DAILY_SAMPLE` env var |
| Trade caps, fresh-wallet sample, sniper window, minimum sample sizes | `DATA` in `src/lib/config.ts` |
| Dev-buy cap, priority fee, rate limits, banned words | `LAUNCH` in `src/lib/config.ts` |
| Tick time/credit budget, refresh intervals | `TICK` in `src/lib/config.ts` |
| Footer links / socials | `src/components/site-footer.tsx` |
| Custom domain | Vercel → Project → Settings → Domains; then update `SITE_URL` and the cron-job.org URL, and redeploy |

## 9. Local development

```sh
npm install
npx prisma dev --name yardstick --detach      # local Postgres (no Docker); prints a postgres:// URL
# put that URL in .env.local as DATABASE_URL, plus SITE_URL=http://localhost:3000 and a CRON_SECRET
npx prisma migrate deploy
npm run dev                                   # http://localhost:3000
npm run tick                                  # one background tick against mainnet
npm test                                      # unit tests
node --no-experimental-require-module -e "require('@pump-fun/pump-sdk')"   # strict-Node load check
```

`scripts/record-fixtures.ts` and `scripts/find-graduation.ts` re-record the real mainnet transactions used by the trade-parsing tests.

## 10. Launch flow (for reference)

1. **Sign in:** the wallet signs a nonce message; the server verifies it (ed25519) and sets an httpOnly session cookie, stored hashed.
2. **Prepare** (`/api/launch/prepare`): validate, normalise the image to PNG with sharp, upload to pump.fun's IPFS (Pinata fallback), store a pending launch. Rate-limited per wallet and per IP.
3. **Mint key:** generated in the browser; its secret never leaves it.
4. **Build** (`/api/launch/build`): the pump SDK's `createV2Instruction` (or `createV2AndBuyInstructions` with a dev buy), compute budget, fresh blockhash, balance check, simulation.
5. **Sign:** the wallet signs first, then the mint key signs.
6. **Relay** (`/api/launch/relay`): only ComputeBudget, exactly one `create_v2` for this launch's mint/name/symbol/URI/creator and, with a dev buy, exactly one token-account create and one `buy` for this mint from the fee payer at the entered amount (+1% slippage) are allowed; v0 transactions may only use the site's lookup table; every signature must verify. Then it's sent.
7. **Finalize** (`/api/launch/[id]`, polled; also every tick): confirms the signature, checks the bonding curve exists with this creator, claims the launch atomically and creates the coin row.

## 11. Design

The look follows the design language studied in `docs/design-reference.md` (warm grey page, deep teal-black ink, bold rounded type, coloured word pills, a glyph field behind the page). Nothing from the reference site (code, fonts, images, text) is in this repo; its screenshots in `docs/design-reference/` are gitignored and stay local.

### Tokens

All tokens live in **`src/app/globals.css`**: colours as CSS custom properties on `:root`, everything exposed to Tailwind through `@theme inline` (so `bg-page`, `text-muted`, `text-display`, `rounded-card`, `px-gutter`… work).

| Group | Tokens | Notes |
|---|---|---|
| Surfaces | `--page`, `--surface`, `--soft`, `--sunk` | Page, cards, quiet panels, chips/tracks |
| Text and lines | `--ink`, `--muted`, `--faint`, `--rule`, `--rule-strong`, `--focus` | Every text colour is AA on every surface |
| Brand | `--teal` (large elements), `--teal-ink` (links, small teal text), `--btn`/`--on-btn` (primary button), `--yellow`, `--coral`, `--stone`, `--on-pill`, `--on-teal` | Yellow and coral are highlights only, never up/down. White on teal is for display-size text only |
| Data | `--data-you`, `--data-median`, `--data-range`, `--data-range-strong`, `--up`, `--down` | Up/down always also carry ▲/▼ and a sign |
| Cursor field | `--field-dot`, `--field-square`, `--field-plus`, `--field-cell`, `--field-glyph` | Per theme |
| Type | `text-giant`, `text-display`, `text-headline`, `text-title`, `text-lead`, `text-micro`, `text-figure-hero`, `text-figure` | Size, line height, tracking and weight together |
| Space and width | `--gutter` (16px phones, 32px from 768px), `--gutter-inner`, `--section-sm/md/lg`; containers `max-w-page` (1440), `max-w-wide`, `max-w-narrow`, `max-w-measure` | |
| Shape | `rounded-xs` … `rounded-2xl`, `rounded-card`, `rounded-pill` | |
| Motion | `--dur-fast/base/slow/reveal`, `--stagger`, `ease-out`, `ease-in-out`, `ease-standard` | Everything stops under `prefers-reduced-motion` |

Component classes in the same file: `.pill` + `.pill-teal/-ink/-plain/-yellow/-coral/-stone` (word highlights), `.chip`, `.btn` + `.btn-primary/-secondary/-lg` (44px minimum), `.field` and `.label` (form inputs), `.seg` (segmented control), `.skeleton`, `.num` (tabular figures), `.addr` (monospace for addresses and signatures).

`tests/design-tokens.test.ts` reads the colours straight from `globals.css` and checks every text, data, focus and glyph pair for WCAG AA in both themes, and that the two dark blocks stay identical. Change a colour, run `npm test`.

`/design` shows every token, the cursor field and a dashboard sample. It's dev-only (404 in production).

### Fonts

| Font | Use | Source | Licence |
|---|---|---|---|
| Figtree (variable 300–900) | Everything: headings at 800, text at 400–700, numbers with `tabular-nums` | `next/font/google` in `src/app/layout.tsx` (self-hosted at build, no request to Google at runtime) | SIL Open Font License 1.1 |
| Figtree 500 and 800 (static `.woff`) | The share card (`next/og` can't use variable fonts) | `assets/fonts/`, from the Fontsource package | SIL OFL 1.1, text in `assets/fonts/OFL-Figtree.txt` |
| IBM Plex Mono 400/500 | Wallet addresses, mints and transaction signatures only | `next/font/google` | SIL OFL 1.1 |

### Themes

- Light is the default; dark follows the system setting. The header toggle cycles **system → light → dark** and remembers the choice in `localStorage` (`ys-theme`), applied before paint by the inline script in `src/components/theme-toggle.tsx`.
- In CSS, `:root` holds the light values; the dark values are in two identical blocks (system preference and explicit choice). Edit both, or the token test fails.
- `body` and `html` always get an explicit `--page` background.

### Cursor field (`<CursorField />`)

**What it is.** One 2D `<canvas>`, mounted once as the first child of `<body>` in `src/app/layout.tsx`, behind a positioned content layer. Pointer movement leaves irregular clusters of glyphs (dots, squares, teal +) on a 32px grid along its recent path; each cluster grows cell by cell, holds about a second, then fades cell by cell. With no pointer, small ambient blooms appear every 1.3–2.6 s.

**Files.** `src/lib/cursor-field.ts` is the engine (pure logic, unit-tested in `tests/cursor-field.test.ts`); `src/components/cursor-field.tsx` is the canvas, listeners and drawing.

**Behaviour by situation.**
- Touch screens: ambient blooms only (taps and scrolling don't trigger anything).
- `prefers-reduced-motion`: one still frame that scrolls with the page; no animation, no pointer response.
- Tab hidden: the loop stops. Idle with nothing lit: it sleeps until the next ambient bloom.
- Performance: at most 30 frames per second, device pixel ratio capped at 1.5. The canvas covers the viewport plus a margin and scrolls natively with the page, so glyphs never lag during scroll. Measured cost: about 0.2–0.4% of one core for the field's own work (1.9% with 4× CPU slowdown).
- Readability: dot and square colours keep all text at AA (tested). Teal + glyphs are never placed under small text (paragraphs, links, labels, table cells, form fields, SVG text, or anything with `data-field-protect`).

**Strength by area.** Put `data-field` on any element; the smallest containing area wins:

| Value | Effect | Used on |
|---|---|---|
| `full` | All cells, full opacity, 12% + glyphs | Landing hero and closing section, 404 page |
| `calm` (default) | 60% density, 85% opacity, 5% + | Everything not marked |
| `quiet` | 28% density, 55% opacity, no + | Dashboards, tables, charts, status page |
| `off` | Nothing | Available where needed |

**Tuning.**

| What | Where |
|---|---|
| Glyph colours (per theme) | `--field-dot`, `--field-square`, `--field-plus` in `globals.css` (keep dots/squares within 1.35:1 of `--page`; the test checks) |
| Grid pitch and glyph size | `--field-cell` (32px), `--field-glyph` (14px) in `globals.css` |
| Strength per level | `LEVELS` in `src/lib/cursor-field.ts` (`density`, `alpha`, `plus`) |
| Default level | `FIELD.defaultLevel`, or `<CursorField fallback="quiet" />` |
| How far the trail eases behind the pointer | `FIELD.follow` (ms time constant; larger = lazier) |
| Cluster size and spacing | `FIELD.stampRadius` (cells), `FIELD.stampEvery` (px of pointer travel), `FIELD.noiseCut` (higher = sparser), `FIELD.noiseScale` |
| Growth and fade | `FIELD.grow`, `FIELD.growJitter`, `FIELD.hold`, `FIELD.fadeIn`, `FIELD.fadeOut` |
| Ambient blooms | `FIELD.ambientEvery`, `FIELD.ambientRadius` |
| Reduced-motion still frame density | `FIELD.staticCut` (higher = sparser) |
| Frame rate and pixel-ratio cap | `FPS` and `MAX_DPR` in `src/components/cursor-field.tsx` |

### Share card

`src/app/coin/[mint]/opengraph-image.tsx` renders each coin's card on request with `next/og`: symbol, name, age, the standing in a teal pill, the percentile bar and the wordmark, always in the light theme.
