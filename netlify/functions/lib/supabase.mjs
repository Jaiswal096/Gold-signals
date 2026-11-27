/**
 * Shared Supabase PostgREST helper for Netlify Functions.
 * Strictly reads credentials from server environment variables — zero hardcoded secrets.
 */

export function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || /^https?:\/\/.+/i.test(url);
  const configured = Boolean(validUrl && key && !key.includes('your_supabase'));
  return { configured, url, key };
}

export async function sbFetch(path, { method = 'GET', body = null, headers = {}, timeoutMs = 4500 } = {}) {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) {
    return { ok: false, status: 0, configured: false, error: 'SUPABASE_NOT_CONFIGURED', data: null };
  }

  try {
    const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ManusMax-Serverless/6.0',
        ...headers,
      },
      body: body !== null ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        configured: true,
        error: typeof parsed === 'object' && parsed?.message ? parsed.message : `HTTP ${res.status}`,
        data: parsed,
      };
    }

    return { ok: true, status: res.status, configured: true, error: null, data: parsed };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      configured: true,
      error: err.message || 'SUPABASE_NETWORK_ERROR',
      data: null,
    };
  }
}

export async function getCachedOhlcv(cacheKey) {
  const res = await sbFetch(`ohlcv_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=*&limit=1`);
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null;
  return res.data[0];
}

export async function setCachedOhlcv({ cacheKey, spotPrice, provider, candles, macro = {} }) {
  return sbFetch('ohlcv_cache?on_conflict=cache_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: {
      cache_key: cacheKey,
      spot_price: Number(spotPrice.toFixed(2)),
      provider: provider || 'Unknown',
      candles_json: candles,
      macro_json: macro,
      fetched_at: new Date().toISOString(),
    },
  });
}

export async function upsertSignals(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: true, data: [] };
  }
  return sbFetch('signals?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: rows,
  });
}

export async function querySignals(queryString) {
  return sbFetch(`signals?${queryString}`);
}

export async function recordMarketStatus({ provider, price, timestamp, freshnessMs = 0 }) {
  return sbFetch('market_status', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: {
      symbol: 'XAUUSD',
      provider,
      last_tick_price: Number(price.toFixed(2)),
      last_tick_time: timestamp || new Date().toISOString(),
      freshness_ms: freshnessMs,
      connection_state: 'LIVE',
    },
  });
}
