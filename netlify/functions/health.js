/**
 * Netlify Serverless Function: health
 * Returns the health/status of the XAU/USD data feed.
 * Does NOT expose the GOLDAPI_KEY value.
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

  const serverTime = new Date().toISOString();
  const configured = Boolean(process.env.GOLDAPI_KEY);

  if (!configured) {
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_connected: false,
        last_tick_time: null,
        server_time: serverTime,
        provider: 'GoldAPI.io',
        symbol: 'XAU/USD',
        data_feed_status: 'NOT_CONFIGURED',
        configured: false,
      }),
    };
  }

  // Attempt a live fetch to verify connectivity
  let providerConnected = false;
  let lastTickTime = null;
  let feedStatus = 'UNAVAILABLE';

  try {
    const response = await fetch('https://www.goldapi.io/api/XAU/USD', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.GOLDAPI_KEY}`,
        'x-user-agent': 'goldapi-js-client',
      },
    });

    if (response.ok) {
      const data = await response.json();
      providerConnected = true;

      if (data.timestamp) {
        lastTickTime = new Date(data.timestamp * 1000).toISOString();
        const ageMs = Date.now() - data.timestamp * 1000;

        if (ageMs < 60_000) {
          feedStatus = 'LIVE';
        } else if (ageMs < 300_000) {
          feedStatus = 'STALE';
        } else {
          feedStatus = 'STALE';
        }
      } else {
        feedStatus = 'LIVE'; // Response OK, timestamp missing but price available
      }
    } else {
      feedStatus = 'UNAVAILABLE';
    }
  } catch (err) {
    feedStatus = 'UNAVAILABLE';
    providerConnected = false;
  }

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider_connected: providerConnected,
      last_tick_time: lastTickTime,
      server_time: serverTime,
      provider: 'GoldAPI.io',
      symbol: 'XAU/USD',
      data_feed_status: feedStatus,
      configured: true,
    }),
  };
};
