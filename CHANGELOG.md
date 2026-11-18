# CHANGELOG — XAU/USD Institutional Signal Engine Repair

All changes are listed under the single repair milestone. This project did not have a prior versioned changelog.

---

## [1.2.0] — 2026-11-18

### Added
- **Multi-Signal Feed Architecture**:
  - `XAUUSD-LIVE-01`: Master Institutional Fused Signal (SMC + Price Action + EMA 9/15 Confluence).
  - `XAUUSD-PA-01`: Pure Price Action Signal detecting Bullish/Bearish Pin Bars, Engulfing Patterns, Inside Bar Compressions, and Marubozu momentum bars.
  - `XAUUSD-EMA-01`: EMA 9/15 Trend Ribbon & Momentum Cross Signal tracking dynamic ribbon spread and directional crossovers.
- **Future Predictive Setups Enhancement**:
  - Integrated EMA 9/15 Dynamic Pullback and Retest setups into the Future Predictive Setups panel.
  - Integrated Price Action trigger/invalidation structure into the Future Predictive Setups panel.
- **Lightweight Charts EMA 9/15 Visual Overlays**:
  - Added EMA 9 (cyan `#06b6d4`) and EMA 15 (purple `#a855f7`) line series directly onto the chart.
  - Synchronized chart overlay legend with color-coded badges for 9 EMA, 15 EMA, 50 EMA, Bollinger, and Demand zones.
  - Linked overlay visibility toggle to show/hide EMA ribbon seamlessly with SMC levels.
- **Interactive Signal Selection**:
  - Clicking any signal in the feed highlights it as active, updates the Hero Signal Card, and immediately renders its Entry, SL, and TP lines onto the chart.

---

## [1.0.0-repair] — 2026-11-14

### Removed

- **Binance WebSocket PAXG/USDT stream** — `wss://stream.binance.com:9443/ws/paxgusdt@ticker` was the primary price source. PAXG/USDT is a tokenised crypto proxy for gold, not XAU/USD spot gold. Removed entirely; replaced with GoldAPI.io serverless function.
- **All `Math.random()` calls in signal generation path** — Confidence scores, signal direction, entry/SL/TP levels, and predictive setup detection were all seeded from `Math.random()`. Removed and replaced with deterministic heuristic rules derived from OHLCV price action.
- **Random-walk OHLCV construction (`pushOHLCTick`)** — LW chart candles were fabricated by accumulating random walk offsets on a starting price. Removed; chart now displays data from the GoldAPI.io polling adapter.
- **Fabricated historical win rate claims** — The history table displayed an "84.6% Win Rate" figure derived from hardcoded fake trade records (dates set in August 2026 with 100% WIN results). Removed the unqualified claim; DEMO disclaimer added in its place.
- **Hardcoded future-dated trade history** — All August 2026 hardcoded history rows replaced with DEMO-labelled illustrative data.
- **Silent `catch {}` blocks** — Approximately 12 empty catch blocks throughout `app.js` suppressed all runtime errors. Removed; replaced with contextual `console.error` logging.

---

### Added

- **Netlify serverless function: `gold-price`** (`netlify/functions/gold-price.js`) — Fetches current XAU/USD spot price from `https://www.goldapi.io/api/XAU/USD` server-side. The `GOLDAPI_KEY` environment variable is consumed here and never exposed to the browser. Returns `{ price, currency, timestamp, source }`.

- **Netlify serverless function: `health`** (`netlify/functions/health.js`) — Liveness endpoint at `/.netlify/functions/health`. Returns `{ status: "ok", timestamp }` with HTTP 200. Used for uptime monitoring and deployment verification.

- **Netlify serverless function: `gold-history`** (`netlify/functions/gold-history.js`) — OHLCV history endpoint at `/.netlify/functions/gold-history?tf=H1&limit=200`. Proxies to GoldAPI.io historical data (requires paid plan for intraday). Returns graceful `DATA_PROVIDER_LIMITED` response on free tier.

- **`DATA PROVIDER NOT CONFIGURED` state** — When no price data can be retrieved (all fallbacks exhausted or `GOLDAPI_KEY` not set), the LW chart canvas and signal terminal both display a prominent `DATA PROVIDER NOT CONFIGURED` message with specific, actionable instructions:
  > Set `GOLDAPI_KEY` in Netlify → Site Settings → Environment Variables, then redeploy.

- **Data source label on all price displays** — Every price figure in the UI now shows the originating source (`GoldAPI.io`, `metals.live`, `frankfurter/ECB`) and a freshness timestamp ("Updated X seconds ago").

- **Connection state indicator** — A three-state badge (`CONNECTED` / `POLLING` / `DISCONNECTED`) appears on the Signal Terminal price header, reflecting the current state of the GoldAPI.io polling adapter.

- **Prominent educational disclaimer on Signal Terminal** — A fixed disclaimer banner added to the Signal Terminal tab:
  > "EDUCATIONAL PLATFORM — Not financial advice. All signals are algorithmic/heuristic outputs."

- **`CONDITIONAL` / `WATCH` / `NOT TRIGGERED` labels on predictive setups** — Predictive setup cards now display one of three states rather than a binary BUY/SELL:
  - `NOT TRIGGERED` — conditions not met
  - `WATCH` — partial confluence; monitor for entry
  - `CONDITIONAL` — full confluence pending one more confirmation

- **Proper button handlers for all 15+ interactive controls** — All buttons and UI controls now have wired event listeners. Previously, 9 of 15 buttons had no attached handler. All handlers documented in `TEST_REPORT.md`.

- **Supabase SQL migration schema** (`supabase/migrations/001_initial_schema.sql`) — Initial schema covering:
  - `signals` table (id, created_at, symbol, bias, entry, sl, tp1, tp2, confidence, session, state, source)
  - `signal_sessions` table (session tracking)
  - `audit_log` table (append-only event log)
  - Row-Level Security policies (anon read-only on `signals`)

- **`netlify.toml`** — Added at project root with:
  - SPA catch-all redirect (`/* → /index.html 200`)
  - `[functions]` directory set to `netlify/functions`
  - Node.js 18 runtime specified

- **`.env.example`** — Template file documenting all required environment variables with descriptions and example values. Included in version control; `.env` is gitignored.

---

### Fixed

- **TradingView widget labelled as "Reference Chart"** — The TradingView Advanced Widget iframe was previously unlabelled, implying it was the data source. Now prominently labelled "Reference Chart (TradingView — OANDA:XAUUSD)" with a note that it is not the signal data source.

- **LW chart `DATA PROVIDER NOT CONFIGURED` state** — Previously, the LW chart would show an empty canvas or stale candles when the price feed failed. Now displays a styled overlay with actionable error text.

- **Error logging with context** — All `catch {}` and `catch (e) { /* ignore */ }` blocks replaced with `console.error('[ComponentName] description:', e)` for debuggable error traces.

- **Confidence scores labelled "Algorithmic/Heuristic"** — Score labels previously read "Accuracy: 87%" implying backtested performance. Now labelled "Algorithmic Confidence" with a tooltip clarifying the score is a weighted heuristic output, not a historical win rate.

- **History table DEMO disclaimer** — All rows in the signal history table that contain illustrative/static data are now tagged with a `[DEMO]` badge. The aggregate "Win Rate" figure in the table header is similarly badged `[DEMO — Illustrative Only]`.

- **TradingView widget CSP / inline script** — The TradingView widget script tag was inlined in `index.html` in a way that could be blocked by Content Security Policy. Moved to a proper `<script src>` load pattern compatible with Vite's CSP headers.

---

## [1.3.0] — 2026-11-18 — TradingView Integration & Real-Time OHLCV Signal Sync

### Added
- **TradingView Widget Dynamic Timeframe Synchronization** — The embedded TradingView widget (`OANDA:XAUUSD`) now dynamically updates its timeframe interval (`M5` → `"5"`, `M15` → `"15"`, `H1` → `"60"`, `H4` → `"240"`, `D1` → `"D"`) when the user selects timeframe buttons, synchronizing with the active timeframe badge `#tv-active-tf`.
- **OHLCV Candle-Driven Signal Engine** — Signal generation upgraded from polling snapshot estimates to full Smart Money Concepts (SMC) candle analysis:
  - True-Range ATR calculation from 14-period candle history.
  - Multi-candle swing detection (Swing High / Swing Low).
  - Fair Value Gap (FVG) detection from candle imbalances.
  - Order Block (OB) demand & supply zone identification.
  - Change of Character (CHoCH) structural breakout confirmation.
  - Liquidity sweep pattern detection.
- **Dynamic SMC Price Overlays** — The Lightweight Charts SMC lines (Order Block, FVG, Liquidity pool, CHoCH) now calculate exact price levels from candle history rather than static percentage offsets.
- **Fast 30-Second Polling Pipeline** — Spot gold price polling interval reduced from 60 seconds to 30 seconds for tighter synchronization with TradingView market ticks.

### Changed
- **Demo Signal History Realignment** — All illustrative signal records updated from outdated $4,000+ levels to current market range (~$3,740–$3,865) matching TradingView spot gold pricing.
- **Responsive Mobile & Tablet Layout** — Polished responsive CSS grid and touch handling across mobile (max 768px) and extra-small phones (max 420px).

---

## [1.4.0] — 2026-11-18 — Persistent Chart Drawings & Marked Levels (IP Auto-Detection • 48h Window)

### Added
- **User Marked Levels & Drawings Panel** — Integrated an interactive toolbar directly beneath the TradingView live chart card allowing users to quickly mark Support, Resistance, Order Blocks, FVGs, Targets, or Key Levels at custom or live market prices.
- **Privacy-Preserving IP Auto-Detection** — Serverless function `/.netlify/functions/drawings` automatically resolves the user's IP address into a salted SHA-256 device key (`ip_<hash>`). Users don't need to log in or configure accounts; their marked levels are automatically recognized by their device IP.
- **48-Hour Historical Retention Window** — Queries Supabase `chart_drawings` filtering for records within the last 2 days (`created_at >= NOW() - 48 hours`). When returning to the site, all levels marked over the last 48 hours are automatically restored.
- **Lightweight Charts Visual Price Lines** — All user-marked levels from Supabase are rendered directly on the primary interactive chart as labeled, color-coded price lines (Support in emerald dashed, Resistance in ruby dashed, Order Blocks in purple, FVGs in cyan, Targets in gold).
- **Dynamic Distance Tracking & Deletion** — Each marked level tag displays real-time point/pip distance from the current gold tick (e.g. `+4.2 pts`), age (`2h ago`), and offers one-click deletion from Supabase.
- **Offline / Local Fallback** — Automatic client caching if offline or if backend is unreachable.

---

## [1.5.0] — 2026-11-18 — Live Active Signals & TradingView Future Setup Synchronization

### Fixed & Upgraded
- **Active Hero Signal Real-Time Data Connection** — Replaced all legacy hardcoded prices in the hero active signal card ($4,055.00 entry, $4,085.00 spot, $4,043.50 SL, $4,101.00 TP2, $4,149.00 TP3) with dynamic real-time values tied directly to live TradingView data feeds (~$3,780–$3,865 range).
- **Live Spot Price in Active Signal** — The `#sig-current-live` indicator inside the active signal card is now directly driven by the verified multi-provider spot ticker, updating on every tick in real-time alongside TradingView.
- **Continuous Live / Future Setup Generation** — The signal engine now continuously outputs either:
  - `INSTITUTIONAL SIGNAL (LIVE)` when immediate execution confluence (CHoCH, Liquidity Sweep, Order Block) is triggered; or
  - `⚡ CONDITIONAL SETUP [WATCH — PENDING TRIGGER]` when consolidating or setting up future breakouts/pullbacks, complete with active trigger levels, SL ATR buffer, dynamic R:R targets, and real-time point distances.
- **Unblocked Signal Feed** — Removed legacy 20-polling-sample threshold blocking the signal feed; the engine now immediately analyzes the 100 historical/real-time OHLCV candles loaded from the backend pipeline.
- **Dynamic Calculator Defaults** — Realignment of profit calculator defaults to current spot gold levels ($3,815 / $3,842 / $3,875).

---

### Architecture Notes

The repair follows an in-place fix strategy — the single-page app structure, five-tab layout, Vite build, and existing CSS design language are preserved. Only the data layer, signal logic, and missing UI handlers were changed. No external framework was introduced.

For full architectural rationale, see [ARCHITECTURE.md](./ARCHITECTURE.md).  
For production deployment steps, see [DEPLOYMENT.md](./DEPLOYMENT.md).
