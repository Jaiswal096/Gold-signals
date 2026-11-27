/**
 * Legacy compatibility function: /.netlify/functions/signals
 * Delegates to unified Supabase `signals` table (or returns structured empty list when unconfigured).
 */

import { getSupabaseConfig, querySignals, upsertSignals } from './lib/supabase.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-device-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const sb = getSupabaseConfig();
  if (!sb.configured) {
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    };
  }

  if (event.httpMethod === 'GET') {
    const res = await querySignals('order=opened_at.desc&limit=30');
    if (!res.ok) {
      return {
        statusCode: res.status || 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: res.error }),
      };
    }
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(res.data || []),
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body || '{}');
      const res = await upsertSignals([payload]);
      if (!res.ok) {
        return {
          statusCode: res.status || 502,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: res.error, details: res.data }),
        };
      }
      return {
        statusCode: 201,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(res.data || []),
      };
    } catch (err) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
};
