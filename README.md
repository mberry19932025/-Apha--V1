# TradeBot

Full-stack starter for a paper-trading bot dashboard.

This project is intentionally safe by default: it simulates trades and does not connect to a live brokerage account.

## Version 1 features

- Local market scanner for supported symbols.
- Moving-average crossover backtesting with configurable cash, windows, lookback, and risk.
- Paper order ticket with buy/sell validation.
- Paper portfolio with equity, exposure, realized P/L, positions, and recent trades.
- Dashboard panels for scanner rankings, backtest results, market quotes, signals, and portfolio state.

The current historical data is deterministic sample data generated locally. Replace it with CSV or provider data before treating backtest results as strategy evidence.

## Free real-data workflow

The bot uses real local CSV data when a file exists in `backend/data/`. If a symbol does not have enough CSV rows for the selected moving-average windows, the bot falls back to simulated data and marks the source in the dashboard.

CSV files must be named by symbol, for example:

```text
backend/data/AAPL.csv
backend/data/SPY.csv
backend/data/NVDA.csv
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

This saves CSV files into `backend/data/`. The app then uses those files automatically for backtests and scanner rankings.

## Structure

- `frontend/` — React + Vite dashboard
- `backend/` — Express API with paper-trading simulation
- `render.yaml` — Render blueprint for frontend and backend services

## Local setup

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:8080`

## Render deployment

1. Push this folder to a GitHub repo.
2. In Render, create a new Blueprint from the repo.
3. Render will read `render.yaml` and create:
   - `tradebot-api` web service
   - `tradebot-frontend` static site

After deployment, update the frontend `VITE_API_URL` environment variable in Render if your backend URL differs from the placeholder in `render.yaml`.

## API

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
