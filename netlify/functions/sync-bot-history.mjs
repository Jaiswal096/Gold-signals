/**
 * Netlify Function v2: sync-bot-history
 * Scheduled every 15 minutes AND manually invocable to ingest historical signals
 * from process.env.SIGNAL_BOT_URL into Supabase (`source = 'BOT_PROVIDER'`).
 */

import { syncBotHistoryToSupabase } from './lib/bot-sync.mjs';

export const config = {
  schedule: '*/15 * * * *',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  const res = await syncBotHistoryToSupabase();
  if (res.configured && res.error) {
    return Response.json(
      { error: res.error, synced: 0, configured: true },
      { status: res.status || 502 }
    );
  }

  return Response.json(
    {
      ok: true,
      configured: res.configured,
      synced: res.synced,
      persisted: Boolean(res.persisted),
      message: res.configured ? `Synced ${res.synced} bot signals.` : 'SIGNAL_BOT_URL not configured.',
    },
    { status: 200 }
  );
};
