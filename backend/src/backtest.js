import { getSupportedSymbols } from "./market.js";
import { readCsvCandles } from "./data.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULTS = {
  symbol: "SPY",
  startingCash: 1000,
  shortWindow: 20,
  longWindow: 50,
  lookbackDays: 260,
  riskPercent: 0.25
};

const profiles = {
  AAPL: { start: 184, trend: 0.00058, cycle: 0.025, noise: 0.013 },
  MSFT: { start: 390, trend: 0.00042, cycle: 0.018, noise: 0.01 },
  NVDA: { start: 91, trend: 0.0012, cycle: 0.04, noise: 0.022 },
  TSLA: { start: 210, trend: 0.00025, cycle: 0.055, noise: 0.028 },
  SPY: { start: 495, trend: 0.00034, cycle: 0.014, noise: 0.007 },
  QQQ: { start: 425, trend: 0.00048, cycle: 0.02, noise: 0.01 }
};

function round(value, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function movingAverage(candles, endIndex, window) {
  if (endIndex + 1 < window) {
    return null;
  }

  let total = 0;
  for (let index = endIndex - window + 1; index <= endIndex; index += 1) {
    total += candles[index].close;
  }
  return total / window;
}

function generateSyntheticCandles(symbol, lookbackDays) {
  const profile = profiles[symbol] || profiles.SPY;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const candles = [];
  let previousClose = profile.start;

  for (let index = 0; index < lookbackDays; index += 1) {
    const date = new Date(today.getTime() - (lookbackDays - index) * DAY_MS);
    const wave = Math.sin(index / 12) * profile.cycle + Math.cos(index / 33) * profile.cycle * 0.65;
    const shock = Math.sin(index * 2.17 + symbol.length) * profile.noise;
    const dailyReturn = profile.trend + wave / 22 + shock / 6;
    const close = Math.max(1, previousClose * (1 + dailyReturn));
    const spread = close * (0.006 + Math.abs(Math.sin(index / 7)) * 0.01);
    const open = previousClose;
    const high = Math.max(open, close) + spread;
    const low = Math.max(0.01, Math.min(open, close) - spread);
    const volume = Math.floor(900000 + Math.abs(Math.sin(index / 9 + symbol.length)) * 9000000);

    candles.push({
      date: date.toISOString().slice(0, 10),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume
    });

    previousClose = close;
  }

  return candles;
}

export function generateHistoricalCandles(symbol, lookbackDays) {
  const csvData = readCsvCandles(symbol);
  if (csvData) {
    return csvData.candles.slice(-lookbackDays);
  }

  return generateSyntheticCandles(symbol, lookbackDays);
}

export function getHistoricalCandlesWithSource(symbol, lookbackDays, minRows = 2) {
  const csvData = readCsvCandles(symbol);
  if (csvData && csvData.candles.length >= minRows) {
    return {
      source: "csv",
      candles: csvData.candles.slice(-lookbackDays),
      rowsAvailable: csvData.candles.length,
      firstDate: csvData.candles[0]?.date,
      lastDate: csvData.candles.at(-1)?.date
    };
  }

  return {
    source: "simulated",
    candles: generateSyntheticCandles(symbol, lookbackDays),
    rowsAvailable: lookbackDays,
    firstDate: null,
    lastDate: null
  };
}

function calculateMaxDrawdown(equityCurve) {
  let peak = equityCurve[0]?.equity || 0;
  let maxDrawdown = 0;

  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, (peak - point.equity) / peak);
    }
  }

  return maxDrawdown;
}

export function runBacktest(options = {}) {
  const supportedSymbols = getSupportedSymbols();
  const requestedSymbol = String(options.symbol || DEFAULTS.symbol).trim().toUpperCase();
  const symbol = supportedSymbols.includes(requestedSymbol) ? requestedSymbol : DEFAULTS.symbol;
  const startingCash = clampNumber(options.startingCash, DEFAULTS.startingCash, 1000, 10000000);
  const shortWindow = Math.floor(clampNumber(options.shortWindow, DEFAULTS.shortWindow, 3, 100));
  const longWindow = Math.floor(clampNumber(options.longWindow, DEFAULTS.longWindow, shortWindow + 1, 220));
  const lookbackDays = Math.floor(clampNumber(options.lookbackDays, DEFAULTS.lookbackDays, longWindow + 30, 900));
  const riskPercent = clampNumber(options.riskPercent, DEFAULTS.riskPercent, 0.05, 1);

  const data = getHistoricalCandlesWithSource(symbol, lookbackDays, longWindow + 2);
  const candles = data.candles;
  const trades = [];
  const equityCurve = [];
  let cash = startingCash;
  let shares = 0;
  let entryPrice = 0;
  let peakEquity = startingCash;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const shortAverage = movingAverage(candles, index, shortWindow);
    const longAverage = movingAverage(candles, index, longWindow);
    const previousShort = movingAverage(candles, index - 1, shortWindow);
    const previousLong = movingAverage(candles, index - 1, longWindow);
    const equity = cash + shares * candle.close;

    if (shortAverage && longAverage && previousShort && previousLong) {
      const crossedUp = previousShort <= previousLong && shortAverage > longAverage;
      const crossedDown = previousShort >= previousLong && shortAverage < longAverage;

      if (crossedUp && shares === 0) {
        const allocation = equity * riskPercent;
        const quantity = Math.floor(allocation / candle.close);

        if (quantity > 0) {
          const gross = quantity * candle.close;
          shares = quantity;
          entryPrice = candle.close;
          cash -= gross;
          trades.push({
            date: candle.date,
            side: "buy",
            quantity,
            price: candle.close,
            gross: round(gross),
            reason: `${shortWindow}-day average crossed above ${longWindow}-day average`
          });
        }
      }

      if (crossedDown && shares > 0) {
        const gross = shares * candle.close;
        const pnl = (candle.close - entryPrice) * shares;
        cash += gross;
        trades.push({
          date: candle.date,
          side: "sell",
          quantity: shares,
          price: candle.close,
          gross: round(gross),
          pnl: round(pnl),
          reason: `${shortWindow}-day average crossed below ${longWindow}-day average`
        });
        shares = 0;
        entryPrice = 0;
      }
    }

    const markToMarket = cash + shares * candle.close;
    peakEquity = Math.max(peakEquity, markToMarket);
    equityCurve.push({
      date: candle.date,
      close: candle.close,
      equity: round(markToMarket),
      drawdownPercent: round(((peakEquity - markToMarket) / peakEquity) * 100, 2)
    });
  }

  const lastCandle = candles.at(-1);
  if (shares > 0 && lastCandle) {
    const gross = shares * lastCandle.close;
    const pnl = (lastCandle.close - entryPrice) * shares;
    cash += gross;
    trades.push({
      date: lastCandle.date,
      side: "sell",
      quantity: shares,
      price: lastCandle.close,
      gross: round(gross),
      pnl: round(pnl),
      reason: "Closed open position at end of backtest"
    });
    equityCurve[equityCurve.length - 1].equity = round(cash);
  }

  const sellTrades = trades.filter((trade) => trade.side === "sell");
  const winningTrades = sellTrades.filter((trade) => trade.pnl > 0);
  const finalEquity = equityCurve.at(-1)?.equity || startingCash;
  const returnPercent = ((finalEquity - startingCash) / startingCash) * 100;
  const maxDrawdownPercent = calculateMaxDrawdown(equityCurve) * 100;

  return {
    config: {
      symbol,
      startingCash,
      shortWindow,
      longWindow,
      lookbackDays,
      riskPercent
    },
    data: {
      source: data.source,
      rowsAvailable: data.rowsAvailable,
      rowsUsed: candles.length,
      firstDate: candles[0]?.date || data.firstDate,
      lastDate: candles.at(-1)?.date || data.lastDate
    },
    summary: {
      startingCash: round(startingCash),
      finalEquity: round(finalEquity),
      totalReturn: round(finalEquity - startingCash),
      returnPercent: round(returnPercent, 2),
      maxDrawdownPercent: round(maxDrawdownPercent, 2),
      totalTrades: trades.length,
      completedTrades: sellTrades.length,
      winRatePercent: sellTrades.length ? round((winningTrades.length / sellTrades.length) * 100, 2) : 0
    },
    candles: candles.slice(-90),
    equityCurve: equityCurve.slice(-160),
    trades: trades.slice(-30).reverse()
  };
}
