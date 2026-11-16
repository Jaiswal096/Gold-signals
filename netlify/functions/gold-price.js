/**
 * Netlify Serverless Function: gold-price
 * Fetches live XAU/USD spot gold price.
 * Primary: GoldAPI.io (using GOLDAPI_KEY server-side)
 * Fallback: High-reliability public spot gold feeds (GoldPrice.org, Gold-API, Yahoo GC=F)
 * Never exposes API secrets to the browser.
 */

let _cache = {
  data: null,
  fetchedAt: 0,
};
const CACHE_TTL_MS = 15_000; // 15 seconds cache for fast responsive feeds

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const now = Date.now();

  // Serve from cache if fresh
  if (_cache.data && now - _cache.fetchedAt < CACHE_TTL_MS) {
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ..._cache.data,
        freshness_ms: now - _cache.fetchedAt,
        cached: true,
      }),
    };
  }

  let result = null;

  // 1. Primary: GoldAPI.io if key is configured
  const GOLDAPI_KEY = process.env.GOLDAPI_KEY;
  if (GOLDAPI_KEY) {
    try {
      const response = await fetch('https://www.goldapi.io/api/XAU/USD', {
        headers: {
          Authorization: `Bearer ${GOLDAPI_KEY}`,
          'x-user-agent': 'goldapi-js-client',
        },
        signal: AbortSignal.timeout(4500),
      });

      if (response.ok) {
        const raw = await response.json();
        const price = raw.price ?? raw.ask;
        if (price && !isNaN(price)) {
          result = {
            price: Number(parseFloat(price).toFixed(2)),
            timestamp: raw.timestamp ? new Date(raw.timestamp * 1000).toISOString() : new Date().toISOString(),
            source: 'GoldAPI.io/XAU/USD',
            freshness_ms: 0,
            change: raw.ch ?? null,
            changePercent: raw.chp ?? null,
            open: raw.open_price ?? null,
            high: raw.high_price ?? null,
            low: raw.low_price ?? null,
          };
        }
      }
    } catch (e) {
      // Proceed to fallbacks
    }
  }

  // 2. Fallback: GoldPrice.org (Real-time live spot gold)
  if (!result) {
    try {
      const response = await fetch('https://data-asg.goldprice.org/dbXRates/USD', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(3500),
      });

      if (response.ok) {
        const raw = await response.json();
        const item = raw?.items?.[0];
        if (item && item.xauPrice) {
          result = {
            price: Number(item.xauPrice.toFixed(2)),
            timestamp: raw.date ? new Date(raw.date).toISOString() : new Date().toISOString(),
            source: 'GoldPrice.org (Live Spot)',
            freshness_ms: 0,
            change: typeof item.chg === 'number' ? Number(item.chg.toFixed(2)) : null,
            changePercent: typeof item.pcChg === 'number' ? Number(item.pcChg.toFixed(2)) : null,
            open: null,
            high: null,
            low: null,
          };
        }
      }
    } catch (e) {
      // Proceed to next fallback
    }
  }

  // 3. Fallback: Gold-API.com
  if (!result) {
    try {
      const response = await fetch('https://api.gold-api.com/price/XAU', {
        signal: AbortSignal.timeout(3500),
      });

      if (response.ok) {
        const raw = await response.json();
        if (raw && raw.price) {
          result = {
            price: Number(parseFloat(raw.price).toFixed(2)),
            timestamp: raw.updatedAt || new Date().toISOString(),
            source: 'Gold-API.com (Spot)',
            freshness_ms: 0,
            change: null,
            changePercent: null,
            open: null,
            high: null,
            low: null,
          };
        }
      }
    } catch (e) {
      // Proceed to next fallback
    }
  }

  // 4. Fallback: Yahoo Finance GC=F (Gold Futures Spot-Equivalent)
  if (!result) {
    try {
      const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(3500),
      });

      if (response.ok) {
        const raw = await response.json();
        const meta = raw?.chart?.result?.[0]?.meta;
        if (meta && meta.regularMarketPrice) {
          result = {
            price: Number(meta.regularMarketPrice.toFixed(2)),
            timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
            source: 'Yahoo Finance/GC=F (Gold)',
            freshness_ms: 0,
            change: meta.previousClose ? Number((meta.regularMarketPrice - meta.previousClose).toFixed(2)) : null,
            changePercent: meta.previousClose ? Number((((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2)) : null,
            open: meta.chartPreviousClose || null,
            high: meta.regularMarketDayHigh || null,
            low: meta.regularMarketDayLow || null,
          };
        }
      }
    } catch (e) {
      // Fallback failed
    }
  }

  // If successfully fetched, cache and record to Supabase
  if (result) {
    _cache = { data: result, fetchedAt: now };

    // Auto-sync tick to Supabase market_status table
    try {
      const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nrdwfhllmahtakfvtruo.supabase.co';
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_KC0syGG3accWzFE_Htmn8A_zFXgFGPA';

      fetch(`${SUPABASE_URL}/rest/v1/market_status`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'User-Agent': 'Supabase-Server/1.0',
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          symbol: 'XAUUSD',
          provider: result.source,
          last_tick_price: result.price,
          last_tick_time: result.timestamp,
          connection_state: 'LIVE',
        }),
      }).catch(() => {});
    } catch (e) {
      // Ignore background sync errors
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  }

  // If all live fetches failed but we have stale cache, serve stale cache
  if (_cache.data) {
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ..._cache.data,
        freshness_ms: now - _cache.fetchedAt,
        stale: true,
      }),
    };
  }

  // Complete offline / no network available
  return {
    statusCode: 503,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'DATA_PROVIDER_TEMPORARILY_UNAVAILABLE',
      message: 'All live spot gold providers were unreachable. Retrying automatically.',
    }),
  };
};
