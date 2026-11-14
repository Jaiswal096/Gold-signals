/**
 * Netlify Serverless Function: signals
 * Reads and writes signals to Supabase with server-side authorization
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

  // GET /signals — Fetch recent signals from Supabase
  if (event.httpMethod === 'GET') {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/signals?order=generated_at.desc&limit=30`, {
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
          body: JSON.stringify({ error: 'SUPABASE_QUERY_FAILED', status: res.status }),
        };
      }

      const signals = await res.json();
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(signals),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  // POST /signals — Insert a signal
  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body || '{}');

      const res = await fetch(`${SUPABASE_URL}/rest/v1/signals`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'User-Agent': 'Supabase-Server/1.0',
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          statusCode: res.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'SUPABASE_INSERT_FAILED', details: errorText }),
        };
      }

      const inserted = await res.json();
      return {
        statusCode: 201,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(inserted),
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
