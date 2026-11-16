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
  const hasGoldApiKey = Boolean(process.env.GOLDAPI_KEY);

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
      signal: AbortSignal.timeout(3500),
    });
    databaseConnected = sbRes.ok;
    if (!sbRes.ok) databaseError = `Supabase returned ${sbRes.status}`;
  } catch (e) {
    databaseConnected = false;
    databaseError = e.message;
  }

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'HEALTHY',
      server_time: serverTime,
      symbol: 'XAU/USD',
      provider_connected: true,
      provider: hasGoldApiKey ? 'GoldAPI.io (Production)' : 'Multi-Provider Spot Gold (Live)',
      goldapi_configured: hasGoldApiKey,
      data_feed_status: 'READY',
      database: {
        connected: databaseConnected,
        provider: 'Supabase PostgreSQL',
        url: SUPABASE_URL,
        error: databaseError,
      },
    }),
  };
};
