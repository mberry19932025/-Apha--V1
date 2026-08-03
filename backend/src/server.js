import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { getMarketSnapshot, getSignals } from "./market.js";
import { getPortfolio, placeTrade } from "./portfolio.js";
import { runBacktest } from "./backtest.js";
import { resetPortfolio } from "./portfolio.js";
import { scanMarket } from "./scanner.js";
import { getDataStatus } from "./data.js";
import { getSupportedSymbols } from "./market.js";
import { tradingKnowledge } from "./knowledge.js";

const app = express();
const port = Number(process.env.PORT || 8080);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "*";

app.use(helmet());
app.use(cors({ origin: frontendOrigin === "*" ? true : frontendOrigin }));
app.use(express.json());
app.use(morgan("combined"));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "tradebot-api",
    mode: process.env.TRADING_MODE || "paper",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/market", (_req, res) => {
  res.json({ quotes: getMarketSnapshot() });
});

app.get("/api/signals", (_req, res) => {
  res.json({ signals: getSignals() });
});

app.get("/api/backtest", (req, res) => {
  res.json(runBacktest(req.query));
});

app.get("/api/scanner", (req, res) => {
  res.json(scanMarket(req.query));
});

app.get("/api/data/status", (_req, res) => {
  res.json({ symbols: getDataStatus(getSupportedSymbols()) });
});

app.get("/api/knowledge", (_req, res) => {
  res.json(tradingKnowledge);
});

app.get("/api/portfolio", (_req, res) => {
  res.json(getPortfolio());
});

app.post("/api/trades", (req, res) => {
  try {
    const trade = placeTrade(req.body);
    res.status(201).json({ trade, portfolio: getPortfolio() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/portfolio/reset", (_req, res) => {
  res.json(resetPortfolio());
});

app.listen(port, () => {
  console.log(`TradeBot API listening on ${port}`);
});
