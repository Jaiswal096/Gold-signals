/**
 * Netlify Function v2: GET /api/signals/live
 * Returns active LIVE signals and upcoming FUTURE_SETUP predictions from Supabase
 * (`source = 'SMC_ENGINE'`), or computes directly from live multi-TF OHLCV feeds
 * when Supabase is unconfigured or stale (>4m).
 */

import { fetchMultiTfOhlcv, getOhlcvForTimeframe, normalizeTimeframe } from './lib/market-data.mjs';
import { scanMultiTimeframe, analyzeTimeframe } from './lib/smc-engine.mjs';
import { getSupabaseConfig, querySignals, upsertSignals } from './lib/supabase.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const STALE_MS = 4 * 60 * 1000;

function formatSignalForClient(row) {
  const ind = row.indicators_json || row.indicators || {};
  return {
    id: row.id,
    source: row.source || 'SMC_ENGINE',
    status: row.status,
    pair: row.pair || 'XAU/USD',
    direction: row.direction,
    timeframe: row.timeframe,
    strategy: row.strategy,
    entry_price: Number(row.entry_price),
    stop_loss: Number(row.stop_loss),
    tp1: Number(row.tp1),
    tp2: row.tp2 != null ? Number(row.tp2) : null,
    tp3: row.tp3 != null ? Number(row.tp3) : null,
    rr_ratio: row.rr_ratio != null ? Number(row.rr_ratio) : 2.0,
    confidence: row.confidence != null ? Number(row.confidence) : 75,
    confidence_inst: row.confidence_inst != null ? Number(row.confidence_inst) : null,
    confidence_macro: row.confidence_macro != null ? Number(row.confidence_macro) : null,
    confidence_tech: row.confidence_tech != null ? Number(row.confidence_tech) : null,
    distance_pips: row.distance_pips != null ? Number(row.distance_pips) : 0,
    indicators: ind,
    reason: row.reason,
    opened_at: row.opened_at,
    updated_at: row.updated_at,
  };
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const tf = normalizeTimeframe(url.searchParams.get('tf') || 'M15');
    const forceScan = url.searchParams.get('refresh') === '1';

    // Always pull fresh spot & primary TF bundle (30s cached) so spot_price and indicators are live
    const primaryBundle = await getOhlcvForTimeframe(tf, { limit: 200 });
    const sb = getSupabaseConfig();

    let liveRows = [];
    let futureRows = [];
    let persistenceMode = sb.configured ? 'SUPABASE_SMC_ENGINE' : 'STATELESS_LIVE_OHLCV';
    let summaries = {};

    if (sb.configured && !forceScan) {
      const dbRes = await querySignals(
        "source=eq.SMC_ENGINE&status=in.(LIVE,FUTURE_SETUP)&order=opened_at.desc&limit=20"
      );
      if (dbRes.ok && Array.isArray(dbRes.data) && dbRes.data.length > 0) {
        const newestMs = Math.max(...dbRes.data.map((r) => new Date(r.updated_at || r.opened_at).getTime()));
        if (Date.now() - newestMs < STALE_MS) {
          liveRows = dbRes.data.filter((r) => r.status === 'LIVE');
          futureRows = dbRes.data.filter((r) => r.status === 'FUTURE_SETUP');
        }
      }
    }

    // Compute fresh multi-TF scan when DB is unconfigured, empty, or stale
    if (liveRows.length === 0 && futureRows.length === 0) {
      const multiTf = await fetchMultiTfOhlcv(['M5', 'M15', 'H1', 'H4']);
      if (!multiTf[tf]) multiTf[tf] = primaryBundle;

      const scan = scanMultiTimeframe(multiTf, primaryBundle.macro, tf);
      liveRows = scan.live_signals;
      futureRows = scan.future_setups;
      summaries = scan.summaries;

      if (sb.configured) {
        const toUpsert = [...liveRows, ...futureRows];
        if (toUpsert.length > 0) {
          upsertSignals(toUpsert).catch(() => {});
        }
      }
    } else {
      // Populate live indicator summary for requested TF from primaryBundle
      const tfAnalysis = analyzeTimeframe(tf, primaryBundle.candles, primaryBundle.spot, primaryBundle.macro);
      summaries[tf] = tfAnalysis.summary;
    }

    // Recompute live distance_pips relative to current spot
    const liveFormatted = liveRows.map((r) => {
      const f = formatSignalForClient(r);
      f.distance_pips = Number((Math.abs(f.entry_price - primaryBundle.spot) * 10).toFixed(1));
      return f;
    });

    const futureFormatted = futureRows
      .map((r) => {
        const f = formatSignalForClient(r);
        f.distance_pips = Number((Math.abs(f.entry_price - primaryBundle.spot) * 10).toFixed(1));
        return f;
      })
      .sort((a, b) => a.distance_pips - b.distance_pips);

    const activeSummary = summaries[tf] || summaries.M15 || Object.values(summaries)[0] || {};

    return Response.json(
      {
        spot_price: primaryBundle.spot,
        change: primaryBundle.change,
        change_pct: primaryBundle.changePercent,
        timeframe: tf,
        provider: primaryBundle.provider,
        persistence_mode: persistenceMode,
        updated_at: new Date().toISOString(),
        macro: primaryBundle.macro,
        indicators: activeSummary,
        smc_analysis: {
          choch: activeSummary.choch || null,
          ob: activeSummary.ob || null,
          fvg: activeSummary.fvg || null,
          swing_high: activeSummary.swing_high || null,
          swing_low: activeSummary.swing_low || null,
          ema9: activeSummary.ema9 || null,
          ema15: activeSummary.ema15 || null,
          ema50: activeSummary.ema50 || null,
          atr14: activeSummary.atr14 || null,
          rsi14: activeSummary.rsi14 || null,
          price_action: activeSummary.price_action || null,
        },
        live_signals: liveFormatted,
        future_setups: futureFormatted,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    return Response.json(
      {
        error: 'LIVE_SIGNALS_ERROR',
        detail: err.message || 'Failed to compute live signals',
      },
      { status: err.statusCode || 502, headers: CORS_HEADERS }
    );
  }
};
