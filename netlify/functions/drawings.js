/**
 * Netlify Serverless Function: drawings
 * Persists and retrieves user chart drawings and marked levels from Supabase.
 * Automatically identifies user via device IP address (privacy-preserving SHA-256 hash).
 * Retrieves all drawings and levels marked within the last 2 days (48 hours).
 */

import crypto from 'crypto';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-device-id',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nrdwfhllmahtakfvtruo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_KC0syGG3accWzFE_Htmn8A_zFXgFGPA';

function resolveDeviceKey(event) {
  // If explicit device key passed in query or header, allow it
  const explicit = event.queryStringParameters?.device_key || event.headers?.['x-device-id'];
  if (explicit && explicit !== 'default-device' && explicit.length > 5) {
    return explicit;
  }

  // Auto-detect client IP from Netlify or proxy headers
  const clientIp = (
    event.headers?.['x-nf-client-connection-ip'] ||
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers?.['client-ip'] ||
    event.headers?.['x-real-ip'] ||
    '127.0.0.1'
  );

  // Compute privacy-preserving deterministic device key from IP
  const hash = crypto.createHash('sha256').update(`xauusd_salt_${clientIp}`).digest('hex').slice(0, 24);
  return `ip_${hash}`;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const deviceKey = resolveDeviceKey(event);

  // ── GET: Fetch drawings for this device IP within the last 2 days (48 hours) ──
  if (event.httpMethod === 'GET') {
    try {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const url = `${SUPABASE_URL}/rest/v1/chart_drawings?device_key=eq.${encodeURIComponent(deviceKey)}&created_at=gte.${encodeURIComponent(twoDaysAgo)}&order=created_at.desc`;

      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'User-Agent': 'Supabase-Server/1.0',
        },
        signal: AbortSignal.timeout(4500),
      });

      if (!res.ok) {
        return {
          statusCode: res.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'SUPABASE_QUERY_FAILED', drawings: [] }),
        };
      }

      const drawings = await res.json();
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_key: deviceKey,
          auto_detected_by: 'device_ip',
          time_window: 'last_48_hours',
          count: Array.isArray(drawings) ? drawings.length : 0,
          drawings: Array.isArray(drawings) ? drawings : [],
        }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message, drawings: [] }),
      };
    }
  }

  // ── POST: Save a new marked level or drawing ──
  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body || '{}');

      const price = Number(payload.price_from || payload.price);
      if (!price || isNaN(price)) {
        return {
          statusCode: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'PRICE_REQUIRED', message: 'Valid price_from or price is required.' }),
        };
      }

      const record = {
        device_key: payload.device_key || deviceKey,
        symbol: payload.symbol || 'XAUUSD',
        timeframe: payload.timeframe || 'H1',
        drawing_type: payload.drawing_type || payload.type || 'level',
        price_from: price,
        price_to: payload.price_to ? Number(payload.price_to) : null,
        label: payload.label || `Level $${price.toFixed(2)}`,
        color: payload.color || '#f5c242',
        schema_version: 1,
        created_at: new Date().toISOString(),
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/chart_drawings`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'User-Agent': 'Supabase-Server/1.0',
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
        signal: AbortSignal.timeout(4500),
      });

      if (!res.ok) {
        const errDetails = await res.text();
        return {
          statusCode: res.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'SUPABASE_INSERT_FAILED', details: errDetails }),
        };
      }

      const inserted = await res.json();
      return {
        statusCode: 201,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          device_key: deviceKey,
          drawing: inserted[0] || record,
        }),
      };
    } catch (err) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  // ── DELETE: Remove a drawing by ID ──
  if (event.httpMethod === 'DELETE') {
    try {
      const id = event.queryStringParameters?.id;
      if (!id) {
        return {
          statusCode: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'ID_REQUIRED' }),
        };
      }

      const url = `${SUPABASE_URL}/rest/v1/chart_drawings?id=eq.${encodeURIComponent(id)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'User-Agent': 'Supabase-Server/1.0',
        },
        signal: AbortSignal.timeout(4500),
      });

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: res.ok, deleted_id: id }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
};
