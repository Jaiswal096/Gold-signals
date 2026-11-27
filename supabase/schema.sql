-- =====================================================================
-- MANUS MAX AI 6.0 — XAU/USD Live Signal Engine Schema
-- Safe to run on BOTH fresh databases and existing Phase 1 schemas.
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Updated-at Trigger Helper
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 2. Upgrade Legacy Phase 1 `signals` Table (if present without `source`)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  fk_rec RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'signals'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'signals' AND column_name = 'source'
  ) THEN
    -- Drop any foreign key constraints on chart_drawings referencing legacy signals
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'chart_drawings'
    ) THEN
      FOR fk_rec IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.chart_drawings'::regclass
          AND contype = 'f'
          AND confrelid = 'public.signals'::regclass
      LOOP
        EXECUTE format('ALTER TABLE public.chart_drawings DROP CONSTRAINT IF EXISTS %I', fk_rec.conname);
      END LOOP;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'chart_drawings'
          AND column_name = 'signal_id' AND data_type = 'uuid'
      ) THEN
        ALTER TABLE public.chart_drawings
          ALTER COLUMN signal_id TYPE TEXT USING signal_id::text;
      END IF;
    END IF;

    -- Preserve legacy Phase 1 rows under signals_legacy_v1 (avoiding name collision)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'signals_legacy_v1'
    ) THEN
      ALTER TABLE public.signals RENAME TO signals_legacy_v1;
    ELSE
      EXECUTE format(
        'ALTER TABLE public.signals RENAME TO %I',
        'signals_legacy_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
      );
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Unified Signals Table (SMC Engine LIVE/FUTURE + BOT_PROVIDER History)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signals (
  id TEXT PRIMARY KEY,                      -- e.g. 'BOT-9843' or 'SMC-M15-LONG-1795750500'
  source TEXT NOT NULL CHECK (source IN ('BOT_PROVIDER', 'SMC_ENGINE')),
  status TEXT NOT NULL CHECK (
    status IN ('FUTURE_SETUP', 'LIVE', 'HIT_TP1', 'HIT_TP2', 'HIT_TP3', 'HIT_SL', 'CLOSED', 'EXPIRED')
  ),
  pair TEXT NOT NULL DEFAULT 'XAU/USD',
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  timeframe TEXT NOT NULL CHECK (timeframe IN ('M5', 'M15', 'H1', 'H4', 'D1')),
  strategy TEXT NOT NULL,                   -- e.g. 'EMA_9_15_SMC', 'ICT_SilverBullet', 'BOT_SIGNAL'
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
  indicators_json JSONB DEFAULT '{}'::jsonb, -- { ema9, ema15, ema50, ema200, atr14, rsi14, fvg, ob, choch }
  reason TEXT,
  pips_result NUMERIC(10, 1),                -- populated on close (+230.0 or -45.0)
  close_price NUMERIC(10, 2),
  news_tag TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_source_status
  ON public.signals (source, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_closed_at
  ON public.signals (source, closed_at DESC);

DROP TRIGGER IF EXISTS trg_signals_updated_at ON public.signals;
CREATE TRIGGER trg_signals_updated_at
  BEFORE UPDATE ON public.signals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_column();

-- ---------------------------------------------------------------------
-- 4. Multi-Timeframe OHLCV Candle Cache (Protects API Rate Limits)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ohlcv_cache (
  cache_key TEXT PRIMARY KEY,                -- e.g. 'XAUUSD_M15'
  spot_price NUMERIC(10, 2) NOT NULL,
  provider TEXT,
  candles_json JSONB NOT NULL,               -- Array of { time, open, high, low, close }
  macro_json JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 5. Persistent User Chart Drawings (48h IP-hashed retention)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chart_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_key TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT 'XAUUSD',
  timeframe TEXT,
  drawing_type TEXT,
  time_from BIGINT,
  time_to BIGINT,
  price_from NUMERIC(10, 2),
  price_to NUMERIC(10, 2),
  label TEXT,
  color TEXT,
  signal_id TEXT REFERENCES public.signals(id) ON DELETE SET NULL,
  schema_version INT NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chart_drawings_device_symbol
  ON public.chart_drawings (device_key, symbol);

DROP TRIGGER IF EXISTS trg_chart_drawings_updated_at ON public.chart_drawings;
CREATE TRIGGER trg_chart_drawings_updated_at
  BEFORE UPDATE ON public.chart_drawings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_column();

-- ---------------------------------------------------------------------
-- 6. Market Status Heartbeat
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_status (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL DEFAULT 'XAUUSD',
  provider TEXT,
  last_tick_price NUMERIC(10, 2),
  last_tick_time TIMESTAMPTZ,
  freshness_ms BIGINT,
  connection_state TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 7. Row-Level Security (Public Read-Only, Service-Role Full Write)
-- ---------------------------------------------------------------------
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ohlcv_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read signals" ON public.signals;
CREATE POLICY "Public read signals" ON public.signals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read market_status" ON public.market_status;
CREATE POLICY "Public read market_status" ON public.market_status FOR SELECT USING (true);
