/**
 * Netlify Function v2: GET /api/signals/history
 * Returns closed trade history and dynamically computed KPIs.
 * Supports source=AUTO (uses BOT_PROVIDER if configured, else built-in SMC_ENGINE
 * settled trades), source=SMC_ENGINE, or source=BOT_PROVIDER.
 */

import { loadBotHistory } from './lib/bot-sync.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const ALLOWED_SOURCES = new Set(['AUTO', 'BOT_PROVIDER', 'SMC_ENGINE']);

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const requested = (url.searchParams.get('source') || 'AUTO').toUpperCase();

  if (!ALLOWED_SOURCES.has(requested)) {
    return Response.json(
      { error: 'UNSUPPORTED_SOURCE', detail: 'Use source=AUTO, SMC_ENGINE, or BOT_PROVIDER.' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const result = await loadBotHistory(requested);
  if (!result.ok) {
    return Response.json(
      {
        source: result.active_source || requested,
        active_source: result.active_source || requested,
        error: result.error || 'HISTORY_FETCH_FAILED',
        configured: result.configured,
        supabase_configured: result.supabase_configured,
        bot_configured: result.bot_configured,
        open_live_count: result.open_live_count || 0,
        metrics: result.metrics,
        history: [],
      },
      { status: result.status || 502, headers: CORS_HEADERS }
    );
  }

  return Response.json(
    {
      source: result.active_source,
      active_source: result.active_source,
      configured: result.configured,
      supabase_configured: result.supabase_configured,
      bot_configured: result.bot_configured,
      open_live_count: result.open_live_count || 0,
      message: result.message,
      updated_at: new Date().toISOString(),
      metrics: result.metrics,
      history: result.history,
    },
    { status: 200, headers: CORS_HEADERS }
  );
};
