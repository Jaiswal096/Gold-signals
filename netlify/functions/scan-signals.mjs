/**
 * Netlify Scheduled Function v2: scan-signals
 * Runs every 5 minutes (and supports manual HTTP trigger) to scan M5, M15, H1, H4
 * OHLCV candles, evaluate open LIVE signals for TP/SL resolution, and upsert
 * deterministic LIVE & FUTURE_SETUP SMC signals into Supabase.
 */

import { fetchMultiTfOhlcv, fetchMacroSnapshot } from './lib/market-data.mjs';
import { scanMultiTimeframe, resolveOpenSmcSignals } from './lib/smc-engine.mjs';
import { getSupabaseConfig, querySignals, upsertSignals, sbFetch } from './lib/supabase.mjs';

export const config = {
  schedule: '*/5 * * * *',
};

export default async (req) => {
  try {
    const ohlcvByTf = await fetchMultiTfOhlcv(['M5', 'M15', 'H1', 'H4']);
    const tfs = Object.keys(ohlcvByTf);
    if (tfs.length === 0) {
      return Response.json(
        { error: 'SCAN_NO_OHLCV', detail: 'No timeframe OHLCV candles retrieved.' },
        { status: 502 }
      );
    }

    const spot = ohlcvByTf.M15?.spot ?? ohlcvByTf[tfs[0]]?.spot;
    const macro = ohlcvByTf.M15?.macro || (await fetchMacroSnapshot(spot));
    const scanResult = scanMultiTimeframe(ohlcvByTf, macro, 'M15');

    const sb = getSupabaseConfig();
    let resolvedCount = 0;
    let upsertedCount = 0;

    if (sb.configured) {
      // 1. Resolve open LIVE signals against latest M5/M15 candle
      const openRes = await querySignals("source=eq.SMC_ENGINE&status=eq.LIVE&limit=25");
      const m5Candles = ohlcvByTf.M5?.candles || ohlcvByTf.M15?.candles;
      const latestCandle = m5Candles?.[m5Candles.length - 1];
      if (openRes.ok && Array.isArray(openRes.data) && latestCandle) {
        const resolutions = resolveOpenSmcSignals(openRes.data, latestCandle);
        if (resolutions.length > 0) {
          await upsertSignals(resolutions);
          resolvedCount = resolutions.length;
        }
      }

      // 2. Expire old FUTURE_SETUP rows (>2 hours old) so feed stays current
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      await sbFetch(`signals?source=eq.SMC_ENGINE&status=eq.FUTURE_SETUP&opened_at=lt.${encodeURIComponent(twoHoursAgo)}`, {
        method: 'PATCH',
        body: { status: 'EXPIRED', updated_at: new Date().toISOString() },
      });

      // 3. Upsert latest LIVE & FUTURE_SETUP rows
      const rows = [...scanResult.live_signals, ...scanResult.future_setups];
      if (rows.length > 0) {
        const up = await upsertSignals(rows);
        if (up.ok && Array.isArray(up.data)) {
          upsertedCount = up.data.length;
        }
      }
    }

    return Response.json({
      ok: true,
      spot_price: scanResult.spot_price,
      timeframes_scanned: tfs,
      live_count: scanResult.live_signals.length,
      future_count: scanResult.future_setups.length,
      resolved_count: resolvedCount,
      upserted_count: upsertedCount,
      supabase_configured: sb.configured,
      updated_at: scanResult.updated_at,
    });
  } catch (err) {
    return Response.json(
      { error: 'SCAN_SIGNALS_ERROR', detail: err.message },
      { status: 500 }
    );
  }
};
