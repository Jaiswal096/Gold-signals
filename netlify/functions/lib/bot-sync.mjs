/**
 * Signal Provider Bot normalization, upstream fetch, and dynamic KPI aggregation.
 * Strictly handles BOT_PROVIDER historical records — zero fabricated/demo rows.
 */

import { querySignals, upsertSignals, getSupabaseConfig } from './supabase.mjs';

const VALID_DIRECTIONS = new Set(['LONG', 'SHORT']);
const VALID_TF = new Set(['M5', 'M15', 'H1', 'H4', 'D1']);
const VALID_STATUSES = new Set([
  'FUTURE_SETUP',
  'LIVE',
  'HIT_TP1',
  'HIT_TP2',
  'HIT_TP3',
  'HIT_SL',
  'CLOSED',
  'EXPIRED',
]);

/**
 * Map arbitrary bot status labels into canonical database enum values.
 */
function normalizeBotStatus(rawStatus, pipsResult) {
  const s = String(rawStatus || '').trim().toUpperCase();
  if (VALID_STATUSES.has(s)) return s;
  if (s.includes('TP3')) return 'HIT_TP3';
  if (s.includes('TP2')) return 'HIT_TP2';
  if (s.includes('TP1') || s === 'TP' || s === 'WIN' || s === 'WON' || s === 'TP_HIT') return 'HIT_TP1';
  if (s.includes('SL') || s === 'LOSS' || s === 'LOST' || s === 'STOPPED' || s === 'SL_HIT') return 'HIT_SL';
  if (s.includes('EXPIRE')) return 'EXPIRED';
  if (s.includes('ACTIVE') || s === 'OPEN' || s === 'RUNNING') return 'LIVE';
  if (typeof pipsResult === 'number' && !Number.isNaN(pipsResult)) {
    if (pipsResult > 0) return 'HIT_TP1';
    if (pipsResult < 0) return 'HIT_SL';
  }
  return 'CLOSED';
}

function normalizeDirection(rawDir) {
  const d = String(rawDir || '').trim().toUpperCase();
  if (d === 'BUY' || d === 'BULL' || d === 'BULLISH' || d === 'LONG') return 'LONG';
  if (d === 'SELL' || d === 'BEAR' || d === 'BEARISH' || d === 'SHORT') return 'SHORT';
  return VALID_DIRECTIONS.has(d) ? d : 'LONG';
}

function normalizeTimeframe(rawTf) {
  const tf = String(rawTf || 'M15').trim().toUpperCase();
  if (VALID_TF.has(tf)) return tf;
  if (tf === '5M' || tf === '5MIN') return 'M5';
  if (tf === '15M' || tf === '15MIN') return 'M15';
  if (tf === '60M' || tf === '1H' || tf === '1HR') return 'H1';
  if (tf === '240M' || tf === '4H' || tf === '4HR') return 'H4';
  if (tf === '1D' || tf === 'DAY') return 'D1';
  return 'M15';
}

/**
 * Normalize an external signal bot record into the canonical `signals` schema.
 */
export function normalizeBotRecord(raw, idx = 0) {
  const rawId = raw.id ?? raw.signal_id ?? raw.ticket ?? raw.order_id ?? `${Date.now()}-${idx}`;
  const cleanId = String(rawId).startsWith('BOT-') ? String(rawId) : `BOT-${rawId}`;
  const direction = normalizeDirection(raw.direction ?? raw.type ?? raw.side ?? raw.action);
  const entry = Number(raw.entry_price ?? raw.entry ?? raw.open_price ?? 0);
  const sl = Number(raw.stop_loss ?? raw.sl ?? raw.sl_price ?? 0);
  const tp1 = Number(raw.tp1 ?? raw.tp ?? raw.take_profit ?? raw.tp1_price ?? 0);
  const tp2 = raw.tp2 != null ? Number(raw.tp2) : (raw.tp2_price != null ? Number(raw.tp2_price) : null);
  const tp3 = raw.tp3 != null ? Number(raw.tp3) : (raw.tp3_price != null ? Number(raw.tp3_price) : null);
  const closePrice = raw.close_price != null ? Number(raw.close_price) : (raw.exit_price != null ? Number(raw.exit_price) : null);

  if (!Number.isFinite(entry) || entry <= 0) return null;

  let pips = raw.pips_result ?? raw.pips ?? raw.pnl_pips ?? null;
  if (pips !== null && pips !== undefined && pips !== '') {
    pips = Number(pips);
  } else if (Number.isFinite(closePrice) && closePrice > 0) {
    const diff = direction === 'LONG' ? closePrice - entry : entry - closePrice;
    pips = Number((diff * 10).toFixed(1));
  } else {
    pips = null;
  }

  let rrRatio = raw.rr_ratio ?? raw.rr ?? null;
  if (rrRatio != null && rrRatio !== '') {
    rrRatio = Number(rrRatio);
  } else if (sl > 0 && tp1 > 0 && Math.abs(entry - sl) > 0) {
    const target = tp2 && tp2 > 0 ? tp2 : tp1;
    rrRatio = Number((Math.abs(target - entry) / Math.abs(entry - sl)).toFixed(2));
  } else {
    rrRatio = null;
  }

  const status = normalizeBotStatus(raw.status ?? raw.outcome ?? raw.result, pips);
  const openedAt = raw.opened_at ?? raw.open_time ?? raw.timestamp ?? raw.created_at ?? new Date().toISOString();
  const closedAt = raw.closed_at ?? raw.close_time ?? (status !== 'LIVE' && status !== 'FUTURE_SETUP' ? openedAt : null);

  return {
    id: cleanId,
    source: 'BOT_PROVIDER',
    status,
    pair: 'XAU/USD',
    direction,
    timeframe: normalizeTimeframe(raw.timeframe ?? raw.tf),
    strategy: String(raw.strategy || 'Signal_Bot_Provider'),
    entry_price: Number(entry.toFixed(2)),
    stop_loss: Number((sl > 0 ? sl : entry).toFixed(2)),
    tp1: Number((tp1 > 0 ? tp1 : entry).toFixed(2)),
    tp2: tp2 && Number.isFinite(tp2) ? Number(tp2.toFixed(2)) : null,
    tp3: tp3 && Number.isFinite(tp3) ? Number(tp3.toFixed(2)) : null,
    rr_ratio: rrRatio && Number.isFinite(rrRatio) ? rrRatio : null,
    confidence: raw.confidence != null ? Math.max(0, Math.min(100, Math.round(Number(raw.confidence)))) : null,
    pips_result: pips !== null && Number.isFinite(pips) ? Number(pips.toFixed(1)) : null,
    close_price: closePrice && Number.isFinite(closePrice) ? Number(closePrice.toFixed(2)) : null,
    news_tag: raw.news_tag || raw.news || null,
    reason: raw.reason || raw.notes || raw.comment || 'Signal Provider Bot Execution',
    opened_at: new Date(openedAt).toISOString(),
    closed_at: closedAt ? new Date(closedAt).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Pull raw signal list from SIGNAL_BOT_URL and normalize.
 */
export async function fetchFromSignalBot() {
  const botUrl = (process.env.SIGNAL_BOT_URL || '').trim();
  if (!botUrl) {
    return { configured: false, ok: false, records: [], error: 'SIGNAL_BOT_URL_NOT_CONFIGURED' };
  }

  const headers = { 'User-Agent': 'ManusMax-BotSync/6.0', Accept: 'application/json' };
  if (process.env.SIGNAL_BOT_API_KEY) {
    headers.Authorization = `Bearer ${process.env.SIGNAL_BOT_API_KEY}`;
  }

  try {
    const res = await fetch(botUrl, { headers, signal: AbortSignal.timeout(6500) });
    if (!res.ok) {
      return { configured: true, ok: false, status: res.status, records: [], error: `BOT_UPSTREAM_HTTP_${res.status}` };
    }
    const payload = await res.json();
    const list = Array.isArray(payload)
      ? payload
      : (payload.signals || payload.history || payload.trades || payload.data || []);

    if (!Array.isArray(list)) {
      return { configured: true, ok: false, records: [], error: 'BOT_PAYLOAD_NOT_ARRAY' };
    }

    const normalized = list.map((item, idx) => normalizeBotRecord(item, idx)).filter(Boolean);
    return { configured: true, ok: true, records: normalized, error: null };
  } catch (err) {
    return { configured: true, ok: false, records: [], error: err.message || 'BOT_FETCH_FAILED' };
  }
}

/**
 * Sync bot signals into Supabase (if configured) and return result.
 */
export async function syncBotHistoryToSupabase() {
  const pulled = await fetchFromSignalBot();
  if (!pulled.configured) {
    return { configured: false, synced: 0, records: [], error: pulled.error };
  }
  if (!pulled.ok) {
    return { configured: true, synced: 0, records: [], error: pulled.error, status: pulled.status || 502 };
  }

  const sb = getSupabaseConfig();
  if (sb.configured && pulled.records.length > 0) {
    const up = await upsertSignals(pulled.records);
    if (!up.ok) {
      return {
        configured: true,
        synced: 0,
        records: pulled.records,
        supabase_error: up.error,
      };
    }
  }

  return {
    configured: true,
    synced: pulled.records.length,
    records: pulled.records,
    persisted: sb.configured,
  };
}

/**
 * Compute real quantitative KPIs strictly from BOT_PROVIDER rows.
 * Never returns hardcoded fallback numbers like 84.6% or +6,840 Pips.
 */
export function computeBotMetrics(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      total_trades: 0,
      settled_trades: 0,
      win_rate_pct: null,
      avg_rr: null,
      total_pips: null,
      max_drawdown_pips: null,
      sharpe_ratio: null,
      signals_per_day: null,
    };
  }

  const settled = rows.filter((r) => !['LIVE', 'FUTURE_SETUP'].includes(r.status));
  const wins = settled.filter((r) =>
    ['HIT_TP1', 'HIT_TP2', 'HIT_TP3'].includes(r.status) ||
    (r.status === 'CLOSED' && Number(r.pips_result) > 0)
  );
  const losses = settled.filter((r) =>
    r.status === 'HIT_SL' ||
    (r.status === 'CLOSED' && Number(r.pips_result) < 0)
  );
  const decidedCount = wins.length + losses.length;
  const winRate = decidedCount > 0 ? Number(((wins.length / decidedCount) * 100).toFixed(1)) : null;

  const pipsSeries = settled
    .slice()
    .sort((a, b) => new Date(a.closed_at || a.opened_at) - new Date(b.closed_at || b.opened_at))
    .map((r) => Number(r.pips_result))
    .filter((v) => Number.isFinite(v));

  const totalPips = pipsSeries.length > 0
    ? Number(pipsSeries.reduce((acc, v) => acc + v, 0).toFixed(1))
    : null;

  // Peak-to-trough drawdown across closed trades
  let maxDrawdown = null;
  if (pipsSeries.length > 0) {
    let equity = 0;
    let peak = 0;
    let worstDd = 0;
    for (const p of pipsSeries) {
      equity += p;
      if (equity > peak) peak = equity;
      const dd = equity - peak;
      if (dd < worstDd) worstDd = dd;
    }
    const minSingle = Math.min(...pipsSeries);
    maxDrawdown = Number(Math.min(worstDd, minSingle < 0 ? minSingle : 0).toFixed(1));
  }

  const rrValues = rows.map((r) => Number(r.rr_ratio)).filter((v) => Number.isFinite(v) && v > 0);
  const avgRr = rrValues.length > 0
    ? Number((rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(2))
    : null;

  let sharpeRatio = null;
  if (pipsSeries.length >= 2) {
    const mean = pipsSeries.reduce((a, b) => a + b, 0) / pipsSeries.length;
    const variance = pipsSeries.reduce((a, b) => a + (b - mean) ** 2, 0) / (pipsSeries.length - 1);
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) {
      sharpeRatio = Number(((mean / stdDev) * Math.sqrt(pipsSeries.length)).toFixed(2));
    }
  }

  let signalsPerDay = null;
  const timestamps = rows.map((r) => new Date(r.opened_at).getTime()).filter((t) => Number.isFinite(t));
  if (timestamps.length >= 2) {
    const spanDays = Math.max(1, (Math.max(...timestamps) - Math.min(...timestamps)) / 86_400_000);
    signalsPerDay = Number((rows.length / spanDays).toFixed(1));
  } else if (rows.length === 1) {
    signalsPerDay = 1;
  }

  return {
    total_trades: rows.length,
    settled_trades: settled.length,
    win_rate_pct: winRate,
    avg_rr: avgRr,
    total_pips: totalPips,
    max_drawdown_pips: maxDrawdown,
    sharpe_ratio: sharpeRatio,
    signals_per_day: signalsPerDay,
  };
}

/**
 * Load BOT_PROVIDER history from Supabase (or directly from SIGNAL_BOT_URL if DB unconfigured).
 */
export async function loadBotHistory() {
  const sb = getSupabaseConfig();
  const hasBotUrl = Boolean((process.env.SIGNAL_BOT_URL || '').trim());

  if (sb.configured) {
    const res = await querySignals('source=eq.BOT_PROVIDER&order=closed_at.desc.nullslast,opened_at.desc&limit=100');
    if (res.ok && Array.isArray(res.data)) {
      if (res.data.length > 0) {
        return {
          ok: true,
          configured: true,
          supabase_configured: true,
          bot_configured: hasBotUrl,
          history: res.data,
          metrics: computeBotMetrics(res.data),
          message: null,
        };
      }

      // If DB has no bot rows yet and SIGNAL_BOT_URL is configured, sync immediately
      if (hasBotUrl) {
        const synced = await syncBotHistoryToSupabase();
        if (synced.records.length > 0) {
          return {
            ok: true,
            configured: true,
            supabase_configured: true,
            bot_configured: true,
            history: synced.records,
            metrics: computeBotMetrics(synced.records),
            message: null,
          };
        }
        if (synced.error) {
          return {
            ok: false,
            status: 502,
            configured: true,
            supabase_configured: true,
            bot_configured: true,
            history: [],
            metrics: computeBotMetrics([]),
            error: synced.error,
          };
        }
      }

      return {
        ok: true,
        configured: hasBotUrl,
        supabase_configured: true,
        bot_configured: hasBotUrl,
        history: [],
        metrics: computeBotMetrics([]),
        message: hasBotUrl
          ? 'Connected to Supabase and Signal Bot; no closed bot signals recorded yet.'
          : 'Supabase connected. Set SIGNAL_BOT_URL or POST trades to /api/bot-webhook to populate historical bot signals.',
      };
    }

    return {
      ok: false,
      status: res.status || 502,
      configured: true,
      supabase_configured: true,
      bot_configured: hasBotUrl,
      history: [],
      metrics: computeBotMetrics([]),
      error: res.error || 'SUPABASE_QUERY_FAILED',
    };
  }

  // Fallback: Supabase not configured yet, check if SIGNAL_BOT_URL is configured directly
  if (hasBotUrl) {
    const pulled = await fetchFromSignalBot();
    if (!pulled.ok) {
      return {
        ok: false,
        status: pulled.status || 502,
        configured: true,
        supabase_configured: false,
        bot_configured: true,
        history: [],
        metrics: computeBotMetrics([]),
        error: pulled.error,
      };
    }
    return {
      ok: true,
      configured: true,
      supabase_configured: false,
      bot_configured: true,
      history: pulled.records,
      metrics: computeBotMetrics(pulled.records),
      message: 'Loaded directly from SIGNAL_BOT_URL (configure SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY for persistence).',
    };
  }

  return {
    ok: true,
    configured: false,
    supabase_configured: false,
    bot_configured: false,
    history: [],
    metrics: computeBotMetrics([]),
    message: 'Signal Provider Bot not configured. Set SIGNAL_BOT_URL (or use POST /api/bot-webhook) and SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables.',
  };
}
