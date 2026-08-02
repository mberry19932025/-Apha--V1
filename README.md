# TradeBot

Full-stack starter for a paper-trading bot dashboard.

This project is intentionally safe by default: it simulates trades and does not connect to a live brokerage account.

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
- `POST /api/trades`

Example trade:

```bash
curl -X POST http://localhost:8080/api/trades \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","side":"buy","quantity":2}'
```

## Production note

Do not enable real-money trading until broker authentication, position limits, order validation, audit logging, and manual kill-switch controls are implemented.
