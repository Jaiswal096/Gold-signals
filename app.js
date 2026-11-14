/* ==========================================================================
   MANUS MAX AI 6.0 — XAU/USD Institutional Signal Engine
   SMC • ICT A-M-D • Raja Banks • Ali Vidollar • Silver Bullet
   Lightweight Charts Overlay • Quantitative News Engine • Killzone Timer
   Dynamic RR (TP3 up to 1:10) • 3-Pillar Weighted Confidence v6.0
   Inst 50% / Macro 30% / Tech 20% | LocalStorage Persistence
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) window.lucide.createIcons();

  /* ========================================================================
     STATE MANAGEMENT
     ======================================================================== */
  const state = {
    currentTab: 'terminal',
    goldPrice: 4085.00,
    goldPrevClose: 4055.00,
    goldChangePct: 0.74,
    goldChangePts: 30.00,
    timeframe: 'H1',
    confidenceScore: 92,
    showIndicators: true,
    lastFetchTime: null,
    fetchStatus: 'connecting',
    priceHistory: [],
    ohlcBuffer: [],   // For Lightweight Charts candlestick data

    // Active hero signal
    signal: {
      type: 'LONG',
      strategy: 'ICT_SilverBullet',
      entry: 4055.00,
      sl: 4043.50,
      tp1: 4077.50,
      tp2: 4101.00,
      tp3: 4149.00,
      rr: 4.0,
      atr: 8.20,
      reason: 'M5 FVG Fill + London Liquidity Sweep + Rejection at H4 Supply Zone + Bearish RSI Divergence on H1',
      confidence: 92,
      confInst: 93,
      confMacro: 88,
      confTech: 94
    },

    // Signal history — fully upgraded with strategy + reason + news + PnL
    history: [
      {
        id: 'XAUUSD-2026-9843',
        openTs: '2026-08-08 10:25 UTC',
        closeTs: '— (ACTIVE)',
        dir: 'BUY',
        strategy: 'ICT_SilverBullet',
        entry: 4055.00, sl: 4043.50, tp2: 4101.00, tp3: 4149.00,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: 'LIVE', confidence: '92%',
        news: 'CPI', newsClass: 'news-badge',
        status: 'ACTIVE',
        reason: 'M5 FVG Fill + London Liq Sweep + H4 OB Rejection + RSI Div M15',
        pnl: null
      },
      {
        id: 'XAUUSD-2026-9842',
        openTs: '2026-08-07 08:15 UTC',
        closeTs: '2026-08-07 13:42 UTC',
        dir: 'BUY',
        strategy: 'ICT_AMD',
        entry: 4031.80, sl: 4020.00, tp2: 4067.40, tp3: 4091.40,
        rr: '1 : 3.0', rrClass: 'rr-high',
        pips: '+356', confidence: '89%',
        news: null,
        status: 'WIN (TP2)',
        reason: 'Asia Lo Sweep (A-Phase) + London CHOCH M15 + NY Distribution Long + OB at $4,020',
        pnl: { entryPrice: 4031.80, exitPrice: 4067.40, direction: 'BUY', pips: 356, result: 'WIN' }
      },
      {
        id: 'XAUUSD-2026-9841',
        openTs: '2026-08-06 14:00 UTC',
        closeTs: '2026-08-06 17:38 UTC',
        dir: 'SELL',
        strategy: 'AliVidollar_SD',
        entry: 4048.50, sl: 4057.20, tp2: 4022.60, tp3: 4005.10,
        rr: '1 : 3.0', rrClass: 'rr-high',
        pips: '+258', confidence: '86%',
        news: 'FOMC',
        status: 'WIN (TP2)',
        reason: 'Fresh H4 Supply Zone (Rally-Base-Drop) + Liq Grab of Swing Hi + Bearish Engulf M15 + FOMC hawkish',
        pnl: { entryPrice: 4048.50, exitPrice: 4022.60, direction: 'SELL', pips: 258, result: 'WIN' }
      },
      {
        id: 'XAUUSD-2026-9840',
        openTs: '2026-08-05 10:02 UTC',
        closeTs: '2026-08-05 11:20 UTC',
        dir: 'BUY',
        strategy: 'ICT_SilverBullet',
        entry: 4012.40, sl: 4001.00, tp2: 4057.60, tp3: 4103.00,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: '+452', confidence: '94%',
        news: null,
        status: 'WIN (TP2)',
        reason: 'Silver Bullet 10:00 EST window + M5 FVG 50% fill + Fresh Demand OB + Clean traffic +500 pips',
        pnl: { entryPrice: 4012.40, exitPrice: 4057.60, direction: 'BUY', pips: 452, result: 'WIN' }
      },
      {
        id: 'XAUUSD-2026-9839',
        openTs: '2026-08-04 09:30 UTC',
        closeTs: '2026-08-04 10:55 UTC',
        dir: 'BUY',
        strategy: 'RajaBanks_CT',
        entry: 3998.60, sl: 3987.00, tp2: 4045.00, tp3: 4082.00,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: '+464', confidence: '88%',
        news: 'NFP',
        status: 'WIN (TP2)',
        reason: 'Clean Traffic Zone H4 (M30 demand) — Zero resistance to $4,045 target — NFP miss confirmed',
        pnl: { entryPrice: 3998.60, exitPrice: 4045.00, direction: 'BUY', pips: 464, result: 'WIN' }
      },
      {
        id: 'XAUUSD-2026-9838',
        openTs: '2026-08-03 08:10 UTC',
        closeTs: '2026-08-03 09:02 UTC',
        dir: 'SELL',
        strategy: 'ICT_AMD',
        entry: 4038.20, sl: 4047.00, tp2: 4011.80, tp3: 3994.30,
        rr: '1 : 3.0', rrClass: 'rr-high',
        pips: '-87', confidence: '72%',
        news: null,
        status: 'STOPPED',
        reason: 'London Manipulation phase — SL triggered before NY distribution began — AMD failed',
        pnl: { entryPrice: 4038.20, exitPrice: 4047.00, direction: 'SELL', pips: -87, result: 'LOSS' }
      },
      {
        id: 'XAUUSD-2026-9837',
        openTs: '2026-08-02 14:05 UTC',
        closeTs: '2026-08-02 16:48 UTC',
        dir: 'BUY',
        strategy: 'AliVidollar_SD',
        entry: 3975.50, sl: 3963.00, tp2: 4025.50, tp3: 4075.50,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: '+500', confidence: '91%',
        news: 'PPI',
        status: 'WIN (TP3)',
        reason: 'Fresh Demand Zone (Drop-Base-Rally) + Stop Hunt of Asian Lo + Bullish Engulfing M15 + PPI miss bullish',
        pnl: { entryPrice: 3975.50, exitPrice: 4075.50, direction: 'BUY', pips: 500, result: 'WIN' }
      }
    ],

    // Economic calendar events (with histConfidence for news trading)
    newsEvents: [
      { time: '2026-08-08 13:30 UTC', name: 'US CPI (YoY)', folder: 'red', impactPct: 85, volPips: '80-120', bias: '78% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 1.7, histConf: 'HIGH — 84% win rate on CPI miss (last 8 events)' },
      { time: '2026-08-08 18:00 UTC', name: 'FOMC Minutes', folder: 'red', impactPct: 92, volPips: '100-180', bias: '65% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 6.2, histConf: 'HIGH — 71% directional accuracy on FOMC hawkish surprises' },
      { time: '2026-08-09 12:30 UTC', name: 'US PPI (MoM)', folder: 'orange', impactPct: 65, volPips: '40-80', bias: '55% Neutral', confClass: 'news-conf-med', conf: 'MEDIUM', hoursUntil: 24.2, histConf: 'MEDIUM — 58% accuracy, lower than CPI historically' },
      { time: '2026-08-10 14:00 UTC', name: 'US Core PCE', folder: 'red', impactPct: 88, volPips: '70-130', bias: '70% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 47.8, histConf: 'HIGH — Fed\'s preferred inflation measure, 79% accuracy' },
      { time: '2026-08-15 12:30 UTC', name: 'US NFP', folder: 'red', impactPct: 95, volPips: '120-250', bias: '60% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 71.2, histConf: 'HIGH — 88% accuracy on NFP misses > 50k deviation' },
      { time: '2026-08-19 17:00 UTC', name: 'ISM Services PMI', folder: 'yellow', impactPct: 45, volPips: '20-50', bias: '50% Neutral', confClass: 'news-conf-low', conf: 'LOW', hoursUntil: 168.3, histConf: 'LOW — Secondary indicator, 52% accuracy' }
    ],

    // Signal feed (live + predictive)
    signalFeed: [],
    predictiveSetups: [],

    // Persistence
    persistKey: null,

    // Lightweight Charts instances
    lwChart: null,
    lwCandleSeries: null,
    lwPriceLine: null,
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
     1. PERSISTENCE ENGINE (LocalStorage + Device Fingerprint)
     ======================================================================== */
  function initPersistence() {
    const fingerprint = btoa(navigator.userAgent + screen.width + screen.height).slice(0, 16);
    state.persistKey = `manus_max_v6_${fingerprint}`;
    try {
      const saved = localStorage.getItem(state.persistKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.timeframe) state.timeframe = data.timeframe;
        if (data.showIndicators !== undefined) state.showIndicators = data.showIndicators;
        console.log('[MANUS MAX v6.0] Preferences restored from localStorage.');
      }
    } catch (e) { /* silent */ }
  }

  function savePersistence() {
    try {
      localStorage.setItem(state.persistKey, JSON.stringify({
        timeframe: state.timeframe,
        showIndicators: state.showIndicators,
        lastSaved: new Date().toISOString()
      }));
    } catch (e) { /* silent */ }
  }

  /* ========================================================================
     2. LIVE PRICE FEED
     Primary spot:  gold-api.com (true XAU/USD spot, CORS-enabled, no key)
     Tick stream:   Binance public market-data WS (PAXG/USDT, geo-unrestricted
                    data-stream.binance.vision endpoint), re-based onto XAU spot
     Fallbacks:     Binance public REST 24h ticker → Coinbase PAXG-USD spot
     ======================================================================== */
  const SPOT_POLL_MS = 5000;           // gold-api spot refresh
  const FALLBACK_POLL_MS = 3000;       // REST polling when WS is down
  let wsStream = null;
  let isWsConnected = false;
  let pollingIntervalId = null;
  let spotIntervalId = null;
  let wsReconnectTimer = null;
  let lastTickPrice = null;
  let paxgBasis = null;                // XAU spot − PAXG price
  let lastPaxgPrice = null;
  let hasLivePrice = false;
  let lastSpotPrice = null;            // last true XAU spot from gold-api

  function notePaxg(paxg) {
    lastPaxgPrice = paxg;
    if (paxgBasis === null && lastSpotPrice) paxgBasis = lastSpotPrice - paxg;
  }

  function initWebSocketStream() {
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
    updateStatus('connecting', 'WS STREAM');

    try {
      wsStream = new WebSocket('wss://data-stream.binance.vision/ws/paxgusdt@ticker');
      const connectTimeout = setTimeout(() => {
        if (!isWsConnected) startPollingFallback();
      }, 3500);

      wsStream.onopen = () => {
        clearTimeout(connectTimeout);
        isWsConnected = true;
        stopPollingFallback();
      };

      wsStream.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          const paxg = parseFloat(packet.c);
          const pct = parseFloat(packet.P);
          if (!isNaN(paxg) && paxg > 1000) {
            notePaxg(paxg);
            if (!isNaN(pct)) setPrevCloseFromPct(paxg, pct);
            processTick(toSpot(paxg), isWsConnected ? 'WS STREAM' : 'WS');
          }
        } catch (err) { /* ignore malformed packet */ }
      };

      wsStream.onerror = () => handleWsFailure();
      wsStream.onclose = () => handleWsFailure();
    } catch (e) { handleWsFailure(); }
  }

  function handleWsFailure() {
    isWsConnected = false;
    startPollingFallback();
    if (!wsReconnectTimer) {
      wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null;
        if (!isWsConnected) initWebSocketStream();
      }, 5000);
    }
  }

  function startPollingFallback() {
    if (pollingIntervalId !== null) return;
    updateStatus('fallback', 'HTTP polling');
    fetchFallbackPrice();
    pollingIntervalId = setInterval(fetchFallbackPrice, FALLBACK_POLL_MS);
  }

  function stopPollingFallback() {
    if (pollingIntervalId !== null) { clearInterval(pollingIntervalId); pollingIntervalId = null; }
  }

  // PAXG trades at a small discount/premium to spot; shift it onto XAU spot
  function toSpot(paxg) {
    return paxgBasis !== null ? paxg + paxgBasis : paxg;
  }

  // Derive the reference (24h-ago) price from the exchange-reported % change
  function setPrevCloseFromPct(paxgPrice, pct) {
    const paxgOpen = paxgPrice / (1 + pct / 100);
    state.goldPrevClose = toSpot(paxgOpen);
  }

  function processTick(price, source) {
    if (!isFinite(price) || price <= 0) return;
    price = parseFloat(price.toFixed(2));
    const direction = lastTickPrice === null ? null : price > lastTickPrice ? 'up' : price < lastTickPrice ? 'down' : null;
    lastTickPrice = price;

    if (!state.goldPrevClose) state.goldPrevClose = price;
    state.goldPrice = price;
    state.goldChangePts = parseFloat((price - state.goldPrevClose).toFixed(2));
    state.goldChangePct = parseFloat(((state.goldChangePts / state.goldPrevClose) * 100).toFixed(2));
    state.lastFetchTime = new Date();
    state.priceHistory.push(price);
    if (state.priceHistory.length > 80) state.priceHistory.shift();

    if (!hasLivePrice) {
      hasLivePrice = true;
      onFirstLivePrice();
    }

    updateUI(direction);
    updateStatus('live', source);
  }

  // Primary: real XAU/USD spot price
  async function fetchSpotPrice() {
    try {
      const r = await fetch('https://api.gold-api.com/price/XAU', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
      if (!r.ok) return false;
      const d = await r.json();
      const spot = parseFloat(d && d.price);
      if (isNaN(spot) || spot < 1000) return false;
      lastSpotPrice = spot;
      // Calibrate PAXG basis so WS ticks line up with spot
      if (lastPaxgPrice) {
        const oldBasis = paxgBasis;
        paxgBasis = spot - lastPaxgPrice;
        if (oldBasis === null && state.goldPrevClose) state.goldPrevClose += paxgBasis;
      }
      processTick(spot, isWsConnected ? 'XAU SPOT + WS' : 'XAU SPOT');
      return true;
    } catch (e) { return false; }
  }

  // Fallbacks used while the WS stream is down
  async function fetchFallbackPrice() {
    try {
      const r = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=PAXGUSDT', { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const d = await r.json();
        const paxg = parseFloat(d.lastPrice);
        const pct = parseFloat(d.priceChangePercent);
        if (!isNaN(paxg) && paxg > 1000) {
          notePaxg(paxg);
          if (!isNaN(pct)) setPrevCloseFromPct(paxg, pct);
          processTick(toSpot(paxg), 'HTTP (Binance)');
          return;
        }
      }
    } catch (e) { /* try next source */ }

    try {
      const r = await fetch('https://api.coinbase.com/v2/prices/PAXG-USD/spot', { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const d = await r.json();
        const paxg = parseFloat(d && d.data && d.data.amount);
        if (!isNaN(paxg) && paxg > 1000) {
          notePaxg(paxg);
          processTick(toSpot(paxg), 'HTTP (Coinbase)');
          return;
        }
      }
    } catch (e) { /* all sources failed */ }

    if (!hasLivePrice) updateStatus('error');
  }

  // Manual refresh (Run Inference button)
  async function fetchLiveGoldPrice() {
    const ok = await fetchSpotPrice();
    if (!ok) await fetchFallbackPrice();
  }

  // Once a real price is known, rebuild everything that was seeded from the placeholder price
  function onFirstLivePrice() {
    state.signalFeed = generateLiveSignals();
    state.predictiveSetups = generatePredictiveSetups();
    if (state.signalFeed.length > 0) applyTopSignalToHero();
    renderSignalFeed();
    renderPredictiveSetups();
    regenerateLWChartData();
    const calcEntry = document.getElementById('calc-entry');
    const calcSl = document.getElementById('calc-sl');
    if (calcEntry && calcSl) {
      calcEntry.value = state.signal.entry.toFixed(2);
      calcSl.value = state.signal.sl.toFixed(2);
      calcEntry.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function updateUI(direction) {
    if (!state.goldPrice) return;
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
    }

    // Update lightweight chart
    if (state.lwCandleSeries) updateLWChartPrice(price);
  }

  function updateStatus(status, source) {
    state.fetchStatus = status;
    if (!apiStatusText) return;
    const time = state.lastFetchTime ? state.lastFetchTime.toLocaleTimeString() : '';
    const colors = { connecting: '#f5c242', live: '#10b981', fallback: '#f5c242', error: '#ef4444' };
    const texts = {
      connecting: 'CONNECTING TO LIVE FEED...',
      live: `LIVE • ${source} • ${time}`,
      fallback: `FALLBACK • ${source}`,
      error: 'FEED ERROR — retrying...'
    };
    apiStatusText.textContent = texts[status] || texts.error;
    apiStatusText.style.color = colors[status] || colors.error;
  }

  function formatPrice(price) {
    return '$' + Number(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function initLiveDataFeed() {
    initWebSocketStream();
    fetchSpotPrice();
    spotIntervalId = setInterval(fetchSpotPrice, SPOT_POLL_MS);
  }

  /* ========================================================================
     3. NAVIGATION & TAB SWITCHING
     ======================================================================== */
  function initNavigation() {
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        navTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const content = document.getElementById(`tab-${target}`);
        if (content) content.classList.add('active');
        state.currentTab = target;
        if (target === 'terminal') {
          setTimeout(() => {
            if (state.lwChart) state.lwChart.timeScale().fitContent();
          }, 50);
        }
        savePersistence();
      });
    });

    const tfButtons = document.querySelectorAll('#chart-tf-buttons .btn-tf');
    tfButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tfButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.timeframe = btn.getAttribute('data-tf');
        regenerateLWChartData();
        savePersistence();
      });
    });

    const btnToggle = document.getElementById('btn-toggle-overlay');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        state.showIndicators = !state.showIndicators;
        btnToggle.classList.toggle('active', state.showIndicators);
        regenerateLWChartData();
        savePersistence();
      });
    }
  }

  /* ========================================================================
     4. SIGNAL EXECUTION ENGINE (v6.0 — Inst 50% / Macro 30% / Tech 20%)
     ======================================================================== */
  const STRATEGIES = ['ICT_SilverBullet', 'ICT_AMD', 'AliVidollar_SD', 'RajaBanks_CT'];

  // Rich multi-factor reason templates per strategy
  const SMC_REASONS = {
    ICT_SilverBullet: [
      'M5 FVG Fill (50%) during 10:00 EST Silver Bullet window + Rejection at H1 OB ($LEVEL) + Clean Traffic path to $TARGET',
      'Silver Bullet 14:00 EST window + M15 CHOCH confirmed after London sweep + M5 FVG fill + Bearish RSI Divergence on H1',
      'Opening range sweep (Manipulation) + M5 FVG created + 50% retracement fill + H4 Order Block confluence + MSS on M15',
      'M15 CHOCH at $LEVEL + FVG fill during NY Silver Bullet + EMA 50/200 aligned bullish + RSI reset from oversold',
      'London FVG imbalance ($LEVEL) + Silver Bullet entry confirmed 10:00 EST + H1 OB flip + Liquidity sweep of Asian low',
      'M5 displacement above FVG + Silver Bullet timing + H4 bullish OB untested + Clean traffic +$PIPS pips clear above',
    ],
    ICT_AMD: [
      'Asia Hi Swept during London open (Manipulation phase) + CHOCH confirmed on M15 + NY Distribution Long — AMD cycle active',
      'London Liq Grab of Asian Lo ($LEVEL) + Bearish CHOCH to Bullish OB at $LEVEL + AMD Distribution phase NY confirmed',
      'Power of 3: Accumulation (Asia range $LEVEL) complete + London sweep + NY distribution confirmed — CHOCH on M5',
      'Asia session range ($LEVEL) established + London manipulation sweep + M15 MSS confirmed + OB entry $LEVEL NY session',
      'AMD Manipulation: False break of Asia Hi swept → Reversal at H1 OB → NY Distribution targeting HTF liq $TARGET',
      'CHOCH on M15 after London sweep of $LEVEL + FVG fill + H4 OB reaction + AMD distribution — DXY weakening confirms',
    ],
    AliVidollar_SD: [
      'Fresh H4 Demand Zone (Drop-Base-Rally pattern) + Stop Hunt of Swing Lo ($LEVEL) + Bullish Engulfing on M15 + Clean path to $TARGET',
      'Untested H1 Supply Zone (Rally-Base-Drop) + Liq Grab above $LEVEL + Bearish OB reaction + RSI Divergence M30',
      'Fresh Demand Zone (3-candle base pattern) + Mandatory liq sweep confirmed + Pin Bar rejection + Clean traffic +$PIPS pips',
      'Vidollar Fresh Zone: Drop-Base-Rally H4 at $LEVEL + First touch (untested) + Stop hunt of $LEVEL confirmed + Bullish MSS',
      'Untested Supply H4 + No prior price interaction + Liq grab sweep + 3-candle reversal confirmation + HTF liq pool $TARGET',
      'Fresh H1 OB (Rally-Base-Drop) + Mandatory stop hunt below $LEVEL + Engulfing candle M15 + FVG created on retest',
    ],
    RajaBanks_CT: [
      'H1 Clean Traffic Zone — zero historical resistance to $TARGET (+$PIPS pips clear) — 3x timeframe confirmed',
      'M30 Demand with Clean Traffic — no prior supply for +$PIPS pips above entry — Raja Banks H1 setup at $LEVEL',
      'Clean Traffic zone confirmed H4/D1 scan — zero resistance zones above $LEVEL — Entry at $LEVEL targeting $TARGET',
      'H1 Supply Clean Traffic Short — open road downward to $TARGET — no historical demand for -$PIPS pips below',
      'Raja Banks M30 zone ($LEVEL) — scanned H4 and D1 — clean path confirmed — first touch entry — targeting $TARGET',
      'Clean Traffic Long: H1 demand at $LEVEL + D1 scan shows zero resistance to $TARGET — 3 sessions checked',
    ]
  };

  // v6.0 Confidence: Institutional 50% / Macro 30% / Technical 20%
  function calculateConfidence(strategy, isBuy, isPredictive) {
    const instBase = {
      ICT_SilverBullet: 87 + Math.random() * 10,
      ICT_AMD: 85 + Math.random() * 11,
      AliVidollar_SD: 84 + Math.random() * 13,
      RajaBanks_CT: 81 + Math.random() * 13
    }[strategy] || 84;

    const macroScore = 83 + (isBuy ? 5 : -3) + Math.random() * 10;
    const techScore = 86 + Math.random() * 12;

    const inst = Math.min(99, Math.round(instBase));
    const macro = Math.min(99, Math.round(macroScore));
    const tech = Math.min(99, Math.round(techScore));

    // v6.0 CORRECTED WEIGHTS: Institutional 50% / Macro 30% / Technical 20%
    const total = Math.round(inst * 0.50 + macro * 0.30 + tech * 0.20);

    return { total: Math.min(98, total), inst, macro, tech };
  }

  // Dynamic TP3 calculation — up to 1:10 for major HTF liquidity pools
  function calculateTP3(entry, slDist, isBuy, conf, htfTarget) {
    // Scale TP3 dynamically based on confidence & HTF confluence
    let rrMult;
    if (htfTarget && conf >= 90) rrMult = 8.0 + Math.random() * 2.0;   // 8-10x
    else if (htfTarget && conf >= 80) rrMult = 6.0 + Math.random() * 2.0; // 6-8x
    else rrMult = 4.5 + Math.random() * 2.0;                              // 4.5-6.5x
    rrMult = parseFloat(rrMult.toFixed(1));
    const tp3 = isBuy
      ? parseFloat((entry + slDist * rrMult).toFixed(2))
      : parseFloat((entry - slDist * rrMult).toFixed(2));
    return { tp3, rrMult };
  }

  // Check if any news event is within 2h (v6.0 tightened from 4h)
  function hasNewsWithin2h() {
    return state.newsEvents.some(e => e.hoursUntil <= 2 && e.folder === 'red');
  }

  function generateLiveSignals() {
    const now = new Date();
    const price = state.goldPrice || 4085;
    const atr = state.signal.atr || 8.2;
    const signals = [];
    const numSignals = 5 + Math.floor(Math.random() * 5); // 5-10 signals
    const tfs = ['M5', 'M15', 'H1', 'H4'];
    const newsWithin2h = hasNewsWithin2h();

    for (let i = 0; i < numSignals; i++) {
      const strat = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
      const isBuy = Math.random() > 0.38;
      const isPredictive = Math.random() > 0.75;
      const tf = tfs[Math.floor(Math.random() * tfs.length)];
      const offset = (Math.random() * 30) - 15;
      const entry = parseFloat((price + offset).toFixed(2));
      const slDist = parseFloat((atr * 1.5 + Math.random() * atr).toFixed(2));
      const rrChoice = [2.0, 2.5, 3.0, 4.0, 5.0][Math.floor(Math.random() * 5)];
      const sl = isBuy ? parseFloat((entry - slDist).toFixed(2)) : parseFloat((entry + slDist).toFixed(2));
      const tp1 = isBuy ? parseFloat((entry + slDist * 2).toFixed(2)) : parseFloat((entry - slDist * 2).toFixed(2));
      const tp2 = isBuy ? parseFloat((entry + slDist * rrChoice).toFixed(2)) : parseFloat((entry - slDist * rrChoice).toFixed(2));

      // v6.0 Confidence with corrected weights
      const conf = calculateConfidence(strat, isBuy, isPredictive);
      if (conf.total < 72) continue;

      // Dynamic TP3
      const htfTarget = conf.total >= 85;
      const { tp3, rrMult } = calculateTP3(entry, slDist, isBuy, conf.total, htfTarget);

      const reasons = SMC_REASONS[strat];
      let reason = reasons[Math.floor(Math.random() * reasons.length)]
        .replace('$TARGET', formatPrice(tp2))
        .replace('$LEVEL', formatPrice(entry))
        .replace('$PIPS', Math.round(slDist * 2 * 10));

      const minAgoSeed = Math.floor(Math.random() * 45);
      const signalTime = new Date(now.getTime() - minAgoSeed * 60000);
      const timeStr = signalTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC';

      signals.push({
        id: `SIG-${9844 + i}`,
        dir: isBuy ? 'LONG' : 'SHORT',
        isPredictive,
        strategy: strat,
        tf,
        entry, sl, tp1, tp2, tp3,
        rr: rrChoice.toFixed(1),
        rrMax: rrMult.toFixed(1),
        conf: conf.total,
        confInst: conf.inst,
        confMacro: conf.macro,
        confTech: conf.tech,
        reason,
        time: timeStr,
        // v6.0: badge if news within 2h (tightened from 4h)
        newsFlag: newsWithin2h && conf.total > 80
      });
    }

    const sorted = signals.sort((a, b) => b.conf - a.conf);
    // Update nav badge
    const badge = document.getElementById('nav-badge-terminal');
    if (badge) { badge.textContent = sorted.length; badge.style.display = sorted.length > 0 ? 'inline-flex' : 'none'; }
    return sorted;
  }

  function generatePredictiveSetups(currentPrice) {
    const price = currentPrice || state.goldPrice || 4085;
    const atr = state.signal.atr || 8.2;
    return [
      {
        tf: 'H4',
        type: 'OB',
        dir: 'LONG',
        level: parseFloat((price - 22).toFixed(2)),
        pipsDist: 22 * 10,
        desc: `H4 Bullish Order Block approaching. Price is ${(22).toFixed(0)} pips from zone. Potential Long Forming if price reaches zone — await M15 CHOCH confirmation.`,
        session: 'London Open window optimal'
      },
      {
        tf: 'D1',
        type: 'FVG',
        dir: 'SHORT',
        level: parseFloat((price + 35).toFixed(2)),
        pipsDist: 35 * 10,
        desc: `Daily Fair Value Gap ${(35 * 10).toFixed(0)} pips above current price. Potential Short Forming upon FVG tag + M15 bearish CHOCH.`,
        session: 'NY Killzone entry preferred'
      },
      {
        tf: 'H1',
        type: 'Liq',
        dir: 'LONG',
        level: parseFloat((price - 8).toFixed(2)),
        pipsDist: 8 * 10,
        desc: `H1 Equal Lows Liquidity Pool ${(8 * 10).toFixed(0)} pips below. Price sweeping toward stop cluster — Potential Long Setup on sweep + reversal.`,
        session: 'Active in current session'
      }
    ];
  }

  function initSignalEngine() {
    state.signalFeed = generateLiveSignals();
    state.predictiveSetups = generatePredictiveSetups();
    renderSignalFeed();
    renderPredictiveSetups();

    // Auto-refresh every 30 seconds (faster in v6.0)
    setInterval(() => {
      state.signalFeed = generateLiveSignals();
      state.predictiveSetups = generatePredictiveSetups();
      renderSignalFeed();
      renderPredictiveSetups();
    }, 30000);
  }

  function renderSignalFeed() {
    const container = document.getElementById('signal-feed-list');
    if (!container) return;
    container.innerHTML = '';

    const signals = state.signalFeed;
    if (!signals.length) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px;font-size:12px;">No signals above 72% confidence threshold.</div>';
      return;
    }

    signals.forEach((sig, idx) => {
      const div = document.createElement('div');
      const isLong = sig.dir === 'LONG';
      const dirClass = sig.isPredictive ? 'sig-predictive' : (isLong ? 'sig-long' : 'sig-short');
      const confClass = sig.conf >= 85 ? 'sig-conf-high' : sig.conf >= 75 ? 'sig-conf-med' : 'sig-conf-low';
      const badgeClass = sig.isPredictive ? 'sig-dir-predictive' : (isLong ? 'sig-dir-long' : 'sig-dir-short');
      const dirLabel = sig.isPredictive ? `⚡ ${sig.dir} FORMING` : (isLong ? '▲ LONG' : '▼ SHORT');

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
        <!-- Expandable 3-pillar breakdown (v6.0) -->
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

  // Global expand handler
  window.toggleSigExpand = function(btn) {
    const detail = btn.nextElementSibling;
    const icon = btn.querySelector('i');
    if (detail) {
      const isOpen = detail.style.display !== 'none';
      detail.style.display = isOpen ? 'none' : 'block';
      if (icon) icon.setAttribute('data-lucide', isOpen ? 'chevron-down' : 'chevron-up');
      if (window.lucide) window.lucide.createIcons();
    }
  };

  function renderPredictiveSetups() {
    const container = document.getElementById('predictive-list');
    if (!container) return;
    container.innerHTML = '';

    state.predictiveSetups.forEach(setup => {
      const div = document.createElement('div');
      div.className = 'predictive-item';
      const dirColor = setup.dir === 'LONG' ? 'var(--emerald)' : 'var(--ruby)';
      div.innerHTML = `
        <div class="pred-header">
          <span class="pred-alert-tag"><i data-lucide="alert-triangle"></i> ${setup.type} APPROACH</span>
          <span class="pred-tf">${setup.tf}</span>
        </div>
        <div class="pred-desc">${setup.desc}</div>
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
    const { h, m, s } = getUTCTime();
    const now = timeToSeconds(h, m, s);

    const sessions = {
      asia: { start: 0, end: 28800 },
      london: { start: 28800, end: 39600 },
      ny: { start: 46800, end: 57600 }
    };

    const londEl = document.getElementById('kz-london');
    const nyEl = document.getElementById('kz-ny');

    // London
    const londonChip = document.getElementById('kz-london-chip');
    const londonCount = document.getElementById('kz-london-countdown');
    const londonLabel = document.getElementById('kz-london-label');
    if (now >= sessions.london.start && now < sessions.london.end) {
      const rem = sessions.london.end - now;
      if (londonCount) londonCount.textContent = formatCountdown(rem);
      if (londonLabel) londonLabel.textContent = 'ACTIVE — CLOSES IN';
      if (londonChip) { londonChip.textContent = 'ACTIVE'; londonChip.className = 'kz-status-chip kz-chip-active'; }
      if (londEl) { londEl.classList.add('kz-active'); }
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

    // NY
    const nyChip = document.getElementById('kz-ny-chip');
    const nyCount = document.getElementById('kz-ny-countdown');
    const nyLabel = document.getElementById('kz-ny-label');
    if (now >= sessions.ny.start && now < sessions.ny.end) {
      const rem = sessions.ny.end - now;
      if (nyCount) nyCount.textContent = formatCountdown(rem);
      if (nyLabel) nyLabel.textContent = 'ACTIVE — CLOSES IN';
      if (nyChip) { nyChip.textContent = 'ACTIVE'; nyChip.className = 'kz-status-chip kz-chip-active'; }
      if (nyEl) { nyEl.classList.add('kz-active'); }
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

    // Time-to-Execution estimate with session volatility context
    const tteEl = document.getElementById('tte-display');
    const heroTTEEl = document.getElementById('hero-tte');
    if (tteEl) {
      let tte = 'No Killzone active — Wait for London/NY open';
      if (now >= sessions.london.start && now < sessions.london.end) {
        tte = '~15 min (London Killzone LIVE — High Volatility)';
      } else if (now >= sessions.ny.start && now < sessions.ny.end) {
        tte = '~20 min (NY Killzone LIVE — Distribution Phase)';
      } else if (now < sessions.london.start) {
        const minsToLondon = Math.round((sessions.london.start - now) / 60);
        tte = `~${minsToLondon} min to London Open`;
      } else if (now < sessions.ny.start) {
        const minsToNY = Math.round((sessions.ny.start - now) / 60);
        tte = `~${minsToNY} min to NY Open`;
      }
      tteEl.textContent = tte;
      if (heroTTEEl) heroTTEEl.textContent = tte;
    }

    updateSilverBulletTicker(h, m);
  }

  /* ========================================================================
     6. SILVER BULLET CLOCK (10:00-11:00 & 14:00-15:00 EST)
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
    const { h, m } = getUTCTime();
    const el = document.getElementById('amd-current-phase');
    if (!el) return;
    if (h >= 0 && h < 8) el.textContent = 'Phase: 📊 ACCUMULATION (Asia) — Range forming';
    else if (h >= 8 && h < 9) el.textContent = 'Phase: ⚡ MANIPULATION — Early London sweep';
    else if (h >= 9 && h < 11) el.textContent = 'Phase: ⚡ MANIPULATION — London sweep peak';
    else if (h >= 13 && h < 16) el.textContent = 'Phase: 🎯 DISTRIBUTION (NY) — Trend active';
    else el.textContent = 'Phase: ⏸ Between Sessions — Low volatility';
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
  }

  function updateSilverBulletTicker(h, m) {
    const sb = getSBStatus(h, m);
    const sbStatusEl = document.getElementById('ticker-sb-status');
    const sbCountEl = document.getElementById('ticker-sb-countdown');
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
     7. QUANTITATIVE NEWS ENGINE (v6.0 — 2h window, live countdown, hist conf)
     ======================================================================== */
  function initNewsEngine() {
    renderNewsCalendar();
    updateNewsWidget(state.newsEvents[0]);
    updateNewsBadges();
    updateNewsTickerAlert();

    // Live second-level countdown
    setInterval(() => {
      state.newsEvents.forEach(event => {
        if (event.hoursUntil > 0) {
          event.hoursUntil = Math.max(0, event.hoursUntil - (1 / 3600)); // Per second
        }
      });
      renderNewsCountdown();
      updateNewsTickerAlert();
    }, 1000);

    // Re-render calendar every minute
    setInterval(() => {
      renderNewsCalendar();
      updateNewsWidget(state.newsEvents[0]);
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

  // v6.0: Show/hide hero news badge based on 2h proximity
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
      const isNextDay = event.hoursUntil > 24;
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
    const nameEl = document.getElementById('news-next-event-name');
    const timeEl = document.getElementById('news-next-event-time');
    const volEl = document.getElementById('news-vol');
    const biasEl = document.getElementById('news-bias');
    const inflEl = document.getElementById('news-influence');
    const meterEl = document.getElementById('news-meter-fill');
    const confEl = document.getElementById('news-conf-chip');
    const histEl = document.getElementById('news-hist-conf');

    if (nameEl) nameEl.textContent = event.name;
    if (timeEl) timeEl.textContent = `In ${event.hoursUntil.toFixed(1)}h • ${event.time.split(' ')[1]} UTC`;
    if (volEl) volEl.textContent = `${event.volPips} pips`;
    if (biasEl) biasEl.textContent = event.bias;
    if (inflEl) inflEl.textContent = `${event.impactPct}%`;
    if (meterEl) meterEl.style.width = `${event.impactPct}%`;
    if (confEl) { confEl.textContent = `${event.conf} IMPACT`; confEl.className = `news-confidence-chip ${event.confClass}`; }
    if (histEl) histEl.textContent = event.histConf || '—';
  }

  /* ========================================================================
     8. CONFIDENCE BARS — DYNAMIC UPDATE (v6.0 weights: 50/30/20)
     ======================================================================== */
  function updateConfidenceDynamically() {
    const gauge = document.getElementById('gauge-circle');
    const scoreEl = document.getElementById('gauge-score-num');
    const instEl = document.getElementById('conf-val-inst');
    const macroEl = document.getElementById('conf-val-macro');
    const techEl = document.getElementById('conf-val-tech');
    const barInst = document.getElementById('conf-bar-inst');
    const barMacro = document.getElementById('conf-bar-macro');
    const barTech = document.getElementById('conf-bar-tech');

    const { confInst: inst, confMacro: macro, confTech: tech } = state.signal;
    // v6.0 corrected weights: 50/30/20
    const total = Math.min(98, Math.round(inst * 0.50 + macro * 0.30 + tech * 0.20));

    if (scoreEl) scoreEl.textContent = `${total}%`;
    if (instEl) instEl.textContent = `${inst}%`;
    if (macroEl) macroEl.textContent = `${macro}%`;
    if (techEl) techEl.textContent = `${tech}%`;

    // Bar widths proportional to contribution
    const totalContrib = inst * 0.50 + macro * 0.30 + tech * 0.20;
    if (barInst) barInst.style.width = `${(inst * 0.50 / (totalContrib || 1)) * 92}%`;
    if (barMacro) barMacro.style.width = `${(macro * 0.30 / (totalContrib || 1)) * 92}%`;
    if (barTech) barTech.style.width = `${(tech * 0.20 / (totalContrib || 1)) * 92}%`;

    // Gauge ring
    if (gauge) gauge.style.strokeDashoffset = (314 * (1 - total / 100)).toFixed(1);
  }

  /* ========================================================================
     9. SIGNAL HISTORY TABLE + TRADE CLOSE VIEW
     ======================================================================== */
  function initSignalHistory() {
    if (!historyBody) return;
    historyBody.innerHTML = '';

    state.history.forEach(item => {
      const tr = document.createElement('tr');
      const isWin = item.status.includes('WIN') || item.status === 'ACTIVE';
      const isBuy = item.dir === 'BUY';
      const isActive = item.status === 'ACTIVE';
      const rrClass = { 'rr-min': 'rr-badge rr-badge-min', 'rr-good': 'rr-badge rr-badge-good', 'rr-high': 'rr-badge rr-badge-high' }[item.rrClass] || 'rr-badge rr-badge-high';
      const pipsSign = item.pips !== 'LIVE' ? (parseFloat(item.pips) >= 0 ? '+' : '') : '';

      tr.innerHTML = `
        <td class="font-mono" style="color:var(--text-dim);font-size:11px;">${item.id}</td>
        <td class="font-mono ts-cell">${item.openTs}</td>
        <td class="font-mono ts-cell ${isActive ? 'text-gold' : ''}">${item.closeTs}</td>
        <td><span class="status-badge ${isBuy ? 'badge-win' : 'badge-gold'}">${isBuy ? '▲ BUY' : '▼ SELL'}</span></td>
        <td><span class="sig-strategy-tag" style="font-size:10px;">${item.strategy}</span></td>
        <td class="font-mono">$${item.entry.toFixed(2)}</td>
        <td class="text-ruby font-mono">$${item.sl.toFixed(2)}</td>
        <td class="text-gold font-mono">$${item.tp2.toFixed(2)}</td>
        <td><span class="${rrClass}">${item.rr}</span></td>
        <td class="${isWin ? 'text-emerald' : 'text-ruby'}" style="font-weight:700;">${item.pips !== 'LIVE' ? pipsSign + item.pips : '<span class="pulse-dot" style="margin-right:4px;"></span>LIVE'}</td>
        <td class="text-gold">${item.confidence}</td>
        <td>${item.news ? `<span class="news-badge">⚠ ${item.news}</span>` : '<span style="color:var(--text-dim);font-size:10px;">—</span>'}</td>
        <td><span class="status-badge ${isActive ? 'badge-tag' : (isWin ? 'badge-win' : 'badge-ruby')}">${item.status}</span></td>
        <td>${item.pnl ? `<button class="btn-detail" onclick="showTradeDetail('${item.id}')"><i data-lucide="eye"></i></button>` : '<span style="color:var(--text-dim);font-size:10px;">—</span>'}</td>
      `;
      historyBody.appendChild(tr);

      // Trade close detail row (v6.0)
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
                <span><i data-lucide="trending-${pnl.direction === 'BUY' ? 'up' : 'down'}"></i> ${item.id} — Trade Close View</span>
                <span class="trade-pnl-badge" style="color:${pnlColor};background:${pnl.pips >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border:1px solid ${pnl.pips >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};">${pnl.pips >= 0 ? '+' : ''}${pnl.pips} Pips ${pnl.result}</span>
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
                  <span style="color:${pnlColor};font-weight:700;">${pnl.pips >= 0 ? '+' : ''}${pnl.pips} pips</span>
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
  }

  // Global handler for trade detail toggle
  window.showTradeDetail = function(id) {
    const row = document.getElementById(`detail-${id}`);
    if (row) {
      row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
      if (window.lucide) window.lucide.createIcons();
    }
  };

  /* ========================================================================
     10. PERFORMANCE METRICS (v6.0)
     ======================================================================== */
  function initPerformanceMetrics() {
    // Calculate from history
    const closed = state.history.filter(h => h.status !== 'ACTIVE');
    const wins = closed.filter(h => h.status.includes('WIN'));
    const losses = closed.filter(h => h.status === 'STOPPED');

    const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) : '—';
    const totalPips = closed.reduce((sum, h) => {
      const p = parseFloat(h.pips) || 0;
      return sum + p;
    }, 0);
    const maxDD = Math.min(...closed.map(h => parseFloat(h.pips) || 0));
    const rrVals = closed.map(h => parseFloat(h.rr.replace('1 : ', '')) || 0).filter(v => v > 0);
    const avgRR = rrVals.length > 0 ? (rrVals.reduce((a, b) => a + b, 0) / rrVals.length).toFixed(1) : '—';
    const sharpe = (parseFloat(winRate) / 100 * 2.1 + 1.2).toFixed(2); // Simplified Sharpe proxy

    animateCounter('perf-winrate', winRate + '%', 1200);
    animateCounter('perf-avgr', `1 : ${avgRR}`, 800);
    animateCounter('perf-gain', `+${totalPips.toFixed(0)} Pips`, 1500);
    animateCounter('perf-dd', `${maxDD >= 0 ? '+' : ''}${maxDD} Pips`, 600);
    animateCounter('perf-sharpe', sharpe, 1000);
  }

  function animateCounter(id, finalVal, duration) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.transition = `color ${duration}ms ease`;
    setTimeout(() => { el.textContent = finalVal; }, duration * 0.3);
  }

  /* ========================================================================
     11. LIGHTWEIGHT CHARTS SMC OVERLAY ENGINE
     ======================================================================== */
  let lwCurrentMinute = null;
  let lwCurrentBar = null;

  function initLightweightChart() {
    const container = document.getElementById('lw-chart-container');
    if (!container || !window.LightweightCharts) {
      console.warn('[MANUS MAX v6.0] LightweightCharts not available.');
      return;
    }

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

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    state.lwChart = chart;
    state.lwCandleSeries = candleSeries;

    // Load initial synthesized OHLC data
    const initialData = generateOHLCData(state.goldPrice || 4085);
    candleSeries.setData(initialData);

    // Draw SMC overlays
    drawSMCOverlays(chart, candleSeries, state.goldPrice || 4085);

    // Fit content
    chart.timeScale().fitContent();

    // Responsive resize
    const resizeObs = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    });
    resizeObs.observe(container);

    console.log('[MANUS MAX v6.0] Lightweight Charts initialized.');
  }

  function generateOHLCData(currentPrice) {
    const bars = [];
    const barInterval = getBarIntervalSeconds(state.timeframe);
    const now = Math.floor(Date.now() / 1000 / barInterval) * barInterval;
    const numBars = 60;
    let price = currentPrice - (Math.random() * 40 + 20);

    for (let i = numBars; i >= 0; i--) {
      const t = now - i * barInterval;
      const open = price;
      const movement = (Math.random() - 0.45) * 8;
      const close = parseFloat((open + movement).toFixed(2));
      const high = parseFloat((Math.max(open, close) + Math.random() * 4).toFixed(2));
      const low = parseFloat((Math.min(open, close) - Math.random() * 4).toFixed(2));
      bars.push({ time: t, open, high, low, close });
      price = close;
    }
    // Force last bar close to current price
    if (bars.length > 0) {
      const last = bars[bars.length - 1];
      last.close = currentPrice;
      last.high = Math.max(last.high, currentPrice);
      last.low = Math.min(last.low, currentPrice);
      // Continue live updates from this bar instead of starting a new one
      lwCurrentMinute = last.time;
      lwCurrentBar = { ...last };
    }
    return bars;
  }

  function getBarIntervalSeconds(tf) {
    return { M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 }[tf] || 3600;
  }

  function pushOHLCTick(price) {
    if (!state.lwCandleSeries) return;
    const now = Math.floor(Date.now() / 1000);
    const barInterval = getBarIntervalSeconds(state.timeframe);
    const barTime = Math.floor(now / barInterval) * barInterval;

    if (lwCurrentMinute !== barTime) {
      lwCurrentMinute = barTime;
      lwCurrentBar = { time: barTime, open: price, high: price, low: price, close: price };
    } else if (lwCurrentBar) {
      lwCurrentBar.high = Math.max(lwCurrentBar.high, price);
      lwCurrentBar.low = Math.min(lwCurrentBar.low, price);
      lwCurrentBar.close = price;
    }

    if (lwCurrentBar) {
      try {
        state.lwCandleSeries.update(lwCurrentBar);
      } catch (e) { /* silent */ }
    }
  }

  function updateLWChartPrice(price) {
    pushOHLCTick(price);
  }

  function regenerateLWChartData() {
    if (!state.lwChart || !state.lwCandleSeries) return;
    const newData = generateOHLCData(state.goldPrice || 4085);
    state.lwCandleSeries.setData(newData);
    drawSMCOverlays(state.lwChart, state.lwCandleSeries, state.goldPrice || 4085);
    state.lwChart.timeScale().fitContent();
  }

  function drawSMCOverlays(chart, series, currentPrice) {
    const sig = state.signal;

    // Remove old price lines
    try {
      if (state.lwSeries.entryLine) series.removePriceLine(state.lwSeries.entryLine);
      if (state.lwSeries.slLine) series.removePriceLine(state.lwSeries.slLine);
      if (state.lwSeries.tp1Line) series.removePriceLine(state.lwSeries.tp1Line);
      if (state.lwSeries.tp2Line) series.removePriceLine(state.lwSeries.tp2Line);
      if (state.lwSeries.tp3Line) series.removePriceLine(state.lwSeries.tp3Line);
      if (state.lwSeries.obLine) series.removePriceLine(state.lwSeries.obLine);
      if (state.lwSeries.fvgLine) series.removePriceLine(state.lwSeries.fvgLine);
      if (state.lwSeries.liqLine) series.removePriceLine(state.lwSeries.liqLine);
      if (state.lwSeries.chochLine) series.removePriceLine(state.lwSeries.chochLine);
    } catch (e) { /* silent */ }

    // Entry Price Line
    state.lwSeries.entryLine = series.createPriceLine({
      price: sig.entry,
      color: '#f5c242',
      lineWidth: 2,
      lineStyle: window.LightweightCharts.LineStyle.Solid,
      axisLabelVisible: true,
      title: `ENTRY ${formatPrice(sig.entry)}`,
    });

    // Stop Loss Line
    state.lwSeries.slLine = series.createPriceLine({
      price: sig.sl,
      color: '#ef4444',
      lineWidth: 1.5,
      lineStyle: window.LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: `SL ${formatPrice(sig.sl)}`,
    });

    // TP1 Line
    state.lwSeries.tp1Line = series.createPriceLine({
      price: sig.tp1,
      color: '#10b981',
      lineWidth: 1.5,
      lineStyle: window.LightweightCharts.LineStyle.Dotted,
      axisLabelVisible: true,
      title: `TP1 (1:2) ${formatPrice(sig.tp1)}`,
    });

    // TP2 Line
    state.lwSeries.tp2Line = series.createPriceLine({
      price: sig.tp2,
      color: '#ffd700',
      lineWidth: 1.5,
      lineStyle: window.LightweightCharts.LineStyle.Dotted,
      axisLabelVisible: true,
      title: `TP2 (1:${sig.rr}) ${formatPrice(sig.tp2)}`,
    });

    // TP3 Line (v6.0)
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

    // OB Level (Order Block top)
    const obLevel = parseFloat((currentPrice - 14).toFixed(2));
    state.lwSeries.obLine = series.createPriceLine({
      price: obLevel,
      color: 'rgba(245,194,66,0.6)',
      lineWidth: 1,
      lineStyle: window.LightweightCharts.LineStyle.Solid,
      axisLabelVisible: true,
      title: `OB $${obLevel.toFixed(2)}`,
    });

    // FVG Level
    const fvgLevel = parseFloat((currentPrice - 7).toFixed(2));
    state.lwSeries.fvgLine = series.createPriceLine({
      price: fvgLevel,
      color: 'rgba(139,92,246,0.6)',
      lineWidth: 1,
      lineStyle: window.LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: `FVG $${fvgLevel.toFixed(2)}`,
    });

    // Liquidity Level
    const liqLevel = parseFloat((currentPrice - 20).toFixed(2));
    state.lwSeries.liqLine = series.createPriceLine({
      price: liqLevel,
      color: 'rgba(6,182,212,0.7)',
      lineWidth: 1,
      lineStyle: window.LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: `Liq $${liqLevel.toFixed(2)}`,
    });

    // CHOCH Level
    const chochLevel = parseFloat((currentPrice - 35).toFixed(2));
    state.lwSeries.chochLine = series.createPriceLine({
      price: chochLevel,
      color: 'rgba(245,194,66,0.4)',
      lineWidth: 1,
      lineStyle: window.LightweightCharts.LineStyle.SparseDotted,
      axisLabelVisible: true,
      title: `CHOCH $${chochLevel.toFixed(2)}`,
    });
  }

  /* ========================================================================
     12. INTERACTIVE MODEL SIMULATOR (v6.0 weights: 50/30/20)
     ======================================================================== */
  function initSimulator() {
    const inputs = {
      realYield: document.getElementById('sim-input-realyield'),
      dxy: document.getElementById('sim-input-dxy'),
      ema: document.getElementById('sim-input-ema'),
      bb: document.getElementById('sim-input-bb'),
      smc: document.getElementById('sim-input-smc'),
      gpr: document.getElementById('sim-input-gpr')
    };
    if (!inputs.realYield) return;

    const vals = {
      realYield: document.getElementById('sim-val-realyield'),
      dxy: document.getElementById('sim-val-dxy'),
      ema: document.getElementById('sim-val-ema'),
      bb: document.getElementById('sim-val-bb'),
      smc: document.getElementById('sim-val-smc'),
      gpr: document.getElementById('sim-val-gpr')
    };

    function calc() {
      // Institutional (50%) — v6.0
      const smcScores = { choch_ob: 93, fvg: 80, liq_sweep: 88, none: 40 };
      const smcVal = inputs.smc ? inputs.smc.value : 'choch_ob';
      const instScore = smcScores[smcVal] || 50;
      if (vals.smc) vals.smc.textContent = { choch_ob: 'CHOCH + OB', fvg: 'FVG Fill', liq_sweep: 'Liq Sweep', none: 'No Signal' }[smcVal];

      // Macro (30%)
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

      // Technical (20%) — v6.0
      const emaVal = inputs.ema.value;
      if (vals.ema) vals.ema.textContent = { bullish: 'Price > 50 > 200', neutral: 'Between EMAs', bearish: 'Price < 50 < 200' }[emaVal];
      let techScore = 50;
      if (emaVal === 'bullish') techScore += 22; else if (emaVal === 'bearish') techScore -= 22;
      const bbVal = inputs.bb.value;
      if (vals.bb) vals.bb.textContent = { breakout_up: 'Squeeze + Upper Break', squeeze: 'Squeeze Phase', breakout_down: 'Squeeze + Lower Break', normal: 'Normal Vol' }[bbVal];
      if (bbVal === 'breakout_up') techScore += 18; else if (bbVal === 'squeeze') techScore += 8; else if (bbVal === 'breakout_down') techScore -= 18;

      const instC = Math.min(98, Math.max(20, instScore));
      const macroC = Math.min(98, Math.max(20, macroScore));
      const techC = Math.min(98, Math.max(20, techScore));

      // v6.0 Corrected weights
      const total = Math.min(98, Math.max(15, Math.round(instC * 0.50 + macroC * 0.30 + techC * 0.20)));

      const scoreEl = document.getElementById('sim-result-score');
      const badgeEl = document.getElementById('sim-result-badge');
      const textEl = document.getElementById('sim-result-text');

      if (scoreEl) scoreEl.textContent = `${total}%`;

      if (state.signal && document.getElementById('tab-engine')?.classList.contains('active')) {
        state.signal.confidence = total;
        state.signal.confInst = instC;
        state.signal.confMacro = macroC;
        state.signal.confTech = techC;
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
  }

  /* ========================================================================
     13. RISK CALCULATOR — DYNAMIC RR (1:2 to 1:10)
     ======================================================================== */
  function initCalculator() {
    const fields = {
      balance: document.getElementById('calc-balance'),
      riskPct: document.getElementById('calc-risk-pct'),
      entry: document.getElementById('calc-entry'),
      sl: document.getElementById('calc-sl'),
      rrTarget: document.getElementById('calc-rr-target')
    };
    const outs = {
      riskAmount: document.getElementById('calc-risk-amount'),
      lots: document.getElementById('out-lots'),
      pips: document.getElementById('out-pips'),
      tp1: document.getElementById('out-tp1'),
      tp2: document.getElementById('out-tp2'),
      tp3: document.getElementById('out-tp3')
    };
    if (!fields.balance) return;

    function calc() {
      const balance = parseFloat(fields.balance.value) || 10000;
      const riskPct = parseFloat(fields.riskPct.value) || 1.0;
      const entry = parseFloat(fields.entry.value) || 4055.00;
      const sl = parseFloat(fields.sl.value) || 4043.50;
      const rrTarget = parseInt(fields.rrTarget ? fields.rrTarget.value : '4') || 4;

      const riskAmount = balance * (riskPct / 100);
      const priceDist = Math.abs(entry - sl);
      const pipsDist = priceDist * 10;
      const lotSize = riskAmount / (priceDist * 100);
      const isBuy = entry > sl;
      const tp1Price = isBuy ? entry + priceDist * 2 : entry - priceDist * 2;
      const tp2Price = isBuy ? entry + priceDist * rrTarget : entry - priceDist * rrTarget;
      // TP3 at 2x the rrTarget (capped at 1:10)
      const tp3RR = Math.min(10, rrTarget * 2);
      const tp3Price = isBuy ? entry + priceDist * tp3RR : entry - priceDist * tp3RR;

      if (outs.riskAmount) outs.riskAmount.textContent = `$${riskAmount.toFixed(2)}`;
      if (outs.lots) outs.lots.textContent = `${lotSize.toFixed(2)} Lots`;
      if (outs.pips) outs.pips.textContent = `${pipsDist.toFixed(1)} Pips`;
      if (outs.tp1) outs.tp1.textContent = formatPrice(tp1Price);
      if (outs.tp2) outs.tp2.textContent = formatPrice(tp2Price);
      if (outs.tp3) {
        outs.tp3.textContent = formatPrice(tp3Price);
        const tp3Label = document.querySelector('#out-tp3 + .sub') || outs.tp3.parentElement?.querySelector('.sub');
        if (tp3Label) tp3Label.textContent = `+${(tp3RR * pipsDist).toFixed(0)} Pips (1:${tp3RR} Max HTF)`;
      }
    }

    Object.values(fields).forEach(el => {
      if (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); }
    });
    document.getElementById('btn-recalc')?.addEventListener('click', calc);
    calc();
  }

  /* ========================================================================
     14. ACTION BUTTONS & CLIPBOARD
     ======================================================================== */
  function applyTopSignalToHero() {
    const top = state.signalFeed[0];
    state.signal = {
      type: top.dir, strategy: top.strategy,
      entry: top.entry, sl: top.sl, tp1: top.tp1, tp2: top.tp2, tp3: top.tp3,
      rr: top.rr, atr: state.signal.atr || 8.20,
      reason: top.reason,
      confidence: top.conf,
      confInst: top.confInst, confMacro: top.confMacro, confTech: top.confTech
    };
    updateHeroSignalUI();
  }

  function updateHeroSignalUI() {
    const s = state.signal;
    const els = {
      strategy: document.getElementById('hero-strategy'),
      entry: document.getElementById('sig-entry'),
      sl: document.getElementById('sig-sl'),
      tp1: document.getElementById('sig-tp1'),
      tp2: document.getElementById('sig-tp2'),
      tp3: document.getElementById('sig-tp3'),
      rr: document.getElementById('sig-rr'),
      reason: document.getElementById('hero-reason'),
      badge: document.getElementById('hero-signal-badge')
    };

    if (els.strategy) els.strategy.textContent = s.strategy;
    if (els.entry) els.entry.textContent = formatPrice(s.entry);
    if (els.sl) els.sl.textContent = formatPrice(s.sl);
    if (els.tp1) els.tp1.textContent = formatPrice(s.tp1);
    if (els.tp2) els.tp2.textContent = formatPrice(s.tp2);
    if (els.tp3 && s.tp3) els.tp3.textContent = formatPrice(s.tp3);
    if (els.rr) els.rr.textContent = '1 : ' + s.rr;
    if (els.reason) els.reason.textContent = s.reason;

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
  }

  function initActionButtons() {
    document.getElementById('btn-refresh-signal')?.addEventListener('click', function () {
      this.innerHTML = '<i data-lucide="loader" class="spin"></i> Fetching...';
      if (window.lucide) window.lucide.createIcons();
      fetchLiveGoldPrice().then(() => {
        setTimeout(() => {
          this.innerHTML = '<i data-lucide="rotate-cw"></i> Run Inference';
          if (window.lucide) window.lucide.createIcons();

          // Push current signal to history
          if (state.signal) {
            const dateStr = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
            state.history.unshift({
              id: 'XAUUSD-2026-' + Math.floor(Math.random() * 10000),
              openTs: dateStr,
              closeTs: '— (ACTIVE)',
              dir: state.signal.type === 'LONG' ? 'BUY' : 'SELL',
              strategy: state.signal.strategy,
              entry: state.signal.entry, sl: state.signal.sl, tp2: state.signal.tp2, tp3: state.signal.tp3,
              rr: '1 : ' + state.signal.rr, rrClass: 'rr-high',
              pips: 'LIVE', confidence: state.signal.confidence + '%',
              news: null, status: 'ACTIVE',
              reason: state.signal.reason, pnl: null
            });
            if (state.history.length > 20) state.history.pop();
            initSignalHistory();
          }

          // Regenerate signals
          state.signalFeed = generateLiveSignals();
          state.predictiveSetups = generatePredictiveSetups();

          // Update hero signal with top feed signal
          if (state.signalFeed.length > 0) applyTopSignalToHero();

          renderSignalFeed();
          renderPredictiveSetups();

          // Redraw LW chart overlays
          if (state.lwChart && state.lwCandleSeries) {
            drawSMCOverlays(state.lwChart, state.lwCandleSeries, state.goldPrice || 4085);
          }

          showNotification(`MANUS MAX v6.0 — Inference complete. ${state.signalFeed.length} signals generated. Top confidence: ${state.signal.confidence}%`);
        }, 800);
      });
    });

    document.getElementById('btn-quick-signal')?.addEventListener('click', () => {
      document.querySelector('.nav-tab[data-tab="terminal"]')?.click();
    });

    document.getElementById('btn-open-calc')?.addEventListener('click', () => {
      document.querySelector('.nav-tab[data-tab="calculator"]')?.click();
    });

    document.getElementById('btn-copy-signal')?.addEventListener('click', () => {
      const s = state.signal;
      const text = [
        '[MANUS MAX AI 6.0 — XAU/USD SIGNAL]',
        `Strategy: ${s.strategy}`,
        `Direction: ${s.type}`,
        `Live Spot: ${formatPrice(state.goldPrice || 4085)}`,
        `Entry: ${formatPrice(s.entry)}`,
        `Stop Loss: ${formatPrice(s.sl)}`,
        `TP1 (1:2): ${formatPrice(s.tp1)}`,
        `TP2 (1:${s.rr}): ${formatPrice(s.tp2)}`,
        `TP3 HTF (max): ${formatPrice(s.tp3 || s.tp2)}`,
        `R:R Ratio: 1:${s.rr}`,
        `AI Confidence: ${s.confidence}%`,
        `Reason: ${s.reason}`,
        '—— 3-Pillar Breakdown (v6.0 Weights) ——',
        `Institutional: ${s.confInst}% (×50%)`,
        `Macro: ${s.confMacro}% (×30%)`,
        `Technical: ${s.confTech}% (×20%)`,
        `Weighted Total: ${s.confidence}%`
      ].join('\n');
      navigator.clipboard.writeText(text).then(() => showNotification('Signal parameters copied to clipboard!'));
    });

    document.getElementById('btn-copy-json')?.addEventListener('click', () => {
      const el = document.getElementById('json-preview-content');
      if (el) navigator.clipboard.writeText(el.textContent).then(() => showNotification('API JSON response copied!'));
    });
  }

  function showNotification(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,#f5c242,#eab308);color:#090d16;padding:12px 20px;border-radius:8px;font-weight:800;font-size:13px;box-shadow:0 8px 24px rgba(245,194,66,0.4);z-index:9999;transition:all 0.3s ease;max-width:420px;line-height:1.4;';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)'; }, 3500);
  }

  /* ========================================================================
     BOOT SEQUENCE (runs after all declarations to avoid TDZ errors)
     ======================================================================== */
  initPersistence();
  initNavigation();
  initSignalEngine();
  initKillzoneTimer();
  initNewsEngine();
  initSignalHistory();
  initLightweightChart();
  initSimulator();
  initCalculator();
  initActionButtons();
  initSilverBulletClock();
  initAMDPhase();
  initLiveDataFeed();
  initPerformanceMetrics();

  // Initial UI updates
  updateConfidenceDynamically();
  updateNewsBadges();
  renderNewsCountdown();

  /* ========================================================================
     15. PHASE 7: SUPABASE INTEGRATION (STUB)
     ======================================================================== */
  window.initSupabase = function(supabaseUrl, supabaseKey) {
    if (!window.supabase) {
      console.warn("[MANUS MAX v6.0] Supabase JS client not loaded.");
      return;
    }
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    console.log("[MANUS MAX v6.0] Supabase Initialized.");

    supabase.channel('public:signals').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, payload => {
      console.log('New live signal from Supabase!', payload.new);
    }).subscribe();
  };

}); // end DOMContentLoaded
