# XAU/USD Signals Platform — Deployment Guide

> **Target**: Netlify (static + serverless functions) + Supabase (Postgres backend)  
> Last updated: 2026-11-14

---

## 1. Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 18 LTS |
| npm / pnpm | any recent |
| Netlify CLI | `npm i -g netlify-cli` |
| Supabase account | free tier OK |
| GoldAPI.io account | free tier (100 req/hr) |

---

## 2. Environment Variables

### 2.1 Required Variables

Create a `.env` file at the project root (never commit it — it is in `.gitignore`).

```
# ── GoldAPI.io ──────────────────────────────────────────────────────────────
# Server-side only. Used in netlify/functions/gold-price.js
# Get your key at https://www.goldapi.io/ (free tier)
GOLDAPI_KEY=your_goldapi_key_here

# ── Supabase ─────────────────────────────────────────────────────────────────
# Public project URL — safe for browser
VITE_SUPABASE_URL=https://nrdwfhllmahtakfvtruo.supabase.co

# Anon (public) key — safe for browser. Find in:
# Supabase Dashboard → Project Settings → API → Project API keys → anon public
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Service-role key — SERVER-SIDE ONLY (Netlify functions). NEVER expose to browser.
# Find in: Supabase Dashboard → Project Settings → API → Project API keys → service_role secret
SUPABASE_SERVICE_KEY=sb_secret_KC0syGG3accWzFE_Htmn8A_zFXgFGPA
```

> [!CAUTION]  
> `SUPABASE_SERVICE_KEY` bypasses Row Level Security. It must only be used inside  
> `netlify/functions/`. Never reference it in `app.js` or any client bundle.

> [!IMPORTANT]  
> `GOLDAPI_KEY` must also stay server-side only. The Netlify function acts as a  
> secure proxy — the key is never sent to the browser.

### 2.2 Locating Your Supabase Anon Key

The project URL is `https://nrdwfhllmahtakfvtruo.supabase.co`.

1. Log in to [app.supabase.com](https://app.supabase.com)
2. Select project **nrdwfhllmahtakfvtruo**
3. Go to **Project Settings → API**
4. Copy the **`anon` `public`** key (starts with `eyJ...`)
5. Set it as `VITE_SUPABASE_ANON_KEY`

---

## 3. Local Development

```bash
# Install dependencies
npm install

# Start Netlify Dev (runs Vite + Netlify functions locally)
npx netlify dev
```

Netlify Dev starts on **http://localhost:8888** and proxies:
- `/.netlify/functions/*` → local function runner
- Everything else → Vite dev server on port 5173

> [!TIP]  
> `netlify dev` reads your `.env` automatically. No need to source it manually.

### Local `.env` file

Copy `.env.example` and fill in your keys:

```bash
cp .env.example .env
# Edit .env with your actual keys
```

---

## 4. Netlify Deployment

### 4.1 Connect Repository

1. Push repo to GitHub / GitLab / Bitbucket
2. Log in to [app.netlify.com](https://app.netlify.com)
3. **Add new site → Import from Git** → select your repo

### 4.2 Build Settings (auto-detected from `netlify.toml`)

| Setting | Value |
|---|---|
| Base directory | *(repo root)* |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |
| Node version | `18` |

### 4.3 Set Environment Variables in Netlify Dashboard

**Site → Site configuration → Environment variables → Add a variable**

| Key | Value | Scope |
|---|---|---|
| `GOLDAPI_KEY` | your GoldAPI.io key | All scopes (functions only need it, but Netlify doesn't scope per-function) |
| `VITE_SUPABASE_URL` | `https://nrdwfhllmahtakfvtruo.supabase.co` | All scopes |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon key (`eyJ...`) | All scopes |
| `SUPABASE_SERVICE_KEY` | your Supabase service-role key | All scopes |

> [!WARNING]  
> After adding or changing environment variables, trigger a **new deploy** (Deploys → Trigger deploy → Deploy site) for the new values to take effect.

### 4.4 Deploy

```bash
# Manual deploy via CLI
npx netlify deploy --prod
```

Or push to your main branch — Netlify auto-deploys on push.

---

## 5. Supabase Setup

### 5.1 Create the `signals` Table

Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS signals (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  timestamptz DEFAULT now(),
  symbol      text NOT NULL DEFAULT 'XAU/USD',
  direction   text NOT NULL CHECK (direction IN ('LONG','SHORT')),
  state       text NOT NULL,
  entry_price numeric(10,2),
  tp_price    numeric(10,2),
  sl_price    numeric(10,2),
  confidence  numeric(5,2),
  outcome     text CHECK (outcome IN ('TP_HIT','SL_HIT','EXPIRED'))
);

-- Enable RLS
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

-- Allow anon reads (public leaderboard / history view)
CREATE POLICY "anon_read_signals"
  ON signals FOR SELECT
  TO anon
  USING (true);

-- Only service role may insert (Netlify function)
-- (service role bypasses RLS by default — no extra policy needed)
```

### 5.2 Row Level Security Summary

| Role | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `anon` | ✅ all rows | ❌ | ❌ | ❌ |
| `service_role` | ✅ | ✅ | ✅ | ✅ |

---

## 6. GoldAPI.io Setup

1. Register at [https://www.goldapi.io/](https://www.goldapi.io/) (free — no credit card)
2. Copy your API key from the dashboard
3. Set as `GOLDAPI_KEY` in Netlify environment variables
4. Free tier: **100 requests/hour**. The app polls every 60 seconds = **60 req/hr** — safely within limits.

### Endpoint Used

```
GET https://www.goldapi.io/api/XAU/USD
Headers:
  x-access-token: <GOLDAPI_KEY>
  Content-Type: application/json
```

---

## 7. Netlify Functions Reference

| Function | Path | Trigger | Description |
|---|---|---|---|
| `gold-price` | `netlify/functions/gold-price.js` | HTTP GET | Proxies GoldAPI.io, returns sanitised OHLCV |
| `health` | `netlify/functions/health.js` | HTTP GET | Liveness check |

### Function File Structure

```
netlify/
└── functions/
    ├── gold-price.js   ← GOLDAPI_KEY used here
    └── health.js
```

---

## 8. SPA Routing

The `netlify.toml` redirect rule `/* → /index.html 200` ensures deep-linking works correctly. This is required for the tab-based SPA structure — without it, refreshing on any path returns a 404.

---

## 9. Checklist Before Going Live

- [ ] `GOLDAPI_KEY` set in Netlify env vars
- [ ] `VITE_SUPABASE_URL` set in Netlify env vars
- [ ] `VITE_SUPABASE_ANON_KEY` set in Netlify env vars
- [ ] `SUPABASE_SERVICE_KEY` set in Netlify env vars
- [ ] `signals` table created in Supabase with RLS enabled
- [ ] `.env` is in `.gitignore` (never committed)
- [ ] `/.netlify/functions/health` returns `{status:"ok"}` after deploy
- [ ] `/.netlify/functions/gold-price` returns live XAU/USD price
- [ ] LW Charts shows real candles (not random walk)
- [ ] TradingView widget shows "Reference Chart (TradingView)" label
- [ ] No `Math.random()` calls remain in signal engine
- [ ] Console shows no CORS errors
