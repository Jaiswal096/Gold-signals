# XAU/USD Institutional Signal Engine

> **Live Deployment:** [https://xau-usd-signals.netlify.app/](https://xau-usd-signals.netlify.app/)  
> **Backend:** Supabase (`https://nrdwfhllmahtakfvtruo.supabase.co`)  
> **Repository:** [https://github.com/Jaiswal096/Gold-signals](https://github.com/Jaiswal096/Gold-signals)  
>
> **⚠️ EDUCATIONAL & RESEARCH PLATFORM ONLY**  
> This software is provided for educational and research purposes. It does **not** constitute financial advice, investment recommendations, or trading signals. Never risk capital based on output from this platform. Past performance indicators shown are illustrative only.

---

## Overview

A single-page web application that aggregates XAU/USD (spot gold) price data, applies heuristic Smart Money Concept (SMC) analysis, and presents the results in an institutional-style signal terminal. The platform is built with vanilla JavaScript, Vite, and deploys as a static site to Netlify with serverless functions handling all API key operations server-side.

**Five Tabs:**
| Tab | Purpose |
|-----|---------|
| Signal Terminal | Live price feed, LW chart with SMC overlays, signal feed |
| Strategy Library | ICT/SMC pattern reference cards |
| AI Model | Heuristic inference playground & confidence explorer |
| Risk Calculator | Position sizing, R:R calculation, pip value |
| Blueprint & API | Supabase schema, REST API spec, JSON schema explorer |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript (ES2022), HTML5, CSS3 |
| Build tool | [Vite 5.x](https://vitejs.dev/) |
| Charting (primary) | [Lightweight Charts v4.1.3](https://github.com/tradingview/lightweight-charts) — real OHLCV data |
| Charting (reference) | [TradingView Advanced Widget](https://www.tradingview.com/widget/) — OANDA:XAUUSD reference view only |
| Serverless functions | [Netlify Functions](https://docs.netlify.com/functions/overview/) (Node.js 18) |
| Database / Auth | [Supabase](https://supabase.com/) (PostgreSQL + Row-Level Security) |
| Data provider | [GoldAPI.io](https://www.goldapi.io/) — XAU/USD spot price |
| Hosting | [Netlify](https://netlify.com/) |

---

## Data Provider

### Primary: GoldAPI.io
XAU/USD spot price is fetched via a **Netlify serverless function** (`/.netlify/functions/gold-price`) that calls the [GoldAPI.io](https://www.goldapi.io/) REST API. The API key is kept server-side and is never exposed to the browser.

- **Free tier:** ~100 requests/hour
- **Polling interval:** 60 seconds
- **Endpoint used:** `GET https://www.goldapi.io/api/XAU/USD`

### Fallback Chain
When GoldAPI.io is unavailable or the key is not configured, the app attempts fallbacks in order:

```
GoldAPI.io (via Netlify function)
  └─► metals.live (public REST, browser-side)
        └─► frankfurter.app ECB rates (XAU/EUR → USD conversion)
              └─► DATA PROVIDER NOT CONFIGURED state (actionable error shown)
```

### TradingView Widget — Reference Only
The TradingView Advanced Widget embedded in the Signal Terminal displays **OANDA:XAUUSD** for visual context. It is labelled **"Reference Chart (TradingView)"** and is **not** the data source for signals. All signal generation uses price data from the GoldAPI.io serverless function chain above.

---

## Local Development Setup

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) (recommended) or npm

### 1. Install dependencies

```bash
pnpm install
# or
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required — GoldAPI.io key (server-side only, used in Netlify functions)
GOLDAPI_KEY=your_goldapi_key_here

# Required — Supabase project credentials
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

> **Note:** `GOLDAPI_KEY` is consumed by Netlify Functions and must **not** have the `VITE_` prefix — it must never be bundled into client-side code.

### 3. Start the dev server

```bash
npm run dev
```

The app opens at `http://localhost:5173`.

For local function testing, use the Netlify CLI:

```bash
npx netlify dev
```

This runs functions at `http://localhost:8888/.netlify/functions/*` and proxies the Vite dev server.

---

## Production Build

```bash
npm run build
```

Output is written to `dist/`. Deploy this directory to Netlify (the `netlify.toml` at the project root handles SPA redirects and function paths automatically).

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full production setup instructions including Netlify environment variable configuration, Supabase setup, and Supabase migrations.

---

## Environment Variables Reference

| Variable | Where used | Required | Description |
|----------|-----------|----------|-------------|
| `GOLDAPI_KEY` | Netlify Functions (server-side) | **Yes** | GoldAPI.io API key. Get one free at [goldapi.io](https://www.goldapi.io/) |
| `VITE_SUPABASE_URL` | Browser + Functions | **Yes** | Supabase project URL (`https://<project-id>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Browser (read-only RLS) | **Yes** | Supabase anonymous/public key |

> **Security:** Never commit `.env` to version control. It is already listed in `.gitignore`. All keys that must remain secret are accessed only through Netlify Functions.

---

## Project Structure

```
Gold-signals-main/
├── index.html                     # Single-page app shell
├── app.js                         # Main application logic
├── style.css                      # Dark-theme styles
├── netlify.toml                   # Netlify config (SPA redirects, function dir)
├── .env.example                   # Environment variable template
├── package.json
├── vite.config.js
├── netlify/
│   └── functions/
│       ├── gold-price.js          # XAU/USD price from GoldAPI.io (server-side)
│       ├── gold-history.js        # OHLCV history endpoint
│       └── health.js              # /api/health liveness check
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql # DB schema (signals, sessions, audit log)
```

---

## Netlify Functions

| Endpoint | Description |
|----------|-------------|
| `GET /.netlify/functions/health` | Liveness check — returns `{ status: "ok" }` |
| `GET /.netlify/functions/gold-price` | Current XAU/USD spot price from GoldAPI.io |
| `GET /.netlify/functions/gold-history?tf=H1&limit=200` | OHLCV candle history (requires paid GoldAPI plan for intraday) |

---

## Known Limitations

| Limitation | Detail |
|-----------|--------|
| **Intraday OHLCV history** | GoldAPI.io free tier does not provide intraday candlestick history. M5/M15/H1 chart history is unavailable without a paid plan. The chart falls back to tick-aggregated data from live polling. |
| **Supabase Auth** | User authentication (login/signup) is not yet implemented. The Supabase schema is in place but Auth flows are pending. |
| **Signal accuracy** | Signals are generated by heuristic rules (SMC/ICT pattern matching). They are **not** produced by a trained ML model. Confidence scores are algorithmic outputs, not backtested accuracy figures. |
| **History win rate** | Any historical win-rate figures in the history table are labelled DEMO and are illustrative only. |
| **CORS on metals.live** | The metals.live fallback may fail in some browsers due to CORS restrictions. frankfurter.app (ECB) is the final fallback. |

---

## Disclaimer

> This platform is intended **solely for educational and research purposes**. The XAU/USD signals, confidence scores, win-rate estimates, and any other analytical outputs are generated by heuristic algorithms and are **not** financial advice. The developers make no representations about the accuracy or profitability of any signals. **Do not trade real money based on output from this platform.**
>
> XAU/USD (spot gold) trading involves significant risk of loss. Always consult a qualified financial professional before making investment decisions.

---

## License

MIT © 2024 — See `LICENSE` for details.
