/**
 * Deterministic Quantitative SMC + Price Action + EMA 9/15 Signal Engine.
 * Zero Math.random(). Operates strictly on real OHLCV arrays (M5, M15, H1, H4).
 *
 * Classifies signals into:
 *   - LIVE: Spot within 0.35 * ATR(14) of valid OB/FVG/EMA9-15 confluence + directional confirmation
 *   - FUTURE_SETUP: Untested OB / FVG / Swing Liquidity zone 0.35 * ATR to 4.5 * ATR ahead of spot
 * Enforces hard minimum 1:2 RR (TP1 = 1:2.0, TP2 = 1:3.5, TP3 = 1:6.0).
 */

export function computeEMASeries(candles, period) {
  if (!Array.isArray(candles) || candles.length < period) return [];
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += candles[i].close;
  let ema = sum / period;
  const out = [{ time: candles[period - 1].time, value: Number(ema.toFixed(2)) }];
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    out.push({ time: candles[i].time, value: Number(ema.toFixed(2)) });
  }
  return out;
}

export function computeATR(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < 2) return 6.0;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  const slice = trs.slice(-period);
  const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
  return Number(Math.max(1.5, avg).toFixed(2));
}

export function computeRSI(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length <= period) return 50.0;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
  }
  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

export function computeBollingerBands(candles, period = 20, mult = 2) {
  if (!Array.isArray(candles) || candles.length < period) {
    return { upper: null, middle: null, lower: null, bandwidthPct: null, squeeze: false, breakout: null };
  }
  const closes = candles.slice(-period).map((c) => c.close);
  const mean = closes.reduce((a, b) => a + b, 0) / period;
  const variance = closes.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  const upper = Number((mean + mult * std).toFixed(2));
  const lower = Number((mean - mult * std).toFixed(2));
  const middle = Number(mean.toFixed(2));
  const bandwidthPct = Number((((upper - lower) / middle) * 100).toFixed(2));
  const lastClose = candles[candles.length - 1].close;
  return {
    upper,
    middle,
    lower,
    bandwidthPct,
    squeeze: bandwidthPct < 1.35,
    breakout: lastClose > upper ? 'UPPER' : lastClose < lower ? 'LOWER' : null,
  };
}

export function detectSwingPoints(candles, lookback = 30) {
  if (!Array.isArray(candles) || candles.length < 7) {
    return { swingHigh: null, swingLow: null, pivotHighs: [], pivotLows: [] };
  }
  const slice = candles.slice(-Math.min(lookback, candles.length));
  const pivotHighs = [];
  const pivotLows = [];

  for (let i = 2; i < slice.length - 2; i++) {
    const c = slice[i];
    if (c.high >= slice[i - 1].high && c.high >= slice[i - 2].high && c.high > slice[i + 1].high && c.high > slice[i + 2].high) {
      pivotHighs.push({ price: c.high, time: c.time, idx: i });
    }
    if (c.low <= slice[i - 1].low && c.low <= slice[i - 2].low && c.low < slice[i + 1].low && c.low < slice[i + 2].low) {
      pivotLows.push({ price: c.low, time: c.time, idx: i });
    }
  }

  const maxHigh = Math.max(...slice.map((c) => c.high));
  const minLow = Math.min(...slice.map((c) => c.low));

  return {
    swingHigh: pivotHighs.length ? pivotHighs[pivotHighs.length - 1].price : Number(maxHigh.toFixed(2)),
    swingLow: pivotLows.length ? pivotLows[pivotLows.length - 1].price : Number(minLow.toFixed(2)),
    rangeHigh: Number(maxHigh.toFixed(2)),
    rangeLow: Number(minLow.toFixed(2)),
    pivotHighs,
    pivotLows,
  };
}

/**
 * Unmitigated Fair Value Gap detector across 3 consecutive candles [i-2, i-1, i].
 */
export function detectUnmitigatedFVGs(candles) {
  if (!Array.isArray(candles) || candles.length < 5) return { bullish: [], bearish: [] };
  const start = Math.max(2, candles.length - 60);
  const bullish = [];
  const bearish = [];

  for (let i = start; i < candles.length - 1; i++) {
    const c0 = candles[i - 2];
    const c2 = candles[i];

    // Bullish FVG: Low[i] > High[i-2]
    if (c2.low > c0.high) {
      const zoneLow = Number(c0.high.toFixed(2));
      const zoneHigh = Number(c2.low.toFixed(2));
      if (zoneHigh - zoneLow >= 0.4) {
        let mitigated = false;
        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].low <= zoneLow) {
            mitigated = true;
            break;
          }
        }
        if (!mitigated) {
          bullish.push({
            type: 'BULLISH_FVG',
            low: zoneLow,
            high: zoneHigh,
            mid: Number(((zoneLow + zoneHigh) / 2).toFixed(2)),
            time: c2.time,
          });
        }
      }
    }

    // Bearish FVG: High[i] < Low[i-2]
    if (c2.high < c0.low) {
      const zoneLow = Number(c2.high.toFixed(2));
      const zoneHigh = Number(c0.low.toFixed(2));
      if (zoneHigh - zoneLow >= 0.4) {
        let mitigated = false;
        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].high >= zoneHigh) {
            mitigated = true;
            break;
          }
        }
        if (!mitigated) {
          bearish.push({
            type: 'BEARISH_FVG',
            low: zoneLow,
            high: zoneHigh,
            mid: Number(((zoneLow + zoneHigh) / 2).toFixed(2)),
            time: c2.time,
          });
        }
      }
    }
  }

  return { bullish, bearish };
}

/**
 * Unmitigated Order Block detector:
 * Opposing candle immediately preceding displacement > 1.2 * ATR(14).
 */
export function detectOrderBlocks(candles, atr) {
  if (!Array.isArray(candles) || candles.length < 10) return { demand: [], supply: [] };
  const start = Math.max(1, candles.length - 60);
  const demand = [];
  const supply = [];

  for (let i = start; i < candles.length - 1; i++) {
    const ob = candles[i - 1];
    const disp = candles[i];
    const dispBody = Math.abs(disp.close - disp.open);
    const dispRange = disp.high - disp.low;
    const isDisplacement = dispBody >= atr * 1.05 || dispRange >= atr * 1.45;
    if (!isDisplacement) continue;

    // Bullish displacement -> bearish OB candle precedes
    if (disp.close > disp.open && ob.close < ob.open && disp.close > ob.high) {
      const zoneLow = Number(ob.low.toFixed(2));
      const zoneHigh = Number(ob.open.toFixed(2));
      let mitigated = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].close < zoneLow) {
          mitigated = true;
          break;
        }
      }
      if (!mitigated) {
        demand.push({
          type: 'DEMAND_OB',
          low: zoneLow,
          high: zoneHigh,
          mid: Number(((zoneLow + zoneHigh) / 2).toFixed(2)),
          time: ob.time,
        });
      }
    }

    // Bearish displacement -> bullish OB candle precedes
    if (disp.close < disp.open && ob.close > ob.open && disp.close < ob.low) {
      const zoneLow = Number(ob.open.toFixed(2));
      const zoneHigh = Number(ob.high.toFixed(2));
      let mitigated = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].close > zoneHigh) {
          mitigated = true;
          break;
        }
      }
      if (!mitigated) {
        supply.push({
          type: 'SUPPLY_OB',
          low: zoneLow,
          high: zoneHigh,
          mid: Number(((zoneLow + zoneHigh) / 2).toFixed(2)),
          time: ob.time,
        });
      }
    }
  }

  return { demand, supply };
}

export function detectCHOCH(candles, swings) {
  if (!Array.isArray(candles) || candles.length < 10) {
    return { detected: false, direction: null, breakLevel: null };
  }
  const latest = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  if (swings.swingHigh && latest.close > swings.swingHigh && prev.close <= swings.swingHigh) {
    return { detected: true, direction: 'LONG', breakLevel: swings.swingHigh };
  }
  if (swings.swingLow && latest.close < swings.swingLow && prev.close >= swings.swingLow) {
    return { detected: true, direction: 'SHORT', breakLevel: swings.swingLow };
  }
  // Recent 3-bar structural shift
  const last3 = candles.slice(-3);
  if (swings.swingHigh && last3.some((c) => c.close > swings.swingHigh)) {
    return { detected: true, direction: 'LONG', breakLevel: swings.swingHigh };
  }
  if (swings.swingLow && last3.some((c) => c.close < swings.swingLow)) {
    return { detected: true, direction: 'SHORT', breakLevel: swings.swingLow };
  }
  return { detected: false, direction: null, breakLevel: swings.swingHigh || swings.swingLow };
}

export function detectLiquiditySweep(candles, swings) {
  if (!Array.isArray(candles) || candles.length < 10) return { swept: false, direction: null, level: null };
  const priorSwings = detectSwingPoints(candles.slice(0, -4), 25);
  const recent = candles.slice(-4);
  if (priorSwings.swingLow && recent.some((c) => c.low < priorSwings.swingLow && c.close > priorSwings.swingLow)) {
    return { swept: true, direction: 'LONG', level: priorSwings.swingLow };
  }
  if (priorSwings.swingHigh && recent.some((c) => c.high > priorSwings.swingHigh && c.close < priorSwings.swingHigh)) {
    return { swept: true, direction: 'SHORT', level: priorSwings.swingHigh };
  }
  return { swept: false, direction: null, level: swings.swingLow || swings.swingHigh };
}

export function detectPriceAction(candles) {
  if (!Array.isArray(candles) || candles.length < 3) {
    return { pattern: 'NONE', dir: 'NEUTRAL', desc: 'Awaiting bar close', score: 0 };
  }
  const latest = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const range = latest.high - latest.low;
  if (range <= 0) return { pattern: 'NONE', dir: 'NEUTRAL', desc: 'Range compression', score: 0 };

  const body = Math.abs(latest.close - latest.open);
  const upperWick = latest.high - Math.max(latest.open, latest.close);
  const lowerWick = Math.min(latest.open, latest.close) - latest.low;

  if (lowerWick >= range * 0.55 && latest.close >= latest.low + range * 0.4) {
    return {
      pattern: 'BULLISH_PIN_BAR',
      dir: 'LONG',
      desc: `Bullish Pin Bar rejection at $${latest.low.toFixed(2)}`,
      score: 24,
      trigger: latest.high,
      invalidation: latest.low,
    };
  }
  if (upperWick >= range * 0.55 && latest.close <= latest.high - range * 0.4) {
    return {
      pattern: 'BEARISH_PIN_BAR',
      dir: 'SHORT',
      desc: `Bearish Pin Bar rejection at $${latest.high.toFixed(2)}`,
      score: 24,
      trigger: latest.low,
      invalidation: latest.high,
    };
  }
  if (prev.close < prev.open && latest.close > latest.open && latest.close > prev.open && latest.open <= prev.close) {
    return {
      pattern: 'BULLISH_ENGULFING',
      dir: 'LONG',
      desc: `Bullish Engulfing candle ($${latest.open.toFixed(2)} -> $${latest.close.toFixed(2)})`,
      score: 28,
      trigger: latest.high,
      invalidation: latest.low,
    };
  }
  if (prev.close > prev.open && latest.close < latest.open && latest.close < prev.open && latest.open >= prev.close) {
    return {
      pattern: 'BEARISH_ENGULFING',
      dir: 'SHORT',
      desc: `Bearish Engulfing candle ($${latest.open.toFixed(2)} -> $${latest.close.toFixed(2)})`,
      score: 28,
      trigger: latest.low,
      invalidation: latest.high,
    };
  }
  if (body >= range * 0.65) {
    const isUp = latest.close > latest.open;
    return {
      pattern: isUp ? 'BULLISH_MARUBOZU' : 'BEARISH_MARUBOZU',
      dir: isUp ? 'LONG' : 'SHORT',
      desc: `${isUp ? 'Bullish' : 'Bearish'} displacement momentum candle`,
      score: 20,
      trigger: latest.close,
      invalidation: isUp ? latest.low : latest.high,
    };
  }

  const dir = latest.close >= prev.close ? 'LONG' : 'SHORT';
  return {
    pattern: 'ORDER_FLOW_CONTINUATION',
    dir,
    desc: `Order flow ${dir.toLowerCase()} structure`,
    score: 10,
    trigger: latest.close,
    invalidation: dir === 'LONG' ? latest.low : latest.high,
  };
}

function zoneDistance(spot, zone) {
  if (!zone) return Infinity;
  if (spot >= zone.low && spot <= zone.high) return 0;
  return Math.min(Math.abs(spot - zone.low), Math.abs(spot - zone.high));
}

function buildRiskLevels(entry, dir, atr, structuralInvalidation = null) {
  const isLong = dir === 'LONG';
  const baseDist = Math.max(atr * 1.5, 3.0);
  let slDist = baseDist;
  if (structuralInvalidation != null && Number.isFinite(structuralInvalidation)) {
    const structDist = isLong ? entry - structuralInvalidation : structuralInvalidation - entry;
    if (structDist >= atr * 0.9 && structDist <= atr * 2.5) {
      slDist = Math.max(structDist + atr * 0.25, baseDist);
    }
  }
  slDist = Number(slDist.toFixed(2));
  const sl = Number((isLong ? entry - slDist : entry + slDist).toFixed(2));
  const tp1 = Number((isLong ? entry + slDist * 2.0 : entry - slDist * 2.0).toFixed(2));
  const tp2 = Number((isLong ? entry + slDist * 3.5 : entry - slDist * 3.5).toFixed(2));
  const tp3 = Number((isLong ? entry + slDist * 6.0 : entry - slDist * 6.0).toFixed(2));
  return { sl, tp1, tp2, tp3, rr: 2.0, rrTp2: 3.5, slDist };
}

function computePillars({ direction, instPoints, macroSnapshot, ema9, ema15, ema50, rsi14, bb, spot }) {
  const isLong = direction === 'LONG';
  const inst = Math.min(97, Math.max(52, Math.round(52 + instPoints)));

  // Macro pillar from live DXY / 10Y / Real Yield
  let macro = 68;
  if (macroSnapshot) {
    if (macroSnapshot.dxy_change_pct != null) {
      macro += isLong
        ? (macroSnapshot.dxy_change_pct < 0 ? 12 : -8)
        : (macroSnapshot.dxy_change_pct > 0 ? 12 : -8);
    }
    if (macroSnapshot.us10y_change_bps != null) {
      macro += isLong
        ? (macroSnapshot.us10y_change_bps <= 0 ? 8 : -6)
        : (macroSnapshot.us10y_change_bps > 0 ? 8 : -6);
    }
    if (macroSnapshot.real_yield_est != null) {
      if (isLong && macroSnapshot.real_yield_est < 2.2) macro += 4;
      if (!isLong && macroSnapshot.real_yield_est > 2.2) macro += 4;
    }
  }
  macro = Math.min(96, Math.max(45, Math.round(macro)));

  // Technical pillar from EMA 9/15/50 + RSI + Bollinger
  let tech = 60;
  if (ema9 != null && ema15 != null) {
    if ((isLong && ema9 > ema15) || (!isLong && ema9 < ema15)) tech += 16;
  }
  if (ema50 != null) {
    if ((isLong && spot > ema50) || (!isLong && spot < ema50)) tech += 10;
  }
  if (isLong && rsi14 >= 45 && rsi14 <= 68) tech += 8;
  else if (!isLong && rsi14 <= 55 && rsi14 >= 32) tech += 8;
  if (bb?.squeeze || (isLong && bb?.breakout === 'UPPER') || (!isLong && bb?.breakout === 'LOWER')) tech += 4;
  tech = Math.min(97, Math.max(48, Math.round(tech)));

  const total = Math.min(97, Math.max(50, Math.round(inst * 0.5 + macro * 0.3 + tech * 0.2)));
  return { total, inst, macro, tech };
}

/**
 * Analyze a single timeframe's OHLCV candles deterministically.
 */
export function analyzeTimeframe(tf, candles, spotInput, macroSnapshot = null, nowIso = new Date().toISOString()) {
  if (!Array.isArray(candles) || candles.length < 25) {
    return { tf, liveSignals: [], futureSetups: [], summary: null };
  }

  const spot = Number((spotInput ?? candles[candles.length - 1].close).toFixed(2));
  const atr14 = computeATR(candles, 14);
  const rsi14 = computeRSI(candles, 14);
  const bb = computeBollingerBands(candles, 20, 2);

  const ema9Arr = computeEMASeries(candles, 9);
  const ema15Arr = computeEMASeries(candles, 15);
  const ema50Arr = computeEMASeries(candles, 50);
  const ema200Arr = computeEMASeries(candles, 200);

  const ema9 = ema9Arr[ema9Arr.length - 1]?.value ?? null;
  const ema15 = ema15Arr[ema15Arr.length - 1]?.value ?? null;
  const prevEma9 = ema9Arr[ema9Arr.length - 2]?.value ?? null;
  const prevEma15 = ema15Arr[ema15Arr.length - 2]?.value ?? null;
  const ema50 = ema50Arr[ema50Arr.length - 1]?.value ?? null;
  const ema200 = ema200Arr[ema200Arr.length - 1]?.value ?? null;

  const emaTrend = ema9 != null && ema15 != null ? (ema9 > ema15 ? 'BULLISH' : 'BEARISH') : 'NEUTRAL';
  let emaCross = null;
  if (prevEma9 != null && prevEma15 != null && ema9 != null && ema15 != null) {
    if (prevEma9 <= prevEma15 && ema9 > ema15) emaCross = 'BULLISH_CROSS';
    else if (prevEma9 >= prevEma15 && ema9 < ema15) emaCross = 'BEARISH_CROSS';
  }

  const swings = detectSwingPoints(candles, 30);
  const fvgs = detectUnmitigatedFVGs(candles);
  const obs = detectOrderBlocks(candles, atr14);
  const choch = detectCHOCH(candles, swings);
  const liqSweep = detectLiquiditySweep(candles, swings);
  const pa = detectPriceAction(candles);

  const bucketTs = Math.floor(Date.now() / (5 * 60 * 1000)) * (5 * 60);
  const liveSignals = [];
  const futureSetups = [];

  const nearestDemandOB = obs.demand.slice().sort((a, b) => zoneDistance(spot, a) - zoneDistance(spot, b))[0] || null;
  const nearestSupplyOB = obs.supply.slice().sort((a, b) => zoneDistance(spot, a) - zoneDistance(spot, b))[0] || null;
  const nearestBullFVG = fvgs.bullish.slice().sort((a, b) => zoneDistance(spot, a) - zoneDistance(spot, b))[0] || null;
  const nearestBearFVG = fvgs.bearish.slice().sort((a, b) => zoneDistance(spot, a) - zoneDistance(spot, b))[0] || null;

  const indicatorsBase = {
    ema9,
    ema15,
    ema50,
    ema200,
    ema_trend: emaTrend,
    ema_cross: emaCross,
    atr14,
    rsi14,
    bb_bandwidth_pct: bb.bandwidthPct,
    bb_squeeze: bb.squeeze,
    fvg: nearestBullFVG ? [nearestBullFVG.low, nearestBullFVG.high] : (nearestBearFVG ? [nearestBearFVG.low, nearestBearFVG.high] : null),
    ob: nearestDemandOB ? [nearestDemandOB.low, nearestDemandOB.high] : (nearestSupplyOB ? [nearestSupplyOB.low, nearestSupplyOB.high] : null),
    choch: choch.detected ? { direction: choch.direction, level: choch.breakLevel } : null,
    swing_high: swings.swingHigh,
    swing_low: swings.swingLow,
    price_action: pa.pattern,
  };

  // Evaluate LIVE confluence per direction
  for (const dir of ['LONG', 'SHORT']) {
    const isLong = dir === 'LONG';
    const emaAligned = (isLong && emaTrend === 'BULLISH') || (!isLong && emaTrend === 'BEARISH');
    if (!emaAligned && !(choch.detected && choch.direction === dir)) continue;

    const ob = isLong ? nearestDemandOB : nearestSupplyOB;
    const fvg = isLong ? nearestBullFVG : nearestBearFVG;
    const obDist = zoneDistance(spot, ob);
    const fvgDist = zoneDistance(spot, fvg);
    const emaDist = ema9 != null ? Math.abs(spot - ema9) : Infinity;

    const inConfluenceZone =
      obDist <= atr14 * 0.35 ||
      fvgDist <= atr14 * 0.35 ||
      (emaAligned && emaDist <= atr14 * 0.45 && (pa.dir === dir || emaCross != null || choch.direction === dir || liqSweep.direction === dir));

    if (!inConfluenceZone) continue;

    const factors = [];
    let instPts = 0;

    if (emaAligned) {
      factors.push(`EMA 9 ($${ema9}) ${isLong ? '>' : '<'} EMA 15 ($${ema15})`);
      instPts += 14;
    }
    if (emaCross === (isLong ? 'BULLISH_CROSS' : 'BEARISH_CROSS')) {
      factors.push(`EMA 9/15 ${emaCross.replace('_', ' ')}`);
      instPts += 10;
    }
    if (obDist <= atr14 * 0.35 && ob) {
      factors.push(`${tf} ${isLong ? 'Demand' : 'Supply'} OB [$${ob.low}–$${ob.high}]`);
      instPts += 14;
    }
    if (fvgDist <= atr14 * 0.35 && fvg) {
      factors.push(`${tf} ${isLong ? 'Bullish' : 'Bearish'} FVG [$${fvg.low}–$${fvg.high}]`);
      instPts += 12;
    }
    if (choch.detected && choch.direction === dir) {
      factors.push(`${tf} CHoCH break $${choch.breakLevel}`);
      instPts += 12;
    }
    if (liqSweep.swept && liqSweep.direction === dir) {
      factors.push(`Liquidity sweep at $${liqSweep.level}`);
      instPts += 10;
    }
    if (pa.dir === dir) {
      factors.push(pa.desc);
      instPts += 8;
    }

    const structInvalid = ob ? (isLong ? ob.low : ob.high) : (pa.dir === dir ? pa.invalidation : null);
    const { sl, tp1, tp2, tp3, rr } = buildRiskLevels(spot, dir, atr14, structInvalid);
    const pillars = computePillars({ direction: dir, instPoints: instPts, macroSnapshot, ema9, ema15, ema50, rsi14, bb, spot });

    const strategy = (fvgDist <= atr14 * 0.35 && obDist <= atr14 * 0.35)
      ? 'EMA_9_15_SMC'
      : pa.dir === dir && pa.score >= 20
        ? `PA_${pa.pattern}`
        : 'EMA_9_15_Ribbon';

    liveSignals.push({
      id: `SMC-${tf}-${dir}-${bucketTs}`,
      source: 'SMC_ENGINE',
      status: 'LIVE',
      pair: 'XAU/USD',
      direction: dir,
      timeframe: tf,
      strategy,
      entry_price: spot,
      stop_loss: sl,
      tp1,
      tp2,
      tp3,
      rr_ratio: rr,
      confidence: pillars.total,
      confidence_inst: pillars.inst,
      confidence_macro: pillars.macro,
      confidence_tech: pillars.tech,
      distance_pips: 0.0,
      indicators_json: indicatorsBase,
      reason: `${factors.join(' + ')} | ATR(14): ${atr14} | RSI(14): ${rsi14} | 1:2 Min RR Verified`,
      opened_at: nowIso,
      updated_at: nowIso,
    });
  }

  // Evaluate FUTURE_SETUP predictions (untested zones 0.35*ATR to 4.5*ATR away)
  const minFutureDist = atr14 * 0.35;
  const maxFutureDist = Math.max(atr14 * 4.5, 18.0);

  const candidateZones = [];
  if (nearestDemandOB && nearestDemandOB.high < spot) {
    candidateZones.push({
      dir: 'LONG',
      kind: 'Demand Order Block',
      strategy: 'OB_Liquidity_Sweep',
      entry: nearestDemandOB.high,
      invalidation: nearestDemandOB.low,
      desc: `Untested ${tf} Demand OB [$${nearestDemandOB.low}–$${nearestDemandOB.high}]`,
      pts: 24,
    });
  }
  if (nearestBullFVG && nearestBullFVG.high < spot) {
    candidateZones.push({
      dir: 'LONG',
      kind: 'Bullish FVG Pullback',
      strategy: 'FVG_Pullback_EMA',
      entry: nearestBullFVG.mid,
      invalidation: nearestBullFVG.low,
      desc: `Unfilled ${tf} Bullish FVG [$${nearestBullFVG.low}–$${nearestBullFVG.high}]`,
      pts: 20,
    });
  }
  if (nearestSupplyOB && nearestSupplyOB.low > spot) {
    candidateZones.push({
      dir: 'SHORT',
      kind: 'Supply Order Block',
      strategy: 'OB_Liquidity_Sweep',
      entry: nearestSupplyOB.low,
      invalidation: nearestSupplyOB.high,
      desc: `Untested ${tf} Supply OB [$${nearestSupplyOB.low}–$${nearestSupplyOB.high}]`,
      pts: 24,
    });
  }
  if (nearestBearFVG && nearestBearFVG.low > spot) {
    candidateZones.push({
      dir: 'SHORT',
      kind: 'Bearish FVG Retest',
      strategy: 'FVG_Pullback_EMA',
      entry: nearestBearFVG.mid,
      invalidation: nearestBearFVG.high,
      desc: `Unfilled ${tf} Bearish FVG [$${nearestBearFVG.low}–$${nearestBearFVG.high}]`,
      pts: 20,
    });
  }

  // Always check key swing liquidity sweep POIs if no OB/FVG candidate is in range
  if (swings.swingLow && swings.swingLow < spot) {
    candidateZones.push({
      dir: 'LONG',
      kind: 'Swing Low Liquidity POI',
      strategy: 'ICT_Liquidity_Sweep',
      entry: swings.swingLow,
      invalidation: Number((swings.swingLow - atr14 * 1.2).toFixed(2)),
      desc: `${tf} Swing Low Liquidity Pool at $${swings.swingLow}`,
      pts: 18,
    });
  }
  if (swings.swingHigh && swings.swingHigh > spot) {
    candidateZones.push({
      dir: 'SHORT',
      kind: 'Swing High Liquidity POI',
      strategy: 'ICT_Liquidity_Sweep',
      entry: swings.swingHigh,
      invalidation: Number((swings.swingHigh + atr14 * 1.2).toFixed(2)),
      desc: `${tf} Swing High Liquidity Pool at $${swings.swingHigh}`,
      pts: 18,
    });
  }
  if (ema15 != null && Math.abs(spot - ema15) > minFutureDist) {
    const dir = spot > ema15 ? 'LONG' : 'SHORT';
    candidateZones.push({
      dir,
      kind: 'EMA 9/15 Pullback Zone',
      strategy: 'EMA_9_15_Pullback',
      entry: ema15,
      invalidation: null,
      desc: `${tf} Dynamic EMA 15 Ribbon Pullback at $${ema15} (EMA9: $${ema9})`,
      pts: 16,
    });
  }

  // Deduplicate by direction+strategy and pick closest valid future setups
  const seenFuture = new Set();
  for (const cand of candidateZones.sort((a, b) => Math.abs(a.entry - spot) - Math.abs(b.entry - spot))) {
    const absDist = Math.abs(cand.entry - spot);
    if (absDist < minFutureDist || absDist > maxFutureDist) continue;
    const key = `${cand.dir}-${cand.kind}`;
    if (seenFuture.has(key)) continue;
    seenFuture.add(key);

    const distPips = Number((absDist * 10).toFixed(1));
    const { sl, tp1, tp2, tp3, rr } = buildRiskLevels(cand.entry, cand.dir, atr14, cand.invalidation);
    const pillars = computePillars({
      direction: cand.dir,
      instPoints: cand.pts,
      macroSnapshot,
      ema9,
      ema15,
      ema50,
      rsi14,
      bb,
      spot: cand.entry,
    });

    futureSetups.push({
      id: `SMC-${tf}-PENDING-${cand.dir}-${seenFuture.size}-${bucketTs}`,
      source: 'SMC_ENGINE',
      status: 'FUTURE_SETUP',
      pair: 'XAU/USD',
      direction: cand.dir,
      timeframe: tf,
      strategy: cand.strategy,
      entry_price: Number(cand.entry.toFixed(2)),
      stop_loss: sl,
      tp1,
      tp2,
      tp3,
      rr_ratio: rr,
      confidence: pillars.total,
      confidence_inst: pillars.inst,
      confidence_macro: pillars.macro,
      confidence_tech: pillars.tech,
      distance_pips: distPips,
      indicators_json: indicatorsBase,
      reason: `${cand.desc} ahead at $${cand.entry.toFixed(2)} (${distPips} pips ${cand.entry > spot ? 'above' : 'below'} spot); awaiting zone tap + ${tf} rejection`,
      opened_at: nowIso,
      updated_at: nowIso,
    });

    if (futureSetups.length >= 3) break;
  }

  return {
    tf,
    liveSignals,
    futureSetups,
    summary: {
      timeframe: tf,
      spot,
      ...indicatorsBase,
      candles_analyzed: candles.length,
    },
  };
}

/**
 * Scan M5, M15, H1, H4 OHLCV bundles into unified LIVE & FUTURE_SETUP payloads.
 */
export function scanMultiTimeframe(ohlcvByTf, macroSnapshot = null, primaryTf = 'M15') {
  const nowIso = new Date().toISOString();
  const allLive = [];
  const allFuture = [];
  const summaries = {};
  let latestSpot = null;

  for (const tf of ['M5', 'M15', 'H1', 'H4']) {
    const bundle = ohlcvByTf[tf];
    if (!bundle || !Array.isArray(bundle.candles) || bundle.candles.length < 25) continue;
    if (latestSpot == null) latestSpot = bundle.spot;
    const analysis = analyzeTimeframe(tf, bundle.candles, bundle.spot, macroSnapshot || bundle.macro, nowIso);
    summaries[tf] = analysis.summary;
    allLive.push(...analysis.liveSignals);
    allFuture.push(...analysis.futureSetups);
  }

  // Sort LIVE by timeframe priority / confidence desc, FUTURE_SETUP by closest distance
  allLive.sort((a, b) => {
    if (a.timeframe === primaryTf && b.timeframe !== primaryTf) return -1;
    if (b.timeframe === primaryTf && a.timeframe !== primaryTf) return 1;
    return b.confidence - a.confidence;
  });

  allFuture.sort((a, b) => (a.distance_pips ?? 9999) - (b.distance_pips ?? 9999));

  return {
    spot_price: latestSpot,
    updated_at: nowIso,
    live_signals: allLive.slice(0, 6),
    future_setups: allFuture.slice(0, 8),
    summaries,
  };
}

/**
 * Resolve any previously persisted LIVE SMC_ENGINE signals chronologically
 * against M5 candles completed after `opened_at` and current spot price.
 */
export function resolveOpenSmcSignals(openSignals, candlesOrCandle, currentSpot = null) {
  if (!Array.isArray(openSignals)) return [];
  const candles = Array.isArray(candlesOrCandle)
    ? candlesOrCandle
    : (candlesOrCandle ? [candlesOrCandle] : []);
  if (candles.length === 0 && currentSpot == null) return [];

  const updates = [];
  const nowIso = new Date().toISOString();

  for (const sig of openSignals) {
    if (sig.status !== 'LIVE') continue;
    const isLong = sig.direction === 'LONG';
    const entry = Number(sig.entry_price);
    const sl = Number(sig.stop_loss);
    const tp1 = Number(sig.tp1);
    const tp2 = sig.tp2 ? Number(sig.tp2) : null;
    const tp3 = sig.tp3 ? Number(sig.tp3) : null;
    const openedSec = Math.floor(new Date(sig.opened_at).getTime() / 1000);

    // Check candles from signal open onward, plus synthetic current spot bar
    const barsToCheck = candles.filter((c) => Number.isFinite(openedSec) ? c.time >= openedSec : true);
    if (Number.isFinite(currentSpot) && currentSpot > 0) {
      barsToCheck.push({ high: currentSpot, low: currentSpot, close: currentSpot, time: Math.floor(Date.now() / 1000) });
    }

    let newStatus = null;
    let closePrice = null;
    let closedAtIso = nowIso;

    for (const bar of barsToCheck) {
      if (isLong) {
        if (bar.low <= sl) {
          newStatus = 'HIT_SL';
          closePrice = sl;
        } else if (tp3 && bar.high >= tp3) {
          newStatus = 'HIT_TP3';
          closePrice = tp3;
        } else if (tp2 && bar.high >= tp2) {
          newStatus = 'HIT_TP2';
          closePrice = tp2;
        } else if (bar.high >= tp1) {
          newStatus = 'HIT_TP1';
          closePrice = tp1;
        }
      } else {
        if (bar.high >= sl) {
          newStatus = 'HIT_SL';
          closePrice = sl;
        } else if (tp3 && bar.low <= tp3) {
          newStatus = 'HIT_TP3';
          closePrice = tp3;
        } else if (tp2 && bar.low <= tp2) {
          newStatus = 'HIT_TP2';
          closePrice = tp2;
        } else if (bar.low <= tp1) {
          newStatus = 'HIT_TP1';
          closePrice = tp1;
        }
      }

      if (newStatus) {
        if (bar.time) closedAtIso = new Date(bar.time * 1000).toISOString();
        break;
      }
    }

    if (newStatus) {
      const pips = isLong ? (closePrice - entry) * 10 : (entry - closePrice) * 10;
      updates.push({
        ...sig,
        status: newStatus,
        close_price: Number(closePrice.toFixed(2)),
        pips_result: Number(pips.toFixed(1)),
        closed_at: closedAtIso,
        updated_at: nowIso,
      });
    }
  }

  return updates;
}
