/**
 * Market Data & Macro Adapter for XAU/USD (Server-side only).
 * Priority for OHLCV:
 *   1. Twelve Data API (TWELVEDATA_API_KEY) — true XAU/USD spot OHLCV
 *   2. OANDA v20 REST API (OANDA_API_KEY) — exact OANDA:XAUUSD candles
 *   3. Zero-key fallback: Live Spot (GoldAPI.io / Swissquote / Gold-API.com)
 *      + Yahoo Finance GC=F candles basis-aligned to live spot (true H4 aggregation)
 * Caches candles for 30s in Supabase `ohlcv_cache` (plus in-memory warm cache).
 */

import { getCachedOhlcv, setCachedOhlcv, getSupabaseConfig, recordMarketStatus } from './supabase.mjs';

const TF_CONFIG = {
  M5: { td: '5min', oanda: 'M5', yahooInterval: '5m', yahooRange: '5d', sec: 300 },
  M15: { td: '15min', oanda: 'M15', yahooInterval: '15m', yahooRange: '1mo', sec: 900 },
  H1: { td: '1h', oanda: 'H1', yahooInterval: '60m', yahooRange: '1mo', sec: 3600 },
  H4: { td: '4h', oanda: 'H4', yahooInterval: '60m', yahooRange: '3mo', sec: 14400, aggregateFrom1h: true },
  D1: { td: '1day', oanda: 'D', yahooInterval: '1d', yahooRange: '2y', sec: 86400 },
};

const CACHE_TTL_MS = 30_000;
const MACRO_TTL_MS = 60_000;

const _memCache = new Map();
let _macroCache = { data: null, fetchedAt: 0 };

export function normalizeTimeframe(tf) {
  const key = String(tf || 'M15').trim().toUpperCase();
  return TF_CONFIG[key] ? key : 'M15';
}

function sanitizeCandles(rawCandles, limit = 200) {
  if (!Array.isArray(rawCandles)) return [];
  const byTime = new Map();
  for (const c of rawCandles) {
    const time = Number(c.time);
    const open = Number(c.open);
    const high = Number(c.high);
    const low = Number(c.low);
    const close = Number(c.close);
    if (
      Number.isFinite(time) && time > 0 &&
      Number.isFinite(open) && open > 0 &&
      Number.isFinite(high) && high > 0 &&
      Number.isFinite(low) && low > 0 &&
      Number.isFinite(close) && close > 0
    ) {
      byTime.set(Math.floor(time), {
        time: Math.floor(time),
        open: Number(open.toFixed(2)),
        high: Number(Math.max(high, open, close).toFixed(2)),
        low: Number(Math.min(low, open, close).toFixed(2)),
        close: Number(close.toFixed(2)),
      });
    }
  }
  const sorted = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  return sorted.slice(-Math.min(Math.max(limit, 50), 300));
}

function aggregateCandles(candles, bucketSeconds) {
  const buckets = new Map();
  for (const c of candles) {
    const bucketTime = Math.floor(c.time / bucketSeconds) * bucketSeconds;
    const existing = buckets.get(bucketTime);
    if (!existing) {
      buckets.set(bucketTime, {
        time: bucketTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

/**
 * Fetch true live XAU/USD spot quote (never PAXG/USDT, never daily ECB).
 */
export async function fetchLiveSpotQuote() {
  const goldApiKey = (process.env.GOLDAPI_KEY || '').trim();
  if (goldApiKey && !goldApiKey.includes('your_goldapi')) {
    try {
      const res = await fetch('https://www.goldapi.io/api/XAU/USD', {
        headers: {
          'x-access-token': goldApiKey,
          Authorization: `Bearer ${goldApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const raw = await res.json();
        const price = Number(raw.price ?? raw.ask);
        if (Number.isFinite(price) && price > 500) {
          return {
            price: Number(price.toFixed(2)),
            change: raw.ch != null ? Number(Number(raw.ch).toFixed(2)) : null,
            changePercent: raw.chp != null ? Number(Number(raw.chp).toFixed(2)) : null,
            prevClose: raw.prev_close_price != null ? Number(raw.prev_close_price) : null,
            provider: 'GoldAPI.io (Spot XAU/USD)',
            timestamp: raw.timestamp ? new Date(raw.timestamp * 1000).toISOString() : new Date().toISOString(),
          };
        }
      }
    } catch (_) {
      // fall through to Swissquote / Gold-API
    }
  }

  // Swissquote live institutional BBO spot feed
  try {
    const res = await fetch('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const arr = await res.json();
      const first = Array.isArray(arr) ? arr[0] : null;
      const tier = first?.spreadProfilePrices?.find((p) => p.spreadProfile === 'standard') || first?.spreadProfilePrices?.[0];
      if (tier && Number.isFinite(tier.bid) && Number.isFinite(tier.ask)) {
        const mid = (Number(tier.bid) + Number(tier.ask)) / 2;
        if (mid > 500) {
          return {
            price: Number(mid.toFixed(2)),
            bid: Number(Number(tier.bid).toFixed(2)),
            ask: Number(Number(tier.ask).toFixed(2)),
            change: null,
            changePercent: null,
            provider: 'Swissquote Institutional Spot (XAU/USD)',
            timestamp: first?.ts ? new Date(first.ts).toISOString() : new Date().toISOString(),
          };
        }
      }
    }
  } catch (_) {
    // fall through
  }

  // Gold-API.com live spot fallback
  try {
    const res = await fetch('https://api.gold-api.com/price/XAU', {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const raw = await res.json();
      const price = Number(raw?.price);
      if (Number.isFinite(price) && price > 500) {
        return {
          price: Number(price.toFixed(2)),
          change: null,
          changePercent: null,
          provider: 'Gold-API.com (Spot XAU/USD)',
          timestamp: raw.updatedAt || new Date().toISOString(),
        };
      }
    }
  } catch (_) {
    // fall through
  }

  return null;
}

/**
 * Provider 1: Twelve Data OHLCV time_series
 */
async function fetchTwelveDataCandles(tf, outputsize = 200) {
  const apiKey = (process.env.TWELVEDATA_API_KEY || '').trim();
  if (!apiKey) return null;

  const cfg = TF_CONFIG[tf];
  const url = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${cfg.td}&outputsize=${outputsize}&order=ASC&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  const json = await res.json();

  if (!res.ok || json.status === 'error' || !Array.isArray(json.values)) {
    throw new Error(`Twelve Data error: ${json.message || res.statusText}`);
  }

  const parsed = json.values.map((c) => ({
    time: Math.floor(new Date((c.datetime.includes('T') ? c.datetime : c.datetime.replace(' ', 'T')) + 'Z').getTime() / 1000),
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
  }));

  const candles = sanitizeCandles(parsed, outputsize);
  if (candles.length < 20) {
    throw new Error('Twelve Data returned insufficient candles');
  }

  const spot = candles[candles.length - 1].close;
  return {
    spot,
    candles,
    provider: 'Twelve Data (XAU/USD Spot)',
    basisAdjusted: false,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Provider 2: OANDA v20 REST API (zero drift vs TradingView OANDA:XAUUSD)
 */
async function fetchOandaCandles(tf, count = 200) {
  const apiKey = (process.env.OANDA_API_KEY || '').trim();
  if (!apiKey) return null;

  const cfg = TF_CONFIG[tf];
  const host = process.env.OANDA_ENV === 'live'
    ? 'https://api-fxtrade.oanda.com'
    : 'https://api-fxpractice.oanda.com';
  const url = `${host}/v3/instruments/XAU_USD/candles?granularity=${cfg.oanda}&count=${count}&price=M`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  const json = await res.json();

  if (!res.ok || !Array.isArray(json.candles)) {
    throw new Error(`OANDA v20 error: ${json.errorMessage || res.statusText}`);
  }

  const parsed = json.candles
    .filter((c) => c.mid && c.time)
    .map((c) => ({
      time: Math.floor(new Date(c.time).getTime() / 1000),
      open: parseFloat(c.mid.o),
      high: parseFloat(c.mid.h),
      low: parseFloat(c.mid.l),
      close: parseFloat(c.mid.c),
    }));

  const candles = sanitizeCandles(parsed, count);
  if (candles.length < 20) {
    throw new Error('OANDA returned insufficient candles');
  }

  return {
    spot: candles[candles.length - 1].close,
    candles,
    provider: 'OANDA v20 (XAU/USD)',
    basisAdjusted: false,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Provider 3 (Zero-Key Fallback): Real Yahoo Finance GC=F OHLCV aligned to live XAU/USD spot.
 */
async function fetchSpotAlignedFallbackCandles(tf, limit = 200) {
  const cfg = TF_CONFIG[tf];
  const [spotQuote, yahooRes] = await Promise.all([
    fetchLiveSpotQuote(),
    fetch(`https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=${cfg.yahooInterval}&range=${cfg.yahooRange}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    }),
  ]);

  if (!yahooRes.ok) {
    throw new Error(`Market candle upstream HTTP ${yahooRes.status}`);
  }

  const yData = await yahooRes.json();
  const result = yData?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quotes = result?.indicators?.quote?.[0] || {};
  const opens = quotes.open || [];
  const highs = quotes.high || [];
  const lows = quotes.low || [];
  const closes = quotes.close || [];

  let rawCandles = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (
      opens[i] != null && highs[i] != null && lows[i] != null && closes[i] != null &&
      !Number.isNaN(closes[i])
    ) {
      rawCandles.push({
        time: timestamps[i],
        open: Number(opens[i]),
        high: Number(highs[i]),
        low: Number(lows[i]),
        close: Number(closes[i]),
      });
    }
  }

  if (cfg.aggregateFrom1h) {
    rawCandles = aggregateCandles(rawCandles, cfg.sec);
  }

  let candles = sanitizeCandles(rawCandles, limit);
  if (candles.length < 20) {
    throw new Error('Market feed returned insufficient candle history');
  }

  const meta = result?.meta || {};
  const futPrice = candles[candles.length - 1].close;
  const liveSpot = spotQuote?.price ?? Number((meta.regularMarketPrice || futPrice).toFixed(2));
  const basisDiff = Number((liveSpot - futPrice).toFixed(2));

  // Align futures OHLCV to live XAU/USD spot so Chart & SMC levels match live spot 1:1
  const basisAdjusted = spotQuote?.price != null && Math.abs(basisDiff) > 0.05 && Math.abs(basisDiff) < 150;
  if (basisAdjusted) {
    candles = candles.map((c) => ({
      time: c.time,
      open: Number((c.open + basisDiff).toFixed(2)),
      high: Number((c.high + basisDiff).toFixed(2)),
      low: Number((c.low + basisDiff).toFixed(2)),
      close: Number((c.close + basisDiff).toFixed(2)),
    }));
  }

  const prevClose = meta.chartPreviousClose || meta.previousClose || candles[0].open;
  const alignedPrev = basisAdjusted ? prevClose + basisDiff : prevClose;
  const change = spotQuote?.change ?? Number((liveSpot - alignedPrev).toFixed(2));
  const changePercent = spotQuote?.changePercent ?? (alignedPrev > 0 ? Number(((change / alignedPrev) * 100).toFixed(2)) : 0);

  return {
    spot: liveSpot,
    change,
    changePercent,
    candles,
    provider: spotQuote ? `${spotQuote.provider} + GC=F Structure` : 'Yahoo Finance GC=F',
    basisAdjusted,
    basisOffset: basisAdjusted ? basisDiff : 0,
    timestamp: spotQuote?.timestamp || new Date().toISOString(),
  };
}

/**
 * Fetch live Macro data (DXY, US 10Y Yield, Gold/Silver Ratio) from Yahoo Finance.
 */
export async function fetchMacroSnapshot(goldSpot = null) {
  const now = Date.now();
  if (_macroCache.data && now - _macroCache.fetchedAt < MACRO_TTL_MS) {
    const cached = { ..._macroCache.data };
    if (goldSpot && cached.silver_price > 0) {
      cached.gold_silver_ratio = Number((goldSpot / cached.silver_price).toFixed(2));
    }
    return cached;
  }

  const fetchSymbol = async (sym) => {
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1h&range=2d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta || !Number.isFinite(meta.regularMarketPrice)) return null;
      const price = Number(meta.regularMarketPrice);
      const prev = Number(meta.chartPreviousClose || meta.previousClose || price);
      const change = price - prev;
      const changePct = prev > 0 ? (change / prev) * 100 : 0;
      return { price, prev, change, changePct };
    } catch {
      return null;
    }
  };

  const [dxy, us10y, silver] = await Promise.all([
    fetchSymbol('DX-Y.NYB'),
    fetchSymbol('^TNX'),
    fetchSymbol('SI=F'),
  ]);

  // Estimate 10Y real yield proxy from 10Y nominal minus ~2.35% market inflation breakeven when TIPS feed unavailable
  const us10yPrice = us10y ? Number(us10y.price.toFixed(2)) : null;
  const us10yChangeBps = us10y ? Math.round(us10y.change * 100) : null;
  const realYieldEst = us10yPrice != null ? Number((us10yPrice - 2.35).toFixed(2)) : null;

  const macro = {
    dxy: dxy ? Number(dxy.price.toFixed(2)) : null,
    dxy_change_pct: dxy ? Number(dxy.changePct.toFixed(2)) : null,
    us10y: us10yPrice,
    us10y_change_bps: us10yChangeBps,
    real_yield_est: realYieldEst,
    silver_price: silver ? Number(silver.price.toFixed(2)) : null,
    gold_silver_ratio: (goldSpot && silver?.price > 0) ? Number((goldSpot / silver.price).toFixed(2)) : null,
    updated_at: new Date().toISOString(),
  };

  _macroCache = { data: macro, fetchedAt: now };
  return macro;
}

/**
 * Primary cached multi-provider OHLCV fetcher for a single timeframe.
 */
export async function getOhlcvForTimeframe(rawTf = 'M15', { limit = 200, forceRefresh = false } = {}) {
  const tf = normalizeTimeframe(rawTf);
  const cacheKey = `XAUUSD_${tf}`;
  const now = Date.now();

  // 1. In-memory warm cache
  if (!forceRefresh) {
    const mem = _memCache.get(cacheKey);
    if (mem && now - mem.fetchedAt < CACHE_TTL_MS && mem.data.candles.length >= 20) {
      return {
        ...mem.data,
        candles: mem.data.candles.slice(-limit),
        cached: true,
        cache_layer: 'memory',
      };
    }

    // 2. Supabase ohlcv_cache
    const sb = getSupabaseConfig();
    if (sb.configured) {
      const sbRow = await getCachedOhlcv(cacheKey);
      if (sbRow && Array.isArray(sbRow.candles_json) && sbRow.candles_json.length >= 20) {
        const ageMs = now - new Date(sbRow.fetched_at).getTime();
        if (ageMs < CACHE_TTL_MS) {
          const payload = {
            spot: Number(sbRow.spot_price),
            timeframe: tf,
            candles: sbRow.candles_json,
            macro: sbRow.macro_json || {},
            provider: sbRow.provider || 'Supabase Cache',
            timestamp: sbRow.fetched_at,
          };
          _memCache.set(cacheKey, { data: payload, fetchedAt: now - ageMs });
          return {
            ...payload,
            candles: payload.candles.slice(-limit),
            cached: true,
            cache_layer: 'supabase',
          };
        }
      }
    }
  }

  // 3. Live upstream fetch: Twelve Data -> OANDA v20 -> Live Spot + Basis-Aligned OHLCV
  let liveResult = null;
  const errors = [];

  if (process.env.TWELVEDATA_API_KEY) {
    try {
      liveResult = await fetchTwelveDataCandles(tf, 200);
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (!liveResult && process.env.OANDA_API_KEY) {
    try {
      liveResult = await fetchOandaCandles(tf, 200);
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (!liveResult) {
    try {
      liveResult = await fetchSpotAlignedFallbackCandles(tf, 200);
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (!liveResult) {
    // Serve stale memory cache only if clearly marked stale? Spec requires explicit 502 on upstream failure.
    const err = new Error(errors.join(' | ') || 'All market data upstreams failed');
    err.statusCode = 502;
    throw err;
  }

  // Compute day change from daily candles if missing
  if (liveResult.change == null && liveResult.candles.length >= 2) {
    const first = liveResult.candles[0].open;
    const diff = liveResult.spot - first;
    liveResult.change = Number(diff.toFixed(2));
    liveResult.changePercent = first > 0 ? Number(((diff / first) * 100).toFixed(2)) : 0;
  }

  const macro = await fetchMacroSnapshot(liveResult.spot);

  const fullPayload = {
    spot: liveResult.spot,
    change: liveResult.change ?? null,
    changePercent: liveResult.changePercent ?? null,
    timeframe: tf,
    candles: liveResult.candles,
    macro,
    provider: liveResult.provider,
    basis_adjusted: Boolean(liveResult.basisAdjusted),
    timestamp: liveResult.timestamp || new Date().toISOString(),
  };

  _memCache.set(cacheKey, { data: fullPayload, fetchedAt: now });

  // Persist asynchronously to Supabase if configured
  const sb = getSupabaseConfig();
  if (sb.configured) {
    setCachedOhlcv({
      cacheKey,
      spotPrice: fullPayload.spot,
      provider: fullPayload.provider,
      candles: fullPayload.candles,
      macro: fullPayload.macro,
    }).catch(() => {});

    recordMarketStatus({
      provider: fullPayload.provider,
      price: fullPayload.spot,
      timestamp: fullPayload.timestamp,
      freshnessMs: 0,
    }).catch(() => {});
  }

  return {
    ...fullPayload,
    candles: fullPayload.candles.slice(-limit),
    cached: false,
    cache_layer: 'live',
  };
}

/**
 * Fetch M5, M15, H1, H4 OHLCV bundles in parallel (or via Twelve Data /batch when key exists).
 */
export async function fetchMultiTfOhlcv(timeframes = ['M5', 'M15', 'H1', 'H4']) {
  const results = {};
  const settled = await Promise.allSettled(
    timeframes.map(async (tf) => {
      const data = await getOhlcvForTimeframe(tf, { limit: 200 });
      return { tf, data };
    })
  );

  for (const item of settled) {
    if (item.status === 'fulfilled') {
      results[item.value.tf] = item.value.data;
    }
  }

  return results;
}
