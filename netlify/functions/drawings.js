/**
 * Netlify Serverless Function: drawings
 * Persists and retrieves user chart drawings from Supabase (`chart_drawings`, 48h window)
 * keyed by salted SHA-256 hash of the client IP.
 */

import crypto from 'crypto';
import { getSupabaseConfig, sbFetch } from './lib/supabase.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-device-id',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

function resolveDeviceKey(event) {
  const explicit = event.queryStringParameters?.device_key || event.headers?.['x-device-id'];
  if (explicit && explicit !== 'default-device' && explicit.length > 5) {
    return explicit;
  }
  const clientIp =
    event.headers?.['x-nf-client-connection-ip'] ||
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers?.['client-ip'] ||
    event.headers?.['x-real-ip'] ||
    '127.0.0.1';
  const hash = crypto.createHash('sha256').update(`xauusd_salt_${clientIp}`).digest('hex').slice(0, 24);
  return `ip_${hash}`;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const deviceKey = resolveDeviceKey(event);
  const sbCfg = getSupabaseConfig();

  if (!sbCfg.configured) {
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        configured: false,
        device_key: deviceKey,
        count: 0,
        drawings: [],
        message: 'Supabase not configured; drawings persist locally.',
      }),
    };
  }

  if (event.httpMethod === 'GET') {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const res = await sbFetch(
      `chart_drawings?device_key=eq.${encodeURIComponent(deviceKey)}&created_at=gte.${encodeURIComponent(twoDaysAgo)}&order=created_at.desc`
    );

    if (!res.ok) {
      return {
        statusCode: res.status || 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: res.error, drawings: [] }),
      };
    }

    const drawings = Array.isArray(res.data) ? res.data : [];
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        configured: true,
        device_key: deviceKey,
        auto_detected_by: 'device_ip',
        time_window: 'last_48_hours',
        count: drawings.length,
        drawings,
      }),
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body || '{}');
      const price = Number(payload.price_from || payload.price);
      if (!Number.isFinite(price) || price <= 0) {
        return {
          statusCode: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'PRICE_REQUIRED' }),
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
        schema_version: 2,
      };

      const res = await sbFetch('chart_drawings', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: record,
      });

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
        body: JSON.stringify({
          success: true,
          device_key: deviceKey,
          drawing: (Array.isArray(res.data) && res.data[0]) || record,
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

  if (event.httpMethod === 'DELETE') {
    const id = event.queryStringParameters?.id;
    if (!id) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'ID_REQUIRED' }),
      };
    }

    const res = await sbFetch(`chart_drawings?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return {
      statusCode: res.ok ? 200 : (res.status || 502),
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: res.ok, deleted_id: id, error: res.error }),
    };
  }

  return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
};
