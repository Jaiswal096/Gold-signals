/**
 * Shared SMC_ENGINE Lifecycle Sync for Supabase.
 * Used by both `scan-signals.mjs` (cron) and `signals-live.mjs` (on-demand)
 * so open LIVE trades are never duplicated and always resolve cleanly to
 * HIT_TP1 / HIT_TP2 / HIT_TP3 / HIT_SL in `public.signals`.
 */

import { resolveOpenSmcSignals } from './smc-engine.mjs';
import { getSupabaseConfig, querySignals, upsertSignals, sbFetch } from './supabase.mjs';

export async function syncSmcLifecycle({ scanResult, m5Candles = [], spot = null }) {
  const sb = getSupabaseConfig();
  if (!sb.configured) {
    return {
      persisted: false,
      resolvedCount: 0,
      upsertedCount: 0,
      activeLive: scanResult.live_signals,
      futureSetups: scanResult.future_setups,
    };
  }

  // 1. Fetch currently open LIVE SMC_ENGINE signals
  const openRes = await querySignals('source=eq.SMC_ENGINE&status=eq.LIVE&order=opened_at.desc&limit=50');
  const existingOpen = openRes.ok && Array.isArray(openRes.data) ? openRes.data : [];

  // 2. Resolve breached SL/TP against chronological candles + live spot
  const resolutions = resolveOpenSmcSignals(existingOpen, m5Candles, spot);
  const resolvedIds = new Set(resolutions.map((r) => r.id));
  if (resolutions.length > 0) {
    await upsertSignals(resolutions);
  }

  // 3. Expire stale open LIVE signals older than 24h so dead setups don't linger
  const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
  const expiredOldLive = [];
  const stillActiveOpen = [];
  for (const sig of existingOpen) {
    if (resolvedIds.has(sig.id)) continue;
    const openMs = new Date(sig.opened_at).getTime();
    if (Number.isFinite(openMs) && openMs < dayAgoMs) {
      expiredOldLive.push({ ...sig, status: 'EXPIRED', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    } else {
      stillActiveOpen.push(sig);
    }
  }
  if (expiredOldLive.length > 0) {
    await upsertSignals(expiredOldLive);
  }

  // 4. Deduplicate: skip inserting a new LIVE signal if same (timeframe, direction) is already open
  const openKeys = new Set(stillActiveOpen.map((s) => `${s.timeframe}:${s.direction}`));
  const newLiveToInsert = [];
  for (const sig of scanResult.live_signals) {
    const key = `${sig.timeframe}:${sig.direction}`;
    if (!openKeys.has(key)) {
      openKeys.add(key);
      newLiveToInsert.push(sig);
    }
  }

  // 5. Expire old FUTURE_SETUP rows (>30m old) and upsert fresh ones
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  await sbFetch(`signals?source=eq.SMC_ENGINE&status=eq.FUTURE_SETUP&opened_at=lt.${encodeURIComponent(thirtyMinsAgo)}`, {
    method: 'PATCH',
    body: { status: 'EXPIRED', updated_at: new Date().toISOString() },
  });

  const rowsToUpsert = [...newLiveToInsert, ...scanResult.future_setups];
  let upsertedCount = 0;
  if (rowsToUpsert.length > 0) {
    const up = await upsertSignals(rowsToUpsert);
    if (up.ok && Array.isArray(up.data)) upsertedCount = up.data.length;
  }

  return {
    persisted: true,
    resolvedCount: resolutions.length,
    upsertedCount,
    activeLive: [...stillActiveOpen, ...newLiveToInsert],
    futureSetups: scanResult.future_setups,
  };
}
