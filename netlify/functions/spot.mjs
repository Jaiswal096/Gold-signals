/**
 * Netlify Function v2: GET /api/spot
 * Fetches & caches (30s in Supabase `ohlcv_cache` + memory) real XAU/USD OHLCV candles
 * and live macro indicators (DXY, US 10Y Yield, Gold/Silver ratio).
 */

import { getOhlcvForTimeframe, normalizeTimeframe } from './lib/market-data.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const tf = normalizeTimeframe(url.searchParams.get('tf') || url.searchParams.get('timeframe') || 'M15');
    const includeCandles = url.searchParams.get('include_candles') !== 'false';
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 50), 300);
    const forceRefresh = url.searchParams.get('refresh') === '1';

    const data = await getOhlcvForTimeframe(tf, { limit, forceRefresh });

    const body = {
      spot: data.spot,
      change: data.change,
      changePercent: data.changePercent,
      timeframe: data.timeframe,
      provider: data.provider,
      basis_adjusted: data.basis_adjusted,
      cached: data.cached,
      cache_layer: data.cache_layer,
      updated_at: data.timestamp,
      macro: data.macro,
      candle_count: data.candles.length,
    };

    if (includeCandles) {
      body.candles = data.candles;
    }

    return Response.json(body, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    return Response.json(
      {
        error: 'MARKET_FEED_ERROR',
        detail: err.message || 'Unable to fetch live XAU/USD OHLCV data',
      },
      { status: err.statusCode || 502, headers: CORS_HEADERS }
    );
  }
};
