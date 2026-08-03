import { assessMarketIntelligence, tradingKnowledge } from "./knowledge.js";

export { tradingKnowledge };

const DAY_MS = 24 * 60 * 60 * 1000;

export const symbols = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY", "QQQ"];

export const strategies = [
  { id: "ma-crossover", name: "MA Crossover" },
  { id: "rsi-reversion", name: "RSI Reversion" },
  { id: "macd-trend", name: "MACD Trend" },
  { id: "buy-hold", name: "Buy & Hold" }
];

export const riskProfiles = [
  { id: "capital-guard", name: "Capital Guard", maxRiskPercent: 0.12 },
  { id: "moderate-bullish", name: "Moderate Bullish", maxRiskPercent: 0.2 },
  { id: "pattern-confirmed", name: "Pattern Confirmed", maxRiskPercent: 0.3 }
];

const basePrices = {
  AAPL: 212.45,
  MSFT: 426.8,
  NVDA: 118.72,
  TSLA: 231.6,
  SPY: 552.38,
  QQQ: 472.19
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

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseNumber(value) {
  const parsed = Number(String(value || "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHeader(header) {
  return header.toLowerCase().replace(/[^a-z]/g, "");
}

export function parseCandlesCsv(csv) {
  const rows = csv.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 2) {
    return [];
  }

  const headers = parseCsvLine(rows[0]).map(normalizeHeader);
  const indexes = {
    date: headers.findIndex((header) => ["date", "timestamp", "time"].includes(header)),
    open: headers.findIndex((header) => header === "open"),
    high: headers.findIndex((header) => header === "high"),
    low: headers.findIndex((header) => header === "low"),
    close: headers.findIndex((header) => ["close", "adjustedclose", "adjclose"].includes(header)),
    volume: headers.findIndex((header) => header === "volume")
  };

  if (Object.values(indexes).some((index) => index < 0)) {
    return [];
  }

  return rows
    .slice(1)
    .map((row) => {
      const columns = parseCsvLine(row);
      const candle = {
        date: columns[indexes.date],
        open: parseNumber(columns[indexes.open]),
        high: parseNumber(columns[indexes.high]),
        low: parseNumber(columns[indexes.low]),
        close: parseNumber(columns[indexes.close]),
        volume: parseNumber(columns[indexes.volume])
      };

      return Object.values(candle).some((value) => value === null || value === "") ? null : candle;
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function loadBundledData() {
  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/${symbol}.csv`, {
          cache: "no-store"
        });
        if (!response.ok) {
          return [symbol, []];
        }
        return [symbol, parseCandlesCsv(await response.text())];
      } catch {
        return [symbol, []];
      }
    })
  );

  return Object.fromEntries(entries);
}

export function getMarketSnapshot() {
  const now = Date.now();

  return symbols.map((symbol, index) => {
    const wave = Math.sin(now / 900000 + index) * 0.018;
    const drift = Math.cos(now / 1300000 + index * 2) * 0.006;
    const price = basePrices[symbol] * (1 + wave + drift);
    const changePercent = (wave + drift) * 100;

    return {
      symbol,
      price: round(price),
      changePercent: round(changePercent),
      volume: Math.floor(950000 + Math.abs(Math.sin(now / 500000 + index)) * 8000000)
    };
  });
}

export function getSignals(market = getMarketSnapshot()) {
  return market.map((quote) => {
    const action = quote.changePercent > 1.2 ? "sell" : quote.changePercent < -1.2 ? "buy" : "hold";
    const confidence = Math.min(94, Math.max(52, Math.round(55 + Math.abs(quote.changePercent) * 18)));

    return {
      symbol: quote.symbol,
      action,
      confidence,
      reason:
        action === "hold"
          ? "Momentum is neutral. No trade recommended."
          : `${action === "buy" ? "Downside" : "Upside"} momentum trigger crossed paper strategy threshold.`
    };
  });
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

function getHistoricalCandlesWithSource(symbol, lookbackDays, minRows, dataBySymbol) {
  const csvCandles = dataBySymbol[symbol] || [];
  if (csvCandles.length >= minRows) {
    return {
      source: "csv",
      candles: csvCandles.slice(-lookbackDays),
      rowsAvailable: csvCandles.length
    };
  }

  return {
    source: "simulated",
    candles: generateSyntheticCandles(symbol, lookbackDays),
    rowsAvailable: lookbackDays
  };
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

function exponentialMovingAverage(values, period) {
  const output = [];
  const multiplier = 2 / (period + 1);
  let ema = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    ema = ema === null ? value : value * multiplier + ema * (1 - multiplier);
    output.push(ema);
  }

  return output;
}

function relativeStrengthIndex(candles, period = 14) {
  const output = Array(candles.length).fill(null);
  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index < candles.length; index += 1) {
    const change = candles[index].close - candles[index - 1].close;
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);

    if (index <= period) {
      averageGain += gain;
      averageLoss += loss;

      if (index === period) {
        averageGain /= period;
        averageLoss /= period;
        output[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
      }
      continue;
    }

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    output[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return output;
}

function buildStrategySignals(candles, strategyId, { shortWindow, longWindow }) {
  const closes = candles.map((candle) => candle.close);
  const signals = Array(candles.length).fill("hold");

  if (strategyId === "buy-hold") {
    if (candles.length) {
      signals[0] = "buy";
      signals[candles.length - 1] = "sell";
    }
    return signals;
  }

  if (strategyId === "rsi-reversion") {
    const rsi = relativeStrengthIndex(candles, 14);
    for (let index = 1; index < candles.length; index += 1) {
      if (rsi[index - 1] !== null && rsi[index] !== null) {
        if (rsi[index - 1] >= 30 && rsi[index] < 30) {
          signals[index] = "buy";
        } else if (rsi[index - 1] <= 60 && rsi[index] > 60) {
          signals[index] = "sell";
        }
      }
    }
    return signals;
  }

  if (strategyId === "macd-trend") {
    const ema12 = exponentialMovingAverage(closes, 12);
    const ema26 = exponentialMovingAverage(closes, 26);
    const macd = ema12.map((value, index) => value - ema26[index]);
    const signal = exponentialMovingAverage(macd, 9);

    for (let index = 1; index < candles.length; index += 1) {
      if (macd[index - 1] <= signal[index - 1] && macd[index] > signal[index]) {
        signals[index] = "buy";
      } else if (macd[index - 1] >= signal[index - 1] && macd[index] < signal[index]) {
        signals[index] = "sell";
      }
    }
    return signals;
  }

  for (let index = 1; index < candles.length; index += 1) {
    const shortAverage = movingAverage(candles, index, shortWindow);
    const longAverage = movingAverage(candles, index, longWindow);
    const previousShort = movingAverage(candles, index - 1, shortWindow);
    const previousLong = movingAverage(candles, index - 1, longWindow);

    if (shortAverage && longAverage && previousShort && previousLong) {
      if (previousShort <= previousLong && shortAverage > longAverage) {
        signals[index] = "buy";
      } else if (previousShort >= previousLong && shortAverage < longAverage) {
        signals[index] = "sell";
      }
    }
  }

  return signals;
}

function strategyReason(strategyId, signal, { shortWindow, longWindow }) {
  if (strategyId === "buy-hold") {
    return signal === "buy" ? "Opened benchmark position." : "Closed benchmark position.";
  }
  if (strategyId === "rsi-reversion") {
    return signal === "buy" ? "RSI crossed into oversold territory." : "RSI recovered above exit threshold.";
  }
  if (strategyId === "macd-trend") {
    return signal === "buy" ? "MACD crossed above signal line." : "MACD crossed below signal line.";
  }
  return signal === "buy"
    ? `${shortWindow}-day average crossed above ${longWindow}-day average`
    : `${shortWindow}-day average crossed below ${longWindow}-day average`;
}

function averageVolume(candles, endIndex, window = 20) {
  if (endIndex + 1 < window) {
    return null;
  }

  let total = 0;
  for (let index = endIndex - window + 1; index <= endIndex; index += 1) {
    total += candles[index].volume;
  }
  return total / window;
}

function detectSetupPattern(candles, index, { shortWindow, longWindow }) {
  const candle = candles[index];
  const shortAverage = movingAverage(candles, index, shortWindow);
  const longAverage = movingAverage(candles, index, longWindow);
  const previousLongAverage = movingAverage(candles, index - 3, longWindow);
  const recentWindow = candles.slice(Math.max(0, index - 20), index);
  const recentHigh = recentWindow.length ? Math.max(...recentWindow.map((item) => item.high)) : null;
  const recentLow = recentWindow.length ? Math.min(...recentWindow.map((item) => item.low)) : null;
  const volumeAverage = averageVolume(candles, index, 20);
  const trendUp =
    shortAverage &&
    longAverage &&
    previousLongAverage &&
    shortAverage > longAverage &&
    longAverage >= previousLongAverage;
  const breakout = Boolean(recentHigh && candle.close > recentHigh);
  const higherLow = Boolean(recentLow && candle.low > recentLow * 1.01);
  const volumeConfirm = Boolean(volumeAverage && candle.volume >= volumeAverage * 1.08);

  if (trendUp && breakout && higherLow && volumeConfirm) {
    return {
      id: "bullish-breakout",
      confirmed: true,
      label: "Bullish breakout with trend, higher low, and volume confirmation"
    };
  }

  if (trendUp && higherLow) {
    return {
      id: "moderate-bullish",
      confirmed: false,
      label: "Moderate bullish trend with higher-low structure"
    };
  }

  return {
    id: "unconfirmed",
    confirmed: false,
    label: "No confirmed bullish pattern"
  };
}

function resolveRiskProfile(profileId, pattern) {
  const requestedProfile = riskProfiles.some((profile) => profile.id === profileId)
    ? profileId
    : "moderate-bullish";

  if (requestedProfile === "pattern-confirmed" && !pattern.confirmed) {
    return riskProfiles.find((profile) => profile.id === "moderate-bullish");
  }

  return riskProfiles.find((profile) => profile.id === requestedProfile);
}

export function runBacktest(options = {}, dataBySymbol = {}) {
  const symbol = symbols.includes(String(options.symbol || "").toUpperCase())
    ? String(options.symbol).toUpperCase()
    : "SPY";
  const startingCash = clampNumber(options.startingCash, 100000, 1000, 10000000);
  const shortWindow = Math.floor(clampNumber(options.shortWindow, 20, 3, 100));
  const longWindow = Math.floor(clampNumber(options.longWindow, 50, shortWindow + 1, 220));
  const lookbackDays = Math.floor(clampNumber(options.lookbackDays, 260, longWindow + 30, 900));
  const riskPercent = clampNumber(options.riskPercent, 0.25, 0.05, 1);
  const slippagePercent = clampNumber(options.slippagePercent, 0.05, 0, 5);
  const commission = clampNumber(options.commission, 0, 0, 100);
  const targetProfitPercent = clampNumber(options.targetProfitPercent, 2, 0.25, 20);
  const stopLossPercent = clampNumber(options.stopLossPercent, 2, 0.25, 20);
  const takeProfitPercent = clampNumber(options.takeProfitPercent, 3, 0.25, 30);
  const trailingStopPercent = clampNumber(options.trailingStopPercent, 1.25, 0, 20);
  const profitLockPercent = clampNumber(options.profitLockPercent, 1, 0, 20);
  const protectedProfitGivebackPercent = clampNumber(options.protectedProfitGivebackPercent, 1, 0.25, 20);
  const maxConsecutiveLosses = Math.floor(clampNumber(options.maxConsecutiveLosses, 3, 1, 20));
  const maxConsecutiveWins = Math.floor(clampNumber(options.maxConsecutiveWins, 4, 1, 20));
  const riskProfileId = riskProfiles.some((profile) => profile.id === options.riskProfile)
    ? options.riskProfile
    : "moderate-bullish";
  const strategyId = strategies.some((strategy) => strategy.id === options.strategy)
    ? options.strategy
    : "ma-crossover";
  const minRows = strategyId === "macd-trend" ? 40 : strategyId === "rsi-reversion" ? 20 : longWindow + 2;
  const data = getHistoricalCandlesWithSource(symbol, lookbackDays, minRows, dataBySymbol);
  const candles = data.candles;
  const strategySignals = buildStrategySignals(candles, strategyId, { shortWindow, longWindow });
  const trades = [];
  const equityCurve = [];
  let cash = startingCash;
  let shares = 0;
  let entryPrice = 0;
  let entryCost = 0;
  let highestSinceEntry = 0;
  let peakEquity = startingCash;
  let sessionPeakEquity = startingCash;
  let consecutiveLosses = 0;
  let consecutiveWins = 0;
  let protectedHalts = 0;
  let stopLossExits = 0;
  let takeProfitExits = 0;
  let trailingStopExits = 0;
  let patternConfirmedEntries = 0;
  let halted = false;
  let haltReason = "";

  function closePosition(candle, rawFillPrice, reason, exitType) {
    const fillPrice = rawFillPrice * (1 - slippagePercent / 100);
    const gross = shares * fillPrice;
    const proceeds = gross - commission;
    const pnl = (fillPrice - entryPrice) * shares - commission;
    const returnPercent = entryCost ? (pnl / entryCost) * 100 : 0;
    cash += proceeds;
    trades.push({
      date: candle.date,
      side: "sell",
      quantity: shares,
      price: round(fillPrice),
      gross: round(gross),
      commission: round(commission),
      netCash: round(proceeds),
      pnl: round(pnl),
      returnPercent: round(returnPercent, 2),
      exitType,
      reason
    });

    if (pnl > 0) {
      consecutiveWins += 1;
      consecutiveLosses = 0;
    } else {
      consecutiveLosses += 1;
      consecutiveWins = 0;
    }

    if (exitType === "stop-loss") {
      stopLossExits += 1;
    } else if (exitType === "take-profit") {
      takeProfitExits += 1;
    } else if (exitType === "trailing-stop") {
      trailingStopExits += 1;
    }

    shares = 0;
    entryPrice = 0;
    entryCost = 0;
    highestSinceEntry = 0;

    if (consecutiveLosses >= maxConsecutiveLosses) {
      halted = true;
      haltReason = `${consecutiveLosses} losses in a row`;
      protectedHalts += 1;
    } else if (consecutiveWins >= maxConsecutiveWins && cash >= startingCash * (1 + profitLockPercent / 100)) {
      halted = true;
      haltReason = `${consecutiveWins} wins in a row; profit protected`;
      protectedHalts += 1;
    }
  }

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const equity = cash + shares * candle.close;
    const signal = strategySignals[index];
    sessionPeakEquity = Math.max(sessionPeakEquity, equity);

    if (
      !halted &&
      shares === 0 &&
      equity >= startingCash * (1 + profitLockPercent / 100) &&
      ((sessionPeakEquity - equity) / sessionPeakEquity) * 100 >= protectedProfitGivebackPercent
    ) {
      halted = true;
      haltReason = "protected profit giveback limit reached";
      protectedHalts += 1;
    }

    if (shares > 0) {
      highestSinceEntry = Math.max(highestSinceEntry, candle.high);
      const stopPrice = entryPrice * (1 - stopLossPercent / 100);
      const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
      const trailingStopPrice =
        trailingStopPercent > 0 ? highestSinceEntry * (1 - trailingStopPercent / 100) : 0;

      if (candle.low <= stopPrice) {
        closePosition(candle, stopPrice, "Stop loss protected capital.", "stop-loss");
      } else if (candle.high >= takeProfitPrice) {
        closePosition(candle, takeProfitPrice, "Take profit captured target.", "take-profit");
      } else if (trailingStopPrice > entryPrice && candle.low <= trailingStopPrice) {
        closePosition(candle, trailingStopPrice, "Trailing stop protected open profit.", "trailing-stop");
      }
    }

    if (!halted && signal === "buy" && shares === 0) {
      const pattern = detectSetupPattern(candles, index, { shortWindow, longWindow });
      const profile = resolveRiskProfile(riskProfileId, pattern);
      const effectiveRiskPercent = Math.min(riskPercent, profile.maxRiskPercent);

      if (riskProfileId === "pattern-confirmed" && !pattern.confirmed) {
        continue;
      }

      const fillPrice = candle.close * (1 + slippagePercent / 100);
      const quantity = Math.floor((equity * effectiveRiskPercent - commission) / fillPrice);
      if (quantity > 0) {
        const gross = quantity * fillPrice;
        const totalCost = gross + commission;
        shares = quantity;
        entryPrice = fillPrice;
        entryCost = totalCost;
        highestSinceEntry = fillPrice;
        if (pattern.confirmed) {
          patternConfirmedEntries += 1;
        }
        cash -= totalCost;
        trades.push({
          date: candle.date,
          side: "buy",
          quantity,
          price: round(fillPrice),
          gross: round(gross),
          commission: round(commission),
          netCash: round(-totalCost),
          pattern: pattern.label,
          riskProfile: profile.name,
          effectiveRiskPercent: round(effectiveRiskPercent * 100, 2),
          reason: `${strategyReason(strategyId, "buy", { shortWindow, longWindow })}. ${pattern.label}.`
        });
      }
    }

    if (signal === "sell" && shares > 0) {
      closePosition(
        candle,
        candle.close,
        strategyReason(strategyId, "sell", { shortWindow, longWindow }),
        "signal"
      );
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
    closePosition(lastCandle, lastCandle.close, "Closed open position at end of backtest", "end");
    equityCurve[equityCurve.length - 1].equity = round(cash);
  }

  const sellTrades = trades.filter((trade) => trade.side === "sell");
  const winningTrades = sellTrades.filter((trade) => trade.pnl > 0);
  const grossProfit = sellTrades
    .filter((trade) => trade.pnl > 0)
    .reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(
    sellTrades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0)
  );
  const averageTradeReturnPercent = sellTrades.length
    ? sellTrades.reduce((sum, trade) => sum + (trade.returnPercent || 0), 0) / sellTrades.length
    : 0;
  const targetHitRatePercent = sellTrades.length
    ? (sellTrades.filter((trade) => (trade.returnPercent || 0) >= targetProfitPercent).length /
        sellTrades.length) *
      100
    : 0;
  const finalEquity = equityCurve.at(-1)?.equity || startingCash;

  return {
    config: {
      symbol,
      startingCash,
      shortWindow,
      longWindow,
      lookbackDays,
      riskPercent,
      slippagePercent,
      commission,
      targetProfitPercent,
      stopLossPercent,
      takeProfitPercent,
      trailingStopPercent,
      profitLockPercent,
      protectedProfitGivebackPercent,
      maxConsecutiveLosses,
      maxConsecutiveWins,
      riskProfile: riskProfileId,
      strategy: strategyId
    },
    data: {
      source: data.source,
      rowsAvailable: data.rowsAvailable,
      rowsUsed: candles.length,
      firstDate: candles[0]?.date || null,
      lastDate: candles.at(-1)?.date || null
    },
    summary: {
      startingCash: round(startingCash),
      finalEquity: round(finalEquity),
      totalReturn: round(finalEquity - startingCash),
      returnPercent: round(((finalEquity - startingCash) / startingCash) * 100, 2),
      maxDrawdownPercent: round(calculateMaxDrawdown(equityCurve) * 100, 2),
      totalTrades: trades.length,
      completedTrades: sellTrades.length,
      winRatePercent: sellTrades.length ? round((winningTrades.length / sellTrades.length) * 100, 2) : 0,
      averageTradeReturnPercent: round(averageTradeReturnPercent, 2),
      targetHitRatePercent: round(targetHitRatePercent, 2),
      profitFactor: round(grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0, 2),
      stopLossExits,
      takeProfitExits,
      trailingStopExits,
      protectedHalts,
      patternConfirmedEntries,
      halted,
      haltReason
    },
    candles: candles.slice(-90),
    equityCurve: equityCurve.slice(-160),
    trades: trades.slice(-30).reverse()
  };
}

function classifySetup({ shortAverage, longAverage, price, returnPercent, maxDrawdownPercent, strategyId }) {
  const trendSpread = ((shortAverage - longAverage) / longAverage) * 100;
  const priceStrength = ((price - longAverage) / longAverage) * 100;
  const strategyBoost = strategyId === "buy-hold" ? -8 : strategyId === "rsi-reversion" ? 2 : 0;
  const score = Math.round(
    50 + trendSpread * 8 + returnPercent * 1.8 + priceStrength * 1.2 - maxDrawdownPercent * 1.4 + strategyBoost
  );

  if (score >= 68 && trendSpread > 0 && priceStrength > 0) {
    return { action: "buy", score: Math.min(99, score), reason: "Trend, price, and backtest are aligned." };
  }

  if (score <= 42 || trendSpread < -0.4) {
    return { action: "sell", score: Math.max(1, score), reason: "Trend quality is weak or deteriorating." };
  }

  return { action: "hold", score: Math.min(99, Math.max(1, score)), reason: "Setup is mixed. Wait for confirmation." };
}

export function scanMarket(options = {}, dataBySymbol = {}, market = getMarketSnapshot()) {
  const shortWindow = Number(options.shortWindow || 20);
  const longWindow = Number(options.longWindow || 50);
  const lookbackDays = Number(options.lookbackDays || 260);
  const riskPercent = Number(options.riskPercent || 0.25);
  const slippagePercent = Number(options.slippagePercent || 0.05);
  const commission = Number(options.commission || 0);
  const targetProfitPercent = Number(options.targetProfitPercent || 2);
  const stopLossPercent = Number(options.stopLossPercent || 2);
  const takeProfitPercent = Number(options.takeProfitPercent || 3);
  const trailingStopPercent = Number(options.trailingStopPercent || 1.25);
  const profitLockPercent = Number(options.profitLockPercent || 1);
  const protectedProfitGivebackPercent = Number(options.protectedProfitGivebackPercent || 1);
  const maxConsecutiveLosses = Number(options.maxConsecutiveLosses || 3);
  const maxConsecutiveWins = Number(options.maxConsecutiveWins || 4);
  const riskProfile = options.riskProfile || "moderate-bullish";
  const strategyId = strategies.some((strategy) => strategy.id === options.strategy)
    ? options.strategy
    : "ma-crossover";
  const minRows = strategyId === "macd-trend" ? 40 : strategyId === "rsi-reversion" ? 20 : longWindow + 5;

  const results = symbols
    .map((symbol) => {
      const backtest = runBacktest(
        {
          symbol,
          shortWindow,
          longWindow,
          lookbackDays,
          riskPercent,
          slippagePercent,
          commission,
          targetProfitPercent,
          stopLossPercent,
          takeProfitPercent,
          trailingStopPercent,
          profitLockPercent,
          protectedProfitGivebackPercent,
          maxConsecutiveLosses,
          maxConsecutiveWins,
          riskProfile,
          strategy: strategyId
        },
        dataBySymbol
      );
      const data = getHistoricalCandlesWithSource(
        symbol,
        Math.max(lookbackDays, longWindow + 5),
        minRows,
        dataBySymbol
      );
      const candles = data.candles;
      const lastIndex = candles.length - 1;
      const quote = market.find((item) => item.symbol === symbol);
      const shortAverage = movingAverage(candles, lastIndex, shortWindow);
      const longAverage = movingAverage(candles, lastIndex, longWindow);
      const intelligence = assessMarketIntelligence(candles, quote);
      const setup = classifySetup({
        shortAverage,
        longAverage,
        price: candles[lastIndex].close,
        returnPercent: backtest.summary.returnPercent,
        maxDrawdownPercent: backtest.summary.maxDrawdownPercent,
        strategyId
      });
      const preliminaryScore = Math.min(99, Math.max(1, setup.score + intelligence.scoreAdjustment));
      const action =
        intelligence.liquidityGrade === "avoid" || intelligence.volatilityRegime === "extreme"
          ? "hold"
          : setup.action;
      const adjustedScore =
        action === "hold" ? Math.min(preliminaryScore, setup.action === "hold" ? 67 : 55) : preliminaryScore;
      const reason =
        action !== setup.action
          ? `${setup.reason} Risk gate forced HOLD due to ${intelligence.liquidityGrade} liquidity / ${intelligence.volatilityRegime} volatility.`
          : setup.reason;

      return {
        symbol,
        action,
        score: adjustedScore,
        rawScore: setup.score,
        reason,
        price: quote?.price || candles[lastIndex].close,
        changePercent: quote?.changePercent || 0,
        backtestReturnPercent: backtest.summary.returnPercent,
        maxDrawdownPercent: backtest.summary.maxDrawdownPercent,
        winRatePercent: backtest.summary.winRatePercent,
        averageTradeReturnPercent: backtest.summary.averageTradeReturnPercent,
        targetHitRatePercent: backtest.summary.targetHitRatePercent,
        stopLossExits: backtest.summary.stopLossExits,
        protectedHalts: backtest.summary.protectedHalts,
        patternConfirmedEntries: backtest.summary.patternConfirmedEntries,
        intelligence,
        dataSource: data.source,
        strategy: strategyId,
        shortAverage: round(shortAverage),
        longAverage: round(longAverage),
        suggestedQuantity: Math.max(
          1,
          Math.floor(
            (100000 * riskPercent * Math.max(0.35, intelligence.volatilityScore / 100)) /
              (quote?.price || candles[lastIndex].close)
          )
        )
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date().toISOString(),
    config: {
      shortWindow,
      longWindow,
      lookbackDays,
      riskPercent,
      slippagePercent,
      commission,
      targetProfitPercent,
      stopLossPercent,
      takeProfitPercent,
      trailingStopPercent,
      profitLockPercent,
      protectedProfitGivebackPercent,
      maxConsecutiveLosses,
      maxConsecutiveWins,
      riskProfile
    },
    results
  };
}

export function getDataStatus(dataBySymbol = {}) {
  return symbols.map((symbol) => {
    const candles = dataBySymbol[symbol] || [];
    return {
      symbol,
      source: candles.length ? "csv" : "simulated",
      rows: candles.length,
      firstDate: candles[0]?.date || null,
      lastDate: candles.at(-1)?.date || null
    };
  });
}

export function evaluateDiscipline(result, rules = {}) {
  const minProfitPercent = clampNumber(rules.minProfitPercent, 1, 0, 20);
  const maxProfitPercent = clampNumber(rules.maxProfitPercent, 3, minProfitPercent, 50);
  const maxDrawdownPercent = clampNumber(rules.maxDrawdownPercent, 5, 0.25, 80);
  const minWinRatePercent = clampNumber(rules.minWinRatePercent, 45, 0, 100);
  const minTrades = Math.floor(clampNumber(rules.minTrades, 2, 1, 100));
  const summary = result?.summary || {};
  const averageTradeReturnPercent = Number(summary.averageTradeReturnPercent || 0);
  const completedTrades = Number(summary.completedTrades || 0);
  const checks = [
    {
      id: "profit-target",
      label: "Average completed trade is inside the 1-3% target zone",
      passed:
        averageTradeReturnPercent >= minProfitPercent &&
        averageTradeReturnPercent <= maxProfitPercent
    },
    {
      id: "drawdown",
      label: "Drawdown stays under the risk limit",
      passed: Number(summary.maxDrawdownPercent || 0) <= maxDrawdownPercent
    },
    {
      id: "win-rate",
      label: "Win rate clears the minimum quality bar",
      passed: Number(summary.winRatePercent || 0) >= minWinRatePercent
    },
    {
      id: "sample-size",
      label: "Enough completed trades to count this run",
      passed: completedTrades >= minTrades
    },
    {
      id: "profit-factor",
      label: "Winning dollars are larger than losing dollars",
      passed: Number(summary.profitFactor || 0) >= 1
    },
    {
      id: "protection",
      label: "Protection rules are active for stops, profit locks, and streak limits",
      passed:
        Number.isFinite(result?.config?.stopLossPercent) &&
        Number.isFinite(result?.config?.takeProfitPercent) &&
        Number.isFinite(result?.config?.maxConsecutiveLosses)
    },
    {
      id: "risk-profile",
      label: "Risk profile avoids aggressive sizing unless a pattern is confirmed",
      passed:
        result?.config?.riskProfile !== "pattern-confirmed" ||
        Number(summary.patternConfirmedEntries || 0) > 0 ||
        Number(summary.completedTrades || 0) === 0
    }
  ];
  const score = Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);

  return {
    score,
    verdict: score >= 80 ? "qualified" : score >= 60 ? "watch" : "collecting",
    checks,
    rules: {
      minProfitPercent,
      maxProfitPercent,
      maxDrawdownPercent,
      minWinRatePercent,
      minTrades
    }
  };
}

export function analyzeLearningJournal(runs = []) {
  const validRuns = Array.isArray(runs) ? runs : [];
  const qualifiedRuns = validRuns.filter((run) => run.evaluation?.verdict === "qualified");
  const averageScore = validRuns.length
    ? validRuns.reduce((sum, run) => sum + Number(run.evaluation?.score || 0), 0) / validRuns.length
    : 0;
  const strategyScores = validRuns.reduce((map, run) => {
    const key = run.strategy || "unknown";
    const current = map.get(key) || { strategy: key, score: 0, runs: 0 };
    current.score += Number(run.evaluation?.score || 0);
    current.runs += 1;
    map.set(key, current);
    return map;
  }, new Map());
  const bestStrategy = [...strategyScores.values()]
    .map((item) => ({ ...item, averageScore: round(item.score / item.runs, 1) }))
    .sort((a, b) => b.averageScore - a.averageScore)[0] || null;

  return {
    totalRuns: validRuns.length,
    qualifiedRuns: qualifiedRuns.length,
    averageScore: round(averageScore, 1),
    bestStrategy,
    lastRun: validRuns[0] || null,
    evidenceLevel:
      validRuns.length >= 20 && qualifiedRuns.length >= 10
        ? "strong"
        : validRuns.length >= 10 && qualifiedRuns.length >= 4
          ? "building"
          : "early"
  };
}

function daysSinceDate(dateString) {
  if (!dateString) {
    return Infinity;
  }

  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return Infinity;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / DAY_MS));
}

export function evaluateReadiness({
  backtest,
  currentEvaluation,
  dataStatus = [],
  learningSummary,
  portfolio
} = {}) {
  const newestDataDate = dataStatus
    .map((item) => item.lastDate)
    .filter(Boolean)
    .sort()
    .at(-1);
  const dataAgeDays = daysSinceDate(newestDataDate);
  const summary = backtest?.summary || {};
  const config = backtest?.config || {};
  const checks = [
    {
      id: "real-data",
      label: "All watchlist symbols use CSV data",
      passed: dataStatus.length === symbols.length && dataStatus.every((item) => item.source === "csv")
    },
    {
      id: "fresh-data",
      label: "Market data is fresh enough for paper-test decisions",
      passed: dataAgeDays <= 7,
      detail: Number.isFinite(dataAgeDays) ? `${dataAgeDays} days old` : "missing dates"
    },
    {
      id: "costs",
      label: "Slippage and commission assumptions are included",
      passed: Number.isFinite(config.slippagePercent) && Number.isFinite(config.commission)
    },
    {
      id: "protective-exits",
      label: "Stop loss, take profit, trailing stop, and streak stops are configured",
      passed:
        Number(config.stopLossPercent) > 0 &&
        Number(config.takeProfitPercent) > 0 &&
        Number(config.maxConsecutiveLosses) > 0 &&
        Number(config.maxConsecutiveWins) > 0
    },
    {
      id: "discipline",
      label: "Current setup passes discipline score",
      passed: Number(currentEvaluation?.score || 0) >= 80
    },
    {
      id: "journal-evidence",
      label: "Learning journal has enough qualified repeated runs",
      passed: Number(learningSummary?.qualifiedRuns || 0) >= 5 && Number(learningSummary?.totalRuns || 0) >= 10,
      detail: `${learningSummary?.qualifiedRuns || 0}/${learningSummary?.totalRuns || 0} qualified`
    },
    {
      id: "risk-profile",
      label: "Risk profile is not aggressive without pattern evidence",
      passed:
        config.riskProfile !== "pattern-confirmed" ||
        Number(summary.patternConfirmedEntries || 0) > 0 ||
        Number(summary.completedTrades || 0) === 0
    },
    {
      id: "paper-only",
      label: "Portfolio remains paper-only with no real-money broker attached",
      passed: portfolio?.mode === "static paper"
    },
    {
      id: "backtest-engine",
      label: "Dedicated local/pro backtesting engine is connected",
      passed: false,
      detail: "missing"
    },
    {
      id: "broker-paper",
      label: "Broker paper-trading account is connected",
      passed: false,
      detail: "missing"
    }
  ];
  const passedChecks = checks.filter((check) => check.passed).length;
  const score = Math.round((passedChecks / checks.length) * 100);

  return {
    score,
    status: score >= 85 ? "ready" : score >= 65 ? "almost" : "not ready",
    checks,
    passedChecks,
    totalChecks: checks.length,
    newestDataDate,
    dataAgeDays
  };
}

export function createInitialPortfolio() {
  return {
    cash: 100000,
    startingCash: 100000,
    realizedPnl: 0,
    trades: [],
    positions: {}
  };
}

export function buildPortfolio(state, market) {
  const positions = Object.entries(state.positions).map(([symbol, position]) => {
    const quote = market.find((item) => item.symbol === symbol);
    const marketValue = quote ? quote.price * position.quantity : 0;
    const unrealizedPnl = marketValue - position.averagePrice * position.quantity;

    return {
      symbol,
      quantity: position.quantity,
      averagePrice: round(position.averagePrice),
      marketPrice: quote?.price ?? null,
      marketValue: round(marketValue),
      unrealizedPnl: round(unrealizedPnl)
    };
  });

  const exposure = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const equity = state.cash + exposure;

  return {
    mode: "static paper",
    cash: round(state.cash),
    equity: round(equity),
    startingCash: state.startingCash,
    realizedPnl: round(state.realizedPnl),
    totalReturn: round(equity - state.startingCash),
    totalReturnPercent: round(((equity - state.startingCash) / state.startingCash) * 100),
    exposure: round(exposure),
    exposurePercent: equity ? round((exposure / equity) * 100) : 0,
    positions,
    trades: state.trades.slice(-20).reverse()
  };
}

export function placePaperTrade(state, market, order) {
  const symbol = String(order.symbol || "").trim().toUpperCase();
  const side = String(order.side || "").trim().toLowerCase();
  const quantity = Number(order.quantity);
  const quote = market.find((item) => item.symbol === symbol);

  if (!symbols.includes(symbol) || !quote) {
    throw new Error(`Unsupported symbol: ${symbol}.`);
  }

  if (!["buy", "sell"].includes(side)) {
    throw new Error("Side must be buy or sell.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  const next =
    typeof structuredClone === "function"
      ? structuredClone(state)
      : JSON.parse(JSON.stringify(state));
  const gross = quote.price * quantity;
  const position = next.positions[symbol] || { quantity: 0, averagePrice: 0 };
  let realizedPnl = 0;

  if (side === "buy") {
    if (gross > next.cash) {
      throw new Error("Insufficient paper cash.");
    }

    const totalCost = position.averagePrice * position.quantity + gross;
    position.quantity += quantity;
    position.averagePrice = totalCost / position.quantity;
    next.cash -= gross;
    next.positions[symbol] = position;
  } else {
    if (position.quantity < quantity) {
      throw new Error("Cannot sell more shares than the paper portfolio holds.");
    }

    realizedPnl = (quote.price - position.averagePrice) * quantity;
    next.realizedPnl += realizedPnl;
    position.quantity -= quantity;
    next.cash += gross;

    if (position.quantity === 0) {
      delete next.positions[symbol];
    } else {
      next.positions[symbol] = position;
    }
  }

  next.trades.push({
    id:
      crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    symbol,
    side,
    quantity,
    price: quote.price,
    gross: round(gross),
    realizedPnl: round(realizedPnl),
    createdAt: new Date().toISOString()
  });

  return next;
}
