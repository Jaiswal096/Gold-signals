/**
 * Netlify Serverless Function: drawings
 * Persists and retrieves chart drawings from Supabase
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-device-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nrdwfhllmahtakfvtruo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_KC0syGG3accWzFE_Htmn8A_zFXgFGPA';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const deviceKey = event.queryStringParameters?.device_key || event.headers['x-device-id'] || 'default-device';

  // GET /drawings?device_key=...
  if (event.httpMethod === 'GET') {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/chart_drawings?device_key=eq.${encodeURIComponent(deviceKey)}&order=created_at.asc`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'User-Agent': 'Supabase-Server/1.0',
        },
      });

      if (!res.ok) {
        return {
          statusCode: res.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'SUPABASE_QUERY_FAILED' }),
        };
      }

      const drawings = await res.json();
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(drawings),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  // POST /drawings — Upsert drawing
  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.device_key) payload.device_key = deviceKey;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/chart_drawings`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'User-Agent': 'Supabase-Server/1.0',
          'Content-Type': 'application/json',
          Prefer: 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errDetails = await res.text();
        return {
          statusCode: res.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'SUPABASE_UPSERT_FAILED', details: errDetails }),
        };
      }

      const saved = await res.json();
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(saved),
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
