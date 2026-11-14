# MANUS MAX AI 6.0 — Code Audit Report
> **Audited:** 2026-11-14 · **Files:** index.html (1172 ln), app.js (1776 ln), style.css (3297 ln)

---

## 1. Framework & Build

| Property | Value |
|---|---|
| Runtime | Vanilla JavaScript (ES2020, no framework) |
| Build tool | Vite (see `package.json`) |
| Entry HTML | `index.html` → loads `./style.css` + `./app.js` |
| Structure | Single-Page App, `DOMContentLoaded` wrapper |
| Tabs | 5 — Signal Terminal · Strategy Library · AI Model · Risk & SL/TP · Blueprint & API |

**Tab sections (`section.tab-content`):**

| `data-tab` | `id` |
|---|---|
| `terminal` | `tab-terminal` |
| `strategies` | `tab-strategies` |
| `engine` | `tab-engine` |
| `calculator` | `tab-calculator` |
| `blueprint` | `tab-blueprint` |

---

## 2. External Dependencies (CDN — no npm install)

| Library | Version | Purpose |
|---|---|---|
| Lucide Icons | `@latest` | Icon set via `window.lucide.createIcons()` |
| Lightweight Charts | `4.1.3` | Candlestick chart + price-line overlays |
| TradingView `tv.js` | inline `<script>` | Reference chart widget (OANDA:XAUUSD) |
| Google Fonts | Plus Jakarta Sans + JetBrains Mono | Typography |

> [!WARNING]
> `tv.js` is inlined inside the HTML `<body>` as an inline `<script type="text/javascript" src="https://s3.tradingview.com/tv.js">`. A strict Content-Security-Policy that restricts `script-src` will block it. It is **not** loaded through Vite's module graph.

---

## 3. Data Providers

### 3.1 PRIMARY — Binance WebSocket

```
wss://stream.binance.com:9443/ws/paxgusdt@ticker
```

- Ticker field used: `packet.c` (last price), fallback to `packet.price` / `packet.p`
- Guard: `price > 1000` (passes through)
- Reconnect: 5 s exponential-less timer, single attempt

> [!CAUTION]
> **PAXG/USDT is NOT spot XAU/USD.** PAXG is a Paxos-issued ERC-20 crypto token pegged *approximately* to 1 troy ounce of gold. It carries a 0.1–0.3 % management fee drag, is priced in USDT (itself a stablecoin, not USD), and can deviate from spot gold by $5–$30+ during crypto market hours or liquidity events. The platform labels this feed "XAU/USD" throughout the UI — this is factually incorrect.

### 3.2 FALLBACK 1 — metals.live HTTP REST

```
GET https://api.metals.live/v1/spot/gold
```

- Polled every **1000 ms** (1 s) when WS is unavailable — extremely aggressive
- Uses `AbortSignal.timeout(4000)`
- Response parsed as array; last element's `.price` used

> [!WARNING]
> `api.metals.live` does **not** set permissive CORS headers for browser requests. This endpoint will likely be blocked by browser CORS policy in production. No CORS proxy is configured.

### 3.3 FALLBACK 2 — frankfurter.app ECB Rates

```
GET https://api.frankfurter.app/latest?from=XAU&to=USD
```

- Used when metals.live fails
- ECB rates are updated **once per business day** — unsuitable for intraday signal generation
- Returns `d.rates.USD`

---

## 4. Boot Sequence (`initXxx` calls)

```
initPersistence()      → localStorage restore (timeframe, showIndicators)
initNavigation()       → tab switch + timeframe button + toggle-overlay handlers
initSignalEngine()     → generateLiveSignals() + renderSignalFeed() + 30s setInterval
initKillzoneTimer()    → UTC session countdown, 1s setInterval
initNewsEngine()       → hardcoded newsEvents render + 1s countdown
initSignalHistory()    → renders hardcoded state.history array
initLightweightChart() → LW Charts init + synthetic OHLC
initSimulator()        → AI Model slider/select handlers
initCalculator()       → Risk calculator input handlers
initActionButtons()    → btn-refresh-signal, btn-quick-signal, btn-open-calc, btn-copy-signal, btn-copy-json
initSilverBulletClock()→ 10s setInterval for SB window status
initAMDPhase()         → 30s setInterval AMD phase display
initLiveDataFeed()     → calls initWebSocketStream()
initPerformanceMetrics()→ calculates win-rate etc. from hardcoded history
```

---

## 5. Interactive Controls & Handler Status

### 5.1 Navigation Buttons

| Button | `id` / selector | Handler | Works? |
|---|---|---|---|
| Signal Terminal tab | `.nav-tab[data-tab="terminal"]` | `initNavigation()` click → tab switch | ✅ |
| Strategy Library tab | `.nav-tab[data-tab="strategies"]` | Same | ✅ |
| AI Model tab | `.nav-tab[data-tab="engine"]` | Same | ✅ |
| Risk & SL/TP tab | `.nav-tab[data-tab="calculator"]` | Same | ✅ |
| Blueprint & API tab | `.nav-tab[data-tab="blueprint"]` | Same | ✅ |

### 5.2 Navbar Action Buttons

| Button | `id` | Handler | Works? | Notes |
|---|---|---|---|---|
| Run Inference | `btn-refresh-signal` | `initActionButtons()` → `fetchLiveGoldPrice()` + re-render | ✅ Partial | Calls metals.live/frankfurter, regenerates random signals, pushes new history row |
| Active Signal | `btn-quick-signal` | Clicks terminal nav-tab | ✅ |  |

### 5.3 Chart Controls (Terminal Tab)

| Button | Selector | Handler | Works? |
|---|---|---|---|
| M5 / M15 / H1 / H4 / D1 | `#chart-tf-buttons .btn-tf` | `initNavigation()` → `regenerateLWChartData()` | ✅ Rerenders synthetic data |
| Toggle Indicators (eye) | `#btn-toggle-overlay` | Toggles `state.showIndicators` → `regenerateLWChartData()` | ✅ Toggles state; overlay CSS not dynamically hidden |

### 5.4 Hero Signal Card Buttons

| Button | `id` | Handler | Works? |
|---|---|---|---|
| Copy Signal | `btn-copy-signal` | `navigator.clipboard.writeText()` with signal text | ✅ (requires HTTPS / clipboard permission) |
| Position Size | `btn-open-calc` | Navigates to calculator tab | ✅ |

### 5.5 Signal Feed (per card)

| Control | Selector | Handler | Works? |
|---|---|---|---|
| 3-Pillar Breakdown toggle | `.sig-expand-btn` | `window.toggleSigExpand()` inline onclick | ✅ |

### 5.6 History Table (per row)

| Control | Trigger | Handler | Works? |
|---|---|---|---|
| Eye (detail) button | `btn-detail` per row | `window.showTradeDetail(id)` inline onclick | ✅ Toggles detail `<tr>` |
| News event row click | `news-event-row` | `updateNewsWidget(event)` | ✅ |

### 5.7 AI Model Tab (Inference Playground)

| Control | `id` | Handler | Works? |
|---|---|---|---|
| Real Yield slider | `sim-input-realyield` | `calc()` on `input`/`change` | ✅ |
| DXY Trend select | `sim-input-dxy` | Same | ✅ |
| EMA Alignment select | `sim-input-ema` | Same | ✅ |
| Bollinger Band select | `sim-input-bb` | Same | ✅ |
| SMC Signal select | `sim-input-smc` | Same | ✅ |
| GPR Level slider | `sim-input-gpr` | Same | ✅ |

> [!NOTE]
> The Inference Playground is a **genuine** deterministic calculator. No `Math.random()` is used here. It updates `state.signal` confidence scores and re-renders the hero gauge — these values are real inputs.

### 5.8 Risk Calculator Tab

| Control | `id` | Handler | Works? |
|---|---|---|---|
| Account Balance | `calc-balance` | `calc()` on `input`/`change` | ✅ |
| Risk % | `calc-risk-pct` | Same | ✅ |
| Entry Price | `calc-entry` | Same | ✅ |
| Stop Loss | `calc-sl` | Same | ✅ |
| ATR (14) | `calc-atr` | Present in HTML; **not read in `calc()`** | ⚠️ Field exists, value ignored |
| RR Target select | `calc-rr-target` | Same | ✅ |
| Calculate button | `btn-recalc` | `calc()` | ✅ |

### 5.9 Blueprint & API Tab

| Control | `id` | Handler | Works? |
|---|---|---|---|
| Copy JSON | `btn-copy-json` | `navigator.clipboard.writeText(el.textContent)` | ✅ Copies static hardcoded JSON blob |

---

## 6. Chart Architecture

### 6.1 TradingView Advanced Widget (Reference Chart)

- Loaded via inline `<script src="https://s3.tradingview.com/tv.js">` **inside `<body>`** in `index.html`
- Widget config: `symbol: "OANDA:XAUUSD"`, interval `60` (H1), dark theme
- Studies: `MASimple`, `BollingerBands`, `RSI` (all basic studies)
- Container: `#tradingview_chart_embed` (520 px height)
- **Legitimate** XAU/USD reference chart from OANDA broker feed
- CSP risk: inline script tag + external `tv.js` load from `s3.tradingview.com`

### 6.2 Lightweight Charts v4.1.3 (SMC Overlay Engine)

- Container: `#lw-chart-container`
- Initialized in `initLightweightChart()` → `generateOHLCData()` for 60 bars
- **All OHLC data is synthetically generated via `Math.random()` random walk** (see §7)
- Price lines drawn via `createPriceLine()`: ENTRY, SL, TP1, TP2, TP3, OB, FVG, Liq, CHOCH
- OB/FVG/Liq/CHOCH levels are **fixed offsets from current price** (-14, -7, -20, -35), not detected from real structure
- Live ticks from PAXG/USDT WS feed via `pushOHLCTick()` → real-time candle update
- Responsive via `ResizeObserver`

> [!NOTE]
> Both charts are present simultaneously on the terminal tab. The TradingView widget is a separate `<div>` above the LW Charts container. They do not share data or conflict technically, but they display different underlying assets (OANDA:XAUUSD vs. PAXG/USDT-sourced price).

---

## 7. All Uses of `Math.random()` and Synthetic/Mock Data

### 7.1 Signal Generation — `generateLiveSignals()` (app.js:516–580)

| Variable | Line | Fake |
|---|---|---|
| `numSignals` | 521 | `5 + Math.floor(Math.random() * 5)` — 5–10 signals, random count |
| `strat` | 526 | `Math.random()` strategy picker |
| `isBuy` | 527 | `Math.random() > 0.38` — 62% bullish bias |
| `isPredictive` | 528 | `Math.random() > 0.75` |
| `tf` | 529 | `Math.random()` timeframe picker |
| `offset` | 530 | `Math.random() * 30 - 15` — entry offset from price |
| `slDist` | 532 | `atr * 1.5 + Math.random() * atr` |
| `rrChoice` | 533 | `Math.random()` from fixed array |
| `minAgoSeed` | 552 | `Math.floor(Math.random() * 45)` — fake timestamps |

### 7.2 Confidence Scores — `calculateConfidence()` (app.js:476–494)

```js
const instBase = {
  ICT_SilverBullet: 87 + Math.random() * 10,  // ← FAKE
  ICT_AMD:          85 + Math.random() * 11,  // ← FAKE
  AliVidollar_SD:   84 + Math.random() * 13,  // ← FAKE
  RajaBanks_CT:     81 + Math.random() * 13   // ← FAKE
};
const macroScore = 83 + (isBuy ? 5 : -3) + Math.random() * 10;  // ← FAKE
const techScore  = 86 + Math.random() * 12;                      // ← FAKE
```

The 3-pillar weighted formula itself is correct maths, but **all three inputs are random**. The resulting percentages are meaningless.

### 7.3 TP3 Calculation — `calculateTP3()` (app.js:498–508)

```js
if (htfTarget && conf >= 90) rrMult = 8.0 + Math.random() * 2.0;   // ← FAKE
else if (htfTarget && conf >= 80) rrMult = 6.0 + Math.random() * 2.0;
else rrMult = 4.5 + Math.random() * 2.0;
```

TP3 multiplier is random, not derived from actual HTF structure detection.

### 7.4 LW Charts OHLC — `generateOHLCData()` (app.js:1274–1293)

```js
let price = currentPrice - (Math.random() * 40 + 20);  // ← FAKE starting offset
// per bar:
const movement = (Math.random() - 0.45) * 8;            // ← FAKE random walk
const high = parseFloat((Math.max(open, close) + Math.random() * 4).toFixed(2));
const low  = parseFloat((Math.min(open, close) - Math.random() * 4).toFixed(2));
```

**All 60 historical candles are fabricated via random walk**, not fetched from any price source.

### 7.5 Signal History — Hardcoded (app.js:49–148)

- 7 hardcoded trade records with IDs `XAUUSD-2026-9837` through `XAUUSD-2026-9843`
- **All dates set in August 2026** — in the future relative to November 2026 audit date
- 6 of 7 closed trades show WIN — fabricating an 84.6% win rate
- Pips values are hardcoded integers (+500, +464, +452, +356, +258, -87)
- Performance metrics (`perf-winrate`, `perf-gain`, `perf-sharpe`) are computed from these fabricated rows

### 7.6 `btn-refresh-signal` — New History Entry

```js
id: 'XAUUSD-2026-' + Math.floor(Math.random() * 10000)  // ← random ID
```

### 7.7 Predictive Setups — `generatePredictiveSetups()` (app.js:583–615)

Fixed offsets, not random, but hardcoded relative offsets from current price (H4 OB = price-22, D1 FVG = price+35, H1 Liq = price-8). No actual structure detection.

### 7.8 Data Feeds Widget (index.html)

The "Multi-Layer Data Stream" card shows four hardcoded feed items:
- Real Yields `-0.35%`, DXY `104.20`, ATR(14) `8.2`, RSI `62` — **all static HTML, never updated**
- CHOCH at `$4,048.20`, OB `$4,041–$4,045`, FVG `$4,050–$4,053` — static

### 7.9 Ticker Bar (index.html)

| Element | `id` | Updated dynamically? |
|---|---|---|
| XAU/USD price | `live-gold-price` | ✅ via `updateUI()` |
| XAU/USD change | `live-gold-change` | ✅ via `updateUI()` |
| DXY | `ticker-dxy` | ❌ Static HTML `104.20` |
| DXY change | `ticker-dxy-change` | ❌ Static HTML `-0.42%` |
| US 10Y Yield | `ticker-us10y` | ❌ Static HTML `4.18%` |
| Real Yield | `ticker-realyield` | ❌ Static HTML `-0.35%` |
| GPR Index | `ticker-gpr` | ❌ Static HTML `142.5` |
| Silver Bullet | `ticker-sb-status` | ✅ via `updateSilverBulletTicker()` |
| News Alert | `ticker-news-alert` | ✅ via `updateNewsTickerAlert()` (but counts down fake time) |

---

## 8. Critical Issues

### (a) ❌ PAXG/USDT used as XAU/USD — Incorrect Asset

Binance stream `wss://stream.binance.com:9443/ws/paxgusdt@ticker` feeds prices for a **crypto token** (PAXG = Paxos Gold ERC-20), not spot XAU/USD metal. The UI labels all prices as `XAU/USD`. This is factually wrong and misleading.

**Required fix:** Replace with a real spot gold price source (e.g. GoldAPI.io, Twelve Data, Finnhub XAU/USD endpoint) proxied through a serverless function to keep API keys server-side.

### (b) ❌ TradingView shows real XAU/USD; signal engine uses PAXG price

The TradingView widget (`OANDA:XAUUSD`) displays real spot gold, while all Entry/SL/TP levels are computed from the PAXG/USDT price. These two prices diverge regularly. Users will see contradictory levels.

### (c) ❌ Signal engine uses `Math.random()` — Not real market detection

Signals (direction, strategy, entry offset, timeframe, timestamp) are entirely random. No actual chart pattern recognition, order block detection, or CHOCH identification occurs. The system does not analyze any OHLCV data.

### (d) ❌ Confidence scores use `Math.random()` — Not genuine algorithmic confidence

All three pillars (Institutional, Macro, Technical) start from random bases. The weighted formula is real maths applied to fake inputs. Displayed confidence numbers (e.g. `92%`) have no predictive validity.

### (e) ❌ Predictive setups are hardcoded offsets, not structure detection

H4 OB at `price - 22`, D1 FVG at `price + 35`, H1 Liq at `price - 8` are literal subtraction/addition — not computed from historical candle structure.

### (f) ❌ Signal history is fabricated with future dates showing 100% WIN

All 6 closed trades in the history table are timestamped in **August 2026** (which is in the future as of the November 2026 audit). All 6 show WIN results. The derived `84.6% win rate` and `+6,840 pips` total gain are fabricated numbers with zero basis.

### (g) ❌ No Supabase backend — localStorage only

`window.initSupabase()` exists (app.js:1763–1774) as a stub. It is **never called** anywhere in the codebase. `window.supabase` is never loaded. All persistence is `localStorage` only. Supabase references in the UI roadmap (Phase 7) are aspirational.

### (h) ❌ No server-side API — no `/api/health` endpoint

The Blueprint tab shows `GET https://api.manusmax.ai/v6/signal/XAUUSD` — this endpoint does not exist. The JSON block is static HTML. There is no backend server of any kind.

### (i) ❌ LW Charts candles are a random walk, not real OHLCV

`generateOHLCData()` creates 60 bars using `(Math.random() - 0.45) * 8` per step. Historical candlestick chart does not reflect actual XAU/USD price action.

### (j) ❌ No environment variable validation

No `import.meta.env` variables are used. No runtime check for required keys. API keys would need to be hardcoded or exposed client-side if added naively.

### (k) ❌ Silent `catch {}` blocks throughout

Counted 9+ silent catch blocks (app.js:217, 227, 266, 271, 328, 341, 1318, 1348). Errors are swallowed with no logging, making debugging very difficult. `fetchLiveGoldPrice` failure path falls through silently.

### (l) ❌ No real signal state machine

No states like `WATCH → ARMED → TRIGGERED → ACTIVE → TP_HIT / SL_HIT / EXPIRED` are tracked. Signals appear, disappear every 30 seconds and are never resolved against price. The history table never auto-updates based on price movement.

### (m) ✅ Uses LONG/SHORT correctly (not binary options CALL/PUT)

`generateLiveSignals()` uses `dir: isBuy ? 'LONG' : 'SHORT'`. The hero badge uses "INSTITUTIONAL LONG SIGNAL" / "INSTITUTIONAL SHORT SIGNAL". No binary-options language found.

### (n) ❌ "84.6% Win Rate" is fabricated

Derived from 6 hardcoded WIN results out of 7 fabricated trades in `state.history`. Not from real trade outcomes.

### (o) ❌ CORS issue with metals.live

`api.metals.live/v1/spot/gold` does not serve `Access-Control-Allow-Origin: *` for browser fetch requests. The fallback polling at 1000 ms will silently fail in a browser context in production. The catch block swallows the CORS error.

### (p) ⚠️ TradingView `tv.js` CSP risk

The TradingView widget script is loaded via an inline `<script src="...">` inside `<body>`. Any deployed CSP that restricts `script-src` to `'self'` will block it. The widget script also generates additional XHR and postMessage traffic that CSP must permit.

---

## 9. Security Assessment

| Risk | Severity | Notes |
|---|---|---|
| Binance WS from browser | ✅ Low | Public unauthenticated feed — acceptable |
| metals.live from browser | ⚠️ Medium | Public API, CORS likely blocked, no key |
| frankfurter.app from browser | ✅ Low | Public ECB rate API, no key required |
| Private keys exposed | ✅ None | No API keys in source currently |
| `localStorage` persistence | ✅ Low risk | Only stores `timeframe` + `showIndicators` preferences |
| Supabase service-role key | ⚠️ Pending | Key referenced in ARCHITECTURE task brief; must **never** be in client-side code |
| XSS via innerHTML | ⚠️ Low | Signal reason strings come from internal template arrays only; no user input is rendered via `innerHTML` |
| `navigator.clipboard` | ✅ Low | Requires HTTPS; fails silently on HTTP |

---

## 10. What Works vs. What Doesn't

### ✅ Working Correctly
- Tab navigation (all 5 tabs)
- Killzone session timers (UTC-based, real-time countdown)
- Silver Bullet window timer (10:00–11:00 / 14:00–15:00 EST detection)
- AMD phase display (UTC-based heuristic)
- News countdown timer (counts down from hardcoded initial values)
- LW Charts rendering and timeframe switching (synthetic data, but renders correctly)
- TradingView widget (displays real OANDA:XAUUSD data)
- Risk calculator (all fields, correct lot-size formula)
- AI Model simulator / Inference Playground (deterministic, no randomness)
- Copy Signal to clipboard (requires HTTPS)
- Copy JSON to clipboard (copies static JSON blob)
- Signal feed expandable 3-pillar detail rows
- History trade detail expand/collapse (eye button)
- LocalStorage preference save/restore
- Toast notification system
- Responsive LW chart via `ResizeObserver`

### ❌ Not Working / Broken / Fake
- Price source is PAXG/USDT, not XAU/USD
- metals.live CORS (browser fetch will fail)
- All generated signals are random, not real SMC detection
- All confidence scores are random numbers
- LW Charts OHLC history is a random walk
- Signal history is hardcoded fake data with future timestamps
- DXY, US10Y, Real Yield, GPR ticker items are static HTML (never updated)
- Feed items ("Macroeconomic Feed", "Technical Indicators", "SMC Institutional Action") are static HTML
- Supabase backend does not exist
- `/api/health` and `api.manusmax.ai` endpoints do not exist
- ATR field in calculator (`calc-atr`) is present in HTML but ignored in `calc()` function
- `initPerformanceMetrics()` Sharpe ratio is a simplified proxy (`winRate/100 * 2.1 + 1.2`), not a real Sharpe calculation
- Signal state machine does not exist — no TP_HIT / SL_HIT resolution

---

## 11. Summary Statistics

| Category | Count |
|---|---|
| `Math.random()` calls in production path | **14** |
| Silent `catch {}` blocks | **9+** |
| Static/hardcoded ticker values never updated | **5** |
| Hardcoded fake trade history records | **7** |
| Interactive buttons with working handlers | **15** |
| Buttons/controls that are broken or mislabeled | **3** (`calc-atr` ignored, `btn-copy-json` static, all Supabase stubs) |
| External CDN dependencies | **4** (Lucide, LW Charts, tv.js, Google Fonts) |
| Data source feeds | **3** (PAXG WS, metals.live HTTP, frankfurter HTTP) |
| Backend endpoints | **0** |

---

*End of AUDIT.md*
