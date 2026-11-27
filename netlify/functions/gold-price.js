/**
 * Compatibility alias: /.netlify/functions/gold-price
 * Uses the unified market-data adapter (Twelve Data / OANDA / Swissquote / Gold-API).
 */

import { getOhlcvForTimeframe } from './lib/market-data.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    const data = await getOhlcvForTimeframe('M15', { limit: 60 });
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price: data.spot,
        timestamp: data.timestamp,
        source: data.provider,
        freshness_ms: 0,
        change: data.change,
        changePercent: data.changePercent,
        cached: data.cached,
      }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'MARKET_FEED_ERROR', message: err.message }),
    };
  }
};
