/**
 * Netlify Function v2: GET /api/signals/live
 * Returns active LIVE signals and upcoming FUTURE_SETUP predictions from Supabase
 * (`source = 'SMC_ENGINE'`), resolving any breached TP/SL trades along the way.
 */

import { fetchMultiTfOhlcv, getOhlcvForTimeframe, normalizeTimeframe } from './lib/market-data.mjs';
import { scanMultiTimeframe, analyzeTimeframe } from './lib/smc-engine.mjs';
import { syncSmcLifecycle } from './lib/smc-persistence.mjs';
import { getSupabaseConfig, querySignals } from './lib/supabase.mjs';

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

    const primaryBundle = await getOhlcvForTimeframe(tf, { limit: 200 });
    const sb = getSupabaseConfig();

    let liveRows = [];
    let futureRows = [];
    const persistenceMode = sb.configured ? 'SUPABASE_SMC_ENGINE' : 'STATELESS_LIVE_OHLCV';
    let summaries = {};

    if (sb.configured && !forceScan) {
      const dbRes = await querySignals(
        'source=eq.SMC_ENGINE&status=in.(LIVE,FUTURE_SETUP)&order=opened_at.desc&limit=25'
      );
      if (dbRes.ok && Array.isArray(dbRes.data) && dbRes.data.length > 0) {
        const futureDb = dbRes.data.filter((r) => r.status === 'FUTURE_SETUP');
        const newestMs = futureDb.length > 0
          ? Math.max(...futureDb.map((r) => new Date(r.updated_at || r.opened_at).getTime()))
          : 0;
        if (newestMs > 0 && Date.now() - newestMs < STALE_MS) {
          liveRows = dbRes.data.filter((r) => r.status === 'LIVE');
          futureRows = futureDb;
        }
      }
    }

    if (liveRows.length === 0 && futureRows.length === 0) {
      const multiTf = await fetchMultiTfOhlcv(['M5', 'M15', 'H1', 'H4']);
      if (!multiTf[tf]) multiTf[tf] = primaryBundle;

      const scan = scanMultiTimeframe(multiTf, primaryBundle.macro, tf);
      summaries = scan.summaries;

      const m5Candles = multiTf.M5?.candles || primaryBundle.candles;
      const synced = await syncSmcLifecycle({
        scanResult: scan,
        m5Candles,
        spot: primaryBundle.spot,
      });

      liveRows = synced.activeLive;
      futureRows = synced.futureSetups;
    } else {
      const tfAnalysis = analyzeTimeframe(tf, primaryBundle.candles, primaryBundle.spot, primaryBundle.macro);
      summaries[tf] = tfAnalysis.summary;
    }

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
      { error: 'LIVE_SIGNALS_ERROR', detail: err.message || 'Failed to compute live signals' },
      { status: err.statusCode || 502, headers: CORS_HEADERS }
    );
  }
};
