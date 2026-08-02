# TradeBot

Static-first paper-trading bot dashboard.

This project is intentionally safe by default: it simulates paper trades in the browser and does not connect to a live brokerage account.

## Version 1 features

- Static browser app with no paid backend required.
- Local market scanner for supported symbols.
- Moving-average crossover backtesting with configurable cash, windows, lookback, and risk.
- Paper order ticket with buy/sell validation.
- Paper portfolio with equity, exposure, realized P/L, positions, and recent trades saved in browser storage.
- Dashboard panels for scanner rankings, backtest results, market quotes, signals, and portfolio state.

The current historical data is deterministic sample data generated locally. Replace it with CSV or provider data before treating backtest results as strategy evidence.

## Free real-data workflow

The static app uses real local CSV data when a file exists in `frontend/public/data/`. If a symbol does not have enough CSV rows for the selected moving-average windows, the bot falls back to simulated data and marks the source in the dashboard.

The deployed app also supports browser CSV uploads. Uploaded data is saved in that browser's local storage and is used before bundled CSV files, so you can refresh market data without redeploying.

CSV files must be named by symbol, for example:

```text
frontend/public/data/AAPL.csv
frontend/public/data/SPY.csv
frontend/public/data/NVDA.csv
```

Required CSV columns:

```csv
date,open,high,low,close,volume
2026-01-02,100,105,99,104,1200000
```

You can download free daily data with an Alpha Vantage free API key:

```bash
ALPHA_VANTAGE_API_KEY=your_free_key npm run data:alpha --workspace backend -- AAPL SPY QQQ NVDA TSLA MSFT
```

This saves CSV files into `backend/data/`. For static hosting, copy the downloaded CSV files into `frontend/public/data/` before building. The browser app then uses those files automatically for backtests and scanner rankings.

For the fastest live workflow, download a CSV named like `AAPL.csv`, open the dashboard, and use **Update Market Data > Upload CSV**.

## Structure

- `frontend/` — React + Vite static dashboard and browser bot engine
- `frontend/public/data/` — bundled CSV files for static hosting
- `backend/` — optional Express API and data downloader for local experiments
- `render.yaml` — Render blueprint for a static site only

## Local setup

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Render deployment

1. Push this folder to a GitHub repo.
2. In Render, create a new Blueprint from the repo.
3. Render will read `render.yaml` and create one static site: `apex-alpha-static`.

No backend service or payment-required web service is needed for the static Version 1 app.

## Optional API

The backend is optional for local experiments. The deployed static app does not need these endpoints.
- `GET /api/health`
- `GET /api/market`
- `GET /api/portfolio`
- `GET /api/signals`
- `GET /api/backtest`
- `GET /api/scanner`
- `GET /api/data/status`
- `POST /api/trades`
- `POST /api/portfolio/reset`

Example trade:

```bash
curl -X POST http://localhost:8080/api/trades \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","side":"buy","quantity":2}'
```

## Production note

Do not enable real-money trading until broker authentication, position limits, order validation, audit logging, and manual kill-switch controls are implemented.
