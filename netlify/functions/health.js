/**
 * Netlify Serverless Function: health
 * Returns the health/status of the XAU/USD data feed and Supabase database.
 * Does NOT expose API secrets.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nrdwfhllmahtakfvtruo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_KC0syGG3accWzFE_Htmn8A_zFXgFGPA';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const serverTime = new Date().toISOString();
  const configured = Boolean(process.env.GOLDAPI_KEY);

  // Check Supabase connectivity
  let databaseConnected = false;
  let databaseError = null;
  try {
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/market_status?limit=1`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'User-Agent': 'Supabase-Server/1.0',
      },
    });
    databaseConnected = sbRes.ok;
    if (!sbRes.ok) databaseError = `Supabase returned ${sbRes.status}`;
  } catch (e) {
    databaseConnected = false;
    databaseError = e.message;
  }

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
        database: {
          connected: databaseConnected,
          provider: 'Supabase',
          url: SUPABASE_URL,
          error: databaseError,
        },
      }),
    };
  }

  // Attempt a live fetch to verify GoldAPI connectivity
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
        feedStatus = ageMs < 120_000 ? 'LIVE' : 'STALE';
      } else {
        feedStatus = 'LIVE';
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
      database: {
        connected: databaseConnected,
        provider: 'Supabase',
        url: SUPABASE_URL,
        error: databaseError,
      },
    }),
  };
};
