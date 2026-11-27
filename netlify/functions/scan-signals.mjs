/**
 * Netlify Scheduled Function v2: scan-signals
 * Runs every 5 minutes to scan M5, M15, H1, H4 OHLCV candles, resolve open LIVE
 * SMC_ENGINE signals to HIT_TP1/HIT_TP2/HIT_TP3/HIT_SL, and upsert active signals.
 */

import { fetchMultiTfOhlcv, fetchMacroSnapshot } from './lib/market-data.mjs';
import { scanMultiTimeframe } from './lib/smc-engine.mjs';
import { syncSmcLifecycle } from './lib/smc-persistence.mjs';
import { getSupabaseConfig } from './lib/supabase.mjs';

export const config = {
  schedule: '*/5 * * * *',
};

export default async () => {
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
    const m5Candles = ohlcvByTf.M5?.candles || ohlcvByTf.M15?.candles || [];

    const sync = await syncSmcLifecycle({ scanResult, m5Candles, spot });
    const sb = getSupabaseConfig();

    return Response.json({
      ok: true,
      spot_price: scanResult.spot_price,
      timeframes_scanned: tfs,
      live_count: sync.activeLive.length,
      future_count: sync.futureSetups.length,
      resolved_count: sync.resolvedCount,
      upserted_count: sync.upsertedCount,
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
