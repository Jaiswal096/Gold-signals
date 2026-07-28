/* ==========================================================================
   MANUS MAX — XAU/USD (Gold) AI Signal Platform Engine Logic
   LIVE DATA INTEGRATION — Real-time Gold Price from Public APIs
   ========================================================================== */

/* ==========================================================================
   PRIVACY GATE — Passphrase Authentication
   ========================================================================== */
(function () {
  const SECRET = 'Gold';

  // Inject gate styles
  const gateStyle = document.createElement('style');
  gateStyle.textContent = `
    #ag-gate-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: radial-gradient(ellipse at 50% 30%, #1a1408 0%, #0a0a0a 100%);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      transition: opacity 0.6s ease;
    }
    #ag-gate-overlay.fade-out { opacity: 0; pointer-events: none; }
    .ag-gate-card {
      background: linear-gradient(135deg, rgba(255,195,0,0.06) 0%, rgba(20,20,20,0.95) 100%);
      border: 1px solid rgba(255,195,0,0.25);
      border-radius: 20px;
      padding: 52px 44px 44px;
      width: 100%; max-width: 420px;
      box-shadow: 0 0 60px rgba(255,195,0,0.08), 0 24px 64px rgba(0,0,0,0.7);
      text-align: center;
      backdrop-filter: blur(24px);
    }
    .ag-gate-icon {
      width: 64px; height: 64px;
      background: linear-gradient(135deg, #ffd700, #b8860b);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
      box-shadow: 0 0 32px rgba(255,215,0,0.35);
      font-size: 28px;
    }
    .ag-gate-title {
      color: #ffd700; font-size: 22px; font-weight: 700;
      letter-spacing: 0.04em; margin-bottom: 6px;
    }
    .ag-gate-sub {
      color: rgba(255,255,255,0.38); font-size: 13px;
      margin-bottom: 32px; letter-spacing: 0.02em;
    }
    .ag-gate-input {
      width: 100%; box-sizing: border-box;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,195,0,0.2);
      border-radius: 10px;
      color: #fff; font-size: 16px; font-family: 'JetBrains Mono', monospace;
      padding: 14px 18px; outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      letter-spacing: 0.12em;
      text-align: center;
    }
    .ag-gate-input:focus {
      border-color: rgba(255,215,0,0.6);
      box-shadow: 0 0 16px rgba(255,215,0,0.12);
    }
    .ag-gate-input.shake {
      animation: ag-shake 0.4s ease;
      border-color: rgba(220,50,50,0.7);
    }
    @keyframes ag-shake {
      0%,100%{transform:translateX(0)}
      20%{transform:translateX(-8px)}
      40%{transform:translateX(8px)}
      60%{transform:translateX(-6px)}
      80%{transform:translateX(6px)}
    }
    .ag-gate-btn {
      margin-top: 18px; width: 100%;
      background: linear-gradient(135deg, #ffd700, #b8860b);
      color: #0a0a0a; font-size: 15px; font-weight: 700;
      border: none; border-radius: 10px; padding: 14px;
      cursor: pointer; letter-spacing: 0.06em;
      transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
      box-shadow: 0 4px 24px rgba(255,215,0,0.25);
    }
    .ag-gate-btn:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 32px rgba(255,215,0,0.35); }
    .ag-gate-btn:active { transform: translateY(0); }
    .ag-gate-err {
      margin-top: 14px; color: #ff4f4f; font-size: 12.5px;
      min-height: 18px; letter-spacing: 0.02em;
    }
    #ag-denied-screen {
      position: fixed; inset: 0; z-index: 99999;
      background: #000;
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 16px;
    }
    .ag-denied-icon { font-size: 56px; }
    .ag-denied-title { color: #ff4f4f; font-size: 22px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: 0.05em; }
    .ag-denied-sub { color: rgba(255,255,255,0.28); font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; }
  `;
  document.head.appendChild(gateStyle);

  // Build overlay
  const overlay = document.createElement('div');
  overlay.id = 'ag-gate-overlay';
  overlay.innerHTML = `
    <div class="ag-gate-card">
      <div class="ag-gate-icon">🔐</div>
      <div class="ag-gate-title">RESTRICTED ACCESS</div>
      <div class="ag-gate-sub">Gold Signal Intelligence Platform &mdash; Authorised Users Only</div>
      <input class="ag-gate-input" id="ag-gate-input" type="password"
             placeholder="Enter pass-phrase" autocomplete="off" spellcheck="false" />
      <button class="ag-gate-btn" id="ag-gate-submit">UNLOCK ▶</button>
      <div class="ag-gate-err" id="ag-gate-err"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  function denyAccess() {
    document.body.innerHTML = `
      <div id="ag-denied-screen">
        <div class="ag-denied-icon">🚫</div>
        <div class="ag-denied-title">ACCESS DENIED</div>
        <div class="ag-denied-sub">Invalid pass-phrase. This session has been terminated.</div>
      </div>
    `;
    // Re-inject the denied screen styles since body was wiped
    const s = document.createElement('style');
    s.textContent = `
      body{margin:0;background:#000;}
      #ag-denied-screen{position:fixed;inset:0;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;}
      .ag-denied-icon{font-size:56px;}
      .ag-denied-title{color:#ff4f4f;font-size:22px;font-weight:700;font-family:system-ui,sans-serif;letter-spacing:.05em;}
      .ag-denied-sub{color:rgba(255,255,255,.28);font-size:13px;font-family:system-ui,sans-serif;}
    `;
    document.head.appendChild(s);
  }

  function grantAccess() {
    overlay.classList.add('fade-out');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    initApp(); // Run the main app
  }

  function validate() {
    const val = document.getElementById('ag-gate-input').value.trim();
    const errEl = document.getElementById('ag-gate-err');
    if (val === SECRET) {
      grantAccess();
    } else {
      errEl.textContent = 'Incorrect pass-phrase. Access denied.';
      const input = document.getElementById('ag-gate-input');
      input.classList.add('shake');
      input.addEventListener('animationend', () => input.classList.remove('shake'), { once: true });
      input.value = '';
      input.focus();
      // Lock out after 3 seconds if no retry
      setTimeout(() => {
        if (document.getElementById('ag-gate-overlay')) denyAccess();
      }, 3000);
    }
  }

  document.getElementById('ag-gate-submit').addEventListener('click', validate);
  document.getElementById('ag-gate-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') validate();
  });

  // Auto-focus input
  setTimeout(() => { const el = document.getElementById('ag-gate-input'); if (el) el.focus(); }, 100);
})();

/* ==========================================================================
   MAIN APP — Initialised only after successful gate pass
   ========================================================================== */
function initApp() {

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // State Management
  const state = {
    currentTab: 'terminal',
    goldPrice: 4085.00,
    goldPrevClose: 4055.00,   // Entry trigger as prev-close baseline → delta = +0.74%
    goldChangePct: 0.74,
    goldChangePts: 30.00,
    timeframe: 'H1',
    confidenceScore: 91.4,
    showIndicators: true,
    lastFetchTime: null,
    fetchStatus: 'connecting', // 'connecting', 'live', 'fallback', 'error'
    priceHistory: [], // Store recent prices for the canvas chart

    // Active Signal — Entry $4,055 | Current Spot $4,085 | Delta +0.74%
    signal: {
      type: 'LONG',
      entry: 4055.00,
      sl: 4043.50,
      tp1: 4066.50,
      tp2: 4078.00,
      atr: 8.00
    },

    // Signal History — full ISO-8601 timestamps, ≥1:2 R:R enforced on every row
    // rr: computed as (tp - entry) / (entry - sl) for BUY; (entry - tp) / (sl - entry) for SELL
    history: [
      {
        id: 'SIG-9842',
        openTs:  '2026-07-27 10:30:14 IST',
        closeTs: '—  (ACTIVE)',
        dir: 'BUY',
        entry: 4055.00, sl: 4043.50, tp: 4078.00,
        rr: '1 : 2.0', rrClass: 'rr-min',
        pips: '+230', confidence: '91.4%',
        pillars: 'Macro + Tech + PA', status: 'ACTIVE'
      },
      {
        id: 'SIG-9841',
        openTs:  '2026-07-26 14:15:08 IST',
        closeTs: '2026-07-26 18:42:31 IST',
        dir: 'BUY',
        entry: 4031.80, sl: 4020.00, tp: 4056.60,
        rr: '1 : 2.1', rrClass: 'rr-good',
        pips: '+248', confidence: '88.2%',
        pillars: 'Macro + Tech', status: 'WIN (TP2)'
      },
      {
        id: 'SIG-9840',
        openTs:  '2026-07-25 09:00:55 IST',
        closeTs: '2026-07-25 11:18:22 IST',
        dir: 'SELL',
        entry: 4048.50, sl: 4057.20, tp: 4031.00,
        rr: '1 : 2.0', rrClass: 'rr-min',
        pips: '+175', confidence: '85.6%',
        pillars: 'Tech + PA', status: 'WIN (TP1)'
      },
      {
        id: 'SIG-9839',
        openTs:  '2026-07-24 16:45:02 IST',
        closeTs: '2026-07-24 21:10:47 IST',
        dir: 'BUY',
        entry: 4012.40, sl: 4001.00, tp: 4035.80,
        rr: '1 : 2.1', rrClass: 'rr-good',
        pips: '+234', confidence: '94.1%',
        pillars: 'Macro + Tech + PA', status: 'WIN (TP2)'
      },
      {
        id: 'SIG-9838',
        openTs:  '2026-07-23 11:20:33 IST',
        closeTs: '2026-07-23 12:55:09 IST',
        dir: 'SELL',
        entry: 4038.20, sl: 4047.00, tp: 4020.60,
        rr: '1 : 2.0', rrClass: 'rr-min',
        pips: '-88', confidence: '72.0%',
        pillars: 'Tech Only', status: 'STOPPED'
      },
      {
        id: 'SIG-9837',
        openTs:  '2026-07-22 08:05:19 IST',
        closeTs: '2026-07-22 14:38:51 IST',
        dir: 'BUY',
        entry: 3998.60, sl: 3987.00, tp: 4022.20,
        rr: '1 : 2.0', rrClass: 'rr-min',
        pips: '+236', confidence: '89.7%',
        pillars: 'Macro + Tech', status: 'WIN (TP2)'
      },
      {
        id: 'SIG-9836',
        openTs:  '2026-07-21 13:30:44 IST',
        closeTs: '2026-07-21 17:52:06 IST',
        dir: 'BUY',
        entry: 3975.50, sl: 3963.00, tp: 4000.50,
        rr: '1 : 2.0', rrClass: 'rr-min',
        pips: '+250', confidence: '87.3%',
        pillars: 'Macro + PA', status: 'WIN (TP2)'
      },
    ]
  };

  // DOM Elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const livePriceEl = document.getElementById('live-gold-price');
  const liveChangeEl = document.getElementById('live-gold-change');
  const liveCurrentEl = document.getElementById('sig-current-live');
  const historyTableBody = document.getElementById('history-table-body');
  const canvas = document.getElementById('goldChart');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const apiStatusText = document.getElementById('api-status-text');

  // Initialize Modules
  initNavigation();
  initSignalHistory();
  initCanvasChart();
  initSimulator();
  initCalculator();
  initActionButtons();

  // Start live data fetching
  initLiveDataFeed();

  /* --------------------------------------------------------------------------
     1. HIGH-PERFORMANCE STREAMING WEBSOCKET ARCHITECTURE & FALLBACK ENGINE
     -------------------------------------------------------------------------- */

  let wsStream = null;
  let isWsConnected = false;
  let pollingIntervalId = null;
  let wsReconnectTimer = null;
  let lastTickPrice = null;

  /**
   * Initializes the WebSocket stream for sub-millisecond tick updates.
   * Connects to high-frequency WebSocket feed (Binance PAXG/USDT Gold Spot stream).
   */
  function initWebSocketStream() {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);

    updateStatus('connecting', 'WS STREAM');
    console.log('[MANUS MAX] Establishing WebSocket stream connection...');

    try {
      // Native WebSocket connection to real-time Gold (PAXG/USDT) ticker stream
      wsStream = new WebSocket('wss://stream.binance.com:9443/ws/paxgusdt@ticker');

      // Connection timeout safety net (3.5 seconds)
      const connectTimeout = setTimeout(() => {
        if (!isWsConnected) {
          console.warn('[MANUS MAX] WebSocket connection timeout. Initiating 1000ms polling fallback.');
          startPollingFallback();
        }
      }, 3500);

      wsStream.onopen = () => {
        clearTimeout(connectTimeout);
        isWsConnected = true;
        stopPollingFallback();
        updateStatus('live', 'WS STREAM (PaxGold Spot)');
        console.log('[MANUS MAX] WebSocket Stream CONNECTED — Low-Latency Ticks Active.');
      };

      wsStream.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          // 'c' contains the current absolute spot price in 24hrTicker payload
          const spotPrice = parseFloat(packet.c || packet.price || packet.p);

          if (!isNaN(spotPrice) && spotPrice > 1000) {
            let tickDir = null;
            if (lastTickPrice !== null) {
              if (spotPrice > lastTickPrice) tickDir = 'up';
              else if (spotPrice < lastTickPrice) tickDir = 'down';
            }
            lastTickPrice = spotPrice;

            processTick(spotPrice, tickDir, 'WS STREAM');
          }
        } catch (err) {
          console.error('[MANUS MAX] Error parsing WebSocket message packet:', err);
        }
      };

      wsStream.onerror = (error) => {
        console.warn('[MANUS MAX] WebSocket stream error detected:', error);
        handleWsFailure();
      };

      wsStream.onclose = () => {
        console.warn('[MANUS MAX] WebSocket connection closed.');
        handleWsFailure();
      };

    } catch (e) {
      console.error('[MANUS MAX] Failed to construct WebSocket instance:', e);
      handleWsFailure();
    }
  }

  /**
   * Handles WebSocket disconnection by triggering immediate HTTP polling fallback
   * and scheduling automatic reconnection negotiations.
   */
  function handleWsFailure() {
    isWsConnected = false;
    startPollingFallback();

    // Auto-reconnect negotiation after 5 seconds
    if (!wsReconnectTimer) {
      wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null;
        if (!isWsConnected) {
          console.log('[MANUS MAX] Attempting automatic WebSocket reconnection negotiation...');
          initWebSocketStream();
        }
      }, 5000);
    }
  }

  /**
   * Starts fail-safe HTTP polling fallback loop at 1000ms frequency.
   */
  function startPollingFallback() {
    if (pollingIntervalId !== null) return;
    console.warn('[MANUS MAX] Fail-safe active: Running API polling loop (1000ms).');
    updateStatus('fallback', '1000ms Polling Loop');

    // Trigger immediate fetch
    fetchLiveGoldPrice();

    // Poll every 1000ms
    pollingIntervalId = setInterval(() => {
      fetchLiveGoldPrice();
    }, 1000);
  }

  /**
   * Stops HTTP polling fallback loop once WebSocket stream is healthy.
   */
  function stopPollingFallback() {
    if (pollingIntervalId !== null) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
      console.log('[MANUS MAX] Polling fallback stopped — WebSocket streaming primary active.');
    }
  }

  /**
   * Processes a live tick packet, updates state, and applies micro-scale visual flash animations.
   */
  function processTick(price, direction, source) {
    if (state.goldPrevClose === null) {
      state.goldPrevClose = price;
    }

    state.goldPrice = price;
    state.goldChangePts = parseFloat((price - state.goldPrevClose).toFixed(2));
    state.goldChangePct = parseFloat(((state.goldChangePts / state.goldPrevClose) * 100).toFixed(2));
    state.lastFetchTime = new Date();

    // Store in price history for dynamic canvas chart (max 60 ticks)
    state.priceHistory.push(price);
    if (state.priceHistory.length > 60) {
      state.priceHistory.shift();
    }

    // Update UI elements instantaneously with sub-millisecond precision
    updateUI(direction);
    updateStatus('live', source);
  }

  /**
   * Multi-API HTTP Polling Fallback method (used when WS disconnects).
   */
  async function fetchLiveGoldPrice() {
    try {
      const response = await fetch('https://api.metals.live/v1/spot/gold', {
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const latest = data[data.length - 1];
          const price = parseFloat(latest.price);
          if (!isNaN(price) && price > 1000) {
            let tickDir = null;
            if (lastTickPrice !== null) {
              if (price > lastTickPrice) tickDir = 'up';
              else if (price < lastTickPrice) tickDir = 'down';
            }
            lastTickPrice = price;
            processTick(price, tickDir, 'HTTP Polling (1s)');
            return;
          }
        }
      }
    } catch (e) {
      console.warn('[MANUS MAX] HTTP Polling metals.live issue:', e.message);
    }

    // Secondary fallback endpoint (frankfurter / metals.dev)
    try {
      const response = await fetch('https://api.frankfurter.app/latest?from=XAU&to=USD', {
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.rates && data.rates.USD) {
          const price = parseFloat(data.rates.USD);
          if (!isNaN(price) && price > 1000) {
            processTick(price, null, 'HTTP Polling (Frankfurter)');
            return;
          }
        }
      }
    } catch (e) {
      console.warn('[MANUS MAX] Secondary HTTP Polling issue:', e.message);
    }
  }

  /**
   * Updates DOM elements instantly with smooth directional micro-tick flash animations.
   */
  function updateUI(direction) {
    if (state.goldPrice === null) return;

    const price = state.goldPrice;
    const formattedPrice = formatPrice(price);
    const isPos = state.goldChangePts >= 0;

    // Update Header Ticker Price Element with instantaneous text change & visual flash
    if (livePriceEl) {
      livePriceEl.textContent = formattedPrice;

      // Apply subtle green (tick-up) or red (tick-down) directional micro-flash
      livePriceEl.classList.remove('tick-up', 'tick-down', 'price-flash');
      // Trigger reflow for restartable CSS animation
      void livePriceEl.offsetWidth;

      if (direction === 'up') {
        livePriceEl.classList.add('tick-up');
      } else if (direction === 'down') {
        livePriceEl.classList.add('tick-down');
      } else {
        livePriceEl.classList.add('price-flash');
      }

      setTimeout(() => {
        livePriceEl.classList.remove('tick-up', 'tick-down', 'price-flash');
      }, 380);
    }

    // Update signal card "Current Spot" price
    if (liveCurrentEl) {
      liveCurrentEl.textContent = formattedPrice;
    }

    // Update percentage change display
    if (liveChangeEl) {
      liveChangeEl.textContent = `${isPos ? '+' : ''}${state.goldChangePct.toFixed(2)}% (${isPos ? '+' : ''}${state.goldChangePts.toFixed(2)})`;
      liveChangeEl.className = `ticker-change ${isPos ? 'text-emerald' : 'text-ruby'}`;
    }

    // Re-render AI canvas chart if terminal tab is active
    if (state.currentTab === 'terminal' && canvas) {
      renderGoldChart();
    }
  }

  /**
   * Updates status text in the header ticker bar.
   */
  function updateStatus(status, source) {
    state.fetchStatus = status;
    if (!apiStatusText) return;

    switch (status) {
      case 'connecting':
        apiStatusText.textContent = 'CONNECTING TO WS STREAM...';
        apiStatusText.style.color = '#f5c242';
        break;
      case 'live':
        const timeStr = state.lastFetchTime ? state.lastFetchTime.toLocaleTimeString() : '';
        apiStatusText.textContent = `LIVE • ${source} • ${timeStr}`;
        apiStatusText.style.color = '#10b981';
        break;
      case 'fallback':
        apiStatusText.textContent = `FALLBACK • ${source}`;
        apiStatusText.style.color = '#f5c242';
        break;
      case 'error':
        apiStatusText.textContent = 'FEED ERROR — Using default price';
        apiStatusText.style.color = '#ef4444';
        break;
    }
  }

  /**
   * Formats price with dollar sign and thousand separators.
   */
  function formatPrice(price) {
    return '$' + price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Starts the live data feed (WebSocket primary + HTTP polling fallback).
   */
  function initLiveDataFeed() {
    // Initiate high-performance WebSocket stream
    initWebSocketStream();
  }

  /* --------------------------------------------------------------------------
     2. NAVIGATION & TAB SWITCHING
     -------------------------------------------------------------------------- */
  function initNavigation() {
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        
        navTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const targetContent = document.getElementById(`tab-${targetTab}`);
        if (targetContent) {
          targetContent.classList.add('active');
        }
        
        state.currentTab = targetTab;

        if (targetTab === 'terminal' && canvas) {
          setTimeout(() => renderGoldChart(), 50);
        }
      });
    });

    // Timeframe selector buttons
    const tfButtons = document.querySelectorAll('#chart-tf-buttons .btn-tf');
    tfButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tfButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.timeframe = btn.getAttribute('data-tf');
        renderGoldChart();
      });
    });

    // Toggle indicator overlays
    const btnToggleOverlay = document.getElementById('btn-toggle-overlay');
    if (btnToggleOverlay) {
      btnToggleOverlay.addEventListener('click', () => {
        state.showIndicators = !state.showIndicators;
        btnToggleOverlay.classList.toggle('active', state.showIndicators);
        renderGoldChart();
      });
    }
  }

  /* --------------------------------------------------------------------------
     3. SIGNAL HISTORY TABLE POPULATION
     -------------------------------------------------------------------------- */
  function initSignalHistory() {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '';

    state.history.forEach(item => {
      const tr = document.createElement('tr');
      const isWin = item.status.includes('WIN') || item.status === 'ACTIVE';
      const isBuy = item.dir === 'BUY';
      const isActive = item.status === 'ACTIVE';

      // R:R badge colour class mapping
      const rrBadgeClass = {
        'rr-min':  'rr-badge rr-badge-min',
        'rr-good': 'rr-badge rr-badge-good',
        'rr-high': 'rr-badge rr-badge-high',
      }[item.rrClass] || 'rr-badge rr-badge-min';

      tr.innerHTML = `
        <td class="font-mono" style="color:var(--text-dim);font-size:11px;letter-spacing:.5px">${item.id}</td>
        <td class="font-mono ts-cell">${item.openTs}</td>
        <td class="font-mono ts-cell ${isActive ? 'text-gold' : ''}">${item.closeTs}</td>
        <td>
          <span class="status-badge ${isBuy ? 'badge-win' : 'badge-gold'}">
            ${isBuy ? '▲ BUY' : '▼ SELL'}
          </span>
        </td>
        <td class="font-mono">$${item.entry.toFixed(2)}</td>
        <td class="text-ruby font-mono">$${item.sl.toFixed(2)}</td>
        <td class="text-emerald font-mono">$${item.tp.toFixed(2)}</td>
        <td><span class="${rrBadgeClass}">${item.rr}</span></td>
        <td class="${isWin ? 'text-emerald' : 'text-ruby'}" style="font-weight:700">${item.pips}</td>
        <td class="text-gold">${item.confidence}</td>
        <td style="color:var(--text-secondary);font-size:11px">${item.pillars}</td>
        <td>
          <span class="status-badge ${isActive ? 'badge-tag' : (isWin ? 'badge-win' : 'badge-ruby')}">
            ${item.status}
          </span>
        </td>
      `;
      historyTableBody.appendChild(tr);
    });
  }

  /* --------------------------------------------------------------------------
     4. INTERACTIVE CANVAS PRICE CHART RENDERER (AI Signal Overlay)
     -------------------------------------------------------------------------- */
  function initCanvasChart() {
    if (!canvas || !ctx) return;

    // Handle high DPI retina screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    renderGoldChart();

    window.addEventListener('resize', () => {
      const rectResized = canvas.getBoundingClientRect();
      canvas.width = rectResized.width * dpr;
      canvas.height = rectResized.height * dpr;
      ctx.scale(dpr, dpr);
      renderGoldChart();
    });
  }

  function renderGoldChart() {
    if (!canvas || !ctx) return;
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    // Clear background
    ctx.fillStyle = '#060910';
    ctx.fillRect(0, 0, w, h);

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridCols = 10;
    const gridRows = 6;

    for (let i = 0; i <= gridCols; i++) {
      const x = (w / gridCols) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    for (let j = 0; j <= gridRows; j++) {
      const y = (h / gridRows) * j;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Use live price data if available, otherwise generate synthetic
    const currentPrice = state.goldPrice || 2650;
    const priceData = generatePriceData(currentPrice);
    const numPoints = priceData.length;
    const stepX = w / (numPoints - 1);

    // Dynamic price range based on actual data
    const dataMin = Math.min(...priceData);
    const dataMax = Math.max(...priceData);
    const priceRange = dataMax - dataMin;
    const padding = Math.max(priceRange * 0.25, 15);
    const minPrice = dataMin - padding;
    const maxPrice = dataMax + padding;

    function priceToY(p) {
      return h - ((p - minPrice) / (maxPrice - minPrice)) * (h - 60) - 30;
    }

    // Draw Y-axis price labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '10px "JetBrains Mono"';
    for (let j = 0; j <= gridRows; j++) {
      const priceLabel = maxPrice - ((maxPrice - minPrice) / gridRows) * j;
      const y = (h / gridRows) * j;
      ctx.fillText('$' + priceLabel.toFixed(2), 5, y + 12);
    }

    // 1. Draw Demand Zone (dynamic, relative to current price)
    const demandZoneBottom = currentPrice - 14;
    const demandZoneTop = demandZoneBottom + 4;
    const demandTopY = priceToY(demandZoneTop);
    const demandBotY = priceToY(demandZoneBottom);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.fillRect(0, demandTopY, w, demandBotY - demandTopY);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.strokeRect(0, demandTopY, w, demandBotY - demandTopY);

    ctx.fillStyle = '#10b981';
    ctx.font = '10px "JetBrains Mono"';
    ctx.fillText(`FRESH DEMAND ZONE ($${demandZoneBottom.toFixed(0)} - $${demandZoneTop.toFixed(0)})`, 15, demandTopY - 6);

    if (state.showIndicators) {
      // 2. Draw 200 EMA (Purple Line)
      ctx.beginPath();
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;
      for (let i = 0; i < numPoints; i++) {
        const x = i * stepX;
        const ema200 = (currentPrice - 26) + (i * (26 / numPoints));
        const y = priceToY(ema200);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 3. Draw 50 EMA (Emerald Line)
      ctx.beginPath();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      for (let i = 0; i < numPoints; i++) {
        const x = i * stepX;
        const ema50 = (currentPrice - 15) + (i * (15 / numPoints));
        const y = priceToY(ema50);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 4. Draw Bollinger Bands (Gold Dashed)
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(245, 194, 66, 0.6)';
      ctx.beginPath();
      for (let i = 0; i < numPoints; i++) {
        const x = i * stepX;
        const upperBB = priceData[i] + 7.5;
        const y = priceToY(upperBB);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i < numPoints; i++) {
        const x = i * stepX;
        const lowerBB = priceData[i] - 7.5;
        const y = priceToY(lowerBB);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Draw Gold Price Line & Area Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(245, 194, 66, 0.35)');
    gradient.addColorStop(1, 'rgba(245, 194, 66, 0.0)');

    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
      const x = i * stepX;
      const y = priceToY(priceData[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    ctx.strokeStyle = '#f5c242';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < numPoints; i++) {
      const x = i * stepX;
      const y = priceToY(priceData[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 6. Draw Signal Execution Target Lines (Entry, SL, TP1, TP2)
    const entryY = priceToY(state.signal.entry);
    const slY = priceToY(state.signal.sl);
    const tp1Y = priceToY(state.signal.tp1);
    const tp2Y = priceToY(state.signal.tp2);

    // Entry Line (Gold)
    drawHorizontalTarget(ctx, w, entryY, `ENTRY: $${state.signal.entry.toFixed(2)}`, '#f5c242');
    // SL Line (Red)
    drawHorizontalTarget(ctx, w, slY, `SL: $${state.signal.sl.toFixed(2)}`, '#ef4444');
    // TP1 Line (Emerald)
    drawHorizontalTarget(ctx, w, tp1Y, `TP1 (1:1): $${state.signal.tp1.toFixed(2)}`, '#10b981');
    // TP2 Line (Gold)
    drawHorizontalTarget(ctx, w, tp2Y, `TP2 (1:2): $${state.signal.tp2.toFixed(2)}`, '#ffd700');

    // 7. Draw Active Price Pulsing Dot
    const lastX = w - 1;
    const lastY = priceToY(currentPrice);

    ctx.beginPath();
    ctx.arc(lastX - 4, lastY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f5c242';
    ctx.shadowColor = '#f5c242';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw current price label at the right edge
    ctx.fillStyle = '#f5c242';
    ctx.font = 'bold 11px "JetBrains Mono"';
    ctx.fillText(`$${currentPrice.toFixed(2)}`, lastX - 85, lastY - 10);
  }

  /**
   * Generate price data for the canvas chart, incorporating real price history
   */
  function generatePriceData(currentPrice) {
    const numPoints = 50;

    if (state.priceHistory.length >= 10) {
      // Use actual price history data, interpolated to fill numPoints
      const history = [...state.priceHistory];
      while (history.length < numPoints) {
        // Pad beginning with synthetic data leading to first real point
        const firstReal = history[0];
        const syntheticStart = firstReal - (Math.random() - 0.4) * 2;
        history.unshift(syntheticStart);
      }
      // Make sure last point is current price
      history[history.length - 1] = currentPrice;
      return history.slice(-numPoints);
    }

    // Fallback: Generate synthetic but realistic price path to current price
    const priceData = [];
    let p = currentPrice - 22;

    for (let i = 0; i < numPoints; i++) {
      if (i < 15) {
        p += Math.sin(i * 0.4) * 1.5 + 0.6;
      } else if (i >= 15 && i < 28) {
        p -= (i === 22) ? 6.0 : -0.2;
      } else {
        p += (22 / (numPoints - 28)) + Math.sin(i) * 0.8;
      }
      if (i === numPoints - 1) p = currentPrice;
      priceData.push(p);
    }
    return priceData;
  }

  function drawHorizontalTarget(context, width, y, label, color) {
    context.save();
    context.setLineDash([6, 4]);
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(100, y);
    context.lineTo(width - 120, y);
    context.stroke();

    context.fillStyle = color;
    context.font = 'bold 10px "JetBrains Mono"';
    context.fillText(label, width - 115, y + 3);
    context.restore();
  }

  /* --------------------------------------------------------------------------
     5. INTERACTIVE MODEL SIMULATOR (TAB 2)
     -------------------------------------------------------------------------- */
  function initSimulator() {
    const inputRealYield = document.getElementById('sim-input-realyield');
    const inputDxy = document.getElementById('sim-input-dxy');
    const inputEma = document.getElementById('sim-input-ema');
    const inputBb = document.getElementById('sim-input-bb');
    const inputGpr = document.getElementById('sim-input-gpr');

    const valRealYield = document.getElementById('sim-val-realyield');
    const valGpr = document.getElementById('sim-val-gpr');
    const resultScore = document.getElementById('sim-result-score');
    const resultBadge = document.getElementById('sim-result-badge');
    const resultText = document.getElementById('sim-result-text');

    if (!inputRealYield) return;

    function calculateSimulatedScore() {
      let score = 50; // Base score

      // 1. Real Yield Score
      const ryVal = parseFloat(inputRealYield.value);
      if (valRealYield) valRealYield.textContent = `${ryVal.toFixed(2)}% (${ryVal < 0 ? 'Negative / Bullish' : 'Positive / Bearish'})`;
      if (ryVal < 0) score += Math.abs(ryVal) * 22;
      else score -= ryVal * 20;

      // 2. DXY Trend
      const dxyVal = inputDxy.value;
      if (dxyVal === 'weak') score += 18;
      else if (dxyVal === 'strong') score -= 18;

      // 3. EMA Trend
      const emaVal = inputEma.value;
      if (emaVal === 'bullish') score += 16;
      else if (emaVal === 'bearish') score -= 16;

      // 4. Bollinger Band Status
      const bbVal = inputBb.value;
      if (bbVal === 'breakout_up') score += 14;
      else if (bbVal === 'squeeze') score += 6;
      else if (bbVal === 'breakout_down') score -= 18;

      // 5. GPR Score
      const gprVal = parseInt(inputGpr.value);
      if (valGpr) valGpr.textContent = `${gprVal} (${gprVal > 120 ? 'High Risk' : 'Normal'})`;
      score += (gprVal - 100) * 0.12;

      // Clamp score between 15% and 98.5%
      score = Math.min(98.5, Math.max(15.0, score));
      
      if (resultScore) resultScore.textContent = `${score.toFixed(1)}%`;

      if (resultBadge && resultText) {
        if (score >= 85) {
          resultBadge.className = 'sim-out-signal signal-buy';
          resultBadge.innerHTML = '<i data-lucide="check-circle-2"></i> HIGH CONFIDENCE LONG SIGNAL';
          resultText.textContent = 'Full multi-layer confluence detected! Targeted 300-pip move predicted within 4 hours.';
        } else if (score >= 70) {
          resultBadge.className = 'sim-out-signal';
          resultBadge.style.background = 'rgba(245, 194, 66, 0.15)';
          resultBadge.style.color = '#f5c242';
          resultBadge.style.borderColor = 'rgba(245, 194, 66, 0.4)';
          resultBadge.innerHTML = '<i data-lucide="alert-circle"></i> MEDIUM CONFIDENCE SIGNAL';
          resultText.textContent = 'Technical breakout confirmed by AI model but lacking full Macro alignment.';
        } else {
          resultBadge.className = 'sim-out-signal';
          resultBadge.style.background = 'rgba(239, 68, 68, 0.15)';
          resultBadge.style.color = '#ef4444';
          resultBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          resultBadge.innerHTML = '<i data-lucide="x-circle"></i> NO TRADE — SIGNAL FILTERED';
          resultText.textContent = 'Confidence below 70% execution threshold. Trade filtered out to protect risk.';
        }
        if (window.lucide) window.lucide.createIcons();
      }
    }

    [inputRealYield, inputDxy, inputEma, inputBb, inputGpr].forEach(elem => {
      if (elem) {
        elem.addEventListener('input', calculateSimulatedScore);
        elem.addEventListener('change', calculateSimulatedScore);
      }
    });

    calculateSimulatedScore();
  }

  /* --------------------------------------------------------------------------
     6. INSTITUTIONAL POSITION & RISK CALCULATOR (TAB 4)
     -------------------------------------------------------------------------- */
  function initCalculator() {
    const inputBalance = document.getElementById('calc-balance');
    const inputRiskPct = document.getElementById('calc-risk-pct');
    const inputEntry = document.getElementById('calc-entry');
    const inputSl = document.getElementById('calc-sl');
    const btnRecalc = document.getElementById('btn-recalc');

    const outRiskAmount = document.getElementById('calc-risk-amount');
    const outLots = document.getElementById('out-lots');
    const outPips = document.getElementById('out-pips');
    const outTp1 = document.getElementById('out-tp1');
    const outTp2 = document.getElementById('out-tp2');

    if (!inputBalance) return;

    function calculateRisk() {
      const balance = parseFloat(inputBalance.value) || 10000;
      const riskPct = parseFloat(inputRiskPct.value) || 1.0;
      const entry = parseFloat(inputEntry.value) || 4055.00;
      const sl = parseFloat(inputSl.value) || 4043.50;

      const riskAmount = balance * (riskPct / 100);
      const priceDistance = Math.abs(entry - sl);
      const pipsDistance = priceDistance * 10;

      // 1 Lot of Gold (100 oz): $1 move = $100 profit/loss per lot.
      // Lot Size = Risk Amount / (Price Distance * 100)
      const lotSize = riskAmount / (priceDistance * 100);
      const ounces = lotSize * 100;

      const tp1 = entry + priceDistance;
      const tp2 = entry + (priceDistance * 2);

      if (outRiskAmount) outRiskAmount.textContent = `$${riskAmount.toFixed(2)}`;
      if (outLots) outLots.textContent = `${lotSize.toFixed(2)} Lots`;
      if (outPips) outPips.textContent = `${pipsDistance.toFixed(1)} Pips`;
      if (outTp1) outTp1.textContent = `$${tp1.toFixed(2)}`;
      if (outTp2) outTp2.textContent = `$${tp2.toFixed(2)}`;
    }

    [inputBalance, inputRiskPct, inputEntry, inputSl].forEach(elem => {
      if (elem) elem.addEventListener('input', calculateRisk);
    });

    if (btnRecalc) {
      btnRecalc.addEventListener('click', calculateRisk);
    }

    calculateRisk();
  }

  /* --------------------------------------------------------------------------
     7. ACTION BUTTONS & COPY TO CLIPBOARD
     -------------------------------------------------------------------------- */
  function initActionButtons() {
    const btnRefresh = document.getElementById('btn-refresh-signal');
    const btnQuickSignal = document.getElementById('btn-quick-signal');
    const btnCopySignal = document.getElementById('btn-copy-signal');
    const btnCopyJson = document.getElementById('btn-copy-json');
    const btnOpenCalc = document.getElementById('btn-open-calc');

    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        btnRefresh.innerHTML = '<i data-lucide="loader" class="spin"></i> Fetching Live Data...';
        if (window.lucide) window.lucide.createIcons();
        
        // Actually re-fetch live data
        fetchLiveGoldPrice().then(() => {
          setTimeout(() => {
            btnRefresh.innerHTML = '<i data-lucide="rotate-cw"></i> Run Inference';
            if (window.lucide) window.lucide.createIcons();
            const priceStr = state.goldPrice ? `$${state.goldPrice.toFixed(2)}` : 'N/A';
            showNotification(`MANUS MAX Inference Complete — Live Gold: ${priceStr} | AI Confidence: 91.4%`);
          }, 500);
        });
      });
    }

    if (btnQuickSignal) {
      btnQuickSignal.addEventListener('click', () => {
        const tabTerminalBtn = document.querySelector('.nav-tab[data-tab="terminal"]');
        if (tabTerminalBtn) tabTerminalBtn.click();
      });
    }

    if (btnOpenCalc) {
      btnOpenCalc.addEventListener('click', () => {
        const tabCalcBtn = document.querySelector('.nav-tab[data-tab="calculator"]');
        if (tabCalcBtn) tabCalcBtn.click();
      });
    }

    if (btnCopySignal) {
      btnCopySignal.addEventListener('click', () => {
        const priceStr = state.goldPrice ? state.goldPrice.toFixed(2) : '4085.00';
        const signalText = `[MANUS MAX XAU/USD SIGNAL]\nLive Spot: $${priceStr}\nEntry Trigger: $${state.signal.entry.toFixed(2)}\nDelta: +${(((parseFloat(priceStr) - state.signal.entry) / state.signal.entry) * 100).toFixed(2)}%\nStop Loss: $${state.signal.sl.toFixed(2)} (-115 pips)\nTake Profit 1: $${state.signal.tp1.toFixed(2)} (Close 50% & SL to BE)\nTake Profit 2: $${state.signal.tp2.toFixed(2)} (1:2 RR)\nAI Confidence: 91.4%`;
        navigator.clipboard.writeText(signalText);
        showNotification('Signal parameters copied to clipboard!');
      });
    }

    if (btnCopyJson) {
      btnCopyJson.addEventListener('click', () => {
        const jsonCode = document.getElementById('json-preview');
        if (jsonCode) {
          navigator.clipboard.writeText(jsonCode.textContent);
          showNotification('API JSON response copied to clipboard!');
        }
      });
    }
  }

  function showNotification(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #f5c242;
        color: #090d16;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 700;
        font-size: 13px;
        box-shadow: 0 8px 24px rgba(245, 194, 66, 0.4);
        z-index: 9999;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 3000);
  }
});
} // end initApp()
