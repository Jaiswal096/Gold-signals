/**
 * Netlify Serverless Function: gold-history
 * Fetches historical OHLCV data for XAU/USD.
 * Supports D1 timeframe via frankfurter.app (ECB historical gold rates).
 * Intraday (M5, M15, H1, H4) requires paid data providers.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const params = event.queryStringParameters || {};
  const timeframe = (params.timeframe || 'D1').toUpperCase();
  const limit = Math.min(Math.max(parseInt(params.limit || '100', 10) || 100, 1), 500);

  // Intraday check: Free tier does not support intraday historical series
  if (['M5', 'M15', 'H1', 'H4'].includes(timeframe)) {
    return {
      statusCode: 503,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'INTRADAY_NOT_AVAILABLE',
        message: 'Intraday historical data requires a paid GoldAPI.io plan',
        timeframe,
      }),
    };
  }

  if (timeframe !== 'D1') {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'INVALID_TIMEFRAME',
        message: `Unsupported timeframe '${timeframe}'. Supported timeframes: M5, M15, H1, H4, D1`,
      }),
    };
  }

  try {
    // Calculate start date based on limit (allow buffer for weekends/holidays: ~1.6x days)
    const daysAgo = Math.ceil(limit * 1.6) + 10;
    const startDateObj = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const startDateStr = startDateObj.toISOString().split('T')[0];

    const url = `https://api.frankfurter.app/${startDateStr}..?from=XAU&to=USD`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'UPSTREAM_ERROR',
          message: `Frankfurter API responded with status ${res.status}`,
        }),
      };
    }

    const data = await res.json();
    const rates = data.rates || {};

    const dates = Object.keys(rates).sort();
    const candles = [];
    let prevClose = null;

    for (const date of dates) {
      const price = rates[date]?.USD;
      if (price == null) continue;

      const timeUtc = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
      const open = prevClose !== null ? prevClose : price;
      const close = price;
      const high = Math.max(open, close);
      const low = Math.min(open, close);

      candles.push({
        time: timeUtc,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
      });

      prevClose = close;
    }

    // Limit to requested count (taking the most recent ones)
    const resultCandles = candles.slice(-limit);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(resultCandles),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'FETCH_ERROR',
        message: 'Failed to fetch historical gold data',
        details: err.message,
      }),
    };
  }
};
