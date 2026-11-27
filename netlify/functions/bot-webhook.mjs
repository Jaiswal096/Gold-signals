/**
 * Netlify Function v2: POST /api/bot-webhook
 * Allows an external signal provider bot to push closed or executed historical
 * signals directly into Supabase (`source = 'BOT_PROVIDER'`).
 */

import { normalizeBotRecord } from './lib/bot-sync.mjs';
import { getSupabaseConfig, upsertSignals } from './lib/supabase.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bot-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: CORS_HEADERS });
  }

  const secret = (process.env.BOT_WEBHOOK_SECRET || '').trim();
  if (secret) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const headerSecret = (req.headers.get('x-bot-secret') || '').trim();
    if (token !== secret && headerSecret !== secret) {
      return Response.json({ error: 'UNAUTHORIZED_BOT_WEBHOOK' }, { status: 401, headers: CORS_HEADERS });
    }
  }

  const sb = getSupabaseConfig();
  if (!sb.configured) {
    return Response.json(
      { error: 'SUPABASE_NOT_CONFIGURED', detail: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify.' },
      { status: 503, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await req.json();
    const rawList = Array.isArray(body) ? body : (body.signals || body.trades || [body]);
    const normalized = rawList.map((item, idx) => normalizeBotRecord(item, idx)).filter(Boolean);

    if (normalized.length === 0) {
      return Response.json({ error: 'NO_VALID_BOT_SIGNALS' }, { status: 400, headers: CORS_HEADERS });
    }

    const res = await upsertSignals(normalized);
    if (!res.ok) {
      return Response.json(
        { error: 'SUPABASE_UPSERT_FAILED', detail: res.error },
        { status: res.status || 502, headers: CORS_HEADERS }
      );
    }

    return Response.json(
      { ok: true, ingested: normalized.length, signals: res.data || normalized },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    return Response.json({ error: 'INVALID_JSON', detail: err.message }, { status: 400, headers: CORS_HEADERS });
  }
};
