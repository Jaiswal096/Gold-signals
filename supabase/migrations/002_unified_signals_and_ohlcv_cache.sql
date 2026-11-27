-- =====================================================================
-- Migration: 002_unified_signals_and_ohlcv_cache.sql
-- Upgrades legacy Phase 1 UUID signals table (if present) or creates
-- the unified v2 signals + ohlcv_cache schema.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- If legacy Phase 1 signals table exists without `source`, migrate cleanly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'signals'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'signals' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.signals RENAME TO signals_legacy_v1;
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'chart_drawings'
    ) THEN
      ALTER TABLE public.chart_drawings DROP CONSTRAINT IF EXISTS chart_drawings_signal_id_fkey;
      ALTER TABLE public.chart_drawings ALTER COLUMN signal_id TYPE TEXT USING signal_id::text;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.signals (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('BOT_PROVIDER', 'SMC_ENGINE')),
  status TEXT NOT NULL CHECK (
    status IN ('FUTURE_SETUP', 'LIVE', 'HIT_TP1', 'HIT_TP2', 'HIT_TP3', 'HIT_SL', 'CLOSED', 'EXPIRED')
  ),
  pair TEXT NOT NULL DEFAULT 'XAU/USD',
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  timeframe TEXT NOT NULL CHECK (timeframe IN ('M5', 'M15', 'H1', 'H4', 'D1')),
  strategy TEXT NOT NULL,
  entry_price NUMERIC(10, 2) NOT NULL,
  stop_loss NUMERIC(10, 2) NOT NULL,
  tp1 NUMERIC(10, 2) NOT NULL,
  tp2 NUMERIC(10, 2),
  tp3 NUMERIC(10, 2),
  rr_ratio NUMERIC(5, 2),
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  confidence_inst INTEGER CHECK (confidence_inst BETWEEN 0 AND 100),
  confidence_macro INTEGER CHECK (confidence_macro BETWEEN 0 AND 100),
  confidence_tech INTEGER CHECK (confidence_tech BETWEEN 0 AND 100),
  distance_pips NUMERIC(10, 1),
  indicators_json JSONB DEFAULT '{}'::jsonb,
  reason TEXT,
  pips_result NUMERIC(10, 1),
  close_price NUMERIC(10, 2),
  news_tag TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_source_status
  ON public.signals (source, status, opened_at DESC);

CREATE TABLE IF NOT EXISTS public.ohlcv_cache (
  cache_key TEXT PRIMARY KEY,
  spot_price NUMERIC(10, 2) NOT NULL,
  provider TEXT,
  candles_json JSONB NOT NULL,
  macro_json JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read signals" ON public.signals;
CREATE POLICY "Public read signals" ON public.signals FOR SELECT USING (true);
