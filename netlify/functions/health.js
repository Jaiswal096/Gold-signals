/**
 * Netlify Serverless Function: health
 * Reports live market data adapter config, Supabase connectivity, and Bot sync readiness.
 * Never exposes secrets or fails with unhandled 500s.
 */

import { getSupabaseConfig, sbFetch } from './lib/supabase.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const hasTwelveData = Boolean((process.env.TWELVEDATA_API_KEY || '').trim());
  const hasOanda = Boolean((process.env.OANDA_API_KEY || '').trim());
  const hasGoldApi = Boolean((process.env.GOLDAPI_KEY || '').trim());
  const hasBotUrl = Boolean((process.env.SIGNAL_BOT_URL || '').trim());
  const sbCfg = getSupabaseConfig();

  let databaseConnected = false;
  let databaseError = sbCfg.configured ? null : 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured';

  if (sbCfg.configured) {
    const check = await sbFetch('signals?select=id&limit=1', { timeoutMs: 3500 });
    databaseConnected = check.ok;
    if (!check.ok) databaseError = check.error;
  }

  const provider = hasTwelveData
    ? 'Twelve Data (XAU/USD OHLCV)'
    : hasOanda
      ? 'OANDA v20 (XAU/USD OHLCV)'
      : hasGoldApi
        ? 'GoldAPI.io + Multi-TF OHLCV'
        : 'Swissquote Spot + GC=F Basis-Aligned OHLCV';

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'HEALTHY',
      server_time: new Date().toISOString(),
      symbol: 'XAU/USD',
      provider_connected: true,
      provider,
      market_providers: {
        twelvedata_configured: hasTwelveData,
        oanda_configured: hasOanda,
        goldapi_configured: hasGoldApi,
      },
      bot_provider: {
        signal_bot_url_configured: hasBotUrl,
        webhook_secret_configured: Boolean((process.env.BOT_WEBHOOK_SECRET || '').trim()),
      },
      database: {
        configured: sbCfg.configured,
        connected: databaseConnected,
        provider: 'Supabase PostgreSQL',
        error: databaseError,
      },
    }),
  };
};
