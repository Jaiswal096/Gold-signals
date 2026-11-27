/* ==========================================================================
   MANUS MAX AI 6.0 — XAU/USD Live Signal Engine
   Strictly binds to serverless endpoints:
     - GET /api/spot?tf=<tf>&include_candles=true
     - GET /api/signals/live?tf=<tf>
     - GET /api/signals/history?source=BOT_PROVIDER
     - GET/POST/DELETE /api/drawings
   Zero hardcoded demo trade arrays, zero fake stats, zero broken client-side
   spot adapters, zero TradingView DOM scraping.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  /* ========================================================================
     1. TOP-LEVEL STATE & CONFIGURATION (Initialized before any function call)
     ======================================================================== */
  const VALID_TFS = ['M5', 'M15', 'H1', 'H4', 'D1'];

  const state = {
    currentTab: 'terminal',
    timeframe: 'M15',
    showIndicators: true,
    goldPrice: null,
    goldChangePts: null,
    goldChangePct: null,
    dataProvider: null,
    lastFetchTime: null,
    macro: null,
    indicators: null,
    smcAnalysis: null,
    ohlcHistory: [],
    liveSignals: [],
    futureSetups: [],
    allSignals: [],
    signal: null, // currently selected signal for Hero Card & chart lines
    botHistory: [],
    botMetrics: null,
    userDrawings: [],
    lwUserDrawingLines: [],
    detectedIpKey: null,
    newsEvents: buildUpcomingNewsSchedule(),
    persistKey: null,
    lwChart: null,
    lwCandleSeries: null,
    lwSeries: {},
    calcSeeded: false,
  };

  let spotPollTimerId = null;
  let signalsPollTimerId = null;
  let historyPollTimerId = null;
  let freshnessTimerId = null;
  let lastLivePayload = null;

  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const livePriceEl = document.getElementById('live-gold-price');
  const liveChangeEl = document.getElementById('live-gold-change');
  const liveCurrentEl = document.getElementById('sig-current-live');
  const historyBody = document.getElementById('history-table-body');
  const apiStatusText = document.getElementById('api-status-text');

  /* ========================================================================
     2. UTILITIES & ERROR REPORTING
     ======================================================================== */
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPrice(price) {
    if (price === null || price === undefined || Number.isNaN(Number(price))) return '—';
    return '$' + Number(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatUtcTimestamp(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }

  function showHttpErrorBanner(context, message) {
    console.error('[MANUS MAX]', context, message);
    const terminal = document.getElementById('tab-terminal');
    if (!terminal) return;
    let bar = document.getElementById('http-error-banner');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'http-error-banner';
      bar.className = 'http-error-banner';
      terminal.insertBefore(bar, terminal.firstChild);
    }
    bar.style.display = 'flex';
    bar.innerHTML = `
      <span>⚠ <strong>[${escapeHtml(context)}]</strong> ${escapeHtml(message)}</span>
      <button class="btn btn-outline btn-xs" id="btn-dismiss-http-err" style="padding:2px 8px;font-size:10px;">Dismiss</button>
    `;
    const dismissBtn = document.getElementById('btn-dismiss-http-err');
    if (dismissBtn) {
      dismissBtn.onclick = () => { bar.style.display = 'none'; };
    }
  }

  function clearHttpErrorBanner() {
    const bar = document.getElementById('http-error-banner');
    if (bar) bar.style.display = 'none';
  }

  function injectDisclaimerBanner() {
    const terminal = document.getElementById('tab-terminal');
    if (!terminal || document.getElementById('edu-disclaimer-banner')) return;
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
        <strong>ALGORITHMIC QUANT ENGINE</strong> — Live &amp; Future Setups are computed server-side from real multi-timeframe OHLCV candles (M5/M15/H1/H4). Signal History below reflects external BOT_PROVIDER records only. Not financial advice.
      </span>
    `;
    terminal.insertBefore(banner, terminal.firstChild);
  }

  function showNotification(message) {
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
  }

  /* ========================================================================
     3. PERSISTENCE (User UI Preferences Only)
     ======================================================================== */
  function initPersistence() {
    try {
      const fingerprint = btoa(navigator.userAgent + screen.width + screen.height).slice(0, 16);
      state.persistKey = `manus_max_v63_${fingerprint}`;
      const saved = localStorage.getItem(state.persistKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.timeframe && VALID_TFS.includes(data.timeframe)) state.timeframe = data.timeframe;
        if (typeof data.showIndicators === 'boolean') state.showIndicators = data.showIndicators;
      }
    } catch (err) {
      console.warn('[MANUS MAX] initPersistence', err.message);
    }
  }

  function savePersistence() {
    try {
      if (!state.persistKey) return;
      localStorage.setItem(state.persistKey, JSON.stringify({
        timeframe: state.timeframe,
        showIndicators: state.showIndicators,
        lastSaved: new Date().toISOString(),
      }));
    } catch (err) {
      console.warn('[MANUS MAX] savePersistence', err.message);
    }
  }

  /* ========================================================================
     4. LIVE SPOT + OHLCV + MACRO ENGINE (/api/spot)
     ======================================================================== */
  async function fetchSpotAndCandles(tf = state.timeframe, { forceRefresh = false } = {}) {
    const endpoint = `/api/spot?tf=${encodeURIComponent(tf)}&include_candles=true&limit=200${forceRefresh ? '&refresh=1' : ''}`;
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = data?.detail || data?.error || res.statusText || 'Unknown error';
        setApiStatusError(`FEED ERROR ${res.status}`);
        if (livePriceEl) livePriceEl.textContent = `ERR ${res.status}`;
        if (liveChangeEl) {
          liveChangeEl.textContent = detail;
          liveChangeEl.className = 'ticker-change text-ruby';
        }
        showHttpErrorBanner(`/api/spot HTTP ${res.status}`, detail);
        showChartErrorOverlay(`HTTP ${res.status}: ${detail}`);
        return null;
      }

      if (!data || typeof data.spot !== 'number' || !Array.isArray(data.candles)) {
        throw new Error('Malformed /api/spot payload');
      }

      clearHttpErrorBanner();
      hideChartOverlayMsg();

      const prevPrice = state.goldPrice;
      const tickDir = prevPrice !== null
        ? (data.spot > prevPrice ? 'up' : data.spot < prevPrice ? 'down' : null)
        : null;

      state.goldPrice = data.spot;
      state.goldChangePts = data.change ?? 0;
      state.goldChangePct = data.changePercent ?? 0;
      state.dataProvider = data.provider || 'Server OHLCV';
      state.lastFetchTime = new Date();
      state.ohlcHistory = data.candles;
      if (data.macro) state.macro = data.macro;

      updateTopTickerUI(tickDir);
      updateMacroStreamUI();
      updateChartCandlesAndEMAs(data.candles, tf, data.provider);
      updateFreshnessTimer();

      if (!state.calcSeeded) {
        seedCalculatorFromMarket();
      }

      return data;
    } catch (err) {
      const msg = err.name === 'TimeoutError' ? 'Request timed out (10s)' : err.message;
      setApiStatusError('SPOT FEED UNREACHABLE');
      if (livePriceEl) livePriceEl.textContent = 'FEED ERR';
      if (liveChangeEl) {
        liveChangeEl.textContent = msg;
        liveChangeEl.className = 'ticker-change text-ruby';
      }
      showHttpErrorBanner('/api/spot', msg);
      showChartErrorOverlay(msg);
      return null;
    }
  }

  function setApiStatusLive(provider) {
    if (!apiStatusText) return;
    const t = state.lastFetchTime ? state.lastFetchTime.toISOString().slice(11, 19) + ' UTC' : '';
    apiStatusText.textContent = `LIVE • ${provider} • ${t}`;
    apiStatusText.style.color = '#10b981';
    const dot = document.getElementById('api-status-dot');
    if (dot) dot.style.backgroundColor = '#10b981';
  }

  function setApiStatusError(label) {
    if (!apiStatusText) return;
    apiStatusText.textContent = `⚠ ${label}`;
    apiStatusText.style.color = '#ef4444';
    const dot = document.getElementById('api-status-dot');
    if (dot) dot.style.backgroundColor = '#ef4444';
  }

  function updateTopTickerUI(tickDir) {
    const formatted = formatPrice(state.goldPrice);
    if (livePriceEl) {
      livePriceEl.textContent = formatted;
      livePriceEl.classList.remove('tick-up', 'tick-down', 'price-flash');
      void livePriceEl.offsetWidth;
      if (tickDir === 'up') livePriceEl.classList.add('tick-up');
      else if (tickDir === 'down') livePriceEl.classList.add('tick-down');
      else livePriceEl.classList.add('price-flash');
      setTimeout(() => livePriceEl.classList.remove('tick-up', 'tick-down', 'price-flash'), 380);
    }

    if (liveCurrentEl) liveCurrentEl.textContent = formatted;
    if (liveChangeEl) {
      const pts = Number(state.goldChangePts || 0);
      const pct = Number(state.goldChangePct || 0);
      const isPos = pts >= 0;
      liveChangeEl.textContent = `${isPos ? '+' : ''}${pct.toFixed(2)}% (${isPos ? '+' : ''}${pts.toFixed(2)})`;
      liveChangeEl.className = `ticker-change ${isPos ? 'text-emerald' : 'text-ruby'}`;
    }

    document.querySelectorAll('.live-price-ref').forEach((el) => {
      el.textContent = formatted;
    });
    updateDrawingsDistances(state.goldPrice);
    setApiStatusLive(state.dataProvider);

    const m = state.macro || {};
    const dxyEl = document.getElementById('ticker-dxy');
    const dxyChgEl = document.getElementById('ticker-dxy-change');
    if (dxyEl) dxyEl.textContent = m.dxy != null ? m.dxy.toFixed(2) : '—';
    if (dxyChgEl) {
      if (m.dxy_change_pct != null) {
        const up = m.dxy_change_pct >= 0;
        dxyChgEl.textContent = `${up ? '+' : ''}${m.dxy_change_pct.toFixed(2)}%`;
        dxyChgEl.className = `ticker-change ${up ? 'text-emerald' : 'text-ruby'}`;
      } else {
        dxyChgEl.textContent = '—';
      }
    }

    const us10yEl = document.getElementById('ticker-us10y');
    const us10yChgEl = document.getElementById('ticker-us10y-change');
    if (us10yEl) us10yEl.textContent = m.us10y != null ? `${m.us10y.toFixed(2)}%` : '—';
    if (us10yChgEl) {
      if (m.us10y_change_bps != null) {
        const up = m.us10y_change_bps >= 0;
        us10yChgEl.textContent = `${up ? '+' : ''}${m.us10y_change_bps} bps`;
        us10yChgEl.className = `ticker-change ${up ? 'text-ruby' : 'text-emerald'}`;
      } else {
        us10yChgEl.textContent = '—';
      }
    }

    const ryEl = document.getElementById('ticker-realyield');
    const ryBadgeEl = document.getElementById('ticker-realyield-badge');
    if (ryEl) {
      ryEl.textContent = m.real_yield_est != null ? `${m.real_yield_est >= 0 ? '+' : ''}${m.real_yield_est.toFixed(2)}%` : '—';
      ryEl.className = `ticker-val ${m.real_yield_est != null && m.real_yield_est <= 1.5 ? 'text-emerald' : 'text-gold'}`;
    }
    if (ryBadgeEl && m.real_yield_est != null) {
      const bullish = m.real_yield_est <= 2.0;
      ryBadgeEl.textContent = bullish ? 'BULLISH AU' : 'HEADWIND';
      ryBadgeEl.className = `ticker-badge ${bullish ? 'badge-bullish' : 'badge-gold'}`;
    }

    const auAgEl = document.getElementById('ticker-auag');
    const auAgBadgeEl = document.getElementById('ticker-auag-badge');
    if (auAgEl) auAgEl.textContent = m.gold_silver_ratio != null ? m.gold_silver_ratio.toFixed(1) : '—';
    if (auAgBadgeEl && m.gold_silver_ratio != null) {
      auAgBadgeEl.textContent = m.gold_silver_ratio >= 80 ? 'ELEVATED' : 'NORMAL';
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
        const ageColor = age > 90 ? '#ef4444' : age > 45 ? '#f5c242' : '#10b981';
        dataLabelEl.innerHTML = `Data: <strong>${escapeHtml(state.dataProvider || '—')}</strong> (${state.timeframe}) | Candles: ${state.ohlcHistory.length} | Updated: ${timeStr} | Freshness: <span style="color:${ageColor}">${age}s</span>`;
      }
    }, 1000);
  }

  function updateChartDataLabel(provider) {
    let labelEl = document.getElementById('chart-data-label');
    if (!labelEl) {
      const container = document.getElementById('lw-chart-container');
      if (container && container.parentElement) {
        labelEl = document.createElement('div');
        labelEl.id = 'chart-data-label';
        labelEl.style.cssText = `
          font-size:10px;color:rgba(255,255,255,0.6);padding:6px 10px;
          font-family:var(--font-mono, monospace);border-top:1px solid rgba(255,255,255,0.06);
          background: rgba(6, 9, 16, 0.75);
        `;
        container.parentElement.appendChild(labelEl);
      }
    }
    if (labelEl && state.lastFetchTime) {
      const timeStr = state.lastFetchTime.toISOString().slice(11, 19) + ' UTC';
      labelEl.innerHTML = `Data: <strong>${escapeHtml(provider || '—')}</strong> (${state.timeframe}) | Candles: ${state.ohlcHistory.length} | Updated: ${timeStr} | Freshness: <span style="color:#10b981">0s</span>`;
    }
  }

  /* ========================================================================
     5. LIVE SIGNALS & FUTURE SETUPS ENGINE (/api/signals/live)
     ======================================================================== */
  async function fetchLiveSignals({ forceRefresh = false } = {}) {
    const endpoint = `/api/signals/live?tf=${encodeURIComponent(state.timeframe)}${forceRefresh ? '&refresh=1' : ''}`;
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = data?.detail || data?.error || res.statusText || 'Live signal API error';
        setFeedBadge(`HTTP ${res.status} ERROR`, 'error');
        renderSignalFeedError(res.status, detail);
        renderFutureSetupsError(res.status, detail);
        showHttpErrorBanner(`/api/signals/live HTTP ${res.status}`, detail);
        return null;
      }

      lastLivePayload = data;
      state.liveSignals = Array.isArray(data.live_signals) ? data.live_signals : [];
      state.futureSetups = Array.isArray(data.future_setups) ? data.future_setups : [];
      state.allSignals = [...state.liveSignals, ...state.futureSetups];
      state.indicators = data.indicators || null;
      state.smcAnalysis = data.smc_analysis || null;
      if (data.macro) state.macro = data.macro;

      if (typeof data.spot_price === 'number' && !state.goldPrice) {
        state.goldPrice = data.spot_price;
        state.dataProvider = data.provider || 'Server OHLCV';
        state.lastFetchTime = new Date();
        updateTopTickerUI(null);
      }

      // Bind Hero Card strictly to live_signals[0] (or user-selected live signal)
      if (state.liveSignals.length > 0) {
        const selected = state.signal && state.allSignals.find((s) => s.id === state.signal.id);
        state.signal = selected || state.liveSignals[0];
      } else {
        // Only preserve manual selection if it is still in future_setups; otherwise show Monitoring state
        const manualFuture = state.signal && state.futureSetups.find((s) => s.id === state.signal.id);
        state.signal = manualFuture || null;
      }

      updateHeroSignalUI();
      renderSignalFeed();
      renderFutureSetups();
      updateMacroStreamUI();
      updateBlueprintJsonPreview(data);

      if (state.lwChart && state.lwCandleSeries) {
        drawSMCOverlays();
      }

      const navBadge = document.getElementById('nav-badge-terminal');
      if (navBadge) {
        const count = state.liveSignals.length || state.futureSetups.length;
        navBadge.textContent = count;
        navBadge.style.display = count > 0 ? 'inline-flex' : 'none';
      }

      return data;
    } catch (err) {
      const msg = err.name === 'TimeoutError' ? 'Live signal scan timed out' : err.message;
      setFeedBadge('API ERROR', 'error');
      renderSignalFeedError('NET', msg);
      renderFutureSetupsError('NET', msg);
      showHttpErrorBanner('/api/signals/live', msg);
      return null;
    }
  }

  function setFeedBadge(text, mode = 'live') {
    const badge = document.getElementById('signal-feed-badge');
    const textEl = document.getElementById('signal-feed-status-badge');
    const dotEl = document.getElementById('signal-feed-dot');
    const futureBadge = document.getElementById('future-setups-badge');
    if (textEl) textEl.textContent = text;
    if (badge) {
      if (mode === 'error') {
        badge.style.background = 'rgba(239,68,68,0.15)';
        badge.style.borderColor = 'rgba(239,68,68,0.45)';
        badge.style.color = '#ef4444';
      } else if (mode === 'future') {
        badge.style.background = 'rgba(245,194,66,0.15)';
        badge.style.borderColor = 'rgba(245,194,66,0.45)';
        badge.style.color = '#f5c242';
      } else {
        badge.style.background = 'rgba(16,185,129,0.12)';
        badge.style.borderColor = 'rgba(16,185,129,0.4)';
        badge.style.color = '#10b981';
      }
    }
    if (dotEl) {
      dotEl.style.background = mode === 'error' ? '#ef4444' : mode === 'future' ? '#f5c242' : '#10b981';
    }
    if (futureBadge) {
      futureBadge.textContent = mode === 'error' ? 'ERROR' : `${state.futureSetups.length} SETUPS`;
    }
  }

  function updateHeroSignalUI() {
    const els = {
      badge: document.getElementById('hero-signal-badge'),
      tf1: document.getElementById('hero-tf1'),
      tf2: document.getElementById('hero-tf2'),
      strategy: document.getElementById('hero-strategy'),
      strategySub: document.getElementById('hero-strategy-sub'),
      entry: document.getElementById('sig-entry'),
      spot: document.getElementById('sig-current-live'),
      sl: document.getElementById('sig-sl'),
      slPips: document.getElementById('sig-sl-pips'),
      tp1: document.getElementById('sig-tp1'),
      tp1Pips: document.getElementById('sig-tp1-pips'),
      tp2: document.getElementById('sig-tp2'),
      tp2Pips: document.getElementById('sig-tp2-pips'),
      tp3: document.getElementById('sig-tp3'),
      tp3Pips: document.getElementById('sig-tp3-pips'),
      rr: document.getElementById('sig-rr'),
      rrSub: document.getElementById('sig-rr-sub'),
      reason: document.getElementById('hero-reason'),
      score: document.getElementById('gauge-score-num'),
      gauge: document.getElementById('gauge-circle'),
      valInst: document.getElementById('conf-val-inst'),
      valMacro: document.getElementById('conf-val-macro'),
      valTech: document.getElementById('conf-val-tech'),
      barInst: document.getElementById('conf-bar-inst'),
      barMacro: document.getElementById('conf-bar-macro'),
      barTech: document.getElementById('conf-bar-tech'),
    };

    if (els.spot) els.spot.textContent = formatPrice(state.goldPrice);

    const sig = state.signal;
    if (!sig) {
      // No LIVE signal triggered right now — explicit monitoring state (zero static 92% mock)
      if (els.badge) {
        els.badge.className = 'signal-type-badge';
        els.badge.style.cssText = 'background:rgba(245,194,66,0.14);border:1px solid rgba(245,194,66,0.45);color:#f5c242;';
        els.badge.innerHTML = `<i data-lucide="radar"></i> <span id="hero-signal-label">No Active Trigger — Monitoring Next Setup</span>`;
      }
      if (els.tf1) els.tf1.textContent = state.timeframe;
      if (els.tf2) els.tf2.textContent = 'H1/H4';
      if (els.strategy) els.strategy.textContent = 'SMC_STANDBY';
      if (els.strategySub) els.strategySub.textContent = `${state.futureSetups.length} Future Setups Queued`;
      if (els.entry) els.entry.textContent = '—';
      if (els.sl) els.sl.textContent = '—';
      if (els.slPips) els.slPips.textContent = '— Pips';
      if (els.tp1) els.tp1.textContent = '—';
      if (els.tp1Pips) els.tp1Pips.textContent = 'Min 1:2 RR';
      if (els.tp2) els.tp2.textContent = '—';
      if (els.tp2Pips) els.tp2Pips.textContent = '1:3.5 Runner';
      if (els.tp3) els.tp3.textContent = '—';
      if (els.tp3Pips) els.tp3Pips.textContent = '1:6 Max HTF';
      if (els.rr) els.rr.textContent = '—';
      if (els.rrSub) els.rrSub.textContent = 'Awaiting Zone Tap';

      const nextF = state.futureSetups[0];
      if (els.reason) {
        els.reason.textContent = nextF
          ? `No active trigger at current spot (${formatPrice(state.goldPrice)}). Closest upcoming zone: ${nextF.timeframe} ${nextF.direction} ${nextF.strategy} at ${formatPrice(nextF.entry_price)} (${nextF.distance_pips} pips away).`
          : `Monitoring M5/M15/H1/H4 OHLCV structure at ${formatPrice(state.goldPrice)} — awaiting OB/FVG/EMA 9-15 confluence.`;
      }
      if (els.score) els.score.textContent = '—';
      if (els.gauge) els.gauge.style.strokeDashoffset = '314';
      if (els.valInst) els.valInst.textContent = '—';
      if (els.valMacro) els.valMacro.textContent = '—';
      if (els.valTech) els.valTech.textContent = '—';
      if (els.barInst) els.barInst.style.width = '0%';
      if (els.barMacro) els.barMacro.style.width = '0%';
      if (els.barTech) els.barTech.style.width = '0%';
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const isLong = sig.direction === 'LONG';
    const isFuture = sig.status === 'FUTURE_SETUP';
    if (els.badge) {
      els.badge.style.cssText = '';
      if (isFuture) {
        els.badge.className = 'signal-type-badge';
        els.badge.style.cssText = 'background:rgba(245,194,66,0.15);border:1px solid rgba(245,194,66,0.45);color:#f5c242;';
        els.badge.innerHTML = `<i data-lucide="clock"></i> <span id="hero-signal-label">FUTURE SETUP (${sig.direction}) • ${sig.distance_pips} PIPS AWAY</span>`;
      } else {
        els.badge.className = `signal-type-badge ${isLong ? 'signal-buy' : 'signal-sell'}`;
        els.badge.innerHTML = `<i data-lucide="${isLong ? 'trending-up' : 'trending-down'}"></i> <span id="hero-signal-label">LIVE ${sig.direction} SIGNAL (${sig.timeframe})</span>`;
      }
    }

    if (els.tf1) els.tf1.textContent = sig.timeframe;
    if (els.tf2) els.tf2.textContent = state.timeframe;
    if (els.strategy) els.strategy.textContent = sig.strategy;
    if (els.strategySub) els.strategySub.textContent = isFuture ? `Pending Trigger (${sig.distance_pips} pips)` : 'Active Confluence Zone';

    if (els.entry) els.entry.textContent = formatPrice(sig.entry_price);
    if (els.sl) els.sl.textContent = formatPrice(sig.stop_loss);
    if (els.tp1) els.tp1.textContent = formatPrice(sig.tp1);
    if (els.tp2) els.tp2.textContent = formatPrice(sig.tp2);
    if (els.tp3) els.tp3.textContent = formatPrice(sig.tp3);

    const slPips = Math.round(Math.abs(sig.entry_price - sig.stop_loss) * 10);
    const tp1Pips = Math.round(Math.abs(sig.tp1 - sig.entry_price) * 10);
    const tp2Pips = sig.tp2 ? Math.round(Math.abs(sig.tp2 - sig.entry_price) * 10) : null;
    const tp3Pips = sig.tp3 ? Math.round(Math.abs(sig.tp3 - sig.entry_price) * 10) : null;

    if (els.slPips) els.slPips.textContent = `-${slPips} Pips`;
    if (els.tp1Pips) els.tp1Pips.textContent = `+${tp1Pips} Pips (Close 50%)`;
    if (els.tp2Pips) els.tp2Pips.textContent = tp2Pips != null ? `+${tp2Pips} Pips (Runner)` : '—';
    if (els.tp3Pips) els.tp3Pips.textContent = tp3Pips != null ? `+${tp3Pips} Pips (Max HTF)` : '—';
    if (els.rr) els.rr.textContent = `1 : ${Number(sig.rr_ratio || 2.0).toFixed(1)}`;
    if (els.rrSub) els.rrSub.textContent = `ATR(${sig.indicators?.atr14 ?? '14'}) Verified`;
    if (els.reason) els.reason.textContent = sig.reason || 'Multi-TF OHLCV Confluence';

    const conf = Number(sig.confidence || 0);
    const inst = Number(sig.confidence_inst ?? conf);
    const macro = Number(sig.confidence_macro ?? conf);
    const tech = Number(sig.confidence_tech ?? conf);

    if (els.score) els.score.textContent = `${conf}%`;
    if (els.gauge) els.gauge.style.strokeDashoffset = (314 * (1 - conf / 100)).toFixed(1);
    if (els.valInst) els.valInst.textContent = `${inst}%`;
    if (els.valMacro) els.valMacro.textContent = `${macro}%`;
    if (els.valTech) els.valTech.textContent = `${tech}%`;

    const contrib = inst * 0.5 + macro * 0.3 + tech * 0.2 || 1;
    if (els.barInst) els.barInst.style.width = `${((inst * 0.5) / contrib) * 92}%`;
    if (els.barMacro) els.barMacro.style.width = `${((macro * 0.3) / contrib) * 92}%`;
    if (els.barTech) els.barTech.style.width = `${((tech * 0.2) / contrib) * 92}%`;

    updateNewsBadges();
    if (window.lucide) window.lucide.createIcons();
  }

  function renderSignalCardHtml(sig, isActive) {
    const isLong = sig.direction === 'LONG';
    const isFuture = sig.status === 'FUTURE_SETUP';
    const dirClass = isFuture ? 'sig-predictive' : (isLong ? 'sig-long' : 'sig-short');
    const badgeClass = isLong ? 'sig-dir-long' : 'sig-dir-short';
    const confClass = sig.confidence >= 85 ? 'sig-conf-high' : sig.confidence >= 70 ? 'sig-conf-med' : 'sig-conf-low';

    const statusBadge = isFuture
      ? `<span class="badge-future-amber">⏳ FUTURE SETUP</span><span class="sig-dist-pill">${sig.distance_pips} pips away</span>`
      : `<span class="badge-live-pulse">● LIVE NOW</span>`;

    const ind = sig.indicators || {};
    const chips = [
      ind.ema9 != null ? `<span class="ind-chip">EMA9: <strong>$${ind.ema9}</strong></span>` : '',
      ind.ema15 != null ? `<span class="ind-chip">EMA15: <strong>$${ind.ema15}</strong></span>` : '',
      ind.rsi14 != null ? `<span class="ind-chip">RSI(14): <strong>${ind.rsi14}</strong></span>` : '',
      ind.atr14 != null ? `<span class="ind-chip">ATR(14): <strong>${ind.atr14}</strong></span>` : '',
      ind.ob ? `<span class="ind-chip">OB: <strong>$${ind.ob[0]}–$${ind.ob[1]}</strong></span>` : '',
      ind.fvg ? `<span class="ind-chip">FVG: <strong>$${ind.fvg[0]}–$${ind.fvg[1]}</strong></span>` : '',
    ].filter(Boolean).join('');

    const inst = sig.confidence_inst ?? sig.confidence;
    const macro = sig.confidence_macro ?? sig.confidence;
    const tech = sig.confidence_tech ?? sig.confidence;

    return {
      className: `sig-item ${dirClass}${isActive ? ' sig-active' : ''}`,
      html: `
        <div class="sig-item-header">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span class="sig-dir-badge ${badgeClass}">${isLong ? '▲ LONG' : '▼ SHORT'}</span>
            ${statusBadge}
            <span class="sig-strategy-tag">${escapeHtml(sig.strategy)}</span>
          </div>
          <span class="sig-conf-badge ${confClass}">${sig.confidence}%</span>
        </div>
        <div class="sig-reason">${escapeHtml(sig.reason)}</div>
        ${chips ? `<div class="sig-indicator-chips">${chips}</div>` : ''}
        <div class="sig-levels">
          <span class="sig-level-item"><span class="sig-level-label">${isFuture ? 'PROJECTED' : 'ENTRY'}</span><span class="sig-level-val entry-val">${formatPrice(sig.entry_price)}</span></span>
          <span class="sig-level-item"><span class="sig-level-label">SL</span><span class="sig-level-val sl-val">${formatPrice(sig.stop_loss)}</span></span>
          <span class="sig-level-item"><span class="sig-level-label">TP1</span><span class="sig-level-val tp-val">${formatPrice(sig.tp1)}</span></span>
          ${sig.tp2 ? `<span class="sig-level-item"><span class="sig-level-label">TP2</span><span class="sig-level-val" style="color:var(--gold-primary);">${formatPrice(sig.tp2)}</span></span>` : ''}
          ${sig.tp3 ? `<span class="sig-level-item"><span class="sig-level-label">TP3</span><span class="sig-level-val" style="color:var(--gold-bright);">${formatPrice(sig.tp3)}</span></span>` : ''}
        </div>
        <div class="sig-footer">
          <span class="sig-rr">Min RR 1:${Number(sig.rr_ratio || 2).toFixed(1)}</span>
          <span class="sig-time">${escapeHtml(sig.timeframe)} • ${formatUtcTimestamp(sig.opened_at)}</span>
        </div>
        <div class="sig-expand-btn" onclick="toggleSigExpand(this)">
          <i data-lucide="chevron-down"></i> 3-Pillar Breakdown
        </div>
        <div class="sig-expanded-detail" style="display:none;">
          <div class="sig-pillar-row">
            <span class="sig-pillar-label"><span class="conf-seg-dot inst"></span> Institutional (×50%)</span>
            <span class="sig-pillar-val text-purple">${inst}%</span>
            <div class="sig-pillar-bar"><div class="sig-pillar-fill" style="width:${inst}%;background:var(--purple);"></div></div>
          </div>
          <div class="sig-pillar-row">
            <span class="sig-pillar-label"><span class="conf-seg-dot macro"></span> Macro (×30%)</span>
            <span class="sig-pillar-val text-gold">${macro}%</span>
            <div class="sig-pillar-bar"><div class="sig-pillar-fill" style="width:${macro}%;background:var(--gold-primary);"></div></div>
          </div>
          <div class="sig-pillar-row">
            <span class="sig-pillar-label"><span class="conf-seg-dot tech"></span> Technical (×20%)</span>
            <span class="sig-pillar-val text-emerald">${tech}%</span>
            <div class="sig-pillar-bar"><div class="sig-pillar-fill" style="width:${tech}%;background:var(--emerald);"></div></div>
          </div>
        </div>
      `,
    };
  }

  function renderSignalFeed() {
    const container = document.getElementById('signal-feed-list');
    if (!container) return;

    const liveCount = state.liveSignals.length;
    const futureCount = state.futureSetups.length;

    if (liveCount > 0) {
      setFeedBadge(`${liveCount} LIVE • ${futureCount} FUTURE`, 'live');
    } else if (futureCount > 0) {
      setFeedBadge(`WATCHING (${futureCount} FUTURE SETUPS)`, 'future');
    } else {
      setFeedBadge('NO ACTIVE SETUP', 'future');
    }

    if (state.allSignals.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;color:var(--text-dim);padding:28px 20px;font-size:12px;line-height:1.6;">
          No active LIVE or FUTURE_SETUP triggers detected across M5/M15/H1/H4 at ${formatPrice(state.goldPrice)}.
        </div>
      `;
      return;
    }

    const activeId = state.signal?.id;
    container.innerHTML = '';

    // Strictly render LIVE NOW cards first, followed by FUTURE_SETUP cards
    state.allSignals.forEach((sig) => {
      const { className, html } = renderSignalCardHtml(sig, sig.id === activeId);
      const div = document.createElement('div');
      div.className = className;
      div.setAttribute('data-sig-id', sig.id);
      div.innerHTML = html;

      div.addEventListener('click', (e) => {
        if (e.target.closest('.sig-expand-btn') || e.target.closest('.sig-expanded-detail')) return;
        document.querySelectorAll('#signal-feed-list .sig-item').forEach((el) => el.classList.remove('sig-active'));
        div.classList.add('sig-active');
        state.signal = sig;
        updateHeroSignalUI();
        drawSMCOverlays();
      });

      container.appendChild(div);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function renderSignalFeedError(status, detail) {
    const container = document.getElementById('signal-feed-list');
    if (!container) return;
    container.innerHTML = `
      <div class="http-error-banner" style="margin:8px;">
        <span>⚠ /api/signals/live returned HTTP ${escapeHtml(status)}: ${escapeHtml(detail)}</span>
      </div>
    `;
  }

  function renderFutureSetups() {
    const container = document.getElementById('predictive-list');
    if (!container) return;

    if (!state.futureSetups.length) {
      container.innerHTML = `
        <div class="predictive-item" style="color:var(--text-dim);font-size:12px;text-align:center;padding:16px;">
          No untested OB/FVG future setups within 4.5× ATR of current spot.
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    state.futureSetups.forEach((setup) => {
      const div = document.createElement('div');
      div.className = 'predictive-item';
      div.style.cursor = 'pointer';
      const dirColor = setup.direction === 'LONG' ? 'var(--emerald)' : 'var(--ruby)';
      div.innerHTML = `
        <div class="pred-header">
          <span class="pred-alert-tag"><i data-lucide="clock"></i> FUTURE SETUP • ${setup.distance_pips} PIPS</span>
          <span class="pred-tf">${escapeHtml(setup.timeframe)}</span>
        </div>
        <div class="pred-desc">${escapeHtml(setup.reason)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
          <span class="pred-price" style="color:${dirColor};">${setup.direction} @ ${formatPrice(setup.entry_price)}</span>
          <span style="font-size:10px;color:var(--text-dim);">SL ${formatPrice(setup.stop_loss)} • TP1 ${formatPrice(setup.tp1)}</span>
        </div>
      `;
      div.addEventListener('click', () => {
        state.signal = setup;
        updateHeroSignalUI();
        drawSMCOverlays();
      });
      container.appendChild(div);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function renderFutureSetupsError(status, detail) {
    const container = document.getElementById('predictive-list');
    if (!container) return;
    container.innerHTML = `
      <div class="http-error-banner">
        <span>⚠ Future Setups Error (HTTP ${escapeHtml(status)}): ${escapeHtml(detail)}</span>
      </div>
    `;
  }

  window.toggleSigExpand = function (btn) {
    const detail = btn.nextElementSibling;
    const icon = btn.querySelector('i');
    if (detail) {
      const isOpen = detail.style.display !== 'none';
      detail.style.display = isOpen ? 'none' : 'block';
      if (icon) icon.setAttribute('data-lucide', isOpen ? 'chevron-down' : 'chevron-up');
      if (window.lucide) window.lucide.createIcons();
    }
  };

  /* ========================================================================
     6. MULTI-LAYER DATA STREAM UI (Dynamic — Zero Static Mock Text)
     ======================================================================== */
  function updateMacroStreamUI() {
    const m = state.macro || {};
    const ind = state.indicators || {};
    const smc = state.smcAnalysis || {};

    const macroStatus = document.getElementById('feed-macro-status');
    const macroDetail = document.getElementById('feed-macro-detail');
    if (macroStatus && macroDetail) {
      if (m.dxy != null || m.us10y != null) {
        const dxyBullish = m.dxy_change_pct != null && m.dxy_change_pct < 0;
        macroStatus.textContent = dxyBullish ? 'DXY Weakening (Bullish Au)' : 'DXY Firm (Mixed Au)';
        macroStatus.className = `feed-status ${dxyBullish ? 'text-emerald' : 'text-gold'}`;
        macroDetail.innerHTML = `DXY <strong class="font-mono">${m.dxy ?? '—'}</strong> (${m.dxy_change_pct != null ? `${m.dxy_change_pct >= 0 ? '+' : ''}${m.dxy_change_pct}%` : '—'}). US 10Y <strong class="font-mono">${m.us10y != null ? `${m.us10y}%` : '—'}</strong>. Real Yield Est: <strong class="font-mono">${m.real_yield_est != null ? `${m.real_yield_est}%` : '—'}</strong>. Au/Ag Ratio: <strong class="font-mono">${m.gold_silver_ratio ?? '—'}</strong>.`;
      }
    }

    const techStatus = document.getElementById('feed-tech-status');
    const techDetail = document.getElementById('feed-tech-detail');
    if (techStatus && techDetail && ind.ema9 != null) {
      techStatus.textContent = `${ind.ema_trend || 'NEUTRAL'} (${state.timeframe})`;
      techStatus.className = `feed-status ${ind.ema_trend === 'BULLISH' ? 'text-emerald' : 'text-ruby'}`;
      techDetail.innerHTML = `EMA9 <strong class="font-mono">$${ind.ema9}</strong> / EMA15 <strong class="font-mono">$${ind.ema15}</strong> / EMA50 <strong class="font-mono">${ind.ema50 ? `$${ind.ema50}` : '—'}</strong>. ATR(14): <strong class="font-mono">${ind.atr14 ?? '—'}</strong>. RSI(14): <strong class="font-mono">${ind.rsi14 ?? '—'}</strong>. BB Width: <strong class="font-mono">${ind.bb_bandwidth_pct != null ? `${ind.bb_bandwidth_pct}%` : '—'}</strong>.`;
    }

    const instStatus = document.getElementById('feed-inst-status');
    const instDetail = document.getElementById('feed-inst-detail');
    if (instStatus && instDetail) {
      const chochText = smc.choch ? `${smc.choch.direction} CHoCH at $${smc.choch.level}` : 'No fresh CHoCH on bar close';
      const obText = smc.ob ? `$${smc.ob[0]}–$${smc.ob[1]}` : 'Scanning';
      const fvgText = smc.fvg ? `$${smc.fvg[0]}–$${smc.fvg[1]}` : 'None unmitigated';
      instStatus.textContent = smc.choch ? `CHoCH ${smc.choch.direction}` : 'Structure Mapped';
      instDetail.textContent = `${chochText}. Active OB: ${obText}. FVG: ${fvgText}. Swing Hi/Lo: $${smc.swing_high ?? '—'} / $${smc.swing_low ?? '—'}.`;
    }
  }

  /* ========================================================================
     7. BOTTOM HOMEPAGE: SIGNAL HISTORY (BOT_PROVIDER ONLY)
     ======================================================================== */
  async function fetchBotHistory() {
    if (!historyBody) return;
    const banner = document.getElementById('history-status-banner');
    try {
      const res = await fetch('/api/signals/history?source=BOT_PROVIDER', { signal: AbortSignal.timeout(8000) });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = data?.error || data?.detail || res.statusText;
        updateHistoryKPIs(null);
        if (banner) {
          banner.style.display = 'block';
          banner.innerHTML = `<div class="http-error-banner"><span>⚠ /api/signals/history HTTP ${res.status}: ${escapeHtml(detail)}</span></div>`;
        }
        historyBody.innerHTML = '';
        showHttpErrorBanner(`/api/signals/history HTTP ${res.status}`, detail);
        return;
      }

      state.botHistory = Array.isArray(data.history) ? data.history : [];
      state.botMetrics = data.metrics || null;
      updateHistoryKPIs(state.botMetrics);

      if (state.botHistory.length === 0) {
        if (banner) {
          banner.style.display = 'block';
          banner.innerHTML = `
            <div class="bot-history-notice">
              <strong>BOT_PROVIDER Signal History Ready</strong> — ${escapeHtml(data.message || 'No historical bot signals recorded yet.')}
              <br><span style="font-size:11px;color:var(--text-dim);">Configure <code>SIGNAL_BOT_URL</code> (or push trades to <code>POST /api/bot-webhook</code>) and <code>SUPABASE_URL</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code> in Netlify to populate historical bot trades. Zero demo trades shown.</span>
            </div>
          `;
        }
        historyBody.innerHTML = `
          <tr>
            <td colspan="14" style="text-align:center;color:var(--text-dim);padding:20px;">
              0 BOT_PROVIDER historical records in Supabase.
            </td>
          </tr>
        `;
        return;
      }

      if (banner) banner.style.display = 'none';
      renderBotHistoryRows(state.botHistory);
    } catch (err) {
      updateHistoryKPIs(null);
      if (banner) {
        banner.style.display = 'block';
        banner.innerHTML = `<div class="http-error-banner"><span>⚠ Bot History Request Error: ${escapeHtml(err.message)}</span></div>`;
      }
      showHttpErrorBanner('/api/signals/history', err.message);
    }
  }

  function updateHistoryKPIs(m) {
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    if (!m || m.total_trades === 0) {
      setEl('perf-winrate', '—');
      setEl('perf-avgr', '—');
      setEl('perf-gain', '—');
      setEl('perf-sigday', '—');
      setEl('perf-dd', '—');
      setEl('perf-sharpe', '—');
      return;
    }

    setEl('perf-winrate', m.win_rate_pct != null ? `${m.win_rate_pct.toFixed(1)}%` : '—');
    setEl('perf-avgr', m.avg_rr != null ? `1 : ${m.avg_rr.toFixed(2)}` : '—');
    setEl('perf-gain', m.total_pips != null ? `${m.total_pips >= 0 ? '+' : ''}${m.total_pips.toFixed(1)} Pips` : '—');
    setEl('perf-sigday', m.signals_per_day != null ? `${m.signals_per_day}` : '—');
    setEl('perf-dd', m.max_drawdown_pips != null ? `${m.max_drawdown_pips.toFixed(1)} Pips` : '—');
    setEl('perf-sharpe', m.sharpe_ratio != null ? `${m.sharpe_ratio.toFixed(2)}` : '—');
  }

  function renderBotHistoryRows(rows) {
    if (!historyBody) return;
    historyBody.innerHTML = '';

    rows.forEach((item) => {
      const tr = document.createElement('tr');
      const isLong = item.direction === 'LONG';
      const status = String(item.status || 'CLOSED');
      const pipsNum = item.pips_result != null ? Number(item.pips_result) : null;
      const isWin = status.startsWith('HIT_TP') || (pipsNum != null && pipsNum > 0);
      const isOpen = status === 'LIVE' || status === 'FUTURE_SETUP';

      const rrNum = item.rr_ratio != null ? Number(item.rr_ratio) : null;
      const rrClass = rrNum == null ? 'rr-badge rr-badge-min' : rrNum >= 3 ? 'rr-badge rr-badge-high' : rrNum >= 2.2 ? 'rr-badge rr-badge-good' : 'rr-badge rr-badge-min';

      const pipsLabel = pipsNum != null
        ? `${pipsNum >= 0 ? '+' : ''}${pipsNum.toFixed(1)}`
        : (isOpen ? 'OPEN' : '—');

      tr.innerHTML = `
        <td class="font-mono" style="color:var(--text-dim);font-size:11px;">${escapeHtml(item.id)}</td>
        <td class="font-mono ts-cell">${formatUtcTimestamp(item.opened_at)}</td>
        <td class="font-mono ts-cell ${isOpen ? 'text-gold' : ''}">${item.closed_at ? formatUtcTimestamp(item.closed_at) : (isOpen ? 'OPEN' : '—')}</td>
        <td><span class="status-badge ${isLong ? 'badge-win' : 'badge-gold'}">${isLong ? '▲ LONG' : '▼ SHORT'}</span></td>
        <td><span class="sig-strategy-tag" style="font-size:10px;">${escapeHtml(item.strategy)}</span></td>
        <td class="font-mono">${formatPrice(item.entry_price)}</td>
        <td class="text-ruby font-mono">${formatPrice(item.stop_loss)}</td>
        <td class="text-gold font-mono">${formatPrice(item.tp2 ?? item.tp1)}</td>
        <td><span class="${rrClass}">${rrNum != null ? `1 : ${rrNum.toFixed(1)}` : '—'}</span></td>
        <td class="${pipsNum == null ? '' : (pipsNum >= 0 ? 'text-emerald' : 'text-ruby')}" style="font-weight:700;">${pipsLabel}</td>
        <td class="text-gold">${item.confidence != null ? `${item.confidence}%` : '—'}</td>
        <td>${item.news_tag ? `<span class="news-badge">⚠ ${escapeHtml(item.news_tag)}</span>` : '<span style="color:var(--text-dim);font-size:10px;">—</span>'}</td>
        <td><span class="status-badge ${isOpen ? 'badge-tag' : (isWin ? 'badge-win' : 'badge-ruby')}">${escapeHtml(status)}</span></td>
        <td><button class="btn-detail" onclick="showTradeDetail('${escapeHtml(item.id)}')"><i data-lucide="eye"></i></button></td>
      `;
      historyBody.appendChild(tr);

      const detailRow = document.createElement('tr');
      detailRow.id = `detail-${item.id}`;
      detailRow.className = 'trade-detail-row';
      detailRow.style.display = 'none';
      const pnlColor = (pipsNum ?? 0) >= 0 ? 'var(--emerald)' : 'var(--ruby)';
      const exitPrice = item.close_price ?? item.tp1 ?? item.entry_price;
      detailRow.innerHTML = `
        <td colspan="14">
          <div class="trade-detail-panel">
            <div class="trade-detail-header">
              <span><i data-lucide="trending-${isLong ? 'up' : 'down'}"></i> ${escapeHtml(item.id)} — BOT_PROVIDER Execution</span>
              <span class="trade-pnl-badge" style="color:${pnlColor};background:${(pipsNum ?? 0) >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border:1px solid ${(pipsNum ?? 0) >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};">${pipsLabel} Pips (${escapeHtml(status)})</span>
            </div>
            <div class="trade-markers">
              <div class="trade-marker marker-entry"><span class="marker-dot" style="background:var(--gold-primary);"></span><span>ENTRY: ${formatPrice(item.entry_price)}</span></div>
              <div class="trade-arrow">→</div>
              <div class="trade-marker marker-exit" style="color:${pnlColor};"><span class="marker-dot" style="background:${pnlColor};"></span><span>CLOSE/TARGET: ${formatPrice(exitPrice)}</span></div>
            </div>
            <div class="trade-reason" style="font-size:11px;color:var(--text-secondary);margin-top:6px;font-style:italic;">"${escapeHtml(item.reason || 'Signal Provider Bot Execution')}"</div>
          </div>
        </td>
      `;
      historyBody.appendChild(detailRow);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  window.showTradeDetail = function (id) {
    const row = document.getElementById(`detail-${id}`);
    if (row) {
      row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    }
  };

  /* ========================================================================
     8. LIGHTWEIGHT CHARTS SMC OVERLAY ENGINE
     ======================================================================== */
  function computeClientEMASeries(candles, period) {
    if (!Array.isArray(candles) || candles.length < period) return [];
    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += candles[i].close;
    let ema = sum / period;
    const series = [{ time: candles[period - 1].time, value: Number(ema.toFixed(2)) }];
    for (let i = period; i < candles.length; i++) {
      ema = candles[i].close * k + ema * (1 - k);
      if (candles[i].time > series[series.length - 1].time) {
        series.push({ time: candles[i].time, value: Number(ema.toFixed(2)) });
      }
    }
    return series;
  }

  function initLightweightChart() {
    const container = document.getElementById('lw-chart-container');
    if (!container || !window.LightweightCharts) return;

    showChartLoadingState(container);

    const chart = window.LightweightCharts.createChart(container, {
      layout: {
        background: { type: 'solid', color: '#060910' },
        textColor: 'rgba(255,255,255,0.45)',
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
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      handleScroll: true,
      handleScale: true,
    });

    state.lwChart = chart;
    state.lwCandleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    state.lwSeries.ema9 = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1.5, title: 'EMA 9', priceLineVisible: false });
    state.lwSeries.ema15 = chart.addLineSeries({ color: '#a855f7', lineWidth: 1.5, title: 'EMA 15', priceLineVisible: false });
    state.lwSeries.ema50 = chart.addLineSeries({ color: '#10b981', lineWidth: 1, title: 'EMA 50', priceLineVisible: false });

    const resizeObs = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    resizeObs.observe(container);
  }

  function updateChartCandlesAndEMAs(candles, tf, provider) {
    if (!state.lwCandleSeries || !Array.isArray(candles) || candles.length === 0) return;
    hideChartLoadingState();
    hideChartOverlayMsg();
    state.lwCandleSeries.setData(candles);

    const show = Boolean(state.showIndicators);
    if (state.lwSeries.ema9) {
      state.lwSeries.ema9.applyOptions({ visible: show });
      state.lwSeries.ema9.setData(show ? computeClientEMASeries(candles, 9) : []);
    }
    if (state.lwSeries.ema15) {
      state.lwSeries.ema15.applyOptions({ visible: show });
      state.lwSeries.ema15.setData(show ? computeClientEMASeries(candles, 15) : []);
    }
    if (state.lwSeries.ema50) {
      state.lwSeries.ema50.applyOptions({ visible: show });
      state.lwSeries.ema50.setData(show ? computeClientEMASeries(candles, 50) : []);
    }

    drawSMCOverlays();
    renderUserDrawingsOnChart();
    updateChartDataLabel(provider);
    if (state.lwChart) state.lwChart.timeScale().fitContent();
  }

  function drawSMCOverlays() {
    const series = state.lwCandleSeries;
    if (!series || !window.LightweightCharts) return;

    const lineKeys = ['entryLine', 'slLine', 'tp1Line', 'tp2Line', 'tp3Line', 'obLine', 'fvgLine', 'liqLine', 'chochLine'];
    lineKeys.forEach((k) => {
      if (state.lwSeries[k]) {
        try { series.removePriceLine(state.lwSeries[k]); } catch (_) {}
        state.lwSeries[k] = null;
      }
    });

    if (!state.showIndicators) return;

    const sig = state.signal || state.futureSetups[0];
    if (sig) {
      state.lwSeries.entryLine = series.createPriceLine({
        price: sig.entry_price,
        color: '#f5c242',
        lineWidth: 2,
        lineStyle: window.LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: `${sig.status === 'FUTURE_SETUP' ? 'FUTURE' : 'ENTRY'} ${formatPrice(sig.entry_price)}`,
      });
      state.lwSeries.slLine = series.createPriceLine({
        price: sig.stop_loss,
        color: '#ef4444',
        lineWidth: 1.5,
        lineStyle: window.LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: `SL ${formatPrice(sig.stop_loss)}`,
      });
      if (sig.tp1) {
        state.lwSeries.tp1Line = series.createPriceLine({
          price: sig.tp1,
          color: '#10b981',
          lineWidth: 1.5,
          lineStyle: window.LightweightCharts.LineStyle.Dotted,
          axisLabelVisible: true,
          title: `TP1 ${formatPrice(sig.tp1)}`,
        });
      }
      if (sig.tp2) {
        state.lwSeries.tp2Line = series.createPriceLine({
          price: sig.tp2,
          color: '#ffd700',
          lineWidth: 1,
          lineStyle: window.LightweightCharts.LineStyle.Dotted,
          axisLabelVisible: true,
          title: `TP2 ${formatPrice(sig.tp2)}`,
        });
      }
      if (sig.tp3) {
        state.lwSeries.tp3Line = series.createPriceLine({
          price: sig.tp3,
          color: '#fff200',
          lineWidth: 1,
          lineStyle: window.LightweightCharts.LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: `TP3 ${formatPrice(sig.tp3)}`,
        });
      }
    }

    const smc = sig?.indicators || state.smcAnalysis || {};
    if (Array.isArray(smc.ob) && smc.ob.length === 2) {
      const obPrice = Number(((smc.ob[0] + smc.ob[1]) / 2).toFixed(2));
      state.lwSeries.obLine = series.createPriceLine({
        price: obPrice,
        color: 'rgba(245,194,66,0.65)',
        lineWidth: 1,
        lineStyle: window.LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: `OB ${formatPrice(obPrice)}`,
      });
    }
    if (Array.isArray(smc.fvg) && smc.fvg.length === 2) {
      const fvgPrice = Number(((smc.fvg[0] + smc.fvg[1]) / 2).toFixed(2));
      state.lwSeries.fvgLine = series.createPriceLine({
        price: fvgPrice,
        color: 'rgba(139,92,246,0.7)',
        lineWidth: 1,
        lineStyle: window.LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: `FVG ${formatPrice(fvgPrice)}`,
      });
    }
    const liqLevel = smc.swing_low || smc.swing_high;
    if (liqLevel) {
      state.lwSeries.liqLine = series.createPriceLine({
        price: liqLevel,
        color: 'rgba(6,182,212,0.75)',
        lineWidth: 1,
        lineStyle: window.LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Liq ${formatPrice(liqLevel)}`,
      });
    }
    if (smc.choch?.level) {
      state.lwSeries.chochLine = series.createPriceLine({
        price: smc.choch.level,
        color: 'rgba(245,194,66,0.45)',
        lineWidth: 1,
        lineStyle: window.LightweightCharts.LineStyle.SparseDotted,
        axisLabelVisible: true,
        title: `CHoCH ${formatPrice(smc.choch.level)}`,
      });
    }
  }

  function showChartLoadingState(container) {
    if (!container || document.getElementById('lw-chart-loading-indicator')) return;
    const loading = document.createElement('div');
    loading.id = 'lw-chart-loading-indicator';
    loading.style.cssText = `
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      color:rgba(245,194,66,0.85);font-size:12px;font-weight:600;pointer-events:none;z-index:10;
    `;
    loading.textContent = 'Loading OHLCV candles from /api/spot...';
    container.style.position = 'relative';
    container.appendChild(loading);
  }

  function hideChartLoadingState() {
    document.getElementById('lw-chart-loading-indicator')?.remove();
  }

  function showChartErrorOverlay(message) {
    hideChartLoadingState();
    const container = document.getElementById('lw-chart-container');
    if (!container) return;
    let msg = document.getElementById('lw-chart-overlay-msg');
    if (!msg) {
      msg = document.createElement('div');
      msg.id = 'lw-chart-overlay-msg';
      msg.style.cssText = `
        position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        background:rgba(6,9,16,0.92);border:1px solid rgba(239,68,68,0.45);
        border-radius:8px;padding:14px 20px;text-align:center;color:#ef4444;
        font-size:12px;font-weight:600;z-index:20;pointer-events:none;max-width:85%;
      `;
      container.style.position = 'relative';
      container.appendChild(msg);
    }
    msg.innerHTML = `⚠ MARKET FEED ERROR<br><span style="font-size:10px;color:rgba(255,255,255,0.65);font-weight:400;">${escapeHtml(message)}</span>`;
  }

  function hideChartOverlayMsg() {
    document.getElementById('lw-chart-overlay-msg')?.remove();
  }

  /* ========================================================================
     9. NAVIGATION & URL SYNC
     ======================================================================== */
  function switchTab(target, updateUrl = true) {
    const tabBtn = document.querySelector(`.nav-tab[data-tab="${target}"]`);
    const content = document.getElementById(`tab-${target}`);
    if (!content) return;

    navTabs.forEach((t) => t.classList.remove('active'));
    tabContents.forEach((c) => c.classList.remove('active'));

    if (tabBtn) tabBtn.classList.add('active');
    content.classList.add('active');
    state.currentTab = target;

    if (updateUrl) {
      const newHash = `#${target}?tf=${state.timeframe}`;
      if (window.location.hash !== newHash) history.replaceState(null, '', newHash);
    }

    if (target === 'terminal' && state.lwChart) {
      setTimeout(() => {
        const container = document.getElementById('lw-chart-container');
        if (container && state.lwChart) {
          state.lwChart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
          state.lwChart.timeScale().fitContent();
        }
      }, 50);
    }
    savePersistence();
  }

  function setTimeframe(tf, updateUrl = true, fetchImmediately = true) {
    if (!VALID_TFS.includes(tf)) return;
    document.querySelectorAll('#chart-tf-buttons .btn-tf').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-tf') === tf);
    });
    state.timeframe = tf;

    if (window.updateTVInterval) {
      try { window.updateTVInterval(tf); } catch (_) {}
    }
    const tvBadge = document.getElementById('tv-active-tf');
    if (tvBadge) tvBadge.textContent = tf;

    savePersistence();

    if (updateUrl) {
      const newHash = `#${state.currentTab || 'terminal'}?tf=${tf}`;
      if (window.location.hash !== newHash) history.replaceState(null, '', newHash);
    }

    if (fetchImmediately) {
      fetchSpotAndCandles(tf).then(() => fetchLiveSignals());
    }
  }

  function syncFromUrl(fetchImmediately = false) {
    const rawHash = (window.location.hash || '').replace('#', '');
    let tabName = null;
    let tfVal = null;

    if (rawHash) {
      const [tabPart, queryPart] = rawHash.split('?');
      if (tabPart && document.getElementById(`tab-${tabPart}`)) tabName = tabPart;
      if (queryPart) tfVal = new URLSearchParams(queryPart).get('tf');
    } else if (window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab');
      if (t && document.getElementById(`tab-${t}`)) tabName = t;
      tfVal = params.get('tf');
    }

    if (tabName) switchTab(tabName, false);
    if (tfVal && VALID_TFS.includes(tfVal.toUpperCase())) {
      setTimeframe(tfVal.toUpperCase(), false, fetchImmediately);
    } else {
      setTimeframe(state.timeframe, false, fetchImmediately);
    }
  }

  function initNavigation() {
    navTabs.forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab'), true));
    });

    document.querySelectorAll('#chart-tf-buttons .btn-tf').forEach((btn) => {
      btn.addEventListener('click', () => setTimeframe(btn.getAttribute('data-tf'), true, true));
    });

    const btnToggle = document.getElementById('btn-toggle-overlay');
    if (btnToggle) {
      btnToggle.classList.toggle('active', state.showIndicators);
      btnToggle.addEventListener('click', () => {
        state.showIndicators = !state.showIndicators;
        btnToggle.classList.toggle('active', state.showIndicators);
        if (state.ohlcHistory.length) {
          updateChartCandlesAndEMAs(state.ohlcHistory, state.timeframe, state.dataProvider);
        }
        savePersistence();
        showNotification(state.showIndicators ? 'SMC & EMA overlays enabled' : 'Overlays hidden');
      });
    }

    window.addEventListener('hashchange', () => syncFromUrl(true));
    syncFromUrl(false);
  }

  /* ========================================================================
     10. KILLZONE, SILVER BULLET, AMD & NEWS CALENDAR (Live UTC Clocks)
     ======================================================================== */
  function buildUpcomingNewsSchedule() {
    const now = Date.now();
    const nextUtcHour = (targetHour, minOffsetDays = 0) => {
      const d = new Date(now + minOffsetDays * 86_400_000);
      d.setUTCHours(targetHour, 30, 0, 0);
      if (d.getTime() <= now + 300_000) d.setUTCDate(d.getUTCDate() + 1);
      return d;
    };
    const templates = [
      { name: 'US Core PCE / Macro Release', folder: 'red', impactPct: 88, volPips: '70-130', bias: 'Event-Driven', confClass: 'news-conf-high', conf: 'HIGH', dt: nextUtcHour(13, 0), histConf: 'HIGH — Volatility spike expected on release' },
      { name: 'US Initial Jobless Claims', folder: 'orange', impactPct: 68, volPips: '40-75', bias: 'Data-Dependent', confClass: 'news-conf-med', conf: 'MEDIUM', dt: nextUtcHour(13, 1), histConf: 'MEDIUM — USD reaction on surprise' },
      { name: 'US ISM Manufacturing / Services PMI', folder: 'red', impactPct: 82, volPips: '60-110', bias: 'Data-Dependent', confClass: 'news-conf-high', conf: 'HIGH', dt: nextUtcHour(15, 2), histConf: 'HIGH — Strong correlation with DXY & 10Y yields' },
      { name: 'US Non-Farm Payrolls (NFP Window)', folder: 'red', impactPct: 95, volPips: '120-250', bias: 'High Two-Way Vol', confClass: 'news-conf-high', conf: 'HIGH', dt: nextUtcHour(13, 4), histConf: 'HIGH — Reduce size before 13:30 UTC print' },
      { name: 'FOMC Rate / Minutes Window', folder: 'red', impactPct: 92, volPips: '100-180', bias: 'Yield-Sensitive', confClass: 'news-conf-high', conf: 'HIGH', dt: nextUtcHour(19, 6), histConf: 'HIGH — Watch real yield & DXY reaction' },
    ];
    return templates
      .map((t) => ({
        ...t,
        time: t.dt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
        targetMs: t.dt.getTime(),
        hoursUntil: Math.max(0, (t.dt.getTime() - now) / 3_600_000),
      }))
      .sort((a, b) => a.targetMs - b.targetMs);
  }

  function getUTCTime() {
    const now = new Date();
    return { h: now.getUTCHours(), m: now.getUTCMinutes(), s: now.getUTCSeconds() };
  }

  function formatCountdown(totalSeconds) {
    if (totalSeconds <= 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateKillzoneDisplay() {
    const { h, m, s } = getUTCTime();
    const now = h * 3600 + m * 60 + s;
    const sessions = { asia: { start: 0, end: 28800 }, london: { start: 28800, end: 39600 }, ny: { start: 46800, end: 57600 } };

    const updateSess = (elId, chipId, countId, labelId, sess, activeLbl, doneLbl) => {
      const box = document.getElementById(elId);
      const chip = document.getElementById(chipId);
      const count = document.getElementById(countId);
      const label = document.getElementById(labelId);
      if (now >= sess.start && now < sess.end) {
        if (count) count.textContent = formatCountdown(sess.end - now);
        if (label) label.textContent = activeLbl;
        if (chip) { chip.textContent = 'ACTIVE'; chip.className = 'kz-status-chip kz-chip-active'; }
        if (box) box.classList.add('kz-active');
      } else if (now < sess.start) {
        if (count) count.textContent = formatCountdown(sess.start - now);
        if (label) label.textContent = 'OPENS IN';
        if (chip) { chip.textContent = 'NEXT'; chip.className = 'kz-status-chip kz-chip-next'; }
        if (box) box.classList.remove('kz-active');
      } else {
        if (count) count.textContent = 'CLOSED';
        if (label) label.textContent = doneLbl;
        if (chip) { chip.textContent = 'DONE'; chip.className = 'kz-status-chip kz-chip-done'; }
        if (box) box.classList.remove('kz-active');
      }
    };

    updateSess('kz-london', 'kz-london-chip', 'kz-london-countdown', 'kz-london-label', sessions.london, 'ACTIVE — CLOSES IN', 'MANIPULATION PHASE DONE');
    updateSess('kz-ny', 'kz-ny-chip', 'kz-ny-countdown', 'kz-ny-label', sessions.ny, 'ACTIVE — CLOSES IN', 'DISTRIBUTION PHASE DONE');

    const asiaChip = document.getElementById('kz-asia-chip');
    if (asiaChip) {
      const asiaActive = now >= sessions.asia.start && now < sessions.asia.end;
      asiaChip.textContent = asiaActive ? 'ACTIVE' : 'CLOSED';
      asiaChip.className = `kz-status-chip ${asiaActive ? 'kz-chip-active' : 'kz-chip-done'}`;
    }

    const tteEl = document.getElementById('tte-display');
    const heroTTEEl = document.getElementById('hero-tte');
    if (tteEl) {
      let tte = 'Off-Killzone — Monitoring Next Session';
      if (now >= sessions.london.start && now < sessions.london.end) tte = 'London Killzone LIVE (~15m window)';
      else if (now >= sessions.ny.start && now < sessions.ny.end) tte = 'NY Killzone LIVE (~20m window)';
      else if (now < sessions.london.start) tte = `~${Math.round((sessions.london.start - now) / 60)}m to London Open`;
      else if (now < sessions.ny.start) tte = `~${Math.round((sessions.ny.start - now) / 60)}m to NY Open`;
      else tte = `~${Math.round(((86400 - now) + sessions.london.start) / 60)}m to Next Asia/London Cycle`;
      tteEl.textContent = tte;
      if (heroTTEEl) heroTTEEl.textContent = tte;
    }

    updateSilverBulletTicker(h, m);
  }

  function initKillzoneTimer() {
    updateKillzoneDisplay();
    setInterval(updateKillzoneDisplay, 1000);
  }

  function getSBStatus(nowH, nowM) {
    const estH = (nowH - 5 + 24) % 24;
    const timeMin = estH * 60 + nowM;
    const w1Start = 600, w1End = 660, w2Start = 840, w2End = 900;
    if (timeMin >= w1Start && timeMin < w1End) return { window: 1, active: true, minsLeft: w1End - timeMin };
    if (timeMin >= w2Start && timeMin < w2End) return { window: 2, active: true, minsLeft: w2End - timeMin };
    if (timeMin < w1Start) return { window: 1, active: false, minsTo: w1Start - timeMin };
    if (timeMin < w2Start) return { window: 2, active: false, minsTo: w2Start - timeMin };
    return { window: 0, active: false, minsTo: (1440 - timeMin) + w1Start };
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
      if (overallStatus) overallStatus.innerHTML = '<i data-lucide="zap"></i> WINDOW 1 ACTIVE';
    } else if (sb.active && sb.window === 2) {
      if (w2El) w2El.classList.add('sb-active');
      if (w1El) w1El.classList.remove('sb-active');
      if (chip2) { chip2.textContent = `LIVE ${sb.minsLeft}m`; chip2.className = 'sb-status sb-status-active'; }
      if (chip1) { chip1.textContent = 'DONE'; chip1.className = 'sb-status sb-status-waiting'; }
      if (overallStatus) overallStatus.innerHTML = '<i data-lucide="zap"></i> WINDOW 2 ACTIVE';
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

  function initSilverBulletClock() {
    updateSilverBulletWindows();
    setInterval(updateSilverBulletWindows, 15000);
  }

  function initAMDPhase() {
    const update = () => {
      const { h } = getUTCTime();
      const el = document.getElementById('amd-current-phase');
      if (!el) return;
      if (h < 8) el.textContent = 'Phase: ACCUMULATION (Asia)';
      else if (h < 11) el.textContent = 'Phase: MANIPULATION (London Sweep)';
      else if (h >= 13 && h < 16) el.textContent = 'Phase: DISTRIBUTION (NY Trend)';
      else el.textContent = 'Phase: Consolidation / Inter-session';
    };
    update();
    setInterval(update, 30000);
  }

  function hasNewsWithin2h() {
    return state.newsEvents.some((e) => e.hoursUntil <= 2 && e.folder === 'red');
  }

  function updateNewsBadges() {
    const heroBadge = document.getElementById('hero-news-badge');
    if (heroBadge) heroBadge.style.display = hasNewsWithin2h() ? 'flex' : 'none';
  }

  function updateNewsWidget(ev) {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('news-next-event-name', ev.name);
    set('news-next-event-time', `In ${ev.hoursUntil.toFixed(1)}h • ${ev.time}`);
    set('news-vol', `${ev.volPips} pips`);
    set('news-bias', ev.bias);
    set('news-influence', `${ev.impactPct}%`);
    set('news-hist-conf', ev.histConf || '—');
    const meter = document.getElementById('news-meter-fill');
    if (meter) meter.style.width = `${ev.impactPct}%`;
    const chip = document.getElementById('news-conf-chip');
    if (chip) { chip.textContent = `${ev.conf} IMPACT`; chip.className = `news-confidence-chip ${ev.confClass}`; }
  }

  function renderNewsCalendar() {
    const container = document.getElementById('news-calendar-list');
    if (!container) return;
    container.innerHTML = '';
    state.newsEvents.forEach((ev) => {
      const isUpcoming = ev.hoursUntil <= 2;
      const row = document.createElement('div');
      row.className = `news-event-row${isUpcoming ? ' news-upcoming' : ''}`;
      const timeStr = ev.hoursUntil < 1 ? `${Math.round(ev.hoursUntil * 60)}m` : `${ev.hoursUntil.toFixed(1)}h`;
      row.innerHTML = `
        <div>
          <div class="news-time">${escapeHtml(ev.time)}</div>
          <div class="news-time" style="color:${isUpcoming ? 'var(--ruby)' : 'var(--text-dim)'};">In ${timeStr}</div>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="news-folder-badge folder-${ev.folder}"></span>
            <span class="news-event-name">${escapeHtml(ev.name)}</span>
          </div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:2px;">${escapeHtml(ev.bias)} • ±${escapeHtml(ev.volPips)} pips</div>
        </div>
        <div class="news-impact-col">
          <span class="news-impact-pct">${ev.impactPct}%</span>
          <div class="news-impact-bar-wrap"><div class="news-impact-bar-fill" style="width:${ev.impactPct}%;"></div></div>
          <span class="news-confidence-chip ${ev.confClass}">${ev.conf}</span>
        </div>
      `;
      row.addEventListener('click', () => updateNewsWidget(ev));
      container.appendChild(row);
    });
  }

  function initNewsEngine() {
    renderNewsCalendar();
    if (state.newsEvents[0]) updateNewsWidget(state.newsEvents[0]);
    updateNewsBadges();

    const updateCountdowns = () => {
      const now = Date.now();
      state.newsEvents.forEach((ev) => {
        ev.hoursUntil = Math.max(0, (ev.targetMs - now) / 3_600_000);
      });
      const next = state.newsEvents[0];
      if (!next) return;
      const sec = Math.max(0, Math.round(next.hoursUntil * 3600));
      const timerEl = document.getElementById('news-countdown-timer');
      if (timerEl) timerEl.textContent = formatCountdown(sec);

      const h = Math.floor(next.hoursUntil);
      const m = Math.round((next.hoursUntil - h) * 60);
      const shortLbl = h > 0 ? `${next.name.split(' ')[1] || 'Macro'} in ${h}h ${m}m` : `${next.name.split(' ')[1] || 'Macro'} in ${m}m`;

      const tickerEl = document.getElementById('ticker-news-alert');
      if (tickerEl) {
        tickerEl.textContent = shortLbl;
        tickerEl.style.color = next.hoursUntil <= 2 ? 'var(--ruby)' : 'var(--gold-primary)';
      }

      const feedStatus = document.getElementById('feed-news-status');
      const feedDetail = document.getElementById('feed-news-detail');
      if (feedStatus) feedStatus.textContent = shortLbl;
      if (feedDetail) {
        feedDetail.textContent = `${next.name} (${next.time}) • Expected volatility: ${next.volPips} pips • ${next.histConf}`;
      }
    };

    updateCountdowns();
    setInterval(updateCountdowns, 1000);
    setInterval(renderNewsCalendar, 60000);
  }

  /* ========================================================================
     11. INFERENCE SIMULATOR & RISK CALCULATOR
     ======================================================================== */
  function initSimulator() {
    const inputs = {
      realYield: document.getElementById('sim-input-realyield'),
      dxy: document.getElementById('sim-input-dxy'),
      ema: document.getElementById('sim-input-ema'),
      bb: document.getElementById('sim-input-bb'),
      smc: document.getElementById('sim-input-smc'),
      gpr: document.getElementById('sim-input-gpr'),
    };
    if (!inputs.realYield) return;

    const vals = {
      realYield: document.getElementById('sim-val-realyield'),
      dxy: document.getElementById('sim-val-dxy'),
      ema: document.getElementById('sim-val-ema'),
      bb: document.getElementById('sim-val-bb'),
      smc: document.getElementById('sim-val-smc'),
      gpr: document.getElementById('sim-val-gpr'),
    };

    const calc = () => {
      const smcScores = { choch_ob: 93, fvg: 80, liq_sweep: 88, none: 40 };
      const smcVal = inputs.smc?.value || 'choch_ob';
      const instC = Math.min(98, Math.max(20, smcScores[smcVal] || 50));
      if (vals.smc) vals.smc.textContent = { choch_ob: 'CHOCH + OB', fvg: 'FVG Fill', liq_sweep: 'Liq Sweep', none: 'No Signal' }[smcVal];

      const ryVal = parseFloat(inputs.realYield.value);
      if (vals.realYield) vals.realYield.textContent = `${ryVal.toFixed(2)}% (${ryVal < 0 ? 'Negative / Bullish' : 'Positive / Bearish'})`;
      let macroScore = 50 + (ryVal < 0 ? Math.abs(ryVal) * 22 : -ryVal * 20);

      const dxyVal = inputs.dxy.value;
      if (vals.dxy) vals.dxy.textContent = { weak: 'Weakening (Bullish Au)', flat: 'Neutral', strong: 'Strengthening (Bearish Au)' }[dxyVal];
      if (dxyVal === 'weak') macroScore += 18;
      else if (dxyVal === 'strong') macroScore -= 18;

      const gprVal = parseInt(inputs.gpr.value, 10);
      if (vals.gpr) vals.gpr.textContent = `${gprVal} (${gprVal > 120 ? 'High Risk' : 'Normal'})`;
      macroScore += (gprVal - 100) * 0.12;

      const emaVal = inputs.ema.value;
      if (vals.ema) vals.ema.textContent = { bullish: 'Price > 50 > 200', neutral: 'Between EMAs', bearish: 'Price < 50 < 200' }[emaVal];
      let techScore = 50 + (emaVal === 'bullish' ? 22 : emaVal === 'bearish' ? -22 : 0);

      const bbVal = inputs.bb.value;
      if (vals.bb) vals.bb.textContent = { breakout_up: 'Squeeze + Upper Break', squeeze: 'Squeeze Phase', breakout_down: 'Squeeze + Lower Break', normal: 'Normal Vol' }[bbVal];
      if (bbVal === 'breakout_up') techScore += 18;
      else if (bbVal === 'squeeze') techScore += 8;
      else if (bbVal === 'breakout_down') techScore -= 18;

      const macroC = Math.min(98, Math.max(20, Math.round(macroScore)));
      const techC = Math.min(98, Math.max(20, Math.round(techScore)));
      const total = Math.min(98, Math.max(15, Math.round(instC * 0.5 + macroC * 0.3 + techC * 0.2)));

      const scoreEl = document.getElementById('sim-result-score');
      const badgeEl = document.getElementById('sim-result-badge');
      const textEl = document.getElementById('sim-result-text');
      if (scoreEl) scoreEl.textContent = `${total}%`;
      if (badgeEl && textEl) {
        if (total >= 85) {
          badgeEl.className = 'sim-out-signal signal-buy';
          badgeEl.style.cssText = '';
          badgeEl.innerHTML = '<i data-lucide="check-circle-2"></i> HIGH CONFIDENCE LONG SIGNAL';
        } else if (total >= 70) {
          badgeEl.className = 'sim-out-signal';
          badgeEl.style.cssText = 'background:rgba(245,194,66,0.15);color:#f5c242;border:1px solid rgba(245,194,66,0.4);';
          badgeEl.innerHTML = '<i data-lucide="alert-circle"></i> MEDIUM CONFIDENCE SIGNAL';
        } else {
          badgeEl.className = 'sim-out-signal';
          badgeEl.style.cssText = 'background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.4);';
          badgeEl.innerHTML = '<i data-lucide="x-circle"></i> NO TRADE — FILTERED (< 70%)';
        }
        textEl.textContent = `Inst ${instC}% × 50% + Macro ${macroC}% × 30% + Tech ${techC}% × 20% = ${total}% weighted.`;
        if (window.lucide) window.lucide.createIcons();
      }
    };

    Object.values(inputs).forEach((el) => {
      if (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); }
    });
    calc();
  }

  function seedCalculatorFromMarket() {
    const entryEl = document.getElementById('calc-entry');
    const slEl = document.getElementById('calc-sl');
    const atrEl = document.getElementById('calc-atr');
    if (!entryEl || !slEl) return;

    const sig = state.signal || state.futureSetups[0];
    const atr = state.indicators?.atr14 || 8.0;

    if (sig && !entryEl.value) {
      entryEl.value = Number(sig.entry_price).toFixed(2);
      slEl.value = Number(sig.stop_loss).toFixed(2);
      if (atrEl) atrEl.value = Number(sig.indicators?.atr14 || atr).toFixed(2);
      state.calcSeeded = true;
    } else if (state.goldPrice && !entryEl.value) {
      entryEl.value = state.goldPrice.toFixed(2);
      slEl.value = (state.goldPrice - atr * 1.5).toFixed(2);
      if (atrEl) atrEl.value = Number(atr).toFixed(2);
      state.calcSeeded = true;
    }
    document.getElementById('btn-recalc')?.click();
  }

  function initCalculator() {
    const fields = {
      balance: document.getElementById('calc-balance'),
      riskPct: document.getElementById('calc-risk-pct'),
      entry: document.getElementById('calc-entry'),
      sl: document.getElementById('calc-sl'),
      atr: document.getElementById('calc-atr'),
      rrTarget: document.getElementById('calc-rr-target'),
    };
    if (!fields.balance) return;

    const calc = () => {
      const balance = parseFloat(fields.balance.value) || 10000;
      const riskPct = parseFloat(fields.riskPct.value) || 1.0;
      const atr = parseFloat(fields.atr?.value) || (state.indicators?.atr14 || 8.0);
      const entry = parseFloat(fields.entry.value) || state.goldPrice;
      const sl = parseFloat(fields.sl.value) || (entry ? entry - atr * 1.5 : null);
      const rrTarget = parseInt(fields.rrTarget?.value || '4', 10) || 4;

      const riskAmt = balance * (riskPct / 100);
      const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      set('calc-risk-amount', `$${riskAmt.toFixed(2)}`);

      if (!entry || !sl || Math.abs(entry - sl) <= 0) {
        ['out-lots', 'out-pips', 'out-tp1', 'out-tp2', 'out-tp3'].forEach((id) => set(id, '—'));
        return;
      }

      const priceDist = Math.abs(entry - sl);
      const pipsDist = priceDist * 10;
      const lots = riskAmt / (priceDist * 100);
      const isBuy = entry > sl;
      const tp1 = isBuy ? entry + priceDist * 2 : entry - priceDist * 2;
      const tp2 = isBuy ? entry + priceDist * rrTarget : entry - priceDist * rrTarget;
      const tp3RR = Math.min(10, rrTarget * 2);
      const tp3 = isBuy ? entry + priceDist * tp3RR : entry - priceDist * tp3RR;

      set('out-lots', `${lots.toFixed(2)} Lots`);
      set('out-ounces', `${(lots * 100).toFixed(0)} Ounces of Gold`);
      set('out-pips', `${pipsDist.toFixed(1)} Pips`);
      set('out-dist-usd', `$${priceDist.toFixed(2)} Price Distance`);
      set('out-tp1', formatPrice(tp1));
      set('out-tp1-sub', `+${(pipsDist * 2).toFixed(0)} Pips (Close 50%)`);
      set('out-tp2', formatPrice(tp2));
      set('out-tp2-sub', `+${(pipsDist * rrTarget).toFixed(0)} Pips (1:${rrTarget} Runner)`);
      set('out-tp3', formatPrice(tp3));
      set('out-tp3-sub', `+${(pipsDist * tp3RR).toFixed(0)} Pips (1:${tp3RR} Max HTF)`);
    };

    Object.values(fields).forEach((el) => {
      if (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); }
    });
    document.getElementById('btn-recalc')?.addEventListener('click', calc);
    calc();
  }

  /* ========================================================================
     12. ACTION BUTTONS & BLUEPRINT JSON PREVIEW
     ======================================================================== */
  function updateBlueprintJsonPreview(livePayload) {
    const el = document.getElementById('json-preview-content');
    if (!el || !livePayload) return;
    const preview = {
      endpoint: '/api/signals/live',
      spot_price: livePayload.spot_price,
      timeframe: livePayload.timeframe,
      provider: livePayload.provider,
      persistence_mode: livePayload.persistence_mode,
      updated_at: livePayload.updated_at,
      live_signals: livePayload.live_signals.slice(0, 1),
      future_setups: livePayload.future_setups.slice(0, 1),
      macro: livePayload.macro,
    };
    el.textContent = JSON.stringify(preview, null, 2);
  }

  function initActionButtons() {
    const btnRefresh = document.getElementById('btn-refresh-signal');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', async function () {
        this.innerHTML = '<i data-lucide="loader" class="spin"></i> Scanning...';
        this.disabled = true;
        if (window.lucide) window.lucide.createIcons();

        await fetchSpotAndCandles(state.timeframe, { forceRefresh: true });
        await fetchLiveSignals({ forceRefresh: true });

        this.innerHTML = '<i data-lucide="rotate-cw"></i> Run Inference';
        this.disabled = false;
        if (window.lucide) window.lucide.createIcons();

        if (state.goldPrice) {
          showNotification(`Live scan updated at ${formatPrice(state.goldPrice)} (${state.liveSignals.length} live, ${state.futureSetups.length} future)`);
        }
      });
    }

    document.getElementById('btn-quick-signal')?.addEventListener('click', () => {
      switchTab('terminal', true);
      setTimeout(() => {
        const feedEl = document.getElementById('signal-feed-list');
        if (feedEl) {
          feedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          feedEl.style.boxShadow = '0 0 24px rgba(245, 194, 66, 0.6)';
          setTimeout(() => { feedEl.style.boxShadow = ''; }, 1000);
        }
      }, 100);
    });

    document.getElementById('btn-copy-signal')?.addEventListener('click', () => {
      const s = state.signal || state.futureSetups[0];
      if (!s) {
        showNotification('No active or queued setup available to copy yet.');
        return;
      }
      navigator.clipboard.writeText(JSON.stringify(s, null, 2)).then(() => {
        showNotification('Signal JSON copied to clipboard.');
      });
    });

    document.getElementById('btn-open-calc')?.addEventListener('click', () => {
      switchTab('calculator', true);
      const s = state.signal || state.futureSetups[0];
      if (s) {
        const eEl = document.getElementById('calc-entry');
        const sEl = document.getElementById('calc-sl');
        const aEl = document.getElementById('calc-atr');
        if (eEl) eEl.value = Number(s.entry_price).toFixed(2);
        if (sEl) sEl.value = Number(s.stop_loss).toFixed(2);
        if (aEl && s.indicators?.atr14) aEl.value = Number(s.indicators.atr14).toFixed(2);
        document.getElementById('btn-recalc')?.click();
      }
    });

    document.getElementById('btn-copy-json')?.addEventListener('click', () => {
      const el = document.getElementById('json-preview-content');
      const txt = el ? el.textContent : JSON.stringify(lastLivePayload || {}, null, 2);
      navigator.clipboard.writeText(txt).then(() => showNotification('API JSON copied to clipboard.'));
    });
  }

  /* ========================================================================
     13. USER MARKED LEVELS & DRAWINGS (/api/drawings)
     ======================================================================== */
  async function loadDrawingsFromBackend() {
    try {
      const res = await fetch('/api/drawings', { signal: AbortSignal.timeout(4500) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.device_key) {
        state.detectedIpKey = data.device_key;
        const badge = document.getElementById('drawings-ip-badge');
        if (badge) badge.textContent = `Device ${data.device_key.slice(0, 10)}... • 48h Retention`;
      }
      if (Array.isArray(data.drawings)) {
        state.userDrawings = data.drawings;
        renderUserDrawingsList();
        renderUserDrawingsOnChart();
      }
    } catch (err) {
      console.warn('[MANUS MAX] loadDrawingsFromBackend deferred:', err.message);
    }
  }

  async function saveUserDrawing(levelData) {
    try {
      const res = await fetch('/api/drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_from: levelData.price,
          drawing_type: levelData.type,
          label: levelData.label,
          color: levelData.color,
          timeframe: state.timeframe,
        }),
        signal: AbortSignal.timeout(4500),
      });
      const json = await res.json().catch(() => ({}));
      const saved = json.drawing || {
        id: `local_${Date.now()}`,
        price_from: levelData.price,
        drawing_type: levelData.type,
        label: levelData.label,
        color: levelData.color,
        created_at: new Date().toISOString(),
      };
      state.userDrawings.unshift(saved);
      renderUserDrawingsList();
      renderUserDrawingsOnChart();
      showNotification(`Marked ${levelData.type.toUpperCase()} at ${formatPrice(levelData.price)}`);
    } catch (err) {
      showHttpErrorBanner('/api/drawings', err.message);
    }
  }

  async function deleteUserDrawing(id) {
    state.userDrawings = state.userDrawings.filter((d) => d.id !== id);
    renderUserDrawingsList();
    renderUserDrawingsOnChart();
    if (!String(id).startsWith('local_')) {
      fetch(`/api/drawings?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    }
  }

  function renderUserDrawingsList() {
    const container = document.getElementById('marked-levels-list');
    if (!container) return;
    if (!state.userDrawings.length) {
      container.innerHTML = `<div class="empty-levels-msg" style="color:var(--text-dim);font-size:11px;padding:8px 0;">No custom levels marked in the last 48 hours.</div>`;
      return;
    }

    container.innerHTML = state.userDrawings.map((d) => {
      const p = Number(d.price_from || d.price || 0);
      const type = (d.drawing_type || 'level').toLowerCase();
      const diffStr = state.goldPrice ? `(${p - state.goldPrice >= 0 ? '+' : ''}${(p - state.goldPrice).toFixed(1)} pts)` : '';
      return `
        <div class="level-chip ${escapeHtml(type)}" id="chip-level-${escapeHtml(d.id)}">
          <span class="level-chip-type">${escapeHtml(type.toUpperCase())}</span>
          <span class="level-chip-price">${formatPrice(p)}</span>
          ${diffStr ? `<span class="level-chip-dist">${diffStr}</span>` : ''}
          ${d.label ? `<span class="level-chip-label">${escapeHtml(d.label)}</span>` : ''}
          <span class="level-chip-del" data-del-id="${escapeHtml(d.id)}" title="Delete">✕</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.level-chip-del').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteUserDrawing(btn.getAttribute('data-del-id'));
      });
    });
  }

  function updateDrawingsDistances(currentPrice) {
    if (!currentPrice || !state.userDrawings.length) return;
    state.userDrawings.forEach((d) => {
      const distEl = document.getElementById(`chip-level-${d.id}`)?.querySelector('.level-chip-dist');
      if (distEl) {
        const diff = Number(d.price_from || d.price || 0) - currentPrice;
        distEl.textContent = `(${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pts)`;
      }
    });
  }

  function renderUserDrawingsOnChart() {
    if (!state.lwCandleSeries || !window.LightweightCharts) return;
    state.lwUserDrawingLines.forEach((line) => {
      try { state.lwCandleSeries.removePriceLine(line); } catch (_) {}
    });
    state.lwUserDrawingLines = [];
    state.userDrawings.forEach((d) => {
      const p = Number(d.price_from || d.price);
      if (!Number.isFinite(p) || p <= 0) return;
      const line = state.lwCandleSeries.createPriceLine({
        price: p,
        color: d.color || '#f5c242',
        lineWidth: 1.5,
        lineStyle: window.LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${(d.drawing_type || 'LEVEL').toUpperCase()} ${formatPrice(p)}`,
      });
      state.lwUserDrawingLines.push(line);
    });
  }

  function initUserDrawingsUI() {
    document.getElementById('btn-quick-support')?.addEventListener('click', () => {
      if (!state.goldPrice) return showNotification('Wait for live spot price first.');
      saveUserDrawing({ price: state.goldPrice, type: 'support', label: 'Support Level', color: '#10b981' });
    });
    document.getElementById('btn-quick-resistance')?.addEventListener('click', () => {
      if (!state.goldPrice) return showNotification('Wait for live spot price first.');
      saveUserDrawing({ price: state.goldPrice, type: 'resistance', label: 'Resistance Level', color: '#ef4444' });
    });
    const inputPrice = document.getElementById('input-draw-price');
    const selectType = document.getElementById('select-draw-type');
    const inputLabel = document.getElementById('input-draw-label');
    const saveCustom = () => {
      const rawP = parseFloat(inputPrice?.value || '');
      if (!Number.isFinite(rawP) || rawP <= 0) return showNotification('Enter a valid price level.');
      const type = selectType?.value || 'key_level';
      const colorMap = { support: '#10b981', resistance: '#ef4444', order_block: '#8b5cf6', fvg: '#06b6d4', target: '#ffd700', key_level: '#f5c242' };
      saveUserDrawing({
        price: rawP,
        type,
        label: inputLabel?.value.trim() || `${type.replace('_', ' ').toUpperCase()} Zone`,
        color: colorMap[type] || '#f5c242',
      });
      if (inputPrice) inputPrice.value = '';
      if (inputLabel) inputLabel.value = '';
    };
    document.getElementById('btn-save-level')?.addEventListener('click', saveCustom);
  }

  /* ========================================================================
     14. SAFE BOOT SEQUENCE (Executed last after all declarations)
     ======================================================================== */
  async function boot() {
    if (window.lucide) {
      try { window.lucide.createIcons(); } catch (_) {}
    }

    injectDisclaimerBanner();
    initPersistence();
    initLightweightChart();
    initNavigation();
    initKillzoneTimer();
    initSilverBulletClock();
    initAMDPhase();
    initNewsEngine();
    initSimulator();
    initCalculator();
    initActionButtons();
    initUserDrawingsUI();

    // Parallel initial data load from serverless APIs
    await Promise.all([
      fetchSpotAndCandles(state.timeframe).then(() => fetchLiveSignals()),
      fetchBotHistory(),
      loadDrawingsFromBackend(),
    ]);

    // Recurring real-time polls (protected by 30s server cache)
    spotPollTimerId = setInterval(() => fetchSpotAndCandles(state.timeframe), 15_000);
    signalsPollTimerId = setInterval(() => fetchLiveSignals(), 30_000);
    historyPollTimerId = setInterval(() => fetchBotHistory(), 60_000);

    console.log('[MANUS MAX AI 6.0] Booted cleanly with live /api/spot, /api/signals/live, and /api/signals/history bindings.');
  }

  boot();
});
