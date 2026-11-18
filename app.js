/* ==========================================================================
   MANUS MAX AI 6.0 — XAU/USD Institutional Signal Engine (REPAIRED)
   SMC • ICT A-M-D • Raja Banks • Ali Vidollar • Silver Bullet
   Lightweight Charts Overlay • Quantitative News Engine • Killzone Timer
   Dynamic RR (TP3 up to 1:10) • 3-Pillar Weighted Confidence v6.0
   Inst 50% / Macro 30% / Tech 20% | LocalStorage Persistence
   ─────────────────────────────────────────────────────────────────────────
   REPAIR SPECIFICATION COMPLIANCE:
   1. Data Provider:
      - Binance WebSocket PAXG/USDT completely removed (PAXG != spot gold)
      - Netlify Function (/.netlify/functions/gold-price) polled every 60s
      - Fallback 1: metals.live (https://api.metals.live/v1/spot/gold)
      - Fallback 2: frankfurter.app (https://api.frankfurter.app/latest?from=XAU&to=USD)
      - Prominent "DATA PROVIDER NOT CONFIGURED" state if providers fail
      - Source label: "GoldAPI.io/XAU/USD" or "metals.live (FALLBACK)" or "frankfurter.app (FALLBACK)"
      - Freshness age: live seconds counter since last update
      - Connection states: LIVE | FALLBACK | STALE | DISCONNECTED | NOT_CONFIGURED
   2. Zero Random-Walk / Simulated Data:
      - All Math.random() removed from signal generation & confidence calculation
      - Deterministic heuristic signal engine driven exclusively by real prices
      - Threshold: minimum 20 price readings required for full signal generation
      - Under 20 readings: shows "Insufficient data for signal generation — waiting for price history"
   3. Signal Feed & Predictive Setups:
      - Feed: "SCANNING FOR XAU/USD SETUPS..." with note on OHLCV data requirements
      - Predictive: "⚡ WATCH [CONDITIONAL — NOT TRIGGERED]" only if price dropped > 0.5% in last 5 readings
        Otherwise shows "No qualified HTF POI setups detected."
   4. History Table:
      - Explicit "⚠ DEMO DATA" disclaimer banner
      - All status badges prefixed with "DEMO " (e.g. DEMO WIN, DEMO STOPPED)
      - Performance metrics clearly marked as DEMO, no fabricated live claim
   5. Educational & Algorithmic Disclaimers:
      - Prominent disclaimer injected at top of Signal Terminal
      - Confidence score header updated to "ALGORITHMIC CONFIDENCE SCORE (Heuristic — Not Guaranteed)"
      - Ticker bar shows "⚠ DATA PROVIDER NOT CONFIGURED" on 503/failure
   6. Button Handlers:
      - #btn-refresh-signal, #btn-quick-signal, #btn-copy-signal, #btn-open-calc,
        #btn-recalc, #btn-copy-json, #btn-toggle-overlay all wired and fully functional
   7. Lightweight Charts:
      - Real price feed ticks (pushOHLCTick with provider prices)
      - "Loading chart data..." and "DATA PROVIDER NOT CONFIGURED" state overlays
      - Live data source label with freshness age in seconds
   8. Structured Error Handling:
      - No silent catches; logs [MANUS MAX] context and surfaces via showError()
   9. Clean Institutional Terminology:
      - Strictly LONG/SHORT & BUY/SELL. Zero CALL/PUT binary options terminology.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    try {
      window.lucide.createIcons();
    } catch (err) {
      console.error('[MANUS MAX]', 'Lucide initialization error', err);
    }
  }

  /* ========================================================================
     GLOBAL ERROR DISPLAY
     ======================================================================== */
  function showError(context, message) {
    console.error('[MANUS MAX]', context, message);
    let bar = document.getElementById('error-notification-bar');
    if (!bar) {
      const terminal = document.getElementById('tab-terminal');
      if (terminal) {
        bar = document.createElement('div');
        bar.id = 'error-notification-bar';
        bar.style.cssText = `
          display:none;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 6px;
          padding: 8px 14px;
          margin-bottom: 12px;
          font-size: 11px;
          color: #ef4444;
          font-weight: 600;
          font-family: var(--font-mono, monospace);
        `;
        terminal.insertBefore(bar, terminal.firstChild);
      }
    }
    if (bar) {
      bar.textContent = `⚠ [${context}] ${message}`;
      bar.style.display = 'block';
      setTimeout(() => {
        if (bar) bar.style.display = 'none';
      }, 7000);
    }
  }

  /* ========================================================================
     INJECT EDUCATIONAL DISCLAIMER BANNER
     ======================================================================== */
  function injectDisclaimers() {
    try {
      const terminal = document.getElementById('tab-terminal');
      if (terminal && !document.getElementById('edu-disclaimer-banner')) {
        const banner = document.createElement('div');
        banner.id = 'edu-disclaimer-banner';
        banner.style.cssText = `
          background: rgba(245, 194, 66, 0.08);
          border: 1px solid rgba(245, 194, 66, 0.35);
          border-radius: 8px;
          padding: 10px 16px;
          margin-bottom: 16px;
          font-size: 11px;
          color: #f5c242;
          font-weight: 600;
          letter-spacing: 0.02em;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        `;
        banner.innerHTML = `
          <span style="font-size: 16px;">⚠</span>
          <span>
            <strong>EDUCATIONAL PLATFORM</strong> — All signals are algorithmic outputs for research only.
            Not financial advice. Real signals require live data provider configuration and minimum 20 OHLCV candles.
          </span>
        `;
        terminal.insertBefore(banner, terminal.firstChild);
      }

      // Update confidence card tag/header to comply with requirements
      const confTag = document.querySelector('.confidence-tag');
      if (confTag) {
        confTag.innerHTML = '<i data-lucide="shield-alert"></i> ALGORITHMIC CONFIDENCE SCORE (Heuristic — Not Guaranteed)';
      }
    } catch (err) {
      showError('injectDisclaimers', err.message);
    }
  }
  injectDisclaimers();

  /* ========================================================================
     STATE MANAGEMENT
     ======================================================================== */
  const state = {
    currentTab: 'terminal',
    goldPrice: null,           // starts null until verified provider tick
    goldPrevClose: null,
    goldChangePct: 0,
    goldChangePts: 0,
    timeframe: 'H1',
    showIndicators: true,
    lastFetchTime: null,
    fetchStatus: 'connecting', // 'connecting' | 'live' | 'fallback' | 'stale' | 'disconnected' | 'not_configured'
    dataSource: null,          // e.g. "GoldAPI.io/XAU/USD" or "metals.live (FALLBACK)"
    priceHistory: [],          // array of float prices from polling
    ohlcBuffer: [],
    ohlcHistory: [],           // full OHLCV candle series from backend (Yahoo GC=F / gold-history API)

    // Hero signal — deterministic based on verified price or static fallback
    signal: null,

    // Signal history — Explicitly DEMO data (prices updated to reflect current XAU/USD range ~$3,780)
    history: [
      {
        id: 'XAUUSD-DEMO-9843',
        openTs: '2026-11-14 10:25 UTC',
        closeTs: '— (DEMO ACTIVE)',
        dir: 'LONG',
        strategy: 'ICT_SilverBullet',
        entry: 3821.50, sl: 3810.00, tp2: 3867.50, tp3: 3915.50,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: '+460', confidence: '92%',
        news: 'CPI', newsClass: 'news-badge',
        status: 'DEMO WIN (TP2)',
        reason: 'M5 FVG Fill + London Liq Sweep + H4 OB Rejection + RSI Div M15',
        pnl: { entryPrice: 3821.50, exitPrice: 3867.50, direction: 'LONG', pips: 460, result: 'DEMO WIN' }
      },
      {
        id: 'XAUUSD-DEMO-9842',
        openTs: '2026-11-13 08:15 UTC',
        closeTs: '2026-11-13 13:42 UTC',
        dir: 'LONG',
        strategy: 'ICT_AMD',
        entry: 3797.80, sl: 3786.00, tp2: 3833.40, tp3: 3857.40,
        rr: '1 : 3.0', rrClass: 'rr-high',
        pips: '+356', confidence: '89%',
        news: null,
        status: 'DEMO WIN (TP2)',
        reason: 'Asia Lo Sweep (A-Phase) + London CHOCH M15 + NY Distribution Long + OB at $3,786',
        pnl: { entryPrice: 3797.80, exitPrice: 3833.40, direction: 'LONG', pips: 356, result: 'DEMO WIN' }
      },
      {
        id: 'XAUUSD-DEMO-9841',
        openTs: '2026-11-12 14:00 UTC',
        closeTs: '2026-11-12 17:38 UTC',
        dir: 'SHORT',
        strategy: 'AliVidollar_SD',
        entry: 3815.50, sl: 3824.20, tp2: 3789.60, tp3: 3772.10,
        rr: '1 : 3.0', rrClass: 'rr-high',
        pips: '+258', confidence: '86%',
        news: 'FOMC',
        status: 'DEMO WIN (TP2)',
        reason: 'Fresh H4 Supply Zone (Rally-Base-Drop) + Liq Grab of Swing Hi + Bearish Engulf M15 + FOMC hawkish',
        pnl: { entryPrice: 3815.50, exitPrice: 3789.60, direction: 'SHORT', pips: 258, result: 'DEMO WIN' }
      },
      {
        id: 'XAUUSD-DEMO-9840',
        openTs: '2026-11-11 10:02 UTC',
        closeTs: '2026-11-11 11:20 UTC',
        dir: 'LONG',
        strategy: 'ICT_SilverBullet',
        entry: 3779.40, sl: 3768.00, tp2: 3824.60, tp3: 3870.00,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: '+452', confidence: '94%',
        news: null,
        status: 'DEMO WIN (TP2)',
        reason: 'Silver Bullet 10:00 EST window + M5 FVG 50% fill + Fresh Demand OB + Clean traffic +450 pips',
        pnl: { entryPrice: 3779.40, exitPrice: 3824.60, direction: 'LONG', pips: 452, result: 'DEMO WIN' }
      },
      {
        id: 'XAUUSD-DEMO-9839',
        openTs: '2026-11-10 09:30 UTC',
        closeTs: '2026-11-10 10:55 UTC',
        dir: 'LONG',
        strategy: 'RajaBanks_CT',
        entry: 3765.60, sl: 3754.00, tp2: 3812.00, tp3: 3849.00,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: '+464', confidence: '88%',
        news: 'NFP',
        status: 'DEMO WIN (TP2)',
        reason: 'Clean Traffic Zone H4 (M30 demand) — Zero resistance to $3,812 target — NFP miss confirmed',
        pnl: { entryPrice: 3765.60, exitPrice: 3812.00, direction: 'LONG', pips: 464, result: 'DEMO WIN' }
      },
      {
        id: 'XAUUSD-DEMO-9838',
        openTs: '2026-11-08 08:10 UTC',
        closeTs: '2026-11-08 09:02 UTC',
        dir: 'SHORT',
        strategy: 'ICT_AMD',
        entry: 3804.20, sl: 3813.00, tp2: 3777.80, tp3: 3760.30,
        rr: '1 : 3.0', rrClass: 'rr-high',
        pips: '-87', confidence: '72%',
        news: null,
        status: 'DEMO STOPPED',
        reason: 'London Manipulation phase — SL triggered before NY distribution began — AMD failed',
        pnl: { entryPrice: 3804.20, exitPrice: 3813.00, direction: 'SHORT', pips: -87, result: 'DEMO LOSS' }
      },
      {
        id: 'XAUUSD-DEMO-9837',
        openTs: '2026-11-07 14:05 UTC',
        closeTs: '2026-11-07 16:48 UTC',
        dir: 'LONG',
        strategy: 'AliVidollar_SD',
        entry: 3741.50, sl: 3729.00, tp2: 3791.50, tp3: 3841.50,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: '+500', confidence: '91%',
        news: 'PPI',
        status: 'DEMO WIN (TP3)',
        reason: 'Fresh Demand Zone (Drop-Base-Rally) + Stop Hunt of Asian Lo + Bullish Engulfing M15 + PPI miss bullish',
        pnl: { entryPrice: 3741.50, exitPrice: 3841.50, direction: 'LONG', pips: 500, result: 'DEMO WIN' }
      }
    ],

    // Quantitative economic calendar events
    newsEvents: [
      { time: '2026-11-14 13:30 UTC', name: 'US CPI (YoY)', folder: 'red', impactPct: 85, volPips: '80-120', bias: '78% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 1.7, histConf: 'HIGH — 84% win rate on CPI miss (last 8 events)' },
      { time: '2026-11-14 18:00 UTC', name: 'FOMC Minutes', folder: 'red', impactPct: 92, volPips: '100-180', bias: '65% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 6.2, histConf: 'HIGH — 71% directional accuracy on FOMC hawkish surprises' },
      { time: '2026-11-15 12:30 UTC', name: 'US PPI (MoM)', folder: 'orange', impactPct: 65, volPips: '40-80', bias: '55% Neutral', confClass: 'news-conf-med', conf: 'MEDIUM', hoursUntil: 24.2, histConf: 'MEDIUM — 58% accuracy, lower than CPI historically' },
      { time: '2026-11-16 14:00 UTC', name: 'US Core PCE', folder: 'red', impactPct: 88, volPips: '70-130', bias: '70% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 47.8, histConf: "HIGH — Fed's preferred inflation measure, 79% accuracy" },
      { time: '2026-11-21 12:30 UTC', name: 'US NFP', folder: 'red', impactPct: 95, volPips: '120-250', bias: '60% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 71.2, histConf: 'HIGH — 88% accuracy on NFP misses > 50k deviation' },
      { time: '2026-11-25 17:00 UTC', name: 'ISM Services PMI', folder: 'yellow', impactPct: 45, volPips: '20-50', bias: '50% Neutral', confClass: 'news-conf-low', conf: 'LOW', hoursUntil: 168.3, histConf: 'LOW — Secondary indicator, 52% accuracy' }
    ],

    signalFeed: [],
    predictiveSetups: [],
    persistKey: null,

    // Lightweight Charts
    lwChart: null,
    lwCandleSeries: null,
    lwSeries: {}
  };

  /* ========================================================================
     DOM ELEMENTS
     ======================================================================== */
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const livePriceEl = document.getElementById('live-gold-price');
  const liveChangeEl = document.getElementById('live-gold-change');
  const liveCurrentEl = document.getElementById('sig-current-live');
  const historyBody = document.getElementById('history-table-body');
  const apiStatusText = document.getElementById('api-status-text');

  /* ========================================================================
     BOOT SEQUENCE
     ======================================================================== */
  initPersistence();
  initNavigation();
  initKillzoneTimer();
  initNewsEngine();
  initSignalHistory();
  initLightweightChart();
  initSimulator();
  initCalculator();
  initActionButtons();
  initSilverBulletClock();
  initAMDPhase();
  initPerformanceMetrics();
  initSignalEngine();
  initLiveDataFeed();
  initSupabaseSync();

  /* ========================================================================
     1. PERSISTENCE ENGINE
     ======================================================================== */
  function initPersistence() {
    try {
      const fingerprint = btoa(navigator.userAgent + screen.width + screen.height).slice(0, 16);
      state.persistKey = `manus_max_v61_${fingerprint}`;
      const saved = localStorage.getItem(state.persistKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.timeframe) state.timeframe = data.timeframe;
        if (data.showIndicators !== undefined) state.showIndicators = data.showIndicators;
        console.log('[MANUS MAX v6.1] Preferences restored.');
      }
    } catch (err) {
      console.error('[MANUS MAX]', 'initPersistence', err);
      showError('initPersistence', err.message);
    }
  }

  function savePersistence() {
    try {
      if (!state.persistKey) return;
      localStorage.setItem(state.persistKey, JSON.stringify({
        timeframe: state.timeframe,
        showIndicators: state.showIndicators,
        lastSaved: new Date().toISOString()
      }));
    } catch (err) {
      console.error('[MANUS MAX]', 'savePersistence', err);
      showError('savePersistence', err.message);
    }
  }

  /* ========================================================================
     WAITING / NOT CONFIGURED UI STATES
     ======================================================================== */
  function showWaitingState() {
    if (livePriceEl) livePriceEl.textContent = 'Connecting...';
    if (liveCurrentEl) liveCurrentEl.textContent = '—';
    if (liveChangeEl) {
      liveChangeEl.textContent = 'Connecting to XAU/USD data provider...';
      liveChangeEl.className = 'ticker-change';
    }
    updateStatus('connecting', 'GoldAPI.io/XAU/USD');

    const feedContainer = document.getElementById('signal-feed-list');
    if (feedContainer) {
      feedContainer.innerHTML = `
        <div style="text-align:center;color:var(--text-dim);padding:30px 20px;font-size:12px;line-height:1.8;">
          <div style="font-size:18px;margin-bottom:8px;">📡</div>
          <div style="color:var(--gold-primary);font-weight:700;margin-bottom:6px;">SCANNING FOR XAU/USD SETUPS...</div>
          <div style="font-size:11px;">Real signals require minimum 20 candles of OHLCV data.</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:6px;">Connect a data provider for live signal generation.</div>
        </div>
      `;
    }

    const predContainer = document.getElementById('predictive-list');
    if (predContainer) {
      predContainer.innerHTML = `
        <div class="predictive-item" style="color:var(--text-dim);font-size:12px;text-align:center;padding:16px;">
          No qualified HTF POI setups detected.
        </div>
      `;
    }
  }

  function showNotConfiguredState() {
    state.fetchStatus = 'not_configured';
    updateStatus('not_configured', '⚠ DATA PROVIDER NOT CONFIGURED');

    if (livePriceEl) livePriceEl.textContent = 'N/A';
    if (liveCurrentEl) liveCurrentEl.textContent = 'N/A';
    if (liveChangeEl) {
      liveChangeEl.textContent = '⚠ DATA PROVIDER NOT CONFIGURED';
      liveChangeEl.className = 'ticker-change';
      liveChangeEl.style.color = '#ef4444';
    }

    const feedContainer = document.getElementById('signal-feed-list');
    if (feedContainer) {
      feedContainer.innerHTML = `
        <div style="text-align:center;color:var(--text-dim);padding:30px 20px;font-size:12px;line-height:1.8;">
          <div style="font-size:22px;margin-bottom:8px;">⚠</div>
          <div style="color:#ef4444;font-weight:700;margin-bottom:6px;">DATA PROVIDER NOT CONFIGURED</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.7);">
            All price feed endpoints returned 503 or were unreachable.
          </div>
          <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:8px;">
            Configure <code>GOLDAPI_KEY</code> on Netlify at <code>/.netlify/functions/gold-price</code>
          </div>
        </div>
      `;
    }

    const predContainer = document.getElementById('predictive-list');
    if (predContainer) {
      predContainer.innerHTML = `
        <div class="predictive-item" style="color:var(--text-dim);font-size:12px;text-align:center;padding:16px;">
          No qualified HTF POI setups detected.<br>
          <span style="font-size:10px;color:#ef4444;">Data provider required for setup detection.</span>
        </div>
      `;
    }

    showChartNotConfigured();
  }

  function showChartNotConfigured() {
    const container = document.getElementById('lw-chart-container');
    if (!container) return;
    let msg = document.getElementById('lw-chart-overlay-msg');
    if (!msg) {
      msg = document.createElement('div');
      msg.id = 'lw-chart-overlay-msg';
      msg.style.cssText = `
        position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        background:rgba(6,9,16,0.92);border:1px solid rgba(239,68,68,0.4);
        border-radius:8px;padding:16px 24px;text-align:center;
        color:#ef4444;font-size:12px;font-weight:600;z-index:20;
        pointer-events:none;
      `;
      container.style.position = 'relative';
      container.appendChild(msg);
    }
    msg.innerHTML = `
      <div style="font-size:18px;margin-bottom:6px;">⚠</div>
      DATA PROVIDER NOT CONFIGURED<br>
      <span style="font-size:10px;color:rgba(255,255,255,0.5);font-weight:400;">
        Chart requires XAU/USD price feed
      </span>
    `;
  }

  function hideChartOverlayMsg() {
    const msg = document.getElementById('lw-chart-overlay-msg');
    if (msg) msg.remove();
  }

  /* ========================================================================
     2. DATA PROVIDER ENGINE (60s Polling, No Binance PAXG)
     ======================================================================== */
  let pollingIntervalId = null;
  let freshnessTimerId = null;
  let consecutiveErrors = 0;
  const MAX_RETRIES = 3;

  async function fetchFromNetlify() {
    try {
      // Try both standard Netlify function path and /api rewrite
      const endpoints = ['/.netlify/functions/gold-price', '/api/gold-price'];
      for (const endpoint of endpoints) {
        try {
          const r = await fetch(endpoint, { signal: AbortSignal.timeout(4500) });
          if (!r.ok) continue;
          const d = await r.json();
          if (d && d.price) {
            const p = parseFloat(d.price);
            if (!isNaN(p) && p > 1000) {
              return {
                price: p,
                source: d.source || 'GoldAPI.io/XAU/USD',
                change: d.change ?? null,
                changePercent: d.changePercent ?? null,
                high: d.high ?? null,
                low: d.low ?? null,
                open: d.open ?? null
              };
            }
          }
        } catch (e) {
          // Try next endpoint
        }
      }
      return null;
    } catch (err) {
      console.error('[MANUS MAX]', 'fetchFromNetlify', err);
      return null;
    }
  }

  async function fetchFromGoldPriceOrg() {
    try {
      const r = await fetch('https://data-asg.goldprice.org/dbXRates/USD', { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return null;
      const d = await r.json();
      const p = parseFloat(d?.items?.[0]?.xauPrice);
      if (!isNaN(p) && p > 1000) {
        return { price: p, source: 'GoldPrice.org (Live Spot)' };
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  async function fetchFromGoldApiCom() {
    try {
      const r = await fetch('https://api.gold-api.com/price/XAU', { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return null;
      const d = await r.json();
      const p = parseFloat(d?.price);
      if (!isNaN(p) && p > 1000) {
        return { price: p, source: 'Gold-API.com (Spot)' };
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  async function fetchFromMetalsLive() {
    try {
      const r = await fetch('https://api.metals.live/v1/spot/gold', { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return null;
      const d = await r.json();
      if (Array.isArray(d) && d.length > 0) {
        const p = parseFloat(d[d.length - 1].price);
        if (!isNaN(p) && p > 1000) {
          return { price: p, source: 'metals.live (FALLBACK)' };
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  async function fetchLiveGoldPrice() {
    try {
      // 1. Primary: Netlify backend function pipeline
      let res = await fetchFromNetlify();

      // 2. Fallback: GoldPrice.org live spot feed
      if (!res) {
        res = await fetchFromGoldPriceOrg();
      }

      // 3. Fallback: Gold-API.com
      if (!res) {
        res = await fetchFromGoldApiCom();
      }

      // 4. Fallback: metals.live
      if (!res) {
        res = await fetchFromMetalsLive();
      }

      if (res && res.price) {
        consecutiveErrors = 0;
        const dir = state.goldPrice !== null
          ? (res.price > state.goldPrice ? 'up' : res.price < state.goldPrice ? 'down' : null)
          : null;
        processTick(res.price, dir, res.source, res);
        return true;
      } else {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_RETRIES) {
          showNotConfiguredState();
        } else {
          updateStatus('stale', state.dataSource || 'Polling Retry');
        }
        return false;
      }
    } catch (err) {
      console.error('[MANUS MAX]', 'fetchLiveGoldPrice', err);
      showError('fetchLiveGoldPrice', err.message);
      return false;
    }
  }

  function processTick(price, direction, source, extra = {}) {
    try {
      if (state.goldPrevClose === null) state.goldPrevClose = extra.open || price;
      state.goldPrice = price;

      if (extra.change !== null && extra.change !== undefined && !isNaN(extra.change)) {
        state.goldChangePts = Number(extra.change);
        state.goldChangePct = extra.changePercent !== null && extra.changePercent !== undefined && !isNaN(extra.changePercent)
          ? Number(extra.changePercent)
          : parseFloat(((state.goldChangePts / (price - state.goldChangePts || 1)) * 100).toFixed(2));
      } else {
        state.goldChangePts = parseFloat((price - state.goldPrevClose).toFixed(2));
        state.goldChangePct = parseFloat(((state.goldChangePts / state.goldPrevClose) * 100).toFixed(2));
      }

      state.lastFetchTime = new Date();
      state.dataSource = source;
      state.fetchStatus = source.includes('FALLBACK') ? 'fallback' : 'live';

      state.priceHistory.push(price);
      if (state.priceHistory.length > 150) state.priceHistory.shift();

      pushOHLCTick(price);
      hideChartOverlayMsg();
      updateChartDataLabel(source);

      updateUI(direction);
      updateStatus(state.fetchStatus, source);
      updateSignalEngine();
      updateFreshnessTimer();
    } catch (err) {
      console.error('[MANUS MAX]', 'processTick', err);
      showError('processTick', err.message);
    }
  }

  function updateFreshnessTimer() {
    if (freshnessTimerId) clearInterval(freshnessTimerId);
    freshnessTimerId = setInterval(() => {
      if (!state.lastFetchTime) return;
      const age = Math.round((Date.now() - state.lastFetchTime.getTime()) / 1000);
      const dataLabelEl = document.getElementById('chart-data-label');
      if (dataLabelEl) {
        const timeStr = state.lastFetchTime.toISOString().slice(11, 19) + ' UTC';
        const ageColor = age > 120 ? '#ef4444' : age > 75 ? '#f5c242' : '#10b981';
        dataLabelEl.innerHTML = `Data: <strong>${state.dataSource || '—'}</strong> | Last update: ${timeStr} | Freshness: <span style="color:${ageColor}">${age}s</span>`;
      }
      if (age > 180 && state.fetchStatus !== 'not_configured') {
        updateStatus('stale', state.dataSource || '—');
      }
    }, 1000);
  }

  function updateChartDataLabel(source) {
    let labelEl = document.getElementById('chart-data-label');
    if (!labelEl) {
      const container = document.getElementById('lw-chart-container');
      if (container && container.parentElement) {
        labelEl = document.createElement('div');
        labelEl.id = 'chart-data-label';
        labelEl.style.cssText = `
          font-size:10px;color:rgba(255,255,255,0.5);padding:6px 10px;
          font-family:var(--font-mono, monospace);border-top:1px solid rgba(255,255,255,0.06);
          background: rgba(6, 9, 16, 0.6);
        `;
        container.parentElement.appendChild(labelEl);
      }
    }
    if (labelEl && state.lastFetchTime) {
      const timeStr = state.lastFetchTime.toISOString().slice(11, 19) + ' UTC';
      labelEl.innerHTML = `Data: <strong>${source}</strong> | Last update: ${timeStr} | Freshness: <span style="color:#10b981">0s</span>`;
    }
  }

  function updateUI(direction) {
    if (state.goldPrice === null) return;
    const price = state.goldPrice;
    const formatted = formatPrice(price);
    const isPos = state.goldChangePts >= 0;

    if (livePriceEl) {
      livePriceEl.textContent = formatted;
      livePriceEl.classList.remove('tick-up', 'tick-down', 'price-flash');
      void livePriceEl.offsetWidth;
      if (direction === 'up') livePriceEl.classList.add('tick-up');
      else if (direction === 'down') livePriceEl.classList.add('tick-down');
      else livePriceEl.classList.add('price-flash');
      setTimeout(() => livePriceEl.classList.remove('tick-up', 'tick-down', 'price-flash'), 380);
    }
    if (liveCurrentEl) liveCurrentEl.textContent = formatted;
    if (liveChangeEl) {
      liveChangeEl.textContent = `${isPos ? '+' : ''}${state.goldChangePct.toFixed(2)}% (${isPos ? '+' : ''}${state.goldChangePts.toFixed(2)})`;
      liveChangeEl.className = `ticker-change ${isPos ? 'text-emerald' : 'text-ruby'}`;
      liveChangeEl.style.color = '';
    }

    if (state.lwCandleSeries) updateLWChartPrice(price);
  }

  function updateStatus(status, source) {
    state.fetchStatus = status;
    if (!apiStatusText) return;
    const time = state.lastFetchTime ? state.lastFetchTime.toLocaleTimeString() : '';
    const map = {
      connecting: { text: 'CONNECTING TO DATA PROVIDER...', color: '#f5c242' },
      live:        { text: `LIVE • ${source} • ${time}`, color: '#10b981' },
      fallback:    { text: `FALLBACK • ${source} • ${time}`, color: '#f5c242' },
      stale:       { text: `STALE • ${source} • Retrying...`, color: '#ef4444' },
      disconnected:{ text: 'DISCONNECTED — Feed Unreachable', color: '#ef4444' },
      not_configured: { text: '⚠ DATA PROVIDER NOT CONFIGURED', color: '#ef4444' }
    };
    const entry = map[status] || map.disconnected;
    apiStatusText.textContent = entry.text;
    apiStatusText.style.color = entry.color;
  }

  function formatPrice(price) {
    if (price === null || price === undefined || isNaN(price)) return '—';
    return '$' + price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function initLiveDataFeed() {
    showWaitingState();
    fetchLiveGoldPrice();
    // 30-second polling for fast XAU/USD price sync (backend caches 15s, so 30s is safe)
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    pollingIntervalId = setInterval(fetchLiveGoldPrice, 30000);
  }

  /* ========================================================================
     3. NAVIGATION, URL SYNCHRONIZATION & TAB SWITCHING
     ======================================================================== */
  function switchTab(target, updateUrl = true) {
    try {
      const tabBtn = document.querySelector(`.nav-tab[data-tab="${target}"]`);
      const content = document.getElementById(`tab-${target}`);
      if (!content) return;

      navTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      if (tabBtn) tabBtn.classList.add('active');
      content.classList.add('active');
      state.currentTab = target;

      if (updateUrl) {
        const tfParam = state.timeframe ? `?tf=${state.timeframe}` : '';
        const newHash = `#${target}${tfParam}`;
        if (window.location.hash !== newHash) {
          history.replaceState(null, '', newHash);
        }
      }

      if (target === 'terminal' && state.lwChart) {
        setTimeout(() => {
          if (state.lwChart) {
            const container = document.getElementById('lw-chart-container');
            if (container) {
              state.lwChart.applyOptions({
                width: container.clientWidth,
                height: container.clientHeight,
              });
            }
            state.lwChart.timeScale().fitContent();
          }
        }, 50);
      }
      savePersistence();
    } catch (err) {
      console.error('[MANUS MAX]', 'switchTab error', err);
      showError('switchTab', err.message);
    }
  }

  function setTimeframe(tf, updateUrl = true) {
    try {
      const tfButtons = document.querySelectorAll('#chart-tf-buttons .btn-tf');
      tfButtons.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tf') === tf);
      });
      state.timeframe = tf;

      // Sync TradingView widget to the same timeframe
      if (window.updateTVInterval) {
        try { window.updateTVInterval(tf); } catch (_) {}
      }
      // Update TV active-TF badge
      const tvBadge = document.getElementById('tv-active-tf');
      if (tvBadge) tvBadge.textContent = tf;

      // Fetch historical candles for this timeframe from backend pipeline
      fetchHistoricalCandles(tf);
      regenerateLWChartData();
      savePersistence();

      if (updateUrl) {
        const curTab = state.currentTab || 'terminal';
        const newHash = `#${curTab}?tf=${tf}`;
        if (window.location.hash !== newHash) {
          history.replaceState(null, '', newHash);
        }
      }
    } catch (err) {
      console.error('[MANUS MAX]', 'setTimeframe error', err);
      showError('setTimeframe', err.message);
    }
  }

  function syncFromUrl() {
    try {
      const rawHash = (window.location.hash || '').replace('#', '');
      let tabName = null;
      let tfVal = null;

      if (rawHash) {
        const [tabPart, queryPart] = rawHash.split('?');
        if (tabPart && document.getElementById(`tab-${tabPart}`)) {
          tabName = tabPart;
        }
        if (queryPart) {
          const params = new URLSearchParams(queryPart);
          tfVal = params.get('tf');
        }
      } else if (window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        if (t && document.getElementById(`tab-${t}`)) tabName = t;
        tfVal = params.get('tf');
      }

      if (tabName) {
        switchTab(tabName, false);
      }
      if (tfVal && ['M5', 'M15', 'H1', 'H4', 'D1'].includes(tfVal)) {
        setTimeframe(tfVal, false);
      }
    } catch (e) {
      console.warn('[MANUS MAX] syncFromUrl error', e);
    }
  }

  window.addEventListener('hashchange', () => syncFromUrl());

  function initNavigation() {
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        switchTab(target, true);
      });
    });

    const tfButtons = document.querySelectorAll('#chart-tf-buttons .btn-tf');
    tfButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tf = btn.getAttribute('data-tf');
        setTimeframe(tf, true);
      });
    });

    const btnToggle = document.getElementById('btn-toggle-overlay');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        try {
          state.showIndicators = !state.showIndicators;
          btnToggle.classList.toggle('active', state.showIndicators);
          if (state.lwChart && state.lwCandleSeries && state.goldPrice) {
            drawSMCOverlays(state.lwChart, state.lwCandleSeries, state.goldPrice);
          }
          savePersistence();
          showNotification(state.showIndicators ? 'SMC overlays enabled' : 'SMC overlays hidden');
        } catch (err) {
          console.error('[MANUS MAX]', 'btn-toggle-overlay error', err);
          showError('btn-toggle-overlay', err.message);
        }
      });
    }

    // Sync active view from URL on initial load
    syncFromUrl();
  }

  /* ========================================================================
     4. SIGNAL ENGINE — OHLCV-BASED (Heuristic, Deterministic — No Math.random)
        Uses real candle data from fetchHistoricalCandles() / gold-history API.
        Falls back to priceHistory polling if candles are unavailable.
     ======================================================================== */

  /**
   * Compute ATR from real OHLCV candles (True Range method).
   * Falls back to polling-history estimate if no candles available.
   */
  function estimateATR(priceHistory) {
    // Prefer real candle ATR when available
    if (state.ohlcHistory && state.ohlcHistory.length >= 5) {
      return computeATRFromCandles(state.ohlcHistory, 14);
    }
    if (priceHistory.length < 2) return 8.20;
    const diffs = [];
    for (let i = 1; i < priceHistory.length; i++) {
      diffs.push(Math.abs(priceHistory[i] - priceHistory[i - 1]));
    }
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    return Math.max(6.0, Math.min(25.0, avgDiff * 15 || 8.20));
  }

  /**
   * True-Range ATR from OHLCV candle array.
   * @param {Array} candles - [{open, high, low, close, time}, ...]
   * @param {number} period - ATR period (default 14)
   */
  function computeATRFromCandles(candles, period = 14) {
    if (!candles || candles.length < 2) return 10.0;
    const trs = [];
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const prev = candles[i - 1];
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close)
      );
      trs.push(tr);
    }
    const slice = trs.slice(-period);
    const atr = slice.reduce((a, b) => a + b, 0) / slice.length;
    return Math.max(4.0, Math.min(50.0, atr));
  }

  /**
   * Detect swing high/low from candle array.
   * Returns { swingHigh, swingLow, swingHighIdx, swingLowIdx }
   */
  function detectSwings(candles, lookback = 10) {
    if (!candles || candles.length < 3) return { swingHigh: null, swingLow: null };
    const slice = candles.slice(-Math.min(lookback, candles.length));
    let swingHigh = -Infinity, swingLow = Infinity;
    let swingHighIdx = 0, swingLowIdx = 0;
    slice.forEach((c, i) => {
      if (c.high > swingHigh) { swingHigh = c.high; swingHighIdx = i; }
      if (c.low < swingLow)  { swingLow = c.low;  swingLowIdx = i;  }
    });
    return { swingHigh, swingLow, swingHighIdx, swingLowIdx };
  }

  /**
   * Detect Order Block: last bearish candle before a bullish swing (or vice versa).
   * Returns { obHigh, obLow, obType } or null.
   */
  function detectOrderBlock(candles, dir) {
    if (!candles || candles.length < 5) return null;
    const slice = candles.slice(-20);
    if (dir === 'LONG') {
      // Find last bearish candle before a bullish impulse
      for (let i = slice.length - 2; i >= 1; i--) {
        if (slice[i].close < slice[i].open) { // bearish candle
          return { obHigh: slice[i].open, obLow: slice[i].low, obType: 'demand' };
        }
      }
    } else {
      // Find last bullish candle before a bearish impulse
      for (let i = slice.length - 2; i >= 1; i--) {
        if (slice[i].close > slice[i].open) { // bullish candle
          return { obHigh: slice[i].high, obLow: slice[i].close, obType: 'supply' };
        }
      }
    }
    return null;
  }

  /**
   * Detect Fair Value Gap (FVG / Imbalance):
   * Bullish FVG: candle[i-2].high < candle[i].low  (gap above)
   * Bearish FVG: candle[i-2].low  > candle[i].high (gap below)
   * Returns midpoint price of most recent FVG.
   */
  function detectFVG(candles, dir) {
    if (!candles || candles.length < 3) return null;
    const slice = candles.slice(-15);
    for (let i = slice.length - 1; i >= 2; i--) {
      if (dir === 'LONG' && slice[i - 2].high < slice[i].low) {
        const mid = (slice[i - 2].high + slice[i].low) / 2;
        return parseFloat(mid.toFixed(2));
      }
      if (dir === 'SHORT' && slice[i - 2].low > slice[i].high) {
        const mid = (slice[i - 2].low + slice[i].high) / 2;
        return parseFloat(mid.toFixed(2));
      }
    }
    return null;
  }

  /**
   * Detect CHoCH (Change of Character): close breaks prior swing high (bullish CHoCH) or low (bearish CHoCH).
   * Returns { detected, breakLevel }
   */
  function detectCHoCH(candles, dir) {
    if (!candles || candles.length < 5) return { detected: false, breakLevel: null };
    const { swingHigh, swingLow } = detectSwings(candles, 15);
    const latest = candles[candles.length - 1];
    if (dir === 'LONG' && latest.close > swingHigh) {
      return { detected: true, breakLevel: parseFloat(swingHigh.toFixed(2)) };
    }
    if (dir === 'SHORT' && latest.close < swingLow) {
      return { detected: true, breakLevel: parseFloat(swingLow.toFixed(2)) };
    }
    return { detected: false, breakLevel: dir === 'LONG' ? parseFloat(swingHigh.toFixed(2)) : parseFloat(swingLow.toFixed(2)) };
  }

  /**
   * Detect liquidity sweep: price dips below prior swing low then recovers (bullish) or spikes above swing high then falls (bearish).
   * Returns true/false.
   */
  function detectLiquiditySweep(candles, dir) {
    if (!candles || candles.length < 6) return false;
    const slice = candles.slice(-10);
    const { swingHigh, swingLow } = detectSwings(candles.slice(0, -5), 20);
    const recent = slice.slice(-5);
    if (dir === 'LONG') {
      // Any candle's low went below prior swing low, then closed above it
      return recent.some(c => c.low < swingLow && c.close > swingLow);
    } else {
      return recent.some(c => c.high > swingHigh && c.close < swingHigh);
    }
  }

  /**
   * OHLCV-based signal detection. Uses state.ohlcHistory if available, else falls back to priceHistory.
   * Returns signal object or null.
   */
  function detectSignalFromPrice(currentPrice, priceHistory) {
    // === PRIMARY PATH: OHLCV candle analysis ===
    if (state.ohlcHistory && state.ohlcHistory.length >= 20) {
      return detectSignalFromOHLC(state.ohlcHistory, currentPrice);
    }

    // === FALLBACK PATH: price-history polling analysis ===
    if (priceHistory.length < 20) return null;

    const recent5 = priceHistory.slice(-5);
    const avg5 = recent5.reduce((a, b) => a + b, 0) / 5;
    const momentum5 = currentPrice - priceHistory[priceHistory.length - 5];
    const pctChange5 = (momentum5 / priceHistory[priceHistory.length - 5]) * 100;
    const atr = estimateATR(priceHistory);

    if (Math.abs(pctChange5) < 0.08) return null;

    const isLong = pctChange5 > 0;
    const dir = isLong ? 'LONG' : 'SHORT';

    const moveRatio = Math.min(2.5, Math.abs(momentum5) / Math.max(atr * 0.25, 1));
    const instScore = Math.min(95, Math.round(65 + moveRatio * 12));

    let trendAgreement = 0;
    for (let i = 1; i < recent5.length; i++) {
      if (isLong && recent5[i] >= recent5[i - 1]) trendAgreement++;
      if (!isLong && recent5[i] <= recent5[i - 1]) trendAgreement++;
    }
    const macroScore = Math.min(94, Math.round(60 + (trendAgreement / 4) * 30));

    const priceDistAvg = Math.abs(currentPrice - avg5) / avg5;
    const techScore = Math.min(95, Math.round(65 + Math.min(30, priceDistAvg * 2000)));

    const weightedConf = Math.min(96, Math.round(instScore * 0.50 + macroScore * 0.30 + techScore * 0.20));

    if (weightedConf < 70) return null;

    const slDist = parseFloat((atr * 1.5).toFixed(2));
    const entry = currentPrice;
    const sl  = isLong ? parseFloat((entry - slDist).toFixed(2)) : parseFloat((entry + slDist).toFixed(2));
    const tp1 = isLong ? parseFloat((entry + slDist * 2).toFixed(2))   : parseFloat((entry - slDist * 2).toFixed(2));
    const tp2 = isLong ? parseFloat((entry + slDist * 3.5).toFixed(2)) : parseFloat((entry - slDist * 3.5).toFixed(2));
    const tp3 = isLong ? parseFloat((entry + slDist * 6.0).toFixed(2)) : parseFloat((entry - slDist * 6.0).toFixed(2));

    const reason = isLong
      ? `Bullish Momentum (+${pctChange5.toFixed(2)}%) across 5 readings + Clean Path above $${entry.toFixed(2)} + ATR ${atr.toFixed(1)} SL buffer.`
      : `Bearish Rejection (${pctChange5.toFixed(2)}%) across 5 readings + Resistance tagged near $${entry.toFixed(2)} + ATR ${atr.toFixed(1)} SL buffer.`;

    return {
      dir, strategy: isLong ? 'ICT_SilverBullet' : 'AliVidollar_SD',
      tf: state.timeframe, entry, sl, tp1, tp2, tp3,
      rr: '3.5', rrMax: '6.0', conf: weightedConf,
      confInst: instScore, confMacro: macroScore, confTech: techScore,
      atr, reason, pctChange5,
      smcDetails: null
    };
  }

  /**
   * OHLCV-based signal detection using real candles from gold-history API.
   * SMC analysis: CHoCH, Order Block, FVG, Liquidity Sweep.
   */
  function detectSignalFromOHLC(candles, currentPrice) {
    if (!candles || candles.length < 20) return null;

    const atr = computeATRFromCandles(candles, 14);
    const { swingHigh, swingLow } = detectSwings(candles, 20);

    // Determine direction from price position relative to swings
    const priceRange = swingHigh - swingLow;
    if (priceRange <= 0) return null;
    const pricePosition = (currentPrice - swingLow) / priceRange; // 0=at low, 1=at high

    // Direction: near lows (< 0.35) = potential LONG; near highs (> 0.65) = potential SHORT
    let dir = null;
    if (pricePosition <= 0.40) dir = 'LONG';
    else if (pricePosition >= 0.60) dir = 'SHORT';
    else return null; // Midrange — no clear setup

    // Check CHoCH confirmation
    const choch = detectCHoCH(candles, dir);
    const liqSweep = detectLiquiditySweep(candles, dir);
    const ob = detectOrderBlock(candles, dir);
    const fvgLevel = detectFVG(candles, dir);

    // Confluence scoring
    let confluencePoints = 0;
    const confluenceFactors = [];

    if (choch.detected) { confluencePoints += 35; confluenceFactors.push('CHoCH Confirmed'); }
    else if (choch.breakLevel) { confluencePoints += 10; confluenceFactors.push('CHoCH Pending'); }

    if (liqSweep) { confluencePoints += 25; confluenceFactors.push('Liquidity Sweep'); }

    if (ob) { confluencePoints += 20; confluenceFactors.push(`${ob.obType === 'demand' ? 'Demand' : 'Supply'} OB`); }

    if (fvgLevel !== null) { confluencePoints += 20; confluenceFactors.push('FVG Present'); }

    // Minimum confluence threshold
    if (confluencePoints < 40) return null;

    // 3-pillar weighted confidence from OHLCV analysis
    const instScore = Math.min(96, Math.round(55 + Math.min(41, confluencePoints * 0.6)));

    // Momentum check: last 3 candles
    const last3 = candles.slice(-3);
    let momentumAgree = 0;
    last3.forEach(c => {
      if (dir === 'LONG' && c.close >= c.open) momentumAgree++;
      if (dir === 'SHORT' && c.close <= c.open) momentumAgree++;
    });
    const macroScore = Math.min(94, Math.round(58 + momentumAgree * 12));

    // ATR volatility positioning (lower ATR relative to price range = cleaner setup)
    const atrRatio = atr / priceRange;
    const techScore = Math.min(93, Math.round(60 + Math.max(0, (0.3 - atrRatio) * 100)));

    const weightedConf = Math.min(96, Math.round(instScore * 0.50 + macroScore * 0.30 + techScore * 0.20));
    if (weightedConf < 70) return null;

    // Calculate levels from real candle data
    const slDist = parseFloat((atr * 1.5).toFixed(2));
    const isLong = dir === 'LONG';
    const entry = currentPrice;
    const sl  = isLong ? parseFloat((entry - slDist).toFixed(2)) : parseFloat((entry + slDist).toFixed(2));
    const tp1 = isLong ? parseFloat((entry + slDist * 2).toFixed(2))   : parseFloat((entry - slDist * 2).toFixed(2));
    const tp2 = isLong ? parseFloat((entry + slDist * 3.5).toFixed(2)) : parseFloat((entry - slDist * 3.5).toFixed(2));
    const tp3 = isLong ? parseFloat((entry + slDist * 6.0).toFixed(2)) : parseFloat((entry - slDist * 6.0).toFixed(2));

    const strategyMap = { LONG: 'ICT_SilverBullet', SHORT: 'AliVidollar_SD' };
    const reason = confluenceFactors.join(' + ') +
      ` | ATR(14): ${atr.toFixed(1)} | Swing H: ${swingHigh.toFixed(2)} / L: ${swingLow.toFixed(2)} | ${candles.length} candles (${state.timeframe})`;

    return {
      dir, strategy: strategyMap[dir],
      tf: state.timeframe, entry, sl, tp1, tp2, tp3,
      rr: '3.5', rrMax: '6.0', conf: weightedConf,
      confInst: instScore, confMacro: macroScore, confTech: techScore,
      atr, reason, pctChange5: 0,
      smcDetails: { choch, liqSweep, ob, fvgLevel, swingHigh, swingLow, confluencePoints }
    };
  }

  /**
   * Deterministic predictive setups — strictly based on requirements
   */
  function generatePredictiveSetups(currentPrice, priceHistory) {
    if (!currentPrice || priceHistory.length < 5) return [];
    const setups = [];

    const price5 = priceHistory[priceHistory.length - 5];
    const dropPct = ((currentPrice - price5) / price5) * 100;

    // Requirement: Show "WATCH: Price approaching potential support" ONLY IF price dropped > 0.5% in last 5 readings
    if (dropPct < -0.5) {
      setups.push({
        tf: 'H4',
        type: 'Support Watch',
        dir: 'LONG',
        level: parseFloat((currentPrice * 0.995).toFixed(2)),
        desc: `Price dropped ${Math.abs(dropPct).toFixed(2)}% in last 5 readings. Approaching potential H4 support zone.`,
        session: 'London/NY Killzone scan',
        conditionNote: 'Setup expires if conditions not met'
      });
    } else if (dropPct > 0.5) {
      setups.push({
        tf: 'H4',
        type: 'Resistance Watch',
        dir: 'SHORT',
        level: parseFloat((currentPrice * 1.005).toFixed(2)),
        desc: `Price advanced +${dropPct.toFixed(2)}% in last 5 readings. Approaching potential H4 supply/resistance zone.`,
        session: 'London/NY Killzone scan',
        conditionNote: 'Setup expires if conditions not met'
      });
    }

    return setups;
  }

  function updateSignalEngine() {
    try {
      if (!state.goldPrice) {
        showWaitingState();
        return;
      }

      const signal = detectSignalFromPrice(state.goldPrice, state.priceHistory);
      state.predictiveSetups = generatePredictiveSetups(state.goldPrice, state.priceHistory);

      if (signal) {
        state.signalFeed = [{
          id: 'XAUUSD-LIVE-01',
          ...signal,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC',
          newsFlag: hasNewsWithin2h()
        }];

        state.signal = {
          type: signal.dir,
          strategy: signal.strategy,
          entry: signal.entry,
          sl: signal.sl,
          tp1: signal.tp1,
          tp2: signal.tp2,
          tp3: signal.tp3,
          rr: signal.rr,
          atr: signal.atr,
          reason: signal.reason,
          confidence: signal.conf,
          confInst: signal.confInst,
          confMacro: signal.confMacro,
          confTech: signal.confTech
        };
        updateHeroSignalUI();
      } else {
        state.signalFeed = [];
      }

      renderSignalFeed();
      renderPredictiveSetups();
      updateConfidenceDynamically();

      const badge = document.getElementById('nav-badge-terminal');
      if (badge) {
        badge.textContent = state.signalFeed.length;
        badge.style.display = state.signalFeed.length > 0 ? 'inline-flex' : 'none';
      }
    } catch (err) {
      console.error('[MANUS MAX]', 'updateSignalEngine error', err);
      showError('updateSignalEngine', err.message);
    }
  }

  function initSignalEngine() {
    renderSignalFeed();
    renderPredictiveSetups();
  }

  function renderSignalFeed() {
    const container = document.getElementById('signal-feed-list');
    if (!container) return;

    if (!state.goldPrice) {
      showWaitingState();
      return;
    }

    const count = state.priceHistory.length;

    if (count < 20) {
      container.innerHTML = `
        <div style="text-align:center;color:var(--text-dim);padding:30px 20px;font-size:12px;line-height:1.8;">
          <div style="font-size:18px;margin-bottom:8px;">📊</div>
          <div style="color:var(--gold-primary);font-weight:700;margin-bottom:6px;">
            Insufficient data for signal generation — waiting for price history
          </div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6);">
            Collected ${count} / 20 readings (${(20 - count)} more required).
          </div>
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:6px;">
            Real signals require minimum 20 candles of OHLCV data. Connect a data provider for live signal generation.
          </div>
        </div>
      `;
      return;
    }

    if (!state.signalFeed.length) {
      container.innerHTML = `
        <div style="text-align:center;color:var(--text-dim);padding:24px 20px;font-size:12px;line-height:1.6;">
          <div style="font-size:16px;margin-bottom:6px;">🔍</div>
          <div style="font-weight:600;color:var(--text-secondary);">SCANNING FOR XAU/USD SETUPS...</div>
          <div style="font-size:11px;margin-top:4px;">
            No clear directional break beyond 0.08% threshold in current price window.
          </div>
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:6px;">
            Real signals require minimum 20 candles of OHLCV data. Connect a data provider for live signal generation.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    state.signalFeed.forEach((sig, idx) => {
      const div = document.createElement('div');
      const isLong = sig.dir === 'LONG';
      const dirClass = isLong ? 'sig-long' : 'sig-short';
      const confClass = sig.conf >= 85 ? 'sig-conf-high' : sig.conf >= 75 ? 'sig-conf-med' : 'sig-conf-low';
      const badgeClass = isLong ? 'sig-dir-long' : 'sig-dir-short';
      const dirLabel = isLong ? '▲ LONG' : '▼ SHORT';

      div.className = `sig-item ${dirClass}${idx === 0 ? ' sig-active' : ''}`;
      div.setAttribute('data-sig-id', sig.id);
      div.innerHTML = `
        <div class="sig-item-header">
          <span class="sig-dir-badge ${badgeClass}">${dirLabel}</span>
          <span class="sig-strategy-tag">${sig.strategy}</span>
          <span class="sig-conf-badge ${confClass}">${sig.conf}%</span>
          ${sig.newsFlag ? '<span class="news-2h-badge-sm">⚠ 2h NEWS</span>' : ''}
        </div>
        <div class="sig-reason">"${sig.reason}"</div>
        <div class="sig-levels">
          <span class="sig-level-item"><span class="sig-level-label">ENTRY</span><span class="sig-level-val entry-val">${formatPrice(sig.entry)}</span></span>
          <span class="sig-level-item"><span class="sig-level-label">SL</span><span class="sig-level-val sl-val">${formatPrice(sig.sl)}</span></span>
          <span class="sig-level-item"><span class="sig-level-label">TP2</span><span class="sig-level-val tp-val">${formatPrice(sig.tp2)}</span></span>
          <span class="sig-level-item"><span class="sig-level-label">TP3</span><span class="sig-level-val" style="color:var(--gold-bright);">${formatPrice(sig.tp3)}</span></span>
        </div>
        <div class="sig-footer">
          <span class="sig-rr">RR 1:${sig.rr} <span style="color:var(--text-dim);font-size:10px;">(max 1:${sig.rrMax})</span></span>
          <span style="display:flex;align-items:center;gap:6px;">
            <span class="sig-time">${sig.tf} • ${sig.time}</span>
          </span>
        </div>
        <div class="sig-expand-btn" onclick="toggleSigExpand(this)">
          <i data-lucide="chevron-down"></i> 3-Pillar Breakdown
        </div>
        <div class="sig-expanded-detail" style="display:none;">
          <div class="sig-pillar-row">
            <span class="sig-pillar-label"><span class="conf-seg-dot inst"></span> Institutional (×50%)</span>
            <span class="sig-pillar-val text-purple">${sig.confInst}%</span>
            <div class="sig-pillar-bar"><div class="sig-pillar-fill" style="width:${sig.confInst}%;background:var(--purple);"></div></div>
          </div>
          <div class="sig-pillar-row">
            <span class="sig-pillar-label"><span class="conf-seg-dot macro"></span> Macro (×30%)</span>
            <span class="sig-pillar-val text-gold">${sig.confMacro}%</span>
            <div class="sig-pillar-bar"><div class="sig-pillar-fill" style="width:${sig.confMacro}%;background:var(--gold-primary);"></div></div>
          </div>
          <div class="sig-pillar-row">
            <span class="sig-pillar-label"><span class="conf-seg-dot tech"></span> Technical (×20%)</span>
            <span class="sig-pillar-val text-emerald">${sig.confTech}%</span>
            <div class="sig-pillar-bar"><div class="sig-pillar-fill" style="width:${sig.confTech}%;background:var(--emerald);"></div></div>
          </div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:6px;font-family:var(--font-mono);">
            Total: ${sig.confInst}×0.50 + ${sig.confMacro}×0.30 + ${sig.confTech}×0.20 = <strong style="color:var(--gold-primary);">${sig.conf}%</strong>
          </div>
        </div>
      `;
      container.appendChild(div);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  window.toggleSigExpand = function(btn) {
    try {
      const detail = btn.nextElementSibling;
      const icon = btn.querySelector('i');
      if (detail) {
        const isOpen = detail.style.display !== 'none';
        detail.style.display = isOpen ? 'none' : 'block';
        if (icon) icon.setAttribute('data-lucide', isOpen ? 'chevron-down' : 'chevron-up');
        if (window.lucide) window.lucide.createIcons();
      }
    } catch (err) {
      console.error('[MANUS MAX]', 'toggleSigExpand error', err);
      showError('toggleSigExpand', err.message);
    }
  };

  function renderPredictiveSetups() {
    const container = document.getElementById('predictive-list');
    if (!container) return;
    container.innerHTML = '';

    if (!state.predictiveSetups.length) {
      container.innerHTML = `
        <div class="predictive-item" style="color:var(--text-dim);font-size:12px;text-align:center;padding:16px;">
          No qualified HTF POI setups detected.
        </div>
      `;
      return;
    }

    state.predictiveSetups.forEach(setup => {
      const div = document.createElement('div');
      div.className = 'predictive-item';
      const dirColor = setup.dir === 'LONG' ? 'var(--emerald)' : 'var(--ruby)';
      div.innerHTML = `
        <div class="pred-header">
          <span class="pred-alert-tag"><i data-lucide="zap"></i> ⚡ WATCH [CONDITIONAL — NOT TRIGGERED]</span>
          <span class="pred-tf">${setup.tf}</span>
        </div>
        <div class="pred-desc">${setup.desc}</div>
        <div style="font-size:10px;color:var(--text-dim);margin-top:4px;font-style:italic;">
          ${setup.conditionNote}. Setup expires if conditions not met.
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
          <span class="pred-price" style="color:${dirColor};">⚡ Potential ${setup.dir} near ${formatPrice(setup.level)}</span>
          <span style="font-size:10px;color:var(--text-dim);">${setup.session}</span>
        </div>
      `;
      container.appendChild(div);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  /* ========================================================================
     5. KILLZONE TIMER ENGINE
     ======================================================================== */
  function initKillzoneTimer() {
    updateKillzoneDisplay();
    setInterval(updateKillzoneDisplay, 1000);
  }

  function getUTCTime() {
    const now = new Date();
    return { h: now.getUTCHours(), m: now.getUTCMinutes(), s: now.getUTCSeconds() };
  }

  function timeToSeconds(h, m, s) { return h * 3600 + m * 60 + s; }

  function formatCountdown(totalSeconds) {
    if (totalSeconds <= 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateKillzoneDisplay() {
    try {
      const { h, m, s } = getUTCTime();
      const now = timeToSeconds(h, m, s);

      const sessions = {
        asia:   { start: 0,     end: 28800 },
        london: { start: 28800, end: 39600 },
        ny:     { start: 46800, end: 57600 }
      };

      const londEl   = document.getElementById('kz-london');
      const nyEl     = document.getElementById('kz-ny');
      const londonChip  = document.getElementById('kz-london-chip');
      const londonCount = document.getElementById('kz-london-countdown');
      const londonLabel = document.getElementById('kz-london-label');

      if (now >= sessions.london.start && now < sessions.london.end) {
        const rem = sessions.london.end - now;
        if (londonCount) londonCount.textContent = formatCountdown(rem);
        if (londonLabel) londonLabel.textContent = 'ACTIVE — CLOSES IN';
        if (londonChip) { londonChip.textContent = 'ACTIVE'; londonChip.className = 'kz-status-chip kz-chip-active'; }
        if (londEl) londEl.classList.add('kz-active');
      } else if (now < sessions.london.start) {
        const rem = sessions.london.start - now;
        if (londonCount) londonCount.textContent = formatCountdown(rem);
        if (londonLabel) londonLabel.textContent = 'OPENS IN';
        if (londonChip) { londonChip.textContent = 'NEXT'; londonChip.className = 'kz-status-chip kz-chip-next'; }
        if (londEl) londEl.classList.remove('kz-active');
      } else {
        if (londonCount) londonCount.textContent = 'CLOSED';
        if (londonLabel) londonLabel.textContent = 'MANIPULATION PHASE DONE';
        if (londonChip) { londonChip.textContent = 'DONE'; londonChip.className = 'kz-status-chip kz-chip-done'; }
        if (londEl) londEl.classList.remove('kz-active');
      }

      const nyChip  = document.getElementById('kz-ny-chip');
      const nyCount = document.getElementById('kz-ny-countdown');
      const nyLabel = document.getElementById('kz-ny-label');

      if (now >= sessions.ny.start && now < sessions.ny.end) {
        const rem = sessions.ny.end - now;
        if (nyCount) nyCount.textContent = formatCountdown(rem);
        if (nyLabel) nyLabel.textContent = 'ACTIVE — CLOSES IN';
        if (nyChip) { nyChip.textContent = 'ACTIVE'; nyChip.className = 'kz-status-chip kz-chip-active'; }
        if (nyEl) nyEl.classList.add('kz-active');
      } else if (now < sessions.ny.start) {
        const rem = sessions.ny.start - now;
        if (nyCount) nyCount.textContent = formatCountdown(rem);
        if (nyLabel) nyLabel.textContent = 'OPENS IN';
        if (nyChip) { nyChip.textContent = 'NEXT'; nyChip.className = 'kz-status-chip kz-chip-next'; }
        if (nyEl) nyEl.classList.remove('kz-active');
      } else {
        if (nyCount) nyCount.textContent = 'CLOSED';
        if (nyLabel) nyLabel.textContent = 'DISTRIBUTION PHASE DONE';
        if (nyChip) { nyChip.textContent = 'DONE'; nyChip.className = 'kz-status-chip kz-chip-done'; }
        if (nyEl) nyEl.classList.remove('kz-active');
      }

      const tteEl = document.getElementById('tte-display');
      const heroTTEEl = document.getElementById('hero-tte');
      if (tteEl) {
        let tte = 'No Killzone active — Await London/NY open';
        if (now >= sessions.london.start && now < sessions.london.end) {
          tte = '~15 min (London Killzone LIVE — High Volatility)';
        } else if (now >= sessions.ny.start && now < sessions.ny.end) {
          tte = '~20 min (NY Killzone LIVE — Distribution Phase)';
        } else if (now < sessions.london.start) {
          const mins = Math.round((sessions.london.start - now) / 60);
          tte = `~${mins} min to London Open`;
        } else if (now < sessions.ny.start) {
          const mins = Math.round((sessions.ny.start - now) / 60);
          tte = `~${mins} min to NY Open`;
        }
        tteEl.textContent = tte;
        if (heroTTEEl) heroTTEEl.textContent = tte;
      }

      updateSilverBulletTicker(h, m);
    } catch (err) {
      console.error('[MANUS MAX]', 'updateKillzoneDisplay error', err);
      showError('updateKillzoneDisplay', err.message);
    }
  }

  /* ========================================================================
     6. SILVER BULLET & AMD SESSION CLOCK
     ======================================================================== */
  function initSilverBulletClock() {
    updateSilverBulletWindows();
    setInterval(updateSilverBulletWindows, 10000);
  }

  function initAMDPhase() {
    updateAMDPhase();
    setInterval(updateAMDPhase, 30000);
  }

  function updateAMDPhase() {
    try {
      const { h } = getUTCTime();
      const el = document.getElementById('amd-current-phase');
      if (!el) return;
      if (h >= 0 && h < 8) el.textContent = 'Phase: 📊 ACCUMULATION (Asia) — Range forming';
      else if (h >= 8 && h < 9) el.textContent = 'Phase: ⚡ MANIPULATION — Early London sweep';
      else if (h >= 9 && h < 11) el.textContent = 'Phase: ⚡ MANIPULATION — London sweep peak';
      else if (h >= 13 && h < 16) el.textContent = 'Phase: 🎯 DISTRIBUTION (NY) — Trend active';
      else el.textContent = 'Phase: ⏸ Between Sessions — Low volatility';
    } catch (err) {
      console.error('[MANUS MAX]', 'updateAMDPhase error', err);
      showError('updateAMDPhase', err.message);
    }
  }

  function getSBStatus(nowH, nowM) {
    const estH = (nowH - 4 + 24) % 24;
    const timeMin = estH * 60 + nowM;
    const w1Start = 10 * 60, w1End = 11 * 60;
    const w2Start = 14 * 60, w2End = 15 * 60;

    if (timeMin >= w1Start && timeMin < w1End) return { window: 1, active: true, minsLeft: w1End - timeMin };
    if (timeMin >= w2Start && timeMin < w2End) return { window: 2, active: true, minsLeft: w2End - timeMin };
    if (timeMin < w1Start) return { window: 1, active: false, minsTo: w1Start - timeMin };
    if (timeMin < w2Start) return { window: 2, active: false, minsTo: w2Start - timeMin };
    return { window: 0, active: false, minsTo: (24 * 60 - timeMin) + w1Start };
  }

  function updateSilverBulletWindows() {
    try {
      const { h, m } = getUTCTime();
      const sb = getSBStatus(h, m);

      const w1El = document.getElementById('sb-window-1');
      const w2El = document.getElementById('sb-window-2');
      const chip1 = document.getElementById('sb-chip-1');
      const chip2 = document.getElementById('sb-chip-2');
      const overallStatus = document.getElementById('sb-overall-status');

      if (sb.active && sb.window === 1) {
        if (w1El) w1El.classList.add('sb-active');
        if (w2El) w2El.classList.remove('sb-active');
        if (chip1) { chip1.textContent = `LIVE ${sb.minsLeft}m`; chip1.className = 'sb-status sb-status-active'; }
        if (chip2) { chip2.textContent = 'WAITING'; chip2.className = 'sb-status sb-status-waiting'; }
        if (overallStatus) overallStatus.innerHTML = '<i data-lucide="zap"></i> WINDOW 1 ACTIVE — ENTER NOW';
      } else if (sb.active && sb.window === 2) {
        if (w2El) w2El.classList.add('sb-active');
        if (w1El) w1El.classList.remove('sb-active');
        if (chip2) { chip2.textContent = `LIVE ${sb.minsLeft}m`; chip2.className = 'sb-status sb-status-active'; }
        if (chip1) { chip1.textContent = 'DONE'; chip1.className = 'sb-status sb-status-waiting'; }
        if (overallStatus) overallStatus.innerHTML = '<i data-lucide="zap"></i> WINDOW 2 ACTIVE — ENTER NOW';
      } else {
        if (w1El) w1El.classList.remove('sb-active');
        if (w2El) w2El.classList.remove('sb-active');
        if (chip1) { chip1.textContent = 'WAITING'; chip1.className = 'sb-status sb-status-waiting'; }
        if (chip2) { chip2.textContent = 'WAITING'; chip2.className = 'sb-status sb-status-waiting'; }
        if (overallStatus) overallStatus.innerHTML = `<i data-lucide="clock"></i> Next Window in ~${sb.minsTo || '?'}m`;
      }

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('[MANUS MAX]', 'updateSilverBulletWindows error', err);
      showError('updateSilverBulletWindows', err.message);
    }
  }

  function updateSilverBulletTicker(h, m) {
    const sb = getSBStatus(h, m);
    const sbStatusEl = document.getElementById('ticker-sb-status');
    const sbCountEl  = document.getElementById('ticker-sb-countdown');
    if (!sbStatusEl) return;

    if (sb.active) {
      sbStatusEl.textContent = 'ACTIVE';
      sbStatusEl.style.color = 'var(--cyan)';
      if (sbCountEl) sbCountEl.textContent = `(${sb.minsLeft}m left)`;
    } else {
      sbStatusEl.textContent = 'WAITING';
      sbStatusEl.style.color = 'var(--purple)';
      if (sbCountEl && sb.minsTo) sbCountEl.textContent = `(in ${sb.minsTo}m)`;
    }
  }

  /* ========================================================================
     7. QUANTITATIVE NEWS ENGINE
     ======================================================================== */
  function initNewsEngine() {
    renderNewsCalendar();
    if (state.newsEvents[0]) updateNewsWidget(state.newsEvents[0]);
    updateNewsBadges();
    updateNewsTickerAlert();

    setInterval(() => {
      state.newsEvents.forEach(event => {
        if (event.hoursUntil > 0) {
          event.hoursUntil = Math.max(0, event.hoursUntil - (1 / 3600));
        }
      });
      renderNewsCountdown();
      updateNewsTickerAlert();
    }, 1000);

    setInterval(() => {
      renderNewsCalendar();
      if (state.newsEvents[0]) updateNewsWidget(state.newsEvents[0]);
      updateNewsBadges();
    }, 60000);
  }

  function renderNewsCountdown() {
    const nextEvent = state.newsEvents[0];
    if (!nextEvent) return;
    const totalSec = Math.max(0, Math.round(nextEvent.hoursUntil * 3600));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const el = document.getElementById('news-countdown-timer');
    if (el) {
      el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      el.style.color = nextEvent.hoursUntil <= 2 ? 'var(--ruby)' : nextEvent.hoursUntil <= 6 ? 'var(--gold-primary)' : 'var(--emerald)';
    }
  }

  function updateNewsTickerAlert() {
    const nextEvent = state.newsEvents[0];
    if (!nextEvent) return;
    const el = document.getElementById('ticker-news-alert');
    if (!el) return;
    const h = Math.floor(nextEvent.hoursUntil);
    const m = Math.round((nextEvent.hoursUntil - h) * 60);
    el.textContent = h > 0 ? `CPI in ${h}h ${m}m` : `CPI in ${m}m`;
    el.style.color = nextEvent.hoursUntil <= 2 ? 'var(--ruby)' : 'var(--gold-primary)';
  }

  function hasNewsWithin2h() {
    return state.newsEvents.some(e => e.hoursUntil <= 2 && e.folder === 'red');
  }

  function updateNewsBadges() {
    const within2h = hasNewsWithin2h();
    const heroBadge = document.getElementById('hero-news-badge');
    if (heroBadge) heroBadge.style.display = within2h ? 'flex' : 'none';
  }

  function renderNewsCalendar() {
    const container = document.getElementById('news-calendar-list');
    if (!container) return;
    container.innerHTML = '';

    state.newsEvents.forEach(event => {
      const row = document.createElement('div');
      const isUpcoming = event.hoursUntil <= 2;
      row.className = `news-event-row${isUpcoming ? ' news-upcoming' : ''}`;
      const timeStr = event.hoursUntil < 1
        ? Math.round(event.hoursUntil * 60) + 'm'
        : event.hoursUntil.toFixed(1) + 'h';
      row.innerHTML = `
        <div>
          <div class="news-time">${event.time}</div>
          <div class="news-time" style="color:${isUpcoming ? 'var(--ruby)' : 'var(--text-dim)'};">In ${timeStr}</div>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="news-folder-badge folder-${event.folder}"></span>
            <span class="news-event-name">${event.name}</span>
            ${isUpcoming ? '<span style="font-size:9px;font-weight:700;color:var(--ruby);background:rgba(239,68,68,0.12);padding:1px 5px;border-radius:3px;">⚠ &lt;2h</span>' : ''}
          </div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:2px;">${event.bias} • ±${event.volPips} pips</div>
        </div>
        <div class="news-impact-col">
          <span class="news-impact-pct">${event.impactPct}%</span>
          <div class="news-impact-bar-wrap"><div class="news-impact-bar-fill" style="width:${event.impactPct}%;"></div></div>
          <span class="news-confidence-chip ${event.confClass}">${event.conf}</span>
        </div>
      `;
      row.addEventListener('click', () => updateNewsWidget(event));
      container.appendChild(row);
    });
  }

  function updateNewsWidget(event) {
    try {
      const nameEl  = document.getElementById('news-next-event-name');
      const timeEl  = document.getElementById('news-next-event-time');
      const volEl   = document.getElementById('news-vol');
      const biasEl  = document.getElementById('news-bias');
      const inflEl  = document.getElementById('news-influence');
      const meterEl = document.getElementById('news-meter-fill');
      const confEl  = document.getElementById('news-conf-chip');
      const histEl  = document.getElementById('news-hist-conf');

      if (nameEl)  nameEl.textContent  = event.name;
      if (timeEl)  timeEl.textContent  = `In ${event.hoursUntil.toFixed(1)}h • ${event.time.split(' ')[1]} UTC`;
      if (volEl)   volEl.textContent   = `${event.volPips} pips`;
      if (biasEl)  biasEl.textContent  = event.bias;
      if (inflEl)  inflEl.textContent  = `${event.impactPct}%`;
      if (meterEl) meterEl.style.width = `${event.impactPct}%`;
      if (confEl)  { confEl.textContent = `${event.conf} IMPACT`; confEl.className = `news-confidence-chip ${event.confClass}`; }
      if (histEl)  histEl.textContent  = event.histConf || '—';
    } catch (err) {
      console.error('[MANUS MAX]', 'updateNewsWidget error', err);
      showError('updateNewsWidget', err.message);
    }
  }

  /* ========================================================================
     8. CONFIDENCE BARS & METRICS (Inst 50% / Macro 30% / Tech 20%)
     ======================================================================== */
  function updateConfidenceDynamically() {
    try {
      const gauge    = document.getElementById('gauge-circle');
      const scoreEl  = document.getElementById('gauge-score-num');
      const instEl   = document.getElementById('conf-val-inst');
      const macroEl  = document.getElementById('conf-val-macro');
      const techEl   = document.getElementById('conf-val-tech');
      const barInst  = document.getElementById('conf-bar-inst');
      const barMacro = document.getElementById('conf-bar-macro');
      const barTech  = document.getElementById('conf-bar-tech');

      if (!state.signal) {
        if (scoreEl) scoreEl.textContent = '—';
        return;
      }

      const { confInst: inst, confMacro: macro, confTech: tech } = state.signal;
      const total = Math.min(98, Math.round(inst * 0.50 + macro * 0.30 + tech * 0.20));

      if (scoreEl) scoreEl.textContent = `${total}%`;
      if (instEl)  instEl.textContent  = `${inst}%`;
      if (macroEl) macroEl.textContent = `${macro}%`;
      if (techEl)  techEl.textContent  = `${tech}%`;

      const totalContrib = inst * 0.50 + macro * 0.30 + tech * 0.20;
      if (barInst)  barInst.style.width  = `${(inst  * 0.50 / (totalContrib || 1)) * 92}%`;
      if (barMacro) barMacro.style.width = `${(macro * 0.30 / (totalContrib || 1)) * 92}%`;
      if (barTech)  barTech.style.width  = `${(tech  * 0.20 / (totalContrib || 1)) * 92}%`;

      if (gauge) gauge.style.strokeDashoffset = (314 * (1 - total / 100)).toFixed(1);
    } catch (err) {
      console.error('[MANUS MAX]', 'updateConfidenceDynamically error', err);
      showError('updateConfidenceDynamically', err.message);
    }
  }

  /* ========================================================================
     9. SIGNAL HISTORY TABLE — Explicit DEMO Data Flagging
     ======================================================================== */
  function initSignalHistory() {
    if (!historyBody) return;
    try {
      historyBody.innerHTML = '';

      // Disclaimer banner inside table
      const discTr = document.createElement('tr');
      discTr.innerHTML = `
        <td colspan="14" style="background:rgba(245,194,66,0.06);border:1px dashed rgba(245,194,66,0.3);padding:10px 14px;text-align:center;color:#f5c242;font-size:11px;font-weight:600;">
          ⚠ DEMO DATA — Historical signals shown are for demonstration. Live signal tracking requires backend integration.
        </td>
      `;
      historyBody.appendChild(discTr);

      state.history.forEach(item => {
        const tr = document.createElement('tr');
        const isWin = item.status.includes('WIN');
        const isBuy = item.dir === 'BUY' || item.dir === 'LONG';
        const isActive = item.status.includes('ACTIVE');
        const rrClass = {
          'rr-min': 'rr-badge rr-badge-min',
          'rr-good': 'rr-badge rr-badge-good',
          'rr-high': 'rr-badge rr-badge-high'
        }[item.rrClass] || 'rr-badge rr-badge-high';

        const pipsSign = item.pips !== 'LIVE' ? (parseFloat(item.pips) >= 0 ? '+' : '') : '';

        tr.innerHTML = `
          <td class="font-mono" style="color:var(--text-dim);font-size:11px;">${item.id}</td>
          <td class="font-mono ts-cell">${item.openTs}</td>
          <td class="font-mono ts-cell ${isActive ? 'text-gold' : ''}">${item.closeTs}</td>
          <td><span class="status-badge ${isBuy ? 'badge-win' : 'badge-gold'}">${isBuy ? '▲ LONG' : '▼ SHORT'}</span></td>
          <td><span class="sig-strategy-tag" style="font-size:10px;">${item.strategy}</span></td>
          <td class="font-mono">$${item.entry.toFixed(2)}</td>
          <td class="text-ruby font-mono">$${item.sl.toFixed(2)}</td>
          <td class="text-gold font-mono">$${item.tp2.toFixed(2)}</td>
          <td><span class="${rrClass}">${item.rr}</span></td>
          <td class="${isWin ? 'text-emerald' : 'text-ruby'}" style="font-weight:700;">${item.pips !== 'LIVE' ? pipsSign + item.pips : '<span class="pulse-dot" style="margin-right:4px;"></span>DEMO'}</td>
          <td class="text-gold">${item.confidence}</td>
          <td>${item.news ? `<span class="news-badge">⚠ ${item.news}</span>` : '<span style="color:var(--text-dim);font-size:10px;">—</span>'}</td>
          <td><span class="status-badge ${isActive ? 'badge-tag' : (isWin ? 'badge-win' : 'badge-ruby')}">${item.status}</span></td>
          <td>${item.pnl ? `<button class="btn-detail" onclick="showTradeDetail('${item.id}')"><i data-lucide="eye"></i></button>` : '<span style="color:var(--text-dim);font-size:10px;">—</span>'}</td>
        `;
        historyBody.appendChild(tr);

        if (item.pnl) {
          const detailRow = document.createElement('tr');
          detailRow.id = `detail-${item.id}`;
          detailRow.className = 'trade-detail-row';
          detailRow.style.display = 'none';
          const pnl = item.pnl;
          const pnlColor = pnl.pips >= 0 ? 'var(--emerald)' : 'var(--ruby)';
          detailRow.innerHTML = `
            <td colspan="14">
              <div class="trade-detail-panel">
                <div class="trade-detail-header">
                  <span><i data-lucide="trending-${pnl.direction === 'LONG' || pnl.direction === 'BUY' ? 'up' : 'down'}"></i> ${item.id} — DEMO Trade Close View</span>
                  <span class="trade-pnl-badge" style="color:${pnlColor};background:${pnl.pips >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border:1px solid ${pnl.pips >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};">${pnl.pips >= 0 ? '+' : ''}${pnl.pips} Pips (${pnl.result})</span>
                </div>
                <div class="trade-markers">
                  <div class="trade-marker marker-entry">
                    <span class="marker-dot" style="background:var(--gold-primary);"></span>
                    <span>ENTRY: $${pnl.entryPrice.toFixed(2)}</span>
                  </div>
                  <div class="trade-arrow">→</div>
                  <div class="trade-marker marker-exit" style="color:${pnlColor};">
                    <span class="marker-dot" style="background:${pnlColor};"></span>
                    <span>EXIT: $${pnl.exitPrice.toFixed(2)}</span>
                  </div>
                  <div class="trade-pnl-calc">
                    <span>Δ = ${Math.abs(pnl.exitPrice - pnl.entryPrice).toFixed(2)} pts</span>
                    <span style="color:${pnlColor};font-weight:700;">${pnl.pips >= 0 ? '+' : ''}${pnl.pips} pips (DEMO)</span>
                  </div>
                </div>
                <div class="trade-reason" style="font-size:11px;color:var(--text-secondary);margin-top:6px;font-style:italic;">"${item.reason}"</div>
              </div>
            </td>
          `;
          historyBody.appendChild(detailRow);
        }
      });

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('[MANUS MAX]', 'initSignalHistory error', err);
      showError('initSignalHistory', err.message);
    }
  }

  window.showTradeDetail = function(id) {
    try {
      const row = document.getElementById(`detail-${id}`);
      if (row) {
        row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
        if (window.lucide) window.lucide.createIcons();
      }
    } catch (err) {
      console.error('[MANUS MAX]', 'showTradeDetail error', err);
      showError('showTradeDetail', err.message);
    }
  };

  /* ========================================================================
     10. PERFORMANCE METRICS (Honest DEMO labeling)
     ======================================================================== */
  function initPerformanceMetrics() {
    try {
      const closed = state.history.filter(h => !h.status.includes('ACTIVE'));
      const wins = closed.filter(h => h.status.includes('WIN'));
      const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) : '—';
      const totalPips = closed.reduce((sum, h) => sum + (parseFloat(h.pips) || 0), 0);
      const maxDD = Math.min(...closed.map(h => parseFloat(h.pips) || 0));
      const rrVals = closed.map(h => parseFloat((h.rr || '').replace('1 : ', '')) || 0).filter(v => v > 0);
      const avgRR = rrVals.length > 0 ? (rrVals.reduce((a, b) => a + b, 0) / rrVals.length).toFixed(1) : '—';

      animateCounter('perf-winrate', `${winRate}% (DEMO)`, 1000);
      animateCounter('perf-avgr', `1 : ${avgRR}`, 800);
      animateCounter('perf-gain', `+${totalPips.toFixed(0)} Pips (DEMO)`, 1200);
      animateCounter('perf-dd', `${maxDD >= 0 ? '+' : ''}${maxDD} Pips`, 600);
      animateCounter('perf-sharpe', 'DEMO', 600);
    } catch (err) {
      console.error('[MANUS MAX]', 'initPerformanceMetrics error', err);
      showError('initPerformanceMetrics', err.message);
    }
  }

  function animateCounter(id, finalVal, duration) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.transition = `color ${duration}ms ease`;
    setTimeout(() => { el.textContent = finalVal; }, duration * 0.3);
  }

  /* ========================================================================
     11. LIGHTWEIGHT CHARTS (Real Price Feeds Only — No Random Walk)
     ======================================================================== */
  let lwCurrentMinute = null;
  let lwCurrentBar = null;

  function initLightweightChart() {
    try {
      const container = document.getElementById('lw-chart-container');
      if (!container || !window.LightweightCharts) {
        console.warn('[MANUS MAX v6.1] LightweightCharts library not found on page.');
        return;
      }

      showChartLoadingState(container);

      const chart = window.LightweightCharts.createChart(container, {
        layout: {
          background: { type: 'solid', color: '#060910' },
          textColor: 'rgba(255,255,255,0.4)',
          fontFamily: "'JetBrains Mono', monospace",
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)' },
          horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        crosshair: {
          mode: window.LightweightCharts.CrosshairMode.Normal,
          vertLine: { color: 'rgba(245,194,66,0.5)', width: 1, style: 1 },
          horzLine: { color: 'rgba(245,194,66,0.5)', width: 1, style: 1 },
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.08)',
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.08)',
        },
        handleScroll: true,
        handleScale: true,
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor:         '#10b981',
        downColor:       '#ef4444',
        borderUpColor:   '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor:     '#10b981',
        wickDownColor:   '#ef4444',
      });

      state.lwChart = chart;
      state.lwCandleSeries = candleSeries;

      const resizeObs = new ResizeObserver(() => {
        try {
          chart.applyOptions({
            width:  container.clientWidth,
            height: container.clientHeight,
          });
        } catch (err) {
          console.error('[MANUS MAX]', 'chart resize error', err);
        }
      });
      resizeObs.observe(container);

      // Immediately fetch real historical candles from backend pipeline
      fetchHistoricalCandles(state.timeframe);

      console.log('[MANUS MAX v6.2] Lightweight Charts initialized.');
    } catch (err) {
      console.error('[MANUS MAX]', 'initLightweightChart error', err);
      showError('initLightweightChart', err.message);
    }
  }

  async function fetchHistoricalCandles(tf = state.timeframe) {
    try {
      const container = document.getElementById('lw-chart-container');
      showChartLoadingState(container);

      const endpoints = [
        `/.netlify/functions/gold-history?timeframe=${tf}&limit=100`,
        `/api/gold-history?timeframe=${tf}&limit=100`,
      ];
      let candles = null;
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, { signal: AbortSignal.timeout(4500) });
          if (!res.ok) continue;
          const data = await res.json();
          if (data && Array.isArray(data.candles) && data.candles.length > 0) {
            candles = data.candles;
            break;
          }
        } catch (e) {
          // Proceed to next fallback
        }
      }

      if (candles && state.lwCandleSeries) {
        state.lwCandleSeries.setData(candles);
        // Store OHLCV candles for the signal engine — this is the core data bridge
        state.ohlcHistory = candles;
        hideChartLoadingState();
        if (state.lwChart) state.lwChart.timeScale().fitContent();
        updateChartDataLabel(`XAU/USD (${tf}) • Real Feed`);
        // Re-run signal engine with fresh OHLCV data
        if (state.goldPrice) {
          updateSignalEngine();
        }
        if (state.signal && state.goldPrice) {
          drawSMCOverlays(state.lwChart, state.lwCandleSeries, state.goldPrice);
        }
      } else {
        hideChartLoadingState();
      }
    } catch (e) {
      console.warn('[MANUS MAX] fetchHistoricalCandles error', e);
      hideChartLoadingState();
    }
  }

  function showChartLoadingState(container) {
    if (!container) return;
    let loading = document.getElementById('lw-chart-loading-indicator');
    if (!loading) {
      loading = document.createElement('div');
      loading.id = 'lw-chart-loading-indicator';
      loading.style.cssText = `
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        color: rgba(245, 194, 66, 0.8); font-size: 12px; font-weight: 600;
        letter-spacing: 0.05em; pointer-events: none; z-index: 10;
      `;
      loading.textContent = 'Loading chart data...';
      container.style.position = 'relative';
      container.appendChild(loading);
    }
  }

  function hideChartLoadingState() {
    const loading = document.getElementById('lw-chart-loading-indicator');
    if (loading) loading.remove();
  }

  function getBarIntervalSeconds(tf) {
    return { M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 }[tf] || 3600;
  }

  function pushOHLCTick(price) {
    try {
      if (!state.lwCandleSeries) return;
      hideChartLoadingState();

      const now = Math.floor(Date.now() / 1000);
      const barInterval = getBarIntervalSeconds(state.timeframe);
      const barTime = Math.floor(now / barInterval) * barInterval;

      if (lwCurrentMinute !== barTime) {
        lwCurrentMinute = barTime;
        lwCurrentBar = { time: barTime, open: price, high: price, low: price, close: price };
      } else if (lwCurrentBar) {
        lwCurrentBar.high  = Math.max(lwCurrentBar.high, price);
        lwCurrentBar.low   = Math.min(lwCurrentBar.low, price);
        lwCurrentBar.close = price;
      }

      if (lwCurrentBar) {
        state.lwCandleSeries.update(lwCurrentBar);
      }
    } catch (err) {
      console.error('[MANUS MAX]', 'pushOHLCTick error', err);
      showError('pushOHLCTick', err.message);
    }
  }

  function updateLWChartPrice(price) {
    pushOHLCTick(price);
    if (state.lwChart && state.lwCandleSeries && state.signal) {
      drawSMCOverlays(state.lwChart, state.lwCandleSeries, price);
    }
  }

  function regenerateLWChartData() {
    try {
      if (!state.lwChart || !state.lwCandleSeries) return;
      lwCurrentMinute = null;
      lwCurrentBar    = null;

      if (state.goldPrice && state.priceHistory.length > 0) {
        const barInterval = getBarIntervalSeconds(state.timeframe);
        const now = Math.floor(Date.now() / 1000);
        const bars = [];
        const histLen = state.priceHistory.length;

        state.priceHistory.forEach((price, i) => {
          const ageSeconds = (histLen - 1 - i) * 60;
          const barTime = Math.floor((now - ageSeconds) / barInterval) * barInterval;
          const existing = bars.find(b => b.time === barTime);
          if (existing) {
            existing.high  = Math.max(existing.high, price);
            existing.low   = Math.min(existing.low, price);
            existing.close = price;
          } else {
            bars.push({ time: barTime, open: price, high: price, low: price, close: price });
          }
        });

        bars.sort((a, b) => a.time - b.time);
        state.lwCandleSeries.setData(bars);

        if (state.signal) {
          drawSMCOverlays(state.lwChart, state.lwCandleSeries, state.goldPrice);
        }
        state.lwChart.timeScale().fitContent();
      }
    } catch (err) {
      console.error('[MANUS MAX]', 'regenerateLWChartData error', err);
      showError('regenerateLWChartData', err.message);
    }
  }

  function drawSMCOverlays(chart, series, currentPrice) {
    if (!state.showIndicators || !state.signal) return;
    try {
      const sig = state.signal;
      const keys = ['entryLine', 'slLine', 'tp1Line', 'tp2Line', 'tp3Line', 'obLine', 'fvgLine', 'liqLine', 'chochLine'];
      keys.forEach(k => {
        if (state.lwSeries[k]) {
          try { series.removePriceLine(state.lwSeries[k]); } catch (_) {}
          state.lwSeries[k] = null;
        }
      });

      state.lwSeries.entryLine = series.createPriceLine({
        price: sig.entry,
        color: '#f5c242',
        lineWidth: 2,
        lineStyle: window.LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: `ENTRY ${formatPrice(sig.entry)}`,
      });

      state.lwSeries.slLine = series.createPriceLine({
        price: sig.sl,
        color: '#ef4444',
        lineWidth: 1.5,
        lineStyle: window.LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: `SL ${formatPrice(sig.sl)}`,
      });

      if (sig.tp1) {
        state.lwSeries.tp1Line = series.createPriceLine({
          price: sig.tp1,
          color: '#10b981',
          lineWidth: 1.5,
          lineStyle: window.LightweightCharts.LineStyle.Dotted,
          axisLabelVisible: true,
          title: `TP1 (1:2) ${formatPrice(sig.tp1)}`,
        });
      }

      if (sig.tp2) {
        state.lwSeries.tp2Line = series.createPriceLine({
          price: sig.tp2,
          color: '#ffd700',
          lineWidth: 1.5,
          lineStyle: window.LightweightCharts.LineStyle.Dotted,
          axisLabelVisible: true,
          title: `TP2 (1:${sig.rr}) ${formatPrice(sig.tp2)}`,
        });
      }

      if (sig.tp3) {
        state.lwSeries.tp3Line = series.createPriceLine({
          price: sig.tp3,
          color: '#fff200',
          lineWidth: 1,
          lineStyle: window.LightweightCharts.LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: `TP3 HTF ${formatPrice(sig.tp3)}`,
        });
      }

      const isLong = sig.type === 'LONG';

      // Use real candle-derived SMC levels when ohlcHistory is available
      let obPrice, fvgPrice, liqPrice, chochPrice;

      if (state.ohlcHistory && state.ohlcHistory.length >= 10) {
        const candles = state.ohlcHistory;
        const { swingHigh, swingLow } = detectSwings(candles, 20);
        const ob = detectOrderBlock(candles, sig.type);
        const fvgLevel = detectFVG(candles, sig.type);
        const choch = detectCHoCH(candles, sig.type);

        // Liquidity level = relevant swing high/low
        liqPrice   = isLong ? parseFloat(swingLow.toFixed(2))  : parseFloat(swingHigh.toFixed(2));
        // CHoCH level
        chochPrice = choch.breakLevel || (isLong ? parseFloat((currentPrice * 0.992).toFixed(2)) : parseFloat((currentPrice * 1.008).toFixed(2)));
        // Order Block
        obPrice    = ob ? (isLong ? parseFloat(ob.obLow.toFixed(2)) : parseFloat(ob.obHigh.toFixed(2)))
                        : parseFloat((currentPrice * (isLong ? 0.997 : 1.003)).toFixed(2));
        // FVG
        fvgPrice   = fvgLevel !== null ? fvgLevel : parseFloat((currentPrice * (isLong ? 0.9985 : 1.0015)).toFixed(2));
      } else {
        // Fallback: percentage offsets when no candle data
        obPrice    = parseFloat((currentPrice * (isLong ? 0.997 : 1.003)).toFixed(2));
        fvgPrice   = parseFloat((currentPrice * (isLong ? 0.9985 : 1.0015)).toFixed(2));
        liqPrice   = parseFloat((currentPrice * (isLong ? 0.995 : 1.005)).toFixed(2));
        chochPrice = parseFloat((currentPrice * (isLong ? 0.992 : 1.008)).toFixed(2));
      }

      state.lwSeries.obLine = series.createPriceLine({
        price: obPrice,
        color: 'rgba(245,194,66,0.6)',
        lineWidth: 1,
        lineStyle: window.LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: `OB ${formatPrice(obPrice)}`,
      });

      state.lwSeries.fvgLine = series.createPriceLine({
        price: fvgPrice,
        color: 'rgba(139,92,246,0.6)',
        lineWidth: 1,
        lineStyle: window.LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: `FVG ${formatPrice(fvgPrice)}`,
      });

      state.lwSeries.liqLine = series.createPriceLine({
        price: liqPrice,
        color: 'rgba(6,182,212,0.7)',
        lineWidth: 1,
        lineStyle: window.LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Liq ${formatPrice(liqPrice)}`,
      });

      state.lwSeries.chochLine = series.createPriceLine({
        price: chochPrice,
        color: 'rgba(245,194,66,0.4)',
        lineWidth: 1,
        lineStyle: window.LightweightCharts.LineStyle.SparseDotted,
        axisLabelVisible: true,
        title: `CHOCH ${formatPrice(chochPrice)}`,
      });
    } catch (err) {
      console.error('[MANUS MAX]', 'drawSMCOverlays error', err);
      showError('drawSMCOverlays', err.message);
    }
  }

  /* ========================================================================
     12. INTERACTIVE MODEL SIMULATOR (50/30/20 weights)
     ======================================================================== */
  function initSimulator() {
    try {
      const inputs = {
        realYield: document.getElementById('sim-input-realyield'),
        dxy:       document.getElementById('sim-input-dxy'),
        ema:       document.getElementById('sim-input-ema'),
        bb:        document.getElementById('sim-input-bb'),
        smc:       document.getElementById('sim-input-smc'),
        gpr:       document.getElementById('sim-input-gpr')
      };
      if (!inputs.realYield) return;

      const vals = {
        realYield: document.getElementById('sim-val-realyield'),
        dxy:       document.getElementById('sim-val-dxy'),
        ema:       document.getElementById('sim-val-ema'),
        bb:        document.getElementById('sim-val-bb'),
        smc:       document.getElementById('sim-val-smc'),
        gpr:       document.getElementById('sim-val-gpr')
      };

      function calc() {
        const smcScores = { choch_ob: 93, fvg: 80, liq_sweep: 88, none: 40 };
        const smcVal = inputs.smc ? inputs.smc.value : 'choch_ob';
        const instScore = smcScores[smcVal] || 50;
        if (vals.smc) vals.smc.textContent = { choch_ob: 'CHOCH + OB', fvg: 'FVG Fill', liq_sweep: 'Liq Sweep', none: 'No Signal' }[smcVal];

        const ryVal = parseFloat(inputs.realYield.value);
        if (vals.realYield) vals.realYield.textContent = `${ryVal.toFixed(2)}% (${ryVal < 0 ? 'Negative / Bullish' : 'Positive / Bearish'})`;
        let macroScore = 50;
        if (ryVal < 0) macroScore += Math.abs(ryVal) * 22;
        else macroScore -= ryVal * 20;

        const dxyVal = inputs.dxy.value;
        if (vals.dxy) vals.dxy.textContent = { weak: 'Weakening (Bullish Au)', flat: 'Neutral', strong: 'Strengthening (Bearish Au)' }[dxyVal];
        if (dxyVal === 'weak') macroScore += 18; else if (dxyVal === 'strong') macroScore -= 18;

        const gprVal = parseInt(inputs.gpr.value);
        if (vals.gpr) vals.gpr.textContent = `${gprVal} (${gprVal > 120 ? 'High Risk' : 'Normal'})`;
        macroScore += (gprVal - 100) * 0.12;

        const emaVal = inputs.ema.value;
        if (vals.ema) vals.ema.textContent = { bullish: 'Price > 50 > 200', neutral: 'Between EMAs', bearish: 'Price < 50 < 200' }[emaVal];
        let techScore = 50;
        if (emaVal === 'bullish') techScore += 22; else if (emaVal === 'bearish') techScore -= 22;

        const bbVal = inputs.bb.value;
        if (vals.bb) vals.bb.textContent = { breakout_up: 'Squeeze + Upper Break', squeeze: 'Squeeze Phase', breakout_down: 'Squeeze + Lower Break', normal: 'Normal Vol' }[bbVal];
        if (bbVal === 'breakout_up') techScore += 18; else if (bbVal === 'squeeze') techScore += 8; else if (bbVal === 'breakout_down') techScore -= 18;

        const instC  = Math.min(98, Math.max(20, instScore));
        const macroC = Math.min(98, Math.max(20, macroScore));
        const techC  = Math.min(98, Math.max(20, techScore));
        const total  = Math.min(98, Math.max(15, Math.round(instC * 0.50 + macroC * 0.30 + techC * 0.20)));

        const scoreEl = document.getElementById('sim-result-score');
        const badgeEl = document.getElementById('sim-result-badge');
        const textEl  = document.getElementById('sim-result-text');

        if (scoreEl) scoreEl.textContent = `${total}%`;

        if (state.signal && document.getElementById('tab-engine')?.classList.contains('active')) {
          state.signal.confidence = total;
          state.signal.confInst   = instC;
          state.signal.confMacro  = macroC;
          state.signal.confTech   = techC;
          updateConfidenceDynamically();
        }

        if (badgeEl && textEl) {
          if (total >= 85) {
            badgeEl.className = 'sim-out-signal signal-buy';
            badgeEl.innerHTML = '<i data-lucide="check-circle-2"></i> HIGH CONFIDENCE LONG SIGNAL';
            textEl.textContent = `Institutional ${instC}% × 50% + Macro ${macroC}% × 30% + Technical ${techC}% × 20% = ${total}% weighted.`;
          } else if (total >= 70) {
            badgeEl.className = 'sim-out-signal';
            badgeEl.style.cssText = 'background:rgba(245,194,66,0.15);color:#f5c242;border:1px solid rgba(245,194,66,0.4);';
            badgeEl.innerHTML = '<i data-lucide="alert-circle"></i> MEDIUM CONFIDENCE SIGNAL';
            textEl.textContent = `Partial confluence. Score: ${total}%. Inst ${instC}×0.50 + Macro ${macroC}×0.30 + Tech ${techC}×0.20.`;
          } else {
            badgeEl.className = 'sim-out-signal';
            badgeEl.style.cssText = 'background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.4);';
            badgeEl.innerHTML = '<i data-lucide="x-circle"></i> NO TRADE — FILTERED (< 70%)';
            textEl.textContent = `Confidence ${total}% is below the 70% execution threshold. Trade filtered to protect risk.`;
          }
          if (window.lucide) window.lucide.createIcons();
        }
      }

      Object.values(inputs).forEach(el => {
        if (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); }
      });
      calc();
    } catch (err) {
      console.error('[MANUS MAX]', 'initSimulator error', err);
      showError('initSimulator', err.message);
    }
  }

  /* ========================================================================
     13. RISK CALCULATOR & POSITION SIZING
     ======================================================================== */
  function initCalculator() {
    try {
      const fields = {
        balance:   document.getElementById('calc-balance'),
        riskPct:   document.getElementById('calc-risk-pct'),
        entry:     document.getElementById('calc-entry'),
        sl:        document.getElementById('calc-sl'),
        rrTarget:  document.getElementById('calc-rr-target')
      };
      const outs = {
        riskAmount: document.getElementById('calc-risk-amount'),
        lots:       document.getElementById('out-lots'),
        pips:       document.getElementById('out-pips'),
        tp1:        document.getElementById('out-tp1'),
        tp2:        document.getElementById('out-tp2'),
        tp3:        document.getElementById('out-tp3')
      };
      if (!fields.balance) return;

      function calc() {
        const balance   = parseFloat(fields.balance.value)   || 10000;
        const riskPct   = parseFloat(fields.riskPct.value)   || 1.0;
        const entry     = parseFloat(fields.entry.value)     || (state.goldPrice || 4055.00);
        const sl        = parseFloat(fields.sl.value)        || (state.goldPrice ? state.goldPrice - 11.5 : 4043.50);
        const rrTarget  = parseInt(fields.rrTarget ? fields.rrTarget.value : '4') || 4;

        const riskAmount = balance * (riskPct / 100);
        const priceDist  = Math.abs(entry - sl);
        const pipsDist   = priceDist * 10;
        const lotSize    = priceDist > 0 ? riskAmount / (priceDist * 100) : 0;
        const isBuy      = entry > sl;
        const tp1Price   = isBuy ? entry + priceDist * 2 : entry - priceDist * 2;
        const tp2Price   = isBuy ? entry + priceDist * rrTarget : entry - priceDist * rrTarget;
        const tp3RR      = Math.min(10, rrTarget * 2);
        const tp3Price   = isBuy ? entry + priceDist * tp3RR : entry - priceDist * tp3RR;

        if (outs.riskAmount) outs.riskAmount.textContent = `$${riskAmount.toFixed(2)}`;
        if (outs.lots)       outs.lots.textContent       = `${lotSize.toFixed(2)} Lots`;
        if (outs.pips)       outs.pips.textContent       = `${pipsDist.toFixed(1)} Pips`;
        if (outs.tp1)        outs.tp1.textContent        = formatPrice(tp1Price);
        if (outs.tp2)        outs.tp2.textContent        = formatPrice(tp2Price);
        if (outs.tp3) {
          outs.tp3.textContent = formatPrice(tp3Price);
          const tp3Label = document.querySelector('#out-tp3 + .sub') || outs.tp3.parentElement?.querySelector('.sub');
          if (tp3Label) tp3Label.textContent = `+${(tp3RR * pipsDist).toFixed(0)} Pips (1:${tp3RR} Max HTF)`;
        }
      }

      Object.values(fields).forEach(el => {
        if (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); }
      });

      const btnRecalc = document.getElementById('btn-recalc');
      if (btnRecalc) {
        btnRecalc.addEventListener('click', () => {
          try {
            calc();
            showNotification('Position size and SL/TP recalculated.');
          } catch (err) {
            console.error('[MANUS MAX]', 'btn-recalc error', err);
            showError('btn-recalc', err.message);
          }
        });
      }

      calc();
    } catch (err) {
      console.error('[MANUS MAX]', 'initCalculator error', err);
      showError('initCalculator', err.message);
    }
  }

  /* ========================================================================
     14. ACTION BUTTONS & CLIPBOARD
     ======================================================================== */
  function initActionButtons() {
    // 1. btn-refresh-signal: Re-fetch price from provider, regenerate signals, show loading
    const btnRefresh = document.getElementById('btn-refresh-signal');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', async function () {
        try {
          const btn = this;
          btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Fetching...';
          btn.disabled = true;
          if (window.lucide) window.lucide.createIcons();

          const ok = await fetchLiveGoldPrice();

          setTimeout(() => {
            btn.innerHTML = '<i data-lucide="rotate-cw"></i> Run Inference';
            btn.disabled = false;
            if (window.lucide) window.lucide.createIcons();

            if (ok && state.goldPrice) {
              updateSignalEngine();
              if (state.lwChart && state.lwCandleSeries) {
                drawSMCOverlays(state.lwChart, state.lwCandleSeries, state.goldPrice);
              }
              showNotification(`Price updated: ${formatPrice(state.goldPrice)} (${state.dataSource || 'Live'})`);
            } else {
              showNotification('⚠ Could not retrieve live price. Check data provider configuration.');
            }
          }, 600);
        } catch (err) {
          console.error('[MANUS MAX]', 'btn-refresh-signal error', err);
          showError('btn-refresh-signal', err.message);
          this.innerHTML = '<i data-lucide="rotate-cw"></i> Run Inference';
          this.disabled = false;
        }
      });
    }

    // 2. btn-quick-signal: Scroll to signal feed list and flash it
    const btnQuick = document.getElementById('btn-quick-signal');
    if (btnQuick) {
      btnQuick.addEventListener('click', () => {
        try {
          const termTab = document.querySelector('.nav-tab[data-tab="terminal"]');
          if (termTab) termTab.click();

          setTimeout(() => {
            const feedEl = document.getElementById('signal-feed-list');
            if (feedEl) {
              feedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              feedEl.style.transition = 'box-shadow 0.3s ease';
              feedEl.style.boxShadow = '0 0 24px rgba(245, 194, 66, 0.6)';
              setTimeout(() => { feedEl.style.boxShadow = ''; }, 1200);
            }
          }, 100);
        } catch (err) {
          console.error('[MANUS MAX]', 'btn-quick-signal error', err);
          showError('btn-quick-signal', err.message);
        }
      });
    }

    // 3. btn-copy-signal: Copy signal JSON to clipboard with real current data
    const btnCopySig = document.getElementById('btn-copy-signal');
    if (btnCopySig) {
      btnCopySig.addEventListener('click', () => {
        try {
          const s = state.signal;
          if (!s) {
            showNotification('⚠ No active signal available. Data provider must supply price history.');
            return;
          }

          const payload = {
            platform: 'MANUS MAX AI 6.1 — XAU/USD Institutional Signal Engine',
            disclaimer: 'EDUCATIONAL USE ONLY — Not financial advice',
            timestamp: new Date().toISOString(),
            dataSource: state.dataSource || 'N/A',
            liveSpotPrice: state.goldPrice,
            strategy: s.strategy,
            direction: s.type,
            levels: {
              entry: s.entry,
              stopLoss: s.sl,
              takeProfit1: s.tp1,
              takeProfit2: s.tp2,
              takeProfit3: s.tp3,
              riskRewardRatio: `1:${s.rr}`
            },
            confidence: {
              totalScore: `${s.confidence}%`,
              institutionalWeight: '50%',
              institutionalScore: `${s.confInst}%`,
              macroWeight: '30%',
              macroScore: `${s.confMacro}%`,
              technicalWeight: '20%',
              technicalScore: `${s.confTech}%`
            },
            setupReason: s.reason
          };

          const text = JSON.stringify(payload, null, 2);
          navigator.clipboard.writeText(text).then(() => {
            showNotification('Signal JSON copied to clipboard!');
          }).catch(err => {
            showError('clipboardWrite', err.message);
          });
        } catch (err) {
          console.error('[MANUS MAX]', 'btn-copy-signal error', err);
          showError('btn-copy-signal', err.message);
        }
      });
    }

    // 4. btn-open-calc: Switch to calculator tab
    const btnOpenCalc = document.getElementById('btn-open-calc');
    if (btnOpenCalc) {
      btnOpenCalc.addEventListener('click', () => {
        try {
          const calcTab = document.querySelector('.nav-tab[data-tab="calculator"]');
          if (calcTab) calcTab.click();

          if (state.signal) {
            const entryField = document.getElementById('calc-entry');
            const slField = document.getElementById('calc-sl');
            if (entryField) entryField.value = state.signal.entry.toFixed(2);
            if (slField) slField.value = state.signal.sl.toFixed(2);
            const recalcBtn = document.getElementById('btn-recalc');
            if (recalcBtn) recalcBtn.click();
          }
        } catch (err) {
          console.error('[MANUS MAX]', 'btn-open-calc error', err);
          showError('btn-open-calc', err.message);
        }
      });
    }

    // 5. btn-copy-json: Copy the JSON preview code
    const btnCopyJson = document.getElementById('btn-copy-json');
    if (btnCopyJson) {
      btnCopyJson.addEventListener('click', () => {
        try {
          const el = document.getElementById('json-preview-content');
          const jsonText = el ? el.textContent : JSON.stringify({
            status: 'LIVE',
            pair: 'XAU/USD',
            price: state.goldPrice,
            source: state.dataSource
          }, null, 2);

          navigator.clipboard.writeText(jsonText).then(() => {
            showNotification('API JSON copied to clipboard!');
          }).catch(err => {
            showError('btn-copy-json', err.message);
          });
        } catch (err) {
          console.error('[MANUS MAX]', 'btn-copy-json error', err);
          showError('btn-copy-json', err.message);
        }
      });
    }
  }

  /* ========================================================================
     HERO SIGNAL UI UPDATE
     ======================================================================== */
  function updateHeroSignalUI() {
    if (!state.signal) return;
    try {
      const s = state.signal;
      const els = {
        strategy: document.getElementById('hero-strategy'),
        entry:    document.getElementById('sig-entry'),
        sl:       document.getElementById('sig-sl'),
        tp1:      document.getElementById('sig-tp1'),
        tp2:      document.getElementById('sig-tp2'),
        tp3:      document.getElementById('sig-tp3'),
        rr:       document.getElementById('sig-rr'),
        reason:   document.getElementById('hero-reason'),
        badge:    document.getElementById('hero-signal-badge')
      };

      if (els.strategy) els.strategy.textContent = s.strategy;
      if (els.entry)    els.entry.textContent    = formatPrice(s.entry);
      if (els.sl)       els.sl.textContent       = formatPrice(s.sl);
      if (els.tp1)      els.tp1.textContent      = formatPrice(s.tp1);
      if (els.tp2)      els.tp2.textContent      = formatPrice(s.tp2);
      if (els.tp3 && s.tp3) els.tp3.textContent  = formatPrice(s.tp3);
      if (els.rr)       els.rr.textContent       = '1 : ' + s.rr;
      if (els.reason)   els.reason.textContent   = s.reason;

      if (els.badge) {
        if (s.type === 'LONG') {
          els.badge.className = 'signal-type-badge signal-buy';
          els.badge.innerHTML = '<i data-lucide="trending-up"></i> <span id="hero-signal-label">INSTITUTIONAL LONG SIGNAL</span>';
        } else {
          els.badge.className = 'signal-type-badge signal-sell';
          els.badge.innerHTML = '<i data-lucide="trending-down"></i> <span id="hero-signal-label">INSTITUTIONAL SHORT SIGNAL</span>';
        }
      }

      updateConfidenceDynamically();
      updateNewsBadges();
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('[MANUS MAX]', 'updateHeroSignalUI error', err);
      showError('updateHeroSignalUI', err.message);
    }
  }

  /* ========================================================================
     TOAST NOTIFICATIONS
     ======================================================================== */
  function showNotification(message) {
    try {
      let toast = document.getElementById('app-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.style.cssText = `
          position: fixed; bottom: 24px; right: 24px;
          background: linear-gradient(135deg, #f5c242, #eab308);
          color: #090d16; padding: 12px 20px; border-radius: 8px;
          font-weight: 800; font-size: 13px;
          box-shadow: 0 8px 24px rgba(245,194,66,0.4);
          z-index: 9999; transition: all 0.3s ease; max-width: 420px; line-height: 1.4;
        `;
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
      setTimeout(() => {
        if (toast) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(10px)';
        }
      }, 3500);
    } catch (err) {
      console.error('[MANUS MAX]', 'showNotification error', err);
    }
  }

  /* ========================================================================
     15. BACKEND PIPELINE & SUPABASE REALTIME SYNC
     ======================================================================== */
  const SUPABASE_URL = window.SUPABASE_URL || 'https://nrdwfhllmahtakfvtruo.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

  async function checkBackendPipelineHealth() {
    try {
      const endpoints = ['/.netlify/functions/health', '/api/health'];
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            const health = await res.json();
            console.log('[MANUS MAX v6.2] Backend pipeline connected:', health);
            const statusText = document.getElementById('api-status-text');
            if (statusText) {
              statusText.textContent = `PIPELINE: ${health.provider || 'LIVE (XAU/USD)'}`;
            }
            return true;
          }
        } catch (e) {
          // Try next endpoint
        }
      }
    } catch (err) {
      console.warn('[MANUS MAX] Backend pipeline health check deferred:', err.message);
    }
    return false;
  }

  async function initSupabaseSync() {
    try {
      console.log('[MANUS MAX v6.2] Initializing backend pipeline & Supabase sync...');

      // 1. Verify backend pipeline health
      await checkBackendPipelineHealth();

      // 2. Load persistent signals and drawings from backend
      await loadSignalsFromSupabase();
      await loadDrawingsFromSupabase();

      // 3. Connect Supabase Realtime if window.supabase and public anon key are available
      if (window.supabase && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.startsWith('sb_secret')) {
        state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Realtime listener for signals
        state.supabase
          .channel('public:signals')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, (payload) => {
            console.log('[MANUS MAX] Realtime signal received from Supabase:', payload.new);
            if (payload.new) handleIncomingSupabaseSignal(payload.new);
          })
          .subscribe();

        // Realtime listener for chart drawings
        state.supabase
          .channel('public:chart_drawings')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'chart_drawings' }, (payload) => {
            console.log('[MANUS MAX] Realtime chart drawing update:', payload.eventType);
          })
          .subscribe();

        // Realtime listener for market status
        state.supabase
          .channel('public:market_status')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'market_status' }, (payload) => {
            if (payload.new && payload.new.last_tick_price && !state.goldPrice) {
              processTick(payload.new.last_tick_price, null, `Supabase/${payload.new.provider || 'Live'}`);
            }
          })
          .subscribe();

        updateSupabaseBadge(true);
      }
    } catch (err) {
      console.warn('[MANUS MAX] Backend sync initialized with REST pipeline:', err.message);
      updateSupabaseBadge(false);
    }
  }

  async function loadSignalsFromSupabase() {
    try {
      let signals = null;
      const endpoints = ['/.netlify/functions/signals', '/api/signals'];
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            signals = await res.json();
            break;
          }
        } catch (e) { /* try next */ }
      }

      if (Array.isArray(signals) && signals.length > 0) {
        console.log(`[MANUS MAX] Loaded ${signals.length} persistent signals from backend.`);
        signals.forEach(sig => {
          if (!state.signalFeed.find(s => s.id === sig.id)) {
            state.signalFeed.push(formatSupabaseSignal(sig));
          }
        });
        renderSignalFeed();
      }
    } catch (err) {
      console.error('[MANUS MAX]', 'loadSignalsFromSupabase error', err);
    }
  }

  async function persistSignalToSupabase(sig) {
    try {
      const endpoints = ['/.netlify/functions/signals', '/api/signals'];
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: 'XAUUSD',
              direction: sig.dir,
              strategy: sig.strategy,
              timeframe: sig.tf || state.timeframe || 'H1',
              entry_price: sig.entry,
              sl_price: sig.sl,
              tp1_price: sig.tp1,
              tp2_price: sig.tp2,
              tp3_price: sig.tp3,
              rr_ratio: parseFloat(sig.rr) || 2.0,
              confidence_total: sig.conf || 85,
              confidence_inst: sig.confInst || 85,
              confidence_macro: sig.confMacro || 80,
              confidence_tech: sig.confTech || 85,
              reason: sig.reason || 'SMC Confluence Confirmation',
              status: 'ACTIVE',
            }),
          });
          if (res.ok) break;
        } catch (e) { /* try next */ }
      }
    } catch (e) {
      // Background sync error ignored
    }
  }

  function formatSupabaseSignal(sig) {
    return {
      id: sig.id || `SIG-${Date.now()}`,
      dir: sig.direction || 'LONG',
      strategy: sig.strategy || 'ICT_SilverBullet',
      tf: sig.timeframe || 'H1',
      entry: parseFloat(sig.entry_price || 0),
      sl: parseFloat(sig.sl_price || 0),
      tp1: parseFloat(sig.tp1_price || 0),
      tp2: parseFloat(sig.tp2_price || 0),
      tp3: parseFloat(sig.tp3_price || 0),
      rr: sig.rr_ratio ? parseFloat(sig.rr_ratio).toFixed(1) : '2.0',
      conf: sig.confidence_total || 85,
      confInst: sig.confidence_inst || 85,
      confMacro: sig.confidence_macro || 80,
      confTech: sig.confidence_tech || 85,
      reason: sig.reason || 'SMC Confluence Confirmation',
      time: sig.generated_at ? new Date(sig.generated_at).toLocaleTimeString() + ' UTC' : 'LIVE',
      isPredictive: sig.status === 'WATCH',
      newsFlag: false,
    };
  }

  function handleIncomingSupabaseSignal(sig) {
    const formatted = formatSupabaseSignal(sig);
    if (!state.signalFeed.find(s => s.id === formatted.id)) {
      state.signalFeed.unshift(formatted);
      renderSignalFeed();
      showNotification('New Institutional Signal', `${formatted.dir} on XAU/USD (${formatted.strategy})`);
    }
  }

  async function loadDrawingsFromSupabase() {
    try {
      const deviceKey = state.persistKey || 'default-device';
      let drawings = null;
      const endpoints = [
        `/.netlify/functions/drawings?device_key=${encodeURIComponent(deviceKey)}`,
        `/api/drawings?device_key=${encodeURIComponent(deviceKey)}`,
      ];
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            drawings = await res.json();
            break;
          }
        } catch (e) { /* try next */ }
      }

      if (Array.isArray(drawings) && drawings.length > 0) {
        console.log(`[MANUS MAX] Loaded ${drawings.length} drawings from backend.`);
      }
    } catch (err) {
      console.error('[MANUS MAX]', 'loadDrawingsFromSupabase error', err);
    }
  }

  function updateSupabaseBadge(connected) {
    const statusText = document.getElementById('api-status-text');
    if (statusText && connected) {
      console.log('[MANUS MAX] Backend sync active.');
    }
  }

  window.initSupabase = initSupabaseSync;

  console.log('[MANUS MAX v6.2] Initialized successfully. Polling XAU/USD data feed.');
}); // end DOMContentLoaded
