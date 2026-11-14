/**
 * Netlify Serverless Function: gold-price
 * Fetches live XAU/USD spot gold price from GoldAPI.io
 * API key is kept server-side and never exposed to the browser.
 */

// In-process cache to avoid hammering the free-tier rate limit (100 req/hour)
let _cache = {
  data: null,
  fetchedAt: 0,
};
const CACHE_TTL_MS = 55_000; // 55 seconds

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const GOLDAPI_KEY = process.env.GOLDAPI_KEY;

  if (!GOLDAPI_KEY) {
    return {
      statusCode: 503,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'DATA_PROVIDER_NOT_CONFIGURED',
        message: 'GOLDAPI_KEY environment variable not set',
        required_vars: ['GOLDAPI_KEY'],
      }),
    };
  }

  const now = Date.now();

  // Serve from cache if still fresh
  if (_cache.data && now - _cache.fetchedAt < CACHE_TTL_MS) {
    const cached = {
      ..._cache.data,
      freshness_ms: now - _cache.fetchedAt,
      cached: true,
    };
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(cached),
    };
  }

  try {
    const response = await fetch('https://www.goldapi.io/api/XAU/USD', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${GOLDAPI_KEY}`,
        'x-user-agent': 'goldapi-js-client',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      // If we have stale cache, return it with a warning rather than hard-failing
      if (_cache.data) {
        const stale = {
          ..._cache.data,
          freshness_ms: now - _cache.fetchedAt,
          stale: true,
          upstream_error: `GoldAPI.io returned HTTP ${response.status}`,
        };
        return {
          statusCode: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify(stale),
        };
      }

      return {
        statusCode: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'UPSTREAM_ERROR',
          message: `GoldAPI.io returned HTTP ${response.status}`,
          details: errorText,
        }),
      };
    }

    const raw = await response.json();

    // GoldAPI.io response shape:
    // { price, prev_close_price, open_time, timestamp, ch (change), chp (change%), ask, bid, ... }
    const result = {
      price: raw.price ?? raw.ask ?? null,
      timestamp: raw.timestamp ? new Date(raw.timestamp * 1000).toISOString() : new Date().toISOString(),
      source: 'GoldAPI.io/XAU/USD',
      freshness_ms: 0,
      change: raw.ch ?? null,
      changePercent: raw.chp ?? null,
      open: raw.open_price ?? null,
      high: raw.high_price ?? null,
      low: raw.low_price ?? null,
    };

    // Update cache
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
          provider: 'GoldAPI.io',
          last_tick_price: result.price,
          last_tick_time: result.timestamp,
          connection_state: 'LIVE',
        }),
      }).catch(() => {});
    } catch (e) { /* ignore background sync errors */ }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    // Network / parse error — return stale cache if available
    if (_cache.data) {
      const stale = {
        ..._cache.data,
        freshness_ms: now - _cache.fetchedAt,
        stale: true,
        upstream_error: err.message,
      };
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(stale),
      };
    }

    return {
      statusCode: 503,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'FETCH_FAILED',
        message: 'Failed to fetch XAU/USD price from GoldAPI.io',
        details: err.message,
      }),
    };
  }
};
