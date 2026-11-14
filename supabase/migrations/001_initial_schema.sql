-- =====================================================================
-- Migration: 001_initial_schema.sql
-- Description: Core schema for XAU/USD Signals Platform
-- Tables: signals, chart_drawings, market_status
-- =====================================================================

-- Ensure pgcrypto or uuid-ossp extension is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Helper function for updated_at timestamps
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 2. Table: signals
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL DEFAULT 'XAUUSD',
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  timeframe TEXT,
  entry_price NUMERIC(10, 2),
  sl_price NUMERIC(10, 2),
  tp1_price NUMERIC(10, 2),
  tp2_price NUMERIC(10, 2),
  tp3_price NUMERIC(10, 2),
  rr_ratio NUMERIC(5, 2),
  confidence_total INT,
  confidence_inst INT,
  confidence_macro INT,
  confidence_tech INT,
  strategy TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'WATCH' CHECK (
    status IN ('WATCH', 'ARMED', 'TRIGGERED', 'ACTIVE', 'TP_HIT', 'SL_HIT', 'EXPIRED', 'CANCELLED')
  ),
  data_source TEXT,
  data_freshness_ms BIGINT,
  schema_version INT NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  close_price NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for signals
CREATE INDEX IF NOT EXISTS idx_signals_symbol_status_generated 
  ON signals (symbol, status, generated_at DESC);

-- Trigger for signals updated_at
DROP TRIGGER IF EXISTS trg_signals_updated_at ON signals;
CREATE TRIGGER trg_signals_updated_at
  BEFORE UPDATE ON signals
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_column();

-- ---------------------------------------------------------------------
-- 3. Table: chart_drawings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chart_drawings (
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
  signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
  schema_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for chart_drawings
CREATE INDEX IF NOT EXISTS idx_chart_drawings_device_symbol 
  ON chart_drawings (device_key, symbol);

-- Trigger for chart_drawings updated_at
DROP TRIGGER IF EXISTS trg_chart_drawings_updated_at ON chart_drawings;
CREATE TRIGGER trg_chart_drawings_updated_at
  BEFORE UPDATE ON chart_drawings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_column();

-- ---------------------------------------------------------------------
-- 4. Table: market_status
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_status (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL DEFAULT 'XAUUSD',
  provider TEXT,
  last_tick_price NUMERIC(10, 2),
  last_tick_time TIMESTAMPTZ,
  freshness_ms BIGINT,
  connection_state TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for market_status updated_at
DROP TRIGGER IF EXISTS trg_market_status_updated_at ON market_status;
CREATE TRIGGER trg_market_status_updated_at
  BEFORE UPDATE ON market_status
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_column();
