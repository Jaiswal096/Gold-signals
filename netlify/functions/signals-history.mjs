/**
 * Netlify Function v2: GET /api/signals/history?source=BOT_PROVIDER
 * Strictly serves historical signals from the external signal provider bot
 * and dynamically computes Win Rate, Avg R:R, Total Pips, Max Drawdown, and Sharpe.
 * Zero hardcoded demo arrays or fake statistics.
 */

import { loadBotHistory } from './lib/bot-sync.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const source = (url.searchParams.get('source') || 'BOT_PROVIDER').toUpperCase();

  if (source !== 'BOT_PROVIDER') {
    return Response.json(
      { error: 'UNSUPPORTED_SOURCE', detail: 'History endpoint serves BOT_PROVIDER historical records.' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const result = await loadBotHistory();
  if (!result.ok) {
    return Response.json(
      {
        source: 'BOT_PROVIDER',
        error: result.error || 'HISTORY_FETCH_FAILED',
        configured: result.configured,
        supabase_configured: result.supabase_configured,
        bot_configured: result.bot_configured,
        metrics: result.metrics,
        history: [],
      },
      { status: result.status || 502, headers: CORS_HEADERS }
    );
  }

  return Response.json(
    {
      source: 'BOT_PROVIDER',
      configured: result.configured,
      supabase_configured: result.supabase_configured,
      bot_configured: result.bot_configured,
      message: result.message,
      updated_at: new Date().toISOString(),
      metrics: result.metrics,
      history: result.history,
    },
    { status: 200, headers: CORS_HEADERS }
  );
};
