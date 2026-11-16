/**
 * Netlify Serverless Function: gold-history
 * Fetches historical OHLCV data for XAU/USD (Spot Gold).
 * Uses real market data feeds (Yahoo Finance GC=F / Swissquote XAUUSD).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const params = event.queryStringParameters || {};
  const tf = (params.timeframe || 'H1').toUpperCase();
  const limit = Math.min(Math.max(parseInt(params.limit || '100', 10) || 100, 10), 300);

  // Map requested timeframe to Yahoo Finance interval & range
  const config = {
    M5:  { interval: '5m',  range: '2d' },
    M15: { interval: '15m', range: '5d' },
    H1:  { interval: '60m', range: '1mo' },
    H4:  { interval: '60m', range: '3mo' },
    D1:  { interval: '1d',  range: '1y' },
  }[tf] || { interval: '60m', range: '1mo' };

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=${config.interval}&range=${config.range}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Upstream returned ${res.status}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const quotes = result?.indicators?.quote?.[0] || {};
    const opens = quotes.open || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const closes = quotes.close || [];

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i];
      const h = highs[i];
      const l = lows[i];
      const c = closes[i];
      const t = timestamps[i];

      if (o != null && h != null && l != null && c != null && !isNaN(c)) {
        candles.push({
          time: t,
          open: Number(o.toFixed(2)),
          high: Number(h.toFixed(2)),
          low: Number(l.toFixed(2)),
          close: Number(c.toFixed(2)),
        });
      }
    }

    const trimmed = candles.slice(-limit);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'XAU/USD',
        timeframe: tf,
        count: trimmed.length,
        candles: trimmed,
      }),
    };
  } catch (err) {
    // If upstream fetch fails, return empty list with structured warning
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'XAU/USD',
        timeframe: tf,
        count: 0,
        candles: [],
        warning: 'Historical upstream temporarily unavailable; chart updates live on ticks.',
      }),
    };
  }
};
