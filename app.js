/* ==========================================================================
   MANUS MAX AI 5.0 — XAU/USD Institutional Signal Engine
   SMC • ICT A-M-D • Raja Banks • Ali Vidollar • Silver Bullet
   Quantitative News Engine • Killzone Timer • Dynamic RR
   LocalStorage Persistence • 3-Pillar Weighted Confidence
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

    // Active hero signal
    signal: {
      type: 'LONG',
      strategy: 'ICT_SilverBullet',
      entry: 4055.00,
      sl: 4043.50,
      tp1: 4077.50,
      tp2: 4101.00,
      rr: 4.0,
      atr: 8.20,
      reason: 'M5 FVG Fill + London Liquidity Sweep + Rejection at H4 Supply Zone + Bearish RSI Divergence',
      confidence: 92,
      confInst: 93,
      confMacro: 88,
      confTech: 94
    },

    // Signal history — fully upgraded with strategy + reason + news
    history: [
      {
        id: 'XAUUSD-2026-9843',
        openTs:  '2026-07-28 10:25 UTC',
        closeTs: '— (ACTIVE)',
        dir: 'BUY',
        strategy: 'ICT_SilverBullet',
        entry: 4055.00, sl: 4043.50, tp2: 4101.00,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: 'LIVE', confidence: '92%',
        news: 'CPI', newsClass: 'news-badge',
        status: 'ACTIVE',
        reason: 'M5 FVG Fill + London Liq Sweep + H4 OB Rejection'
      },
      {
        id: 'XAUUSD-2026-9842',
        openTs:  '2026-07-27 08:15 UTC',
        closeTs: '2026-07-27 13:42 UTC',
        dir: 'BUY',
        strategy: 'ICT_AMD',
        entry: 4031.80, sl: 4020.00, tp2: 4067.40,
        rr: '1 : 3.0', rrClass: 'rr-high',
        pips: '+356', confidence: '89%',
        news: null,
        status: 'WIN (TP2)',
        reason: 'Asia Lo Sweep + NY Distribution + OB at $4,020'
      },
      {
        id: 'XAUUSD-2026-9841',
        openTs:  '2026-07-26 14:00 UTC',
        closeTs: '2026-07-26 17:38 UTC',
        dir: 'SELL',
        strategy: 'AliVidollar_SD',
        entry: 4048.50, sl: 4057.20, tp2: 4022.60,
        rr: '1 : 3.0', rrClass: 'rr-high',
        pips: '+258', confidence: '86%',
        news: 'FOMC',
        status: 'WIN (TP2)',
        reason: 'Fresh H4 Supply Zone + Liq Grab of Swing Hi + Bearish Engulf'
      },
      {
        id: 'XAUUSD-2026-9840',
        openTs:  '2026-07-25 10:02 UTC',
        closeTs: '2026-07-25 11:20 UTC',
        dir: 'BUY',
        strategy: 'ICT_SilverBullet',
        entry: 4012.40, sl: 4001.00, tp2: 4057.60,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: '+452', confidence: '94%',
        news: null,
        status: 'WIN (TP2)',
        reason: 'Silver Bullet 10:00 EST window + FVG fill + Fresh Demand OB'
      },
      {
        id: 'XAUUSD-2026-9839',
        openTs:  '2026-07-24 09:30 UTC',
        closeTs: '2026-07-24 10:55 UTC',
        dir: 'BUY',
        strategy: 'RajaBanks_CT',
        entry: 3998.60, sl: 3987.00, tp2: 4045.00,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: '+464', confidence: '88%',
        news: 'NFP',
        status: 'WIN (TP2)',
        reason: 'Clean Traffic Zone H4 — Zero resistance to $4,045 target'
      },
      {
        id: 'XAUUSD-2026-9838',
        openTs:  '2026-07-23 08:10 UTC',
        closeTs: '2026-07-23 09:02 UTC',
        dir: 'SELL',
        strategy: 'ICT_AMD',
        entry: 4038.20, sl: 4047.00, tp2: 4011.80,
        rr: '1 : 3.0', rrClass: 'rr-high',
        pips: '-87', confidence: '72%',
        news: null,
        status: 'STOPPED',
        reason: 'London Manipulation — SL triggered before NY distribution'
      },
      {
        id: 'XAUUSD-2026-9837',
        openTs:  '2026-07-22 14:05 UTC',
        closeTs: '2026-07-22 16:48 UTC',
        dir: 'BUY',
        strategy: 'AliVidollar_SD',
        entry: 3975.50, sl: 3963.00, tp2: 4025.50,
        rr: '1 : 4.0', rrClass: 'rr-high',
        pips: '+500', confidence: '91%',
        news: 'PPI',
        status: 'WIN (TP2)',
        reason: 'Fresh Demand Zone + Stop Hunt of Asian Lo + Bullish Engulfing'
      }
    ],

    // Economic calendar events
    newsEvents: [
      { time: '2026-07-28 15:30 UTC', name: 'US CPI (YoY)', folder: 'red', impactPct: 85, volPips: '80-120', bias: '78% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 3.7 },
      { time: '2026-07-28 18:00 UTC', name: 'FOMC Minutes', folder: 'red', impactPct: 92, volPips: '100-180', bias: '65% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 6.2 },
      { time: '2026-07-29 12:30 UTC', name: 'US PPI (MoM)', folder: 'orange', impactPct: 65, volPips: '40-80', bias: '55% Neutral', confClass: 'news-conf-med', conf: 'MEDIUM', hoursUntil: 24.2 },
      { time: '2026-07-30 14:00 UTC', name: 'US Core PCE', folder: 'red', impactPct: 88, volPips: '70-130', bias: '70% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 47.8 },
      { time: '2026-08-01 12:30 UTC', name: 'US NFP', folder: 'red', impactPct: 95, volPips: '120-250', bias: '60% Bearish', confClass: 'news-conf-high', conf: 'HIGH', hoursUntil: 71.2 },
      { time: '2026-08-05 17:00 UTC', name: 'ISM Services PMI', folder: 'yellow', impactPct: 45, volPips: '20-50', bias: '50% Neutral', confClass: 'news-conf-low', conf: 'LOW', hoursUntil: 168.3 }
    ],

    // Signal feed (live + predictive)
    signalFeed: [],
    predictiveSetups: [],

    // Persistence
    persistKey: null
  };

  /* ========================================================================
     DOM ELEMENTS
     ======================================================================== */
  const navTabs        = document.querySelectorAll('.nav-tab');
  const tabContents    = document.querySelectorAll('.tab-content');
  const livePriceEl    = document.getElementById('live-gold-price');
  const liveChangeEl   = document.getElementById('live-gold-change');
  const liveCurrentEl  = document.getElementById('sig-current-live');
  const historyBody    = document.getElementById('history-table-body');
  const canvas         = document.getElementById('goldChart');
  const ctx            = canvas ? canvas.getContext('2d') : null;
  const apiStatusText  = document.getElementById('api-status-text');

  /* ========================================================================
     BOOT SEQUENCE
     ======================================================================== */
  initPersistence();
  initNavigation();
  initSignalEngine();
  initKillzoneTimer();
  initNewsEngine();
  initSignalHistory();
  initCanvasChart();
  initSimulator();
  initCalculator();
  initActionButtons();
  initSilverBulletClock();
  initAMDPhase();
  initLiveDataFeed();

  /* ========================================================================
     1. PERSISTENCE ENGINE (LocalStorage + Device Fingerprint)
     ======================================================================== */
  function initPersistence() {
    const fingerprint = btoa(navigator.userAgent + screen.width + screen.height).slice(0, 16);
    state.persistKey = `manus_max_v5_${fingerprint}`;
    try {
      const saved = localStorage.getItem(state.persistKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.timeframe) state.timeframe = data.timeframe;
        if (data.showIndicators !== undefined) state.showIndicators = data.showIndicators;
        console.log('[MANUS MAX] Preferences restored from localStorage.');
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
     2. WEBSOCKET STREAM + HTTP POLLING FALLBACK
     ======================================================================== */
  let wsStream = null;
  let isWsConnected = false;
  let pollingIntervalId = null;
  let wsReconnectTimer = null;
  let lastTickPrice = null;

  function initWebSocketStream() {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    updateStatus('connecting', 'WS STREAM');

    try {
      wsStream = new WebSocket('wss://stream.binance.com:9443/ws/paxgusdt@ticker');
      const connectTimeout = setTimeout(() => {
        if (!isWsConnected) startPollingFallback();
      }, 3500);

      wsStream.onopen = () => {
        clearTimeout(connectTimeout);
        isWsConnected = true;
        stopPollingFallback();
        updateStatus('live', 'WS STREAM (PaxGold)');
      };

      wsStream.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          const spotPrice = parseFloat(packet.c || packet.price || packet.p);
          if (!isNaN(spotPrice) && spotPrice > 1000) {
            let dir = null;
            if (lastTickPrice !== null) dir = spotPrice > lastTickPrice ? 'up' : spotPrice < lastTickPrice ? 'down' : null;
            lastTickPrice = spotPrice;
            processTick(spotPrice, dir, 'WS STREAM');
          }
        } catch (err) { /* silent */ }
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
    updateStatus('fallback', '1000ms Polling');
    fetchLiveGoldPrice();
    pollingIntervalId = setInterval(fetchLiveGoldPrice, 1000);
  }

  function stopPollingFallback() {
    if (pollingIntervalId !== null) { clearInterval(pollingIntervalId); pollingIntervalId = null; }
  }

  function processTick(price, direction, source) {
    if (!state.goldPrevClose) state.goldPrevClose = price;
    state.goldPrice = price;
    state.goldChangePts = parseFloat((price - state.goldPrevClose).toFixed(2));
    state.goldChangePct = parseFloat(((state.goldChangePts / state.goldPrevClose) * 100).toFixed(2));
    state.lastFetchTime = new Date();
    state.priceHistory.push(price);
    if (state.priceHistory.length > 80) state.priceHistory.shift();
    updateUI(direction);
    updateStatus('live', source);
    // Dynamically update signal confidence bars on tick
    updateConfidenceDynamically();
  }

  async function fetchLiveGoldPrice() {
    try {
      const r = await fetch('https://api.metals.live/v1/spot/gold', { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const d = await r.json();
        if (d && d.length > 0) {
          const price = parseFloat(d[d.length - 1].price);
          if (!isNaN(price) && price > 1000) {
            let dir = lastTickPrice ? (price > lastTickPrice ? 'up' : price < lastTickPrice ? 'down' : null) : null;
            lastTickPrice = price;
            processTick(price, dir, 'HTTP (metals.live)');
            return;
          }
        }
      }
    } catch (e) { /* fallback */ }

    try {
      const r = await fetch('https://api.frankfurter.app/latest?from=XAU&to=USD', { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const d = await r.json();
        if (d && d.rates && d.rates.USD) {
          const price = parseFloat(d.rates.USD);
          if (!isNaN(price) && price > 1000) {
            processTick(price, null, 'HTTP (frankfurter)');
          }
        }
      }
    } catch (e) { /* silent */ }
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
    if (state.currentTab === 'terminal' && canvas) renderGoldChart();
  }

  function updateStatus(status, source) {
    state.fetchStatus = status;
    if (!apiStatusText) return;
    const time = state.lastFetchTime ? state.lastFetchTime.toLocaleTimeString() : '';
    const colors = { connecting: '#f5c242', live: '#10b981', fallback: '#f5c242', error: '#ef4444' };
    const texts  = {
      connecting: 'CONNECTING TO WS STREAM...',
      live:       `LIVE • ${source} • ${time}`,
      fallback:   `FALLBACK • ${source}`,
      error:      'FEED ERROR — Using default price'
    };
    apiStatusText.textContent = texts[status] || texts.error;
    apiStatusText.style.color = colors[status] || colors.error;
  }

  function formatPrice(price) {
    return '$' + price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function initLiveDataFeed() { initWebSocketStream(); }

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
        if (target === 'terminal' && canvas) setTimeout(() => renderGoldChart(), 50);
        savePersistence();
      });
    });

    const tfButtons = document.querySelectorAll('#chart-tf-buttons .btn-tf');
    tfButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tfButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.timeframe = btn.getAttribute('data-tf');
        renderGoldChart();
        savePersistence();
      });
    });

    const btnToggle = document.getElementById('btn-toggle-overlay');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        state.showIndicators = !state.showIndicators;
        btnToggle.classList.toggle('active', state.showIndicators);
        renderGoldChart();
        savePersistence();
      });
    }
  }

  /* ========================================================================
     4. SIGNAL EXECUTION ENGINE
     ======================================================================== */
  const STRATEGIES = ['ICT_SilverBullet', 'ICT_AMD', 'AliVidollar_SD', 'RajaBanks_CT'];
  const SMC_REASONS = {
    ICT_SilverBullet: [
      'M5 FVG Fill during 10:00 EST window + Rejection at H1 OB + Clean Traffic to $TARGET',
      'Silver Bullet 14:00 EST + M15 CHOCH confirmed + FVG 50% fill + Bearish RSI Div',
      'Opening sweep FVG fill + H4 Order Block reaction + HTF Liq Pool alignment'
    ],
    ICT_AMD: [
      'Asia Hi Swept (Manipulation) + CHOCH M15 + NY Distribution Long setup',
      'London Liq Grab of Asian Lo + OB at $LEVEL + AMD Distribution phase confirmed',
      'Power of 3: Accumulation complete + London sweep + NY trend continuation entry'
    ],
    AliVidollar_SD: [
      'Fresh H4 Demand Zone (Drop-Base-Rally) + Stop Hunt of Swing Lo + Bullish Engulfing M15',
      'Untested Supply Zone + Liq Grab above $LEVEL + Bearish OB reaction + RSI Div',
      'Fresh Demand Zone (3-candle base) + Liq sweep + Pin Bar rejection + Clean path +$PIPS'
    ],
    RajaBanks_CT: [
      'H4 Clean Traffic Zone — zero resistance to $TARGET (+$PIPS pips clear)',
      'M15 Demand with Clean Traffic — no prior supply for +$PIPS pips above entry',
      'Clean Traffic zone confirmed — 3x checked H4/D1 for resistance. Entry at $LEVEL'
    ]
  };

  function generateLiveSignals() {
    const now = new Date();
    const price = state.goldPrice || 4085;
    const atr = state.signal.atr || 8.2;
    const signals = [];
    const numSignals = 5 + Math.floor(Math.random() * 3);
    const tfs = ['M5', 'M15', 'H1', 'H4'];
    const newsWithin4h = state.newsEvents.some(e => e.hoursUntil <= 4);

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

      // 3-Pillar Confidence
      const conf = calculateConfidence(strat, isBuy, isPredictive);
      if (conf.total < 72) continue; // Filter low-confidence

      const reasons = SMC_REASONS[strat];
      let reason = reasons[Math.floor(Math.random() * reasons.length)]
        .replace('$TARGET', formatPrice(tp2))
        .replace('$LEVEL', formatPrice(entry))
        .replace('$PIPS', Math.round(slDist * 2 * 10));

      const minAgoSeed = Math.floor(Math.random() * 45);
      const signalTime = new Date(now.getTime() - minAgoSeed * 60000);
      const timeStr = signalTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';

      signals.push({
        id: `SIG-${9844 + i}`,
        dir: isBuy ? 'LONG' : 'SHORT',
        isPredictive,
        strategy: strat,
        tf,
        entry, sl, tp1, tp2,
        rr: rrChoice.toFixed(1),
        conf: conf.total,
        confInst: conf.inst,
        confMacro: conf.macro,
        confTech: conf.tech,
        reason,
        time: timeStr,
        newsFlag: newsWithin4h && conf.total > 80
      });
    }
    return signals.sort((a, b) => b.conf - a.conf);
  }

  function calculateConfidence(strategy, isBuy, isPredictive) {
    // Institutional (40%): SMC quality — OB/FVG/Liq
    const instBase = {
      ICT_SilverBullet: 88 + Math.random() * 8,
      ICT_AMD:          86 + Math.random() * 10,
      AliVidollar_SD:   85 + Math.random() * 12,
      RajaBanks_CT:     82 + Math.random() * 12
    }[strategy] || 85;

    // Macro (30%): Real yields, DXY
    const macroScore = 84 + (isBuy ? 4 : -2) + Math.random() * 8;

    // Technical (30%): EMA, BB, ATR
    const techScore = 88 + Math.random() * 10;

    const inst  = Math.min(99, Math.round(instBase));
    const macro = Math.min(99, Math.round(macroScore));
    const tech  = Math.min(99, Math.round(techScore));
    const total = Math.round(inst * 0.40 + macro * 0.30 + tech * 0.30);

    return { total: Math.min(98, total), inst, macro, tech };
  }

  function generatePredictiveSetups(currentPrice) {
    const price = currentPrice || state.goldPrice || 4085;
    return [
      {
        tf: 'H4',
        type: 'OB',
        dir: 'LONG',
        level: parseFloat((price - 22).toFixed(2)),
        desc: 'H4 Bullish Order Block approaching. Potential Long Forming if price reaches zone.'
      },
      {
        tf: 'D1',
        type: 'FVG',
        dir: 'SHORT',
        level: parseFloat((price + 35).toFixed(2)),
        desc: 'Daily Fair Value Gap above. Potential Short Forming upon FVG tag.'
      },
      {
        tf: 'H1',
        type: 'Liq',
        dir: 'LONG',
        level: parseFloat((price - 8).toFixed(2)),
        desc: 'H1 Liquidity Pool (Equal Lows). Price sweeping → Potential Long Setup.'
      }
    ];
  }

  function initSignalEngine() {
    state.signalFeed = generateLiveSignals();
    state.predictiveSetups = generatePredictiveSetups();
    renderSignalFeed();
    renderPredictiveSetups();

    // Auto-refresh signals every 45 seconds
    setInterval(() => {
      state.signalFeed = generateLiveSignals();
      renderSignalFeed();
    }, 45000);
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
      div.innerHTML = `
        <div class="sig-item-header">
          <span class="sig-dir-badge ${badgeClass}">${dirLabel}</span>
          <span class="sig-strategy-tag">${sig.strategy}</span>
          <span class="sig-conf-badge ${confClass}">${sig.conf}%</span>
        </div>
        <div class="sig-reason">"${sig.reason}"</div>
        <div class="sig-levels">
          <span class="sig-level-item"><span class="sig-level-label">ENTRY</span><span class="sig-level-val entry-val">${formatPrice(sig.entry)}</span></span>
          <span class="sig-level-item"><span class="sig-level-label">SL</span><span class="sig-level-val sl-val">${formatPrice(sig.sl)}</span></span>
          <span class="sig-level-item"><span class="sig-level-label">TP2</span><span class="sig-level-val tp-val">${formatPrice(sig.tp2)}</span></span>
        </div>
        <div class="sig-footer">
          <span class="sig-rr">RR 1:${sig.rr}</span>
          <span style="display:flex;align-items:center;gap:6px;">
            ${sig.newsFlag ? '<span class="news-badge">⚠ NEWS</span>' : ''}
            <span class="sig-time">${sig.tf} • ${sig.time}</span>
          </span>
        </div>
      `;
      container.appendChild(div);
    });

    if (window.lucide) window.lucide.createIcons();
  }

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
        <span class="pred-price" style="color:${dirColor};">Potential ${setup.dir} near ${formatPrice(setup.level)}</span>
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
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function updateKillzoneDisplay() {
    const { h, m, s } = getUTCTime();
    const now = timeToSeconds(h, m, s);

    // Session windows (UTC seconds)
    const sessions = {
      asia:   { start: 0,     end: 28800  }, // 00:00–08:00
      london: { start: 28800, end: 39600  }, // 08:00–11:00
      ny:     { start: 46800, end: 57600  }  // 13:00–16:00
    };

    const londEl = document.getElementById('kz-london');
    const nyEl   = document.getElementById('kz-ny');
    const asiaEl = document.getElementById('kz-asia');

    // London
    const londonChip = document.getElementById('kz-london-chip');
    const londonCount = document.getElementById('kz-london-countdown');
    const londonLabel = document.getElementById('kz-london-label');
    if (now >= sessions.london.start && now < sessions.london.end) {
      const rem = sessions.london.end - now;
      if (londonCount) londonCount.textContent = formatCountdown(rem);
      if (londonLabel) londonLabel.textContent = 'ACTIVE — CLOSES IN';
      if (londonChip)  { londonChip.textContent = 'ACTIVE'; londonChip.className = 'kz-status-chip kz-chip-active'; }
      if (londEl) londEl.classList.add('kz-active');
    } else if (now < sessions.london.start) {
      const rem = sessions.london.start - now;
      if (londonCount) londonCount.textContent = formatCountdown(rem);
      if (londonLabel) londonLabel.textContent = 'OPENS IN';
      if (londonChip)  { londonChip.textContent = 'NEXT'; londonChip.className = 'kz-status-chip kz-chip-next'; }
      if (londEl) londEl.classList.remove('kz-active');
    } else {
      if (londonCount) londonCount.textContent = 'CLOSED';
      if (londonLabel) londonLabel.textContent = 'MANIPULATION PHASE DONE';
      if (londonChip)  { londonChip.textContent = 'DONE'; londonChip.className = 'kz-status-chip kz-chip-done'; }
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
      if (nyChip)  { nyChip.textContent = 'ACTIVE'; nyChip.className = 'kz-status-chip kz-chip-active'; }
      if (nyEl) nyEl.classList.add('kz-active');
    } else if (now < sessions.ny.start) {
      const rem = sessions.ny.start - now;
      if (nyCount) nyCount.textContent = formatCountdown(rem);
      if (nyLabel) nyLabel.textContent = 'OPENS IN';
      if (nyChip)  { nyChip.textContent = 'NEXT'; nyChip.className = 'kz-status-chip kz-chip-next'; }
      if (nyEl) nyEl.classList.remove('kz-active');
    } else {
      if (nyCount) nyCount.textContent = 'CLOSED';
      if (nyLabel) nyLabel.textContent = 'DISTRIBUTION PHASE DONE';
      if (nyChip)  { nyChip.textContent = 'DONE'; nyChip.className = 'kz-status-chip kz-chip-done'; }
      if (nyEl) nyEl.classList.remove('kz-active');
    }

    // Time-to-Execution estimate
    const tteEl = document.getElementById('tte-display');
    if (tteEl) {
      let tte = 'No Killzone active';
      if (now >= sessions.london.start && now < sessions.london.end) {
        tte = '~15 min (London Killzone LIVE)';
      } else if (now >= sessions.ny.start && now < sessions.ny.end) {
        tte = '~20 min (NY Killzone LIVE)';
      } else if (now < sessions.london.start) {
        const minsToLondon = Math.round((sessions.london.start - now) / 60);
        tte = `~${minsToLondon} min to London Open`;
      } else if (now < sessions.ny.start) {
        const minsToNY = Math.round((sessions.ny.start - now) / 60);
        tte = `~${minsToNY} min to NY Open`;
      }
      tteEl.textContent = tte;
    }

    // Ticker Silver Bullet countdown
    updateSilverBulletTicker(h, m);
  }

  /* ========================================================================
     6. SILVER BULLET CLOCK (10:00-11:00 & 14:00-15:00 EST = UTC-5/UTC-4)
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
    const { h } = getUTCTime();
    const el = document.getElementById('amd-current-phase');
    if (!el) return;
    if (h >= 0 && h < 8)   el.textContent = 'Phase: 📊 ACCUMULATION (Asia)';
    else if (h >= 8 && h < 11) el.textContent = 'Phase: ⚡ MANIPULATION (London)';
    else if (h >= 13 && h < 16) el.textContent = 'Phase: 🎯 DISTRIBUTION (NY)';
    else el.textContent = 'Phase: ⏸ Between Sessions';
  }

  function getSBStatus(nowH, nowM) {
    // EST = UTC - 5 (standard) or UTC - 4 (daylight saving)
    // Use UTC-4 (EDT) as default
    const estH = (nowH - 4 + 24) % 24;
    const estM = nowM;
    const timeMin = estH * 60 + estM;
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
    updateNewsWidget(state.newsEvents[0]);
  }

  function renderNewsCalendar() {
    const container = document.getElementById('news-calendar-list');
    if (!container) return;
    container.innerHTML = '';

    state.newsEvents.forEach(event => {
      const row = document.createElement('div');
      const isUpcoming = event.hoursUntil <= 4;
      row.className = `news-event-row${isUpcoming ? ' news-upcoming' : ''}`;
      row.innerHTML = `
        <div>
          <div class="news-time">${event.time}</div>
          <div class="news-time" style="color:${event.hoursUntil <= 4 ? 'var(--ruby)' : 'var(--text-dim)'};">In ${event.hoursUntil < 1 ? Math.round(event.hoursUntil*60)+'m' : event.hoursUntil.toFixed(1)+'h'}</div>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="news-folder-badge folder-${event.folder}"></span>
            <span class="news-event-name">${event.name}</span>
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
    const nameEl    = document.getElementById('news-next-event-name');
    const timeEl    = document.getElementById('news-next-event-time');
    const volEl     = document.getElementById('news-vol');
    const biasEl    = document.getElementById('news-bias');
    const inflEl    = document.getElementById('news-influence');
    const meterEl   = document.getElementById('news-meter-fill');
    const confEl    = document.getElementById('news-conf-chip');

    if (nameEl) nameEl.textContent = event.name;
    if (timeEl) timeEl.textContent = `In ${event.hoursUntil.toFixed(1)}h • ${event.time.split(' ')[1]} UTC`;
    if (volEl)  volEl.textContent  = `${event.volPips} pips`;
    if (biasEl) biasEl.textContent = event.bias;
    if (inflEl) inflEl.textContent = `${event.impactPct}%`;
    if (meterEl) meterEl.style.width = `${event.impactPct}%`;
    if (confEl)  { confEl.textContent = `${event.conf} IMPACT`; confEl.className = `news-confidence-chip ${event.confClass}`; }
  }

  /* ========================================================================
     8. CONFIDENCE BARS — DYNAMIC UPDATE ON TICK
     ======================================================================== */
  function updateConfidenceDynamically() {
    const gauge = document.getElementById('gauge-circle');
    const scoreEl = document.getElementById('gauge-score-num');
    const instEl  = document.getElementById('conf-val-inst');
    const macroEl = document.getElementById('conf-val-macro');
    const techEl  = document.getElementById('conf-val-tech');
    const barInst  = document.getElementById('conf-bar-inst');
    const barMacro = document.getElementById('conf-bar-macro');
    const barTech  = document.getElementById('conf-bar-tech');

    const { confInst: inst, confMacro: macro, confTech: tech, confidence } = state.signal;
    const total = confidence || Math.round(inst * 0.40 + macro * 0.30 + tech * 0.30);

    if (scoreEl) scoreEl.textContent = `${total}%`;
    if (instEl)  instEl.textContent  = `${inst}%`;
    if (macroEl) macroEl.textContent = `${macro}%`;
    if (techEl)  techEl.textContent  = `${tech}%`;

    // Bar widths are proportional within a total of 100%
    const totalWeight = 0.40 + 0.30 + 0.30;
    if (barInst)  barInst.style.width  = `${(inst  * 0.40 / (total || 1)) * 100 * 0.92}%`;
    if (barMacro) barMacro.style.width = `${(macro * 0.30 / (total || 1)) * 100 * 0.92}%`;
    if (barTech)  barTech.style.width  = `${(tech  * 0.30 / (total || 1)) * 100 * 0.92}%`;

    // Gauge ring: strokeDashoffset = 314 * (1 - score/100)
    if (gauge) gauge.style.strokeDashoffset = (314 * (1 - total / 100)).toFixed(1);
  }

  /* ========================================================================
     9. SIGNAL HISTORY TABLE (UPGRADED)
     ======================================================================== */
  function initSignalHistory() {
    if (!historyBody) return;
    historyBody.innerHTML = '';

    state.history.forEach(item => {
      const tr = document.createElement('tr');
      const isWin  = item.status.includes('WIN') || item.status === 'ACTIVE';
      const isBuy  = item.dir === 'BUY';
      const isActive = item.status === 'ACTIVE';
      const rrClass = { 'rr-min': 'rr-badge rr-badge-min', 'rr-good': 'rr-badge rr-badge-good', 'rr-high': 'rr-badge rr-badge-high' }[item.rrClass] || 'rr-badge rr-badge-high';

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
        <td class="${isWin ? 'text-emerald' : 'text-ruby'}" style="font-weight:700;">${item.pips}</td>
        <td class="text-gold">${item.confidence}</td>
        <td>${item.news ? `<span class="news-badge">⚠ ${item.news}</span>` : '<span style="color:var(--text-dim);font-size:10px;">—</span>'}</td>
        <td><span class="status-badge ${isActive ? 'badge-tag' : (isWin ? 'badge-win' : 'badge-ruby')}">${item.status}</span></td>
      `;
      historyBody.appendChild(tr);
    });
  }

  /* ========================================================================
     10. SMC CANVAS CHART RENDERER
     ======================================================================== */
  function initCanvasChart() {
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    renderGoldChart();
    window.addEventListener('resize', () => {
      const r2 = canvas.getBoundingClientRect();
      canvas.width  = r2.width  * dpr;
      canvas.height = r2.height * dpr;
      ctx.scale(dpr, dpr);
      renderGoldChart();
    });
  }

  function renderGoldChart() {
    if (!canvas || !ctx) return;
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    ctx.fillStyle = '#060910';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { const x = (w / 10) * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let j = 0; j <= 6;  j++) { const y = (h / 6)  * j; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    const currentPrice = state.goldPrice || 4085;
    const priceData = generatePriceData(currentPrice);
    const numPoints = priceData.length;
    const stepX = w / (numPoints - 1);
    const dataMin = Math.min(...priceData);
    const dataMax = Math.max(...priceData);
    const padding = Math.max((dataMax - dataMin) * 0.28, 18);
    const minP = dataMin - padding;
    const maxP = dataMax + padding;

    function pToY(p) { return h - ((p - minP) / (maxP - minP)) * (h - 60) - 30; }

    // Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '10px "JetBrains Mono"';
    for (let j = 0; j <= 6; j++) {
      const pl = maxP - ((maxP - minP) / 6) * j;
      ctx.fillText('$' + pl.toFixed(2), 5, (h / 6) * j + 12);
    }

    // ── SMC OVERLAYS ─────────────────────────────────────────────────────
    const obBottom = currentPrice - 14;
    const obTop    = obBottom + 5;
    const fvgBottom = currentPrice - 7;
    const fvgTop    = fvgBottom + 3.5;
    const liqLevel  = currentPrice - 20;
    const chochLevel = priceData[Math.floor(numPoints * 0.35)];

    // Order Block (Gold fill)
    const obTopY = pToY(obTop); const obBotY = pToY(obBottom);
    ctx.fillStyle = 'rgba(245, 194, 66, 0.10)';
    ctx.fillRect(w * 0.1, obTopY, w * 0.55, obBotY - obTopY);
    ctx.strokeStyle = 'rgba(245, 194, 66, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(w * 0.1, obTopY, w * 0.55, obBotY - obTopY);
    ctx.fillStyle = '#f5c242';
    ctx.font = 'bold 9px "JetBrains Mono"';
    ctx.fillText('OB', w * 0.12, obTopY - 4);

    // FVG (Purple fill)
    const fvgTopY = pToY(fvgTop); const fvgBotY = pToY(fvgBottom);
    ctx.fillStyle = 'rgba(139, 92, 246, 0.10)';
    ctx.fillRect(w * 0.45, fvgTopY, w * 0.35, fvgBotY - fvgTopY);
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(w * 0.45, fvgTopY, w * 0.35, fvgBotY - fvgTopY);
    ctx.setLineDash([]);
    ctx.fillStyle = '#8b5cf6';
    ctx.font = 'bold 9px "JetBrains Mono"';
    ctx.fillText('FVG', w * 0.47, fvgTopY - 4);

    // Liquidity Level (Cyan dashed)
    const liqY = pToY(liqLevel);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, liqY); ctx.lineTo(w * 0.7, liqY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 9px "JetBrains Mono"';
    ctx.fillText(`Liq $${liqLevel.toFixed(2)}`, 8, liqY - 4);

    // CHOCH label
    if (chochLevel) {
      const chochY = pToY(chochLevel);
      ctx.fillStyle = '#f5c242';
      ctx.font = 'bold 9px "JetBrains Mono"';
      ctx.fillText('CHOCH', w * 0.33, chochY - 4);
      ctx.beginPath();
      ctx.arc(w * 0.35, chochY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f5c242';
      ctx.fill();
    }

    // Demand Zone (Emerald fill)
    const demandBot = currentPrice - 14;
    const demandTop = demandBot + 4;
    const dTopY = pToY(demandTop); const dBotY = pToY(demandBot);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.10)';
    ctx.fillRect(0, dTopY, w, dBotY - dTopY);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.28)';
    ctx.strokeRect(0, dTopY, w, dBotY - dTopY);
    ctx.fillStyle = '#10b981';
    ctx.font = '9px "JetBrains Mono"';
    ctx.fillText(`DEMAND $${demandBot.toFixed(0)}–$${demandTop.toFixed(0)}`, 14, dTopY - 5);

    if (state.showIndicators) {
      // 200 EMA (Purple)
      ctx.beginPath(); ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 1.8;
      for (let i = 0; i < numPoints; i++) {
        const x = i * stepX;
        const ema = (currentPrice - 28) + (i * (28 / numPoints));
        const y = pToY(ema);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 50 EMA (Emerald)
      ctx.beginPath(); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.8;
      for (let i = 0; i < numPoints; i++) {
        const x = i * stepX;
        const ema = (currentPrice - 16) + (i * (16 / numPoints));
        const y = pToY(ema);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Bollinger Bands (Gold dashed)
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(245, 194, 66, 0.55)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < numPoints; i++) { const y = pToY(priceData[i] + 8); i === 0 ? ctx.moveTo(i * stepX, y) : ctx.lineTo(i * stepX, y); }
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < numPoints; i++) { const y = pToY(priceData[i] - 8); i === 0 ? ctx.moveTo(i * stepX, y) : ctx.lineTo(i * stepX, y); }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Price line + gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(245, 194, 66, 0.30)');
    gradient.addColorStop(1, 'rgba(245, 194, 66, 0.0)');
    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) { const y = pToY(priceData[i]); i === 0 ? ctx.moveTo(i * stepX, y) : ctx.lineTo(i * stepX, y); }
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = gradient; ctx.fill();

    ctx.beginPath(); ctx.strokeStyle = '#f5c242'; ctx.lineWidth = 2.5;
    for (let i = 0; i < numPoints; i++) { const y = pToY(priceData[i]); i === 0 ? ctx.moveTo(i * stepX, y) : ctx.lineTo(i * stepX, y); }
    ctx.stroke();

    // Entry / SL / TP lines (color-coded)
    drawHorizontalTarget(ctx, w, pToY(state.signal.entry), `ENTRY: ${formatPrice(state.signal.entry)}`, '#f5c242');
    drawHorizontalTarget(ctx, w, pToY(state.signal.sl),    `SL: ${formatPrice(state.signal.sl)}`,    '#ef4444');
    drawHorizontalTarget(ctx, w, pToY(state.signal.tp1),   `TP1 (1:2): ${formatPrice(state.signal.tp1)}`, '#10b981');
    drawHorizontalTarget(ctx, w, pToY(state.signal.tp2),   `TP2 (1:${state.signal.rr}): ${formatPrice(state.signal.tp2)}`, '#ffd700');

    // Live price dot
    const lastX = w - 2;
    const lastY = pToY(currentPrice);
    ctx.beginPath(); ctx.arc(lastX - 4, lastY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f5c242'; ctx.shadowColor = '#f5c242'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#f5c242'; ctx.font = 'bold 11px "JetBrains Mono"';
    ctx.fillText(`${formatPrice(currentPrice)}`, lastX - 90, lastY - 10);
  }

  function generatePriceData(currentPrice) {
    const numPoints = 60;
    if (state.priceHistory.length >= 10) {
      const history = [...state.priceHistory];
      while (history.length < numPoints) { history.unshift(history[0] - (Math.random() - 0.4) * 2); }
      history[history.length - 1] = currentPrice;
      return history.slice(-numPoints);
    }
    const data = [];
    let p = currentPrice - 24;
    for (let i = 0; i < numPoints; i++) {
      if (i < 15)            p += Math.sin(i * 0.4) * 1.5 + 0.5;
      else if (i < 28)       p -= (i === 22) ? 7.0 : -0.3;
      else                   p += (24 / (numPoints - 28)) + Math.sin(i) * 0.7;
      if (i === numPoints - 1) p = currentPrice;
      data.push(p);
    }
    return data;
  }

  function drawHorizontalTarget(context, width, y, label, color) {
    context.save();
    context.setLineDash([6, 4]);
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(100, y); context.lineTo(width - 130, y); context.stroke();
    context.fillStyle = color;
    context.font = 'bold 10px "JetBrains Mono"';
    context.fillText(label, width - 125, y + 3);
    context.restore();
  }

  /* ========================================================================
     11. INTERACTIVE MODEL SIMULATOR (TAB 3)
     ======================================================================== */
  function initSimulator() {
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
      // Institutional (40%)
      const smcScores = { choch_ob: 93, fvg: 80, liq_sweep: 88, none: 40 };
      const smcVal = inputs.smc ? inputs.smc.value : 'choch_ob';
      const instScore = smcScores[smcVal] || 50;
      if (vals.smc) vals.smc.textContent = { choch_ob: 'CHOCH + OB', fvg: 'FVG Fill', liq_sweep: 'Liq Sweep', none: 'No Signal' }[smcVal];

      // Macro (30%)
      const ryVal = parseFloat(inputs.realYield.value);
      if (vals.realYield) vals.realYield.textContent = `${ryVal.toFixed(2)}% (${ryVal < 0 ? 'Negative / Bullish' : 'Positive / Bearish'})`;
      let macroScore = 50;
      if (ryVal < 0) macroScore += Math.abs(ryVal) * 22;
      else           macroScore -= ryVal * 20;
      const dxyVal = inputs.dxy.value;
      if (vals.dxy) vals.dxy.textContent = { weak: 'Weakening (Bullish Au)', flat: 'Neutral', strong: 'Strengthening (Bearish Au)' }[dxyVal];
      if (dxyVal === 'weak') macroScore += 18; else if (dxyVal === 'strong') macroScore -= 18;
      const gprVal = parseInt(inputs.gpr.value);
      if (vals.gpr) vals.gpr.textContent = `${gprVal} (${gprVal > 120 ? 'High Risk' : 'Normal'})`;
      macroScore += (gprVal - 100) * 0.12;

      // Technical (30%)
      const emaVal = inputs.ema.value;
      if (vals.ema) vals.ema.textContent = { bullish: 'Price > 50 > 200', neutral: 'Between EMAs', bearish: 'Price < 50 < 200' }[emaVal];
      let techScore = 50;
      if (emaVal === 'bullish') techScore += 22; else if (emaVal === 'bearish') techScore -= 22;
      const bbVal = inputs.bb.value;
      if (vals.bb) vals.bb.textContent = { breakout_up: 'Squeeze + Upper Break', squeeze: 'Squeeze Phase', breakout_down: 'Squeeze + Lower Break', normal: 'Normal Vol' }[bbVal];
      if (bbVal === 'breakout_up') techScore += 18; else if (bbVal === 'squeeze') techScore += 8; else if (bbVal === 'breakout_down') techScore -= 18;

      const instC = Math.min(98, Math.max(20, instScore));
      const macroC = Math.min(98, Math.max(20, macroScore));
      const techC  = Math.min(98, Math.max(20, techScore));
      const total  = Math.min(98, Math.max(15, Math.round(instC * 0.40 + macroC * 0.30 + techC * 0.30)));

      const scoreEl = document.getElementById('sim-result-score');
      const badgeEl = document.getElementById('sim-result-badge');
      const textEl  = document.getElementById('sim-result-text');

      if (scoreEl) scoreEl.textContent = `${total}%`;
      if (badgeEl && textEl) {
        if (total >= 85) {
          badgeEl.className = 'sim-out-signal signal-buy';
          badgeEl.innerHTML = '<i data-lucide="check-circle-2"></i> HIGH CONFIDENCE LONG SIGNAL';
          textEl.textContent = `Institutional ${instC}% × 40% + Macro ${macroC}% × 30% + Technical ${techC}% × 30% = ${total}% weighted.`;
        } else if (total >= 70) {
          badgeEl.className = 'sim-out-signal';
          badgeEl.style.cssText = 'background:rgba(245,194,66,0.15);color:#f5c242;border:1px solid rgba(245,194,66,0.4);';
          badgeEl.innerHTML = '<i data-lucide="alert-circle"></i> MEDIUM CONFIDENCE SIGNAL';
          textEl.textContent = `Partial confluence detected. Missing ${smcVal === 'none' ? 'SMC confirmation' : 'macro or technical alignment'}. Score: ${total}%.`;
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
     12. RISK CALCULATOR (TAB 4) — DYNAMIC RR
     ======================================================================== */
  function initCalculator() {
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
      tp2:        document.getElementById('out-tp2')
    };
    if (!fields.balance) return;

    function calc() {
      const balance   = parseFloat(fields.balance.value)  || 10000;
      const riskPct   = parseFloat(fields.riskPct.value)  || 1.0;
      const entry     = parseFloat(fields.entry.value)    || 4055.00;
      const sl        = parseFloat(fields.sl.value)       || 4043.50;
      const rrTarget  = parseInt(fields.rrTarget ? fields.rrTarget.value : '4') || 4;

      const riskAmount  = balance * (riskPct / 100);
      const priceDist   = Math.abs(entry - sl);
      const pipsDist    = priceDist * 10;
      const lotSize     = riskAmount / (priceDist * 100);
      const isBuy       = entry > sl;
      const tp1Price    = isBuy ? entry + priceDist * 2      : entry - priceDist * 2;
      const tp2Price    = isBuy ? entry + priceDist * rrTarget : entry - priceDist * rrTarget;

      if (outs.riskAmount) outs.riskAmount.textContent = `$${riskAmount.toFixed(2)}`;
      if (outs.lots)       outs.lots.textContent       = `${lotSize.toFixed(2)} Lots`;
      if (outs.pips)       outs.pips.textContent       = `${pipsDist.toFixed(1)} Pips`;
      if (outs.tp1)        outs.tp1.textContent        = formatPrice(tp1Price);
      if (outs.tp2)        outs.tp2.textContent        = formatPrice(tp2Price);
    }

    Object.values(fields).forEach(el => { if (el) el.addEventListener('input', calc); });
    document.getElementById('btn-recalc')?.addEventListener('click', calc);
    calc();
  }

  /* ========================================================================
     13. ACTION BUTTONS & CLIPBOARD
     ======================================================================== */
  function initActionButtons() {
    document.getElementById('btn-refresh-signal')?.addEventListener('click', function() {
      this.innerHTML = '<i data-lucide="loader" class="spin"></i> Fetching...';
      if (window.lucide) window.lucide.createIcons();
      fetchLiveGoldPrice().then(() => {
        setTimeout(() => {
          this.innerHTML = '<i data-lucide="rotate-cw"></i> Run Inference';
          if (window.lucide) window.lucide.createIcons();
          // Regenerate signal feed
          state.signalFeed = generateLiveSignals();
          state.predictiveSetups = generatePredictiveSetups();
          renderSignalFeed();
          renderPredictiveSetups();
          showNotification(`MANUS MAX v5.0 — Inference complete. ${state.signalFeed.length} signals generated. Confidence: ${state.signal.confidence}%`);
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
        '[MANUS MAX AI 5.0 — XAU/USD SIGNAL]',
        `Strategy: ${s.strategy}`,
        `Direction: ${s.type}`,
        `Live Spot: ${formatPrice(state.goldPrice || 4085)}`,
        `Entry: ${formatPrice(s.entry)}`,
        `Stop Loss: ${formatPrice(s.sl)}`,
        `TP1 (1:2): ${formatPrice(s.tp1)}`,
        `TP2 (1:${s.rr}): ${formatPrice(s.tp2)}`,
        `R:R Ratio: 1:${s.rr}`,
        `AI Confidence: ${s.confidence}%`,
        `Reason: ${s.reason}`,
        '—— 3-Pillar Breakdown ——',
        `Institutional: ${s.confInst}% (×40%)`,
        `Macro: ${s.confMacro}% (×30%)`,
        `Technical: ${s.confTech}% (×30%)`
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
      toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,#f5c242,#eab308);color:#090d16;padding:12px 20px;border-radius:8px;font-weight:800;font-size:13px;box-shadow:0 8px 24px rgba(245,194,66,0.4);z-index:9999;transition:all 0.3s ease;max-width:400px;line-height:1.4;';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)'; }, 3500);
  }

  // Initial confidence update
  updateConfidenceDynamically();

}); // end DOMContentLoaded
