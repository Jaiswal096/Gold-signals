/**
 * Compatibility alias: /.netlify/functions/gold-history
 * Uses unified market-data adapter with real H4 aggregation & spot alignment.
 */

import { getOhlcvForTimeframe, normalizeTimeframe } from './lib/market-data.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const params = event.queryStringParameters || {};
  const tf = normalizeTimeframe(params.timeframe || params.tf || 'H1');
  const limit = Math.min(Math.max(parseInt(params.limit || '200', 10) || 200, 20), 300);

  try {
    const data = await getOhlcvForTimeframe(tf, { limit });
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'XAU/USD',
        timeframe: tf,
        provider: data.provider,
        count: data.candles.length,
        candles: data.candles,
      }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'XAU/USD',
        timeframe: tf,
        error: 'MARKET_FEED_ERROR',
        message: err.message,
        candles: [],
      }),
    };
  }
};
