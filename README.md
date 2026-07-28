# MANUS MAX — XAU/USD Institutional AI Signal Platform

> **Live Gold Price · WebSocket Streaming · TradingView Chart · 1:2 RR Enforcement**

A premium, institutional-grade XAU/USD (Gold) AI signal dashboard built with vanilla HTML, CSS, and JavaScript. Features real-time gold spot price streaming, an embedded TradingView live chart, and a comprehensive signal history with enforced 1:2 Risk-to-Reward ratios.

---

## ✨ Features

| Feature | Description |
|---|---|
| **WebSocket Streaming** | Sub-millisecond gold tick feed via Binance PAXG/USDT stream with auto-reconnection |
| **Fail-Safe Fallback** | 1000ms HTTP polling loop (metals.live → frankfurter ECB) when WS disconnects |
| **Tick Flash Animations** | Green `.tick-up` / Red `.tick-down` CSS micro-animations on every price movement |
| **TradingView Live Chart** | Full embedded Advanced Chart (OANDA:XAUUSD, H1, dark theme, MA + Bollinger) |
| **AI Signal Overlay Canvas** | Custom canvas chart rendering MANUS MAX Entry/SL/TP zones with 50/200 EMA |
| **1:2 R:R Enforcement** | Every signal row displays ISO-8601 timestamps + enforced min 1:2 R:R ratio |
| **Risk Calculator** | Institutional position sizing calculator (lot size, pip distance, TP1/TP2) |
| **AI Model Simulator** | Interactive multi-factor confidence score calculator (sliders + dropdowns) |
| **3-Pillar Strategy Matrix** | Macro · Technical · Smart Money institutional strategy definitions |
| **Blueprint & API** | Phase roadmap with Strategy 04/05 + live REST API JSON preview |

---

## 🛠 Tech Stack

- **Core**: HTML5 · Vanilla CSS · Vanilla JavaScript (ES2022)
- **Icons**: Lucide Icons (CDN)
- **Fonts**: Plus Jakarta Sans · JetBrains Mono (Google Fonts)
- **Chart**: TradingView Advanced Chart Widget (embedded iframe)
- **Data**: Binance WebSocket (`wss://stream.binance.com`) · metals.live · frankfurter.app

---

## 🚀 Running Locally

No build step required. Serve with any static file server:

```bash
# Python (built-in)
python -m http.server 3000

# Node.js
npx serve .
```

Then open **http://localhost:3000** in your browser.

---

## 📊 Signal History Schema

Each signal row includes:
- **Signal ID** — unique identifier (e.g. `SIG-9842`)
- **Open Timestamp** — `YYYY-MM-DD HH:MM:SS IST` (trade execution time)
- **Close / Expiry** — `YYYY-MM-DD HH:MM:SS IST` or `— (ACTIVE)` for live trades
- **R:R Ratio** — color-coded badge: Gold `1:2.0` (min) · Emerald `1:2.1+` (good) · Purple `1:3.0+` (high)

---

## ⚠️ Disclaimer

This platform is for **educational and quantitative research purposes only**. Forex and Gold trading involves significant financial risk. All signals, AI confidence scores, and historical data shown are for demonstration and model development purposes. Past performance does not guarantee future results.

---

*Built with MANUS MAX AI Signal Engine v4.0*
