import { assessMarketIntelligence, tradingKnowledge } from "./knowledge.js";

export { tradingKnowledge };

const DAY_MS = 24 * 60 * 60 * 1000;

export const symbols = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMD",
  "SMH",
  "SOXX",
  "TSLA",
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "TLT",
  "GLD",
  "MES",
  "MNQ",
  "M2K",
  "MYM",
  "MGC",
  "MBT"
];

export const assetCatalog = {
  stocks: ["AAPL", "MSFT", "NVDA", "AMD", "TSLA"],
  etfs: ["SPY", "QQQ", "IWM", "DIA", "TLT", "GLD", "SMH", "SOXX"],
  aiChips: ["NVDA", "AMD", "SMH", "SOXX"],
  optionsUnderlyings: ["SPY", "QQQ", "AAPL", "NVDA", "AMD", "TSLA"],
  futures: ["MES", "MNQ", "M2K", "MYM", "MGC", "MBT"]
};

export const futuresCatalog = {
  MES: { name: "Micro E-mini S&P 500", tickValue: 1.25, pointValue: 5, marginEstimate: 120 },
  MNQ: { name: "Micro E-mini Nasdaq-100", tickValue: 0.5, pointValue: 2, marginEstimate: 150 },
  M2K: { name: "Micro E-mini Russell 2000", tickValue: 0.5, pointValue: 5, marginEstimate: 90 },
  MYM: { name: "Micro E-mini Dow", tickValue: 0.5, pointValue: 0.5, marginEstimate: 80 },
  MGC: { name: "Micro Gold", tickValue: 1, pointValue: 10, marginEstimate: 130 },
  MBT: { name: "Micro Bitcoin", tickValue: 0.5, pointValue: 0.1, marginEstimate: 250 }
};

export const strategies = [
  { id: "ma-crossover", name: "MA Crossover" },
  { id: "rsi-reversion", name: "RSI Reversion" },
  { id: "macd-trend", name: "MACD Trend" },
  { id: "buy-hold", name: "Buy & Hold" }
];

export const riskProfiles = [
  { id: "capital-guard", name: "Capital Guard", maxRiskPercent: 0.12 },
  { id: "moderate", name: "Moderate", maxRiskPercent: 0.16 },
  { id: "bullish", name: "Bullish", maxRiskPercent: 0.24 },
  { id: "moderate-bullish", name: "Moderate Bullish", maxRiskPercent: 0.2 },
  { id: "pattern-confirmed", name: "Pattern Confirmed", maxRiskPercent: 0.3 }
];

const basePrices = {
  AAPL: 212.45,
  MSFT: 426.8,
  NVDA: 118.72,
  AMD: 166.4,
  SMH: 274.25,
  SOXX: 516.2,
  TSLA: 231.6,
  SPY: 552.38,
  QQQ: 472.19,
  IWM: 218.44,
  DIA: 404.12,
  TLT: 92.36,
  GLD: 229.75,
  MES: 5525,
  MNQ: 19680,
  M2K: 2185,
  MYM: 40410,
  MGC: 2315,
  MBT: 114000
};

const profiles = {
  AAPL: { start: 184, trend: 0.00058, cycle: 0.025, noise: 0.013 },
  MSFT: { start: 390, trend: 0.00042, cycle: 0.018, noise: 0.01 },
  NVDA: { start: 91, trend: 0.0012, cycle: 0.04, noise: 0.022 },
  AMD: { start: 122, trend: 0.00105, cycle: 0.052, noise: 0.026 },
  SMH: { start: 210, trend: 0.00078, cycle: 0.035, noise: 0.018 },
  SOXX: { start: 430, trend: 0.00074, cycle: 0.038, noise: 0.019 },
  TSLA: { start: 210, trend: 0.00025, cycle: 0.055, noise: 0.028 },
  SPY: { start: 495, trend: 0.00034, cycle: 0.014, noise: 0.007 },
  QQQ: { start: 425, trend: 0.00048, cycle: 0.02, noise: 0.01 },
  IWM: { start: 202, trend: 0.00028, cycle: 0.022, noise: 0.012 },
  DIA: { start: 384, trend: 0.00022, cycle: 0.013, noise: 0.007 },
  TLT: { start: 96, trend: -0.00005, cycle: 0.018, noise: 0.009 },
  GLD: { start: 205, trend: 0.00031, cycle: 0.017, noise: 0.008 },
  MES: { start: 5200, trend: 0.00034, cycle: 0.014, noise: 0.007 },
  MNQ: { start: 18500, trend: 0.00048, cycle: 0.022, noise: 0.012 },
  M2K: { start: 2050, trend: 0.00028, cycle: 0.024, noise: 0.014 },
  MYM: { start: 38500, trend: 0.00022, cycle: 0.013, noise: 0.007 },
  MGC: { start: 2080, trend: 0.00031, cycle: 0.017, noise: 0.008 },
  MBT: { start: 104000, trend: 0.00065, cycle: 0.06, noise: 0.035 }
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
        const candles = parseCandlesCsv(await response.text());
        candles.dataSource = "csv";
        candles.dataInterval = "daily";
        return [symbol, candles];
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
      source: csvCandles.dataSource || "csv",
      interval: csvCandles.dataInterval || "daily",
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

function averageTrueRange(candles, endIndex, period = 14) {
  if (endIndex <= 0 || candles.length < 2) {
    return null;
  }

  const start = Math.max(1, endIndex - period + 1);
  const ranges = [];

  for (let index = start; index <= endIndex; index += 1) {
    const candle = candles[index];
    const previousClose = candles[index - 1]?.close ?? candle.close;
    ranges.push(
      Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - previousClose),
        Math.abs(candle.low - previousClose)
      )
    );
  }

  if (!ranges.length) {
    return null;
  }

  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
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
    : "moderate";

  if (requestedProfile === "pattern-confirmed" && !pattern.confirmed) {
    return riskProfiles.find((profile) => profile.id === "moderate-bullish");
  }

  return riskProfiles.find((profile) => profile.id === requestedProfile);
}

export function buildOptionsIdeas(scannerResults = [], market = getMarketSnapshot()) {
  return assetCatalog.optionsUnderlyings.map((underlying) => {
    const quote = market.find((item) => item.symbol === underlying);
    const setup = scannerResults.find((result) => result.symbol === underlying);
    const direction = setup?.action === "sell" ? "put" : "call";
    const price = quote?.price || basePrices[underlying];
    const strikeStep = price > 400 ? 5 : price > 100 ? 2.5 : 1;
    const rawStrike = direction === "call" ? price * 1.02 : price * 0.98;
    const strike = round(Math.round(rawStrike / strikeStep) * strikeStep, 2);
    const score = Math.max(1, Math.min(99, Math.round((setup?.score || 50) * 0.7)));
    const premium = estimateOptionPremium({
      underlyingPrice: price,
      strike,
      contractType: direction,
      volatilityScore: setup?.intelligence?.volatilityScore || 60
    });

    return {
      underlying,
      contractType: direction,
      strike,
      expiry: "simulated 30-45 DTE",
      premium,
      notionalCost: round(premium * 100),
      score,
      stance: setup?.action || "hold",
      note:
        setup?.action === "hold"
          ? "Watch only. No simulated options entry until underlying setup improves."
          : "Educational options idea only. Use defined-risk paper sizing before any real options workflow."
    };
  });
}

export function estimateOptionPremium({
  underlyingPrice,
  strike,
  contractType,
  volatilityScore = 60
}) {
  const intrinsic =
    contractType === "call"
      ? Math.max(0, underlyingPrice - strike)
      : Math.max(0, strike - underlyingPrice);
  const volatilityFactor = Math.max(0.012, (100 - volatilityScore) / 2400);
  const timeValue = Math.max(0.35, underlyingPrice * volatilityFactor);
  return round(Math.max(0.25, intrinsic + timeValue), 2);
}

export function getSymbolCategory(symbol) {
  if (assetCatalog.aiChips.includes(symbol)) {
    return "ai-chips";
  }
  if (assetCatalog.futures.includes(symbol)) {
    return "futures";
  }
  if (assetCatalog.etfs.includes(symbol)) {
    return "etfs";
  }
  if (assetCatalog.stocks.includes(symbol)) {
    return "stocks";
  }
  return "other";
}

export function rankAutomationCategories(scannerResults = [], watchlist = symbols) {
  const allowedSymbols = new Set(watchlist.length ? watchlist : symbols);
  const groups = scannerResults
    .filter((result) => allowedSymbols.has(result.symbol))
    .reduce((map, result) => {
      const category = getSymbolCategory(result.symbol);
      const current = map.get(category) || {
        category,
        symbols: [],
        scoreTotal: 0,
        buySignals: 0,
        riskFlags: 0
      };
      current.symbols.push(result.symbol);
      current.scoreTotal += Number(result.score || 0);
      current.buySignals += result.action === "buy" ? 1 : 0;
      current.riskFlags += result.intelligence?.riskFlags?.length || 0;
      map.set(category, current);
      return map;
    }, new Map());

  return [...groups.values()]
    .map((group) => ({
      ...group,
      averageScore: round(group.scoreTotal / group.symbols.length, 1),
      rankScore: round(group.scoreTotal / group.symbols.length + group.buySignals * 8 - group.riskFlags * 4, 1)
    }))
    .sort((a, b) => b.rankScore - a.rankScore);
}

export function selectBestStrategyForSymbol(symbol, baseOptions = {}, dataBySymbol = {}) {
  const results = strategies.map((strategy) => {
    const result = runBacktest(
      {
        ...baseOptions,
        symbol,
        strategy: strategy.id
      },
      dataBySymbol
    );
    const summary = result.summary;
    const completedTrades = Number(summary.completedTrades || 0);
    const score = Math.round(
      50 +
        Number(summary.returnPercent || 0) * 1.7 -
        Number(summary.maxDrawdownPercent || 0) * 2.2 +
        Number(summary.winRatePercent || 0) * 0.25 +
        Math.min(30, Number(summary.profitFactor || 0) * 4) +
        Math.min(10, completedTrades * 1.5) -
        (completedTrades === 0 ? 20 : 0)
    );
    const boundedScore = Math.max(1, Math.min(99, score));

    return {
      strategy,
      result,
      score: boundedScore,
      evidenceGrade: boundedScore >= 75 ? "strong" : boundedScore >= 60 ? "building" : "weak",
      trainingNotes: [
        completedTrades >= 3 ? "sample present" : "small sample",
        Number(summary.profitFactor || 0) >= 1 ? "profit factor clears 1" : "profit factor weak",
        Number(summary.maxDrawdownPercent || 0) <= 5 ? "drawdown controlled" : "drawdown elevated"
      ]
    };
  });

  return results.sort((a, b) => b.score - a.score)[0];
}

export function buildStrategyMap(baseOptions = {}, dataBySymbol = {}, watchlist = symbols) {
  const allowedSymbols = watchlist.length ? watchlist : symbols;
  return Object.fromEntries(
    allowedSymbols.map((symbol) => [symbol, selectBestStrategyForSymbol(symbol, baseOptions, dataBySymbol)])
  );
}

function getTradeAssetType(trade = {}) {
  if (trade.assetType) {
    return trade.assetType;
  }
  if (trade.contractId) {
    return "option";
  }
  return "stock";
}

function createEmptyLearningBucket(id) {
  return {
    id,
    trades: 0,
    wins: 0,
    losses: 0,
    realizedPnl: 0,
    averagePnl: 0,
    winRate: 0,
    scoreAdjustment: 0,
    confidence: "new"
  };
}

function scoreLearningBucket(bucket) {
  if (!bucket.trades) {
    return bucket;
  }

  const winRate = (bucket.wins / bucket.trades) * 100;
  const averagePnl = bucket.realizedPnl / bucket.trades;
  const confidenceMultiplier = Math.min(1, bucket.trades / 8);
  const winRateEdge = (winRate - 50) / 10;
  const pnlEdge = Math.max(-3, Math.min(3, averagePnl / 15));
  const rawAdjustment = (winRateEdge + pnlEdge) * 2.5 * confidenceMultiplier;

  return {
    ...bucket,
    realizedPnl: round(bucket.realizedPnl),
    averagePnl: round(averagePnl),
    winRate: round(winRate, 1),
    scoreAdjustment: round(Math.max(-10, Math.min(10, rawAdjustment)), 1),
    confidence: bucket.trades >= 8 ? "tested" : bucket.trades >= 3 ? "forming" : "new"
  };
}

export function buildPaperLearningMemory(trades = []) {
  const bySymbol = {};
  const byStrategy = {};
  const byAssetType = {};
  const closedTrades = (trades || []).filter((trade) => Number(trade.realizedPnl || 0) !== 0);

  closedTrades.forEach((trade) => {
    const pnl = Number(trade.realizedPnl || 0);
    const symbol = String(trade.symbol || "UNKNOWN").toUpperCase();
    const strategy = trade.strategy || "Manual";
    const assetType = getTradeAssetType(trade);

    [
      [bySymbol, symbol],
      [byStrategy, strategy],
      [byAssetType, assetType]
    ].forEach(([target, key]) => {
      target[key] ||= createEmptyLearningBucket(key);
      target[key].trades += 1;
      target[key].realizedPnl += pnl;
      if (pnl > 0) {
        target[key].wins += 1;
      } else {
        target[key].losses += 1;
      }
    });
  });

  Object.keys(bySymbol).forEach((key) => {
    bySymbol[key] = scoreLearningBucket(bySymbol[key]);
  });
  Object.keys(byStrategy).forEach((key) => {
    byStrategy[key] = scoreLearningBucket(byStrategy[key]);
  });
  Object.keys(byAssetType).forEach((key) => {
    byAssetType[key] = scoreLearningBucket(byAssetType[key]);
  });

  const allBuckets = [...Object.values(bySymbol), ...Object.values(byStrategy), ...Object.values(byAssetType)];
  const strongest = allBuckets.sort((a, b) => b.scoreAdjustment - a.scoreAdjustment)[0] || null;
  const weakest = allBuckets.sort((a, b) => a.scoreAdjustment - b.scoreAdjustment)[0] || null;

  return {
    closedTrades: closedTrades.length,
    bySymbol,
    byStrategy,
    byAssetType,
    strongest,
    weakest,
    summary:
      closedTrades.length < 3
        ? "Learning active: needs more closed paper trades before it strongly changes behavior."
        : strongest?.scoreAdjustment > 0
          ? `Learning active: favoring ${strongest.id} by ${strongest.scoreAdjustment} score points from paper results.`
          : weakest?.scoreAdjustment < 0
            ? `Learning active: reducing ${weakest.id} by ${Math.abs(weakest.scoreAdjustment)} score points from paper losses.`
            : "Learning active: no strong winner or loser yet."
  };
}

function getLearningAdjustment(learningMemory = {}, { symbol, strategy, assetType } = {}) {
  const symbolAdjustment = learningMemory.bySymbol?.[symbol]?.scoreAdjustment || 0;
  const strategyAdjustment = learningMemory.byStrategy?.[strategy]?.scoreAdjustment || 0;
  const assetAdjustment = learningMemory.byAssetType?.[assetType]?.scoreAdjustment || 0;
  return round(symbolAdjustment * 0.5 + strategyAdjustment * 0.35 + assetAdjustment * 0.15, 1);
}

export function evaluateMarketRegime(scannerResults = []) {
  const etfResults = (scannerResults || []).filter((result) => assetCatalog.etfs.includes(result.symbol));
  const bullishEtfs = etfResults.filter((result) => result.action === "buy" && Number(result.score || 0) >= 70);
  const bearishEtfs = etfResults.filter((result) => result.action === "sell");
  const averageScore = etfResults.length
    ? etfResults.reduce((sum, result) => sum + Number(result.score || 0), 0) / etfResults.length
    : 0;
  const extremeVolatility = etfResults.some((result) => result.intelligence?.volatilityRegime === "extreme");
  const highVolatilityCount = etfResults.filter((result) =>
    ["high", "extreme"].includes(result.intelligence?.volatilityRegime)
  ).length;
  const strongestEtf = [...etfResults].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || null;
  let regime = "neutral";
  let tradePermission = "selective";
  let reason = "ETF signals are mixed. Require normal score, liquidity, and volatility confirmation.";

  if (extremeVolatility) {
    regime = "high-volatility";
    tradePermission = "defensive";
    reason = "Extreme ETF volatility detected. New entries require exceptional confirmation.";
  } else if (bullishEtfs.length >= 3 && averageScore >= 74) {
    regime = "trend-up";
    tradePermission = "allowed";
    reason = "Broad ETF trend is positive across multiple indexes.";
  } else if (bearishEtfs.length >= 2 || averageScore < 58) {
    regime = "risk-off";
    tradePermission = "selective";
    reason = "ETF trend is weak or bearish. Avoid weak long entries; only strict downside paper futures/puts or exceptional reversal setups qualify.";
  } else if (highVolatilityCount >= 2) {
    regime = "choppy";
    tradePermission = "selective";
    reason = "Multiple ETFs show elevated volatility. Trade only the strongest liquid ETF.";
  }

  return {
    regime,
    tradePermission,
    reason,
    averageScore: round(averageScore, 1),
    bullishEtfs: bullishEtfs.map((result) => result.symbol),
    bearishEtfs: bearishEtfs.map((result) => result.symbol),
    strongestEtf: strongestEtf
      ? {
          symbol: strongestEtf.symbol,
          score: strongestEtf.score,
          action: strongestEtf.action,
          volatility: strongestEtf.intelligence?.volatilityRegime || "unknown",
          liquidity: strongestEtf.intelligence?.liquidityGrade || "unknown"
        }
      : null
  };
}

export function getAdaptiveRiskSettings(portfolio = {}, mode = "moderate") {
  const equity = Number(portfolio.equity || portfolio.startingCash || 3000);
  const startingCash = Number(portfolio.startingCash || 3000);
  const returnPercent = startingCash ? ((equity - startingCash) / startingCash) * 100 : 0;
  const drawdownFromStartPercent = startingCash ? Math.max(0, ((startingCash - equity) / startingCash) * 100) : 0;
  const isSmallAccount = startingCash <= 1500;
  const baseSingleTradeCashPercent = mode === "bullish" ? 0.14 : 0.1;
  const baseMaxExposurePercent = mode === "bullish" ? 30 : 22;
  let riskMultiplier = 1;

  if (isSmallAccount) {
    riskMultiplier *= 0.68;
  }
  if (returnPercent < 0) {
    riskMultiplier *= 0.55;
  }
  if (drawdownFromStartPercent >= 8) {
    riskMultiplier *= 0.45;
  } else if (drawdownFromStartPercent >= 4) {
    riskMultiplier *= 0.65;
  }
  if (returnPercent >= 6) {
    riskMultiplier *= 1.12;
  } else if (returnPercent >= 3) {
    riskMultiplier *= 1.06;
  }

  return {
    equity: round(equity),
    startingCash: round(startingCash),
    returnPercent: round(returnPercent, 2),
    drawdownFromStartPercent: round(drawdownFromStartPercent, 2),
    riskMultiplier: round(riskMultiplier, 2),
    maxSingleTradeCashPercent: round(baseSingleTradeCashPercent * riskMultiplier, 4),
    maxExposurePercent: round(baseMaxExposurePercent * Math.min(1, riskMultiplier), 2),
    live1000Equivalent: {
      maxSingleTradeDollars: round(1000 * baseSingleTradeCashPercent * riskMultiplier),
      maxTotalExposureDollars: round(1000 * (baseMaxExposurePercent / 100) * Math.min(1, riskMultiplier))
    }
  };
}

function evaluateBullishDiscipline({
  mode,
  adaptiveRisk,
  marketRegime,
  hasRequiredRealData,
  decisionWindow,
  dailyTradeLimit,
  portfolio
} = {}) {
  if (mode !== "bullish") {
    return {
      active: false,
      passed: true,
      label: "Moderate discipline active.",
      failedRules: []
    };
  }

  const failedRules = [];
  const equityGreen = Number(adaptiveRisk?.returnPercent || 0) >= 0;
  const broadTrendUp = marketRegime?.regime === "trend-up" && marketRegime?.tradePermission === "allowed";
  const strongestScore = Number(marketRegime?.strongestEtf?.score || 0);
  const bullishBreadth = Number(marketRegime?.bullishEtfs?.length || 0);
  const exposure = Number(portfolio?.exposurePercent || 0);

  if (!hasRequiredRealData) failedRules.push("real CSV/API ETF data required");
  if (!equityGreen) failedRules.push("account must be green");
  if (!broadTrendUp) failedRules.push("market regime must be trend-up");
  if (strongestScore < 78) failedRules.push("strongest ETF score must be 78+");
  if (bullishBreadth < 2) failedRules.push("at least two core ETFs must be bullish");
  if (exposure > 20) failedRules.push("current exposure must be 20% or lower before adding risk");
  if (Number(decisionWindow?.windowMinutes || 0) < 2) failedRules.push("entry window must be at least 2 minutes");
  if (Number(dailyTradeLimit?.maxTradesPerDay || 0) > 3) failedRules.push("max entries must stay at 3 or lower");

  return {
    active: true,
    passed: failedRules.length === 0,
    label: failedRules.length
      ? `Bullish discipline blocked: ${failedRules.join("; ")}.`
      : "Bullish discipline passed: broad trend, real data, exposure, and score checks confirm risk-on.",
    failedRules,
    required: {
      strongestEtfScore: 78,
      bullishEtfCount: 2,
      maxExposurePercentBeforeEntry: 20,
      minimumDecisionWindowMinutes: 2,
      maxEntriesPerDay: 3
    }
  };
}

function evaluateMarketQuality(scannerResults = [], marketRegime = {}, market = []) {
  const coreSymbols = ["SPY", "QQQ", "DIA", "IWM"];
  const quoteFallbackResults = coreSymbols.map((symbol) => {
    const quote = (market || []).find((item) => item.symbol === symbol);
    if (!quote) return null;
    const changePercent = Number(quote.changePercent || 0);
    const absChange = Math.abs(changePercent);
    return {
      symbol,
      action: changePercent > 0.15 ? "buy" : changePercent < -0.15 ? "sell" : "hold",
      score: round(Math.max(35, Math.min(82, 55 + changePercent * 8))),
      intelligence: {
        liquidityGrade: "deep",
        volatilityRegime: absChange >= 2.5 ? "high" : absChange <= 1 ? "quiet" : "normal",
        riskFlags: absChange >= 3.5 ? ["large intraday index move"] : []
      },
      quoteFallback: true
    };
  });
  const coreResults = coreSymbols
    .map((symbol, index) => scannerResults.find((result) => result.symbol === symbol) || quoteFallbackResults[index])
    .filter(Boolean);

  if (!coreResults.length) {
    return {
      score: 0,
      verdict: "no-trade",
      reason: "No core ETF scanner data is available.",
      details: {}
    };
  }

  const fallbackCount = coreResults.filter((result) => result.quoteFallback).length;
  const averageScore = coreResults.reduce((sum, result) => sum + Number(result.score || 0), 0) / coreResults.length;
  const buyCount = coreResults.filter((result) => result.action === "buy").length;
  const sellCount = coreResults.filter((result) => result.action === "sell").length;
  const deepLiquidityCount = coreResults.filter((result) => result.intelligence?.liquidityGrade === "deep").length;
  const normalVolCount = coreResults.filter((result) =>
    ["quiet", "normal"].includes(result.intelligence?.volatilityRegime)
  ).length;
  const riskFlagCount = coreResults.reduce(
    (sum, result) => sum + Number(result.intelligence?.riskFlags?.length || 0),
    0
  );

  const trendScore = marketRegime?.regime === "trend-up" ? 26 : marketRegime?.regime === "neutral" ? 18 : 8;
  const scoreStrength = Math.min(24, Math.max(0, (averageScore - 45) * 0.8));
  const breadthScore = Math.min(20, buyCount * 7 - sellCount * 5 + 8);
  const liquidityScore = Math.min(15, deepLiquidityCount * 4);
  const volatilityScore = Math.min(15, normalVolCount * 4 - riskFlagCount * 3);
  const score = round(Math.max(0, Math.min(100, trendScore + scoreStrength + breadthScore + liquidityScore + volatilityScore)));
  const verdict = score >= 78 ? "tradeable" : score >= 60 ? "selective" : "no-trade";

  return {
    score,
    verdict,
    reason:
      verdict === "no-trade"
        ? `No Trade Day: market quality is ${score}/100. Breadth, trend, volume, or volatility are not clean enough.`
        : verdict === "selective"
          ? `Selective opportunity market: quality is ${score}/100. Only unusually strong, liquid, risk-capped setups may trade.${fallbackCount ? " Some core ETF scanner data used live-quote fallback." : ""}`
          : `Tradeable market: quality is ${score}/100 with acceptable ETF trend, breadth, liquidity, and volatility.${fallbackCount ? " Some core ETF scanner data used live-quote fallback." : ""}`,
    details: {
      averageScore: round(averageScore, 1),
      buyCount,
      sellCount,
      deepLiquidityCount,
      normalVolCount,
      riskFlagCount,
      fallbackCount
    }
  };
}

function evaluateOptionPermission({
  idea,
  underlyingSetup,
  strategyScore,
  marketQuality,
  hasRequiredRealData,
  portfolio,
  maxTradeCash
} = {}) {
  const reasons = [];
  const score = Number(idea?.score || 0);
  const setupScore = Number(underlyingSetup?.score || 0);
  const premiumCost = Number(idea?.notionalCost || Infinity);
  const marketQualityScore = Number(marketQuality?.score || 0);
  const accountReturn = Number(portfolio?.totalReturn || 0);
  const liquidityGrade = underlyingSetup?.intelligence?.liquidityGrade || "unknown";
  const volatilityRegime = underlyingSetup?.intelligence?.volatilityRegime || "unknown";
  const action = underlyingSetup?.action || "hold";
  const expectedContract = action === "sell" ? "put" : action === "buy" ? "call" : null;
  const directionMatches = expectedContract && idea?.contractType === expectedContract;

  if (!idea) reasons.push("no option idea available");
  if (!hasRequiredRealData) reasons.push("real ETF API/CSV data required");
  if (marketQualityScore < 75) reasons.push("market quality must be 75+ for options");
  if (!directionMatches) reasons.push("call/put direction is not confirmed by underlying signal");
  if (action === "hold") reasons.push("underlying action is hold");
  if (score < 72) reasons.push("option idea score must be 72+");
  if (setupScore < 78) reasons.push("underlying scanner score must be 78+");
  if (Number(strategyScore || 0) < 72) reasons.push("underlying strategy score must be 72+");
  if (liquidityGrade !== "deep") reasons.push("underlying liquidity must be deep");
  if (!["normal", "quiet"].includes(volatilityRegime)) reasons.push("volatility must be normal or quiet");
  if (accountReturn < 10) reasons.push("paper session profit must be at least $10");
  if (premiumCost > Math.max(35, Number(maxTradeCash || 0))) reasons.push("premium cost exceeds allowed paper risk");

  return {
    allowed: reasons.length === 0,
    reasons,
    label: reasons.length
      ? `Options blocked: ${reasons.join("; ")}.`
      : `${String(idea?.contractType || "option").toUpperCase()} permission passed: direction, data, liquidity, volatility, and risk are aligned.`,
    required: {
      marketQuality: 75,
      optionScore: 72,
      underlyingScore: 78,
      strategyScore: 72,
      maxPremiumCost: round(Math.max(35, Number(maxTradeCash || 0)))
    }
  };
}

export function evaluateFuturesPolicy({
  portfolio = {},
  automationLog = [],
  now = new Date(),
  cycleHours = 4,
  maxHoldHours = 8,
  maxDailyLossPercent = 8,
  profitProtectPercent = 2
} = {}) {
  const startingCash = Number(portfolio.startingCash || 3000);
  const totalReturnPercent = Number(portfolio.totalReturnPercent || 0);
  const futuresPnl = (portfolio.futuresPositions || []).reduce(
    (sum, position) => sum + Number(position.unrealizedPnl || 0),
    0
  );
  const futuresPnlPercent = startingCash ? (futuresPnl / startingCash) * 100 : 0;
  const lastFuturesCycle = automationLog.find((entry) =>
    ["buy-future", "sell-future", "futures-eval", "futures-protect"].includes(entry.action)
  );
  const lastCycleTime = lastFuturesCycle ? new Date(lastFuturesCycle.createdAt).getTime() : 0;
  const hoursSinceLastCycle = lastCycleTime
    ? (now.getTime() - lastCycleTime) / (60 * 60 * 1000)
    : Infinity;
  const cycleDue = hoursSinceLastCycle >= cycleHours;
  const hardStop = totalReturnPercent <= -maxDailyLossPercent;
  const protectProfit = totalReturnPercent >= profitProtectPercent && futuresPnlPercent < -0.35;
  const reduceRisk = totalReturnPercent <= -4;
  const oldestOpenHours = (portfolio.futuresPositions || []).reduce((oldest, position) => {
    const openedAt = position.openedAt ? new Date(position.openedAt).getTime() : 0;
    if (!openedAt) {
      return oldest;
    }
    const ageHours = (now.getTime() - openedAt) / (60 * 60 * 1000);
    return Math.max(oldest, ageHours);
  }, 0);
  const maxHoldReached = oldestOpenHours >= maxHoldHours;

  return {
    cycleHours,
    maxHoldHours,
    maxDailyLossPercent,
    profitProtectPercent,
    totalReturnPercent: round(totalReturnPercent, 2),
    futuresPnl: round(futuresPnl),
    futuresPnlPercent: round(futuresPnlPercent, 2),
    hoursSinceLastCycle: Number.isFinite(hoursSinceLastCycle) ? round(hoursSinceLastCycle, 2) : null,
    oldestOpenHours: round(oldestOpenHours, 2),
    cycleDue,
    maxHoldReached,
    hardStop,
    protectProfit,
    reduceRisk,
    canTradeFutures: cycleDue && !hardStop && !protectProfit && !maxHoldReached
  };
}

export function getMarketClock(now = new Date()) {
  const eastern = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);
  const parts = Object.fromEntries(eastern.map((part) => [part.type, part.value]));
  const weekday = parts.weekday;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second || 0);
  const minutes = hour * 60 + minute;
  const openMinutes = 9 * 60 + 30;
  const closeMinutes = 16 * 60;
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  const isRegularSession = isWeekday && minutes >= openMinutes && minutes < closeMinutes;
  const isAfterClose = isWeekday && minutes >= closeMinutes;
  const minutesUntilClose = isRegularSession ? closeMinutes - minutes : 0;
  const minutesUntilOpen = isWeekday && minutes < openMinutes ? openMinutes - minutes : null;

  return {
    timezone: "America/New_York",
    weekday,
    hour,
    minute,
    second,
    minutes,
    isWeekday,
    isRegularSession,
    isAfterClose,
    minutesUntilClose,
    minutesUntilOpen,
    label: `${weekday} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ET`
  };
}

export function getDecisionWindowStatus({
  marketClock = getMarketClock(),
  windowMinutes = 5,
  automationLog = [],
  portfolio = {},
  now = new Date()
} = {}) {
  const safeWindowMinutes = Math.max(1, Math.min(15, Number(windowMinutes || 5)));
  const minute = Number(marketClock.minute || 0);
  const second = Number(marketClock.second || 0);
  const isWindowOpen = minute % safeWindowMinutes === 0 && second < 45;
  const minutesUntilNextWindow = isWindowOpen ? 0 : safeWindowMinutes - (minute % safeWindowMinutes);
  const newEntryActions = ["buy", "buy-option", "buy-future"];
  const lastEntry = (automationLog || []).find((entry) => newEntryActions.includes(entry.action));
  const lastEntryTime = lastEntry ? new Date(lastEntry.createdAt).getTime() : 0;
  const minutesSinceEntry = lastEntryTime ? (now.getTime() - lastEntryTime) / (60 * 1000) : Infinity;
  const entryCooldownActive = Number.isFinite(minutesSinceEntry) && minutesSinceEntry < safeWindowMinutes;
  const lastClosedLoss = (portfolio?.trades || []).find((trade) => Number(trade.realizedPnl || 0) < 0);
  const lastLossTime = lastClosedLoss ? new Date(lastClosedLoss.createdAt).getTime() : 0;
  const minutesSinceLoss = lastLossTime ? (now.getTime() - lastLossTime) / (60 * 1000) : Infinity;
  const lossCooldownMinutes = 10;
  const lossCooldownActive = Number.isFinite(minutesSinceLoss) && minutesSinceLoss < lossCooldownMinutes;

  return {
    windowMinutes: safeWindowMinutes,
    isWindowOpen,
    minutesUntilNextWindow,
    entryCooldownActive,
    minutesSinceEntry: Number.isFinite(minutesSinceEntry) ? round(minutesSinceEntry, 1) : null,
    lossCooldownActive,
    lossCooldownMinutes,
    minutesSinceLoss: Number.isFinite(minutesSinceLoss) ? round(minutesSinceLoss, 1) : null,
    canOpenNewTrade: isWindowOpen && !entryCooldownActive && !lossCooldownActive
  };
}

export function evaluateAutomationPlan({
  scanner,
  portfolio,
  mode = "moderate",
  watchlist = symbols,
  dayTradeEnabled = true,
  optionsEnabled = true,
  strategyMap = {},
  automationLog = [],
  learningMemory = buildPaperLearningMemory(portfolio?.trades || []),
  futuresEnabled = true,
  market = getMarketSnapshot(),
  marketClock = getMarketClock(),
  allowFuturesExtendedHours = false,
  decisionWindowMinutes = 5,
  maxTradesPerDay = 3,
  realDataRequired = true,
  hasRequiredRealData = false,
  sessionPeakEquity = portfolio?.equity
} = {}) {
  const profile = riskProfiles.find((item) => item.id === mode) || riskProfiles.find((item) => item.id === "moderate");
  const adaptiveRisk = getAdaptiveRiskSettings(portfolio, mode);
  const futuresPolicy = evaluateFuturesPolicy({ portfolio, automationLog });
  const decisionWindow = getDecisionWindowStatus({
    marketClock,
    windowMinutes: decisionWindowMinutes,
    automationLog,
    portfolio
  });
  const marketClosed = !marketClock.isRegularSession;
  const futuresAllowedByClock = marketClock.isRegularSession || allowFuturesExtendedHours;
  const todayKey = new Date().toISOString().slice(0, 10);
  const entryActions = ["buy", "buy-option", "buy-future"];
  const todayEntryCount = (automationLog || []).filter(
    (entry) => entryActions.includes(entry.action) && String(entry.createdAt || "").slice(0, 10) === todayKey
  ).length;
  const dailyTradeLimit = {
    maxTradesPerDay: Math.max(1, Math.min(20, Number(maxTradesPerDay || 3))),
    todayEntryCount,
    remainingEntries: Math.max(0, Math.max(1, Math.min(20, Number(maxTradesPerDay || 3))) - todayEntryCount),
    reached: todayEntryCount >= Math.max(1, Math.min(20, Number(maxTradesPerDay || 3)))
  };
  const marketRegime = evaluateMarketRegime(scanner?.results || []);
  const bullishDiscipline = evaluateBullishDiscipline({
    mode,
    adaptiveRisk,
    marketRegime,
    hasRequiredRealData,
    decisionWindow,
    dailyTradeLimit,
    portfolio
  });
  const noTradeIntelligence = {
    realDataRequired,
    hasRequiredRealData,
    bullishDiscipline,
    blockedReasons: []
  };
  if (realDataRequired && !hasRequiredRealData) {
    noTradeIntelligence.blockedReasons.push("Real ETF CSV/API candle data is required before new entries.");
  }
  if (marketRegime.tradePermission === "blocked") {
    noTradeIntelligence.blockedReasons.push(marketRegime.reason);
  }
  if (adaptiveRisk.returnPercent <= -2.5) {
    noTradeIntelligence.blockedReasons.push("Daily loss limit area reached; capital protection blocks new entries.");
  }
  if (bullishDiscipline.active && !bullishDiscipline.passed) {
    noTradeIntelligence.blockedReasons.push(bullishDiscipline.label);
  }
  const maxExposurePercent = adaptiveRisk.maxExposurePercent;
  const maxSingleTradeCashPercent = adaptiveRisk.maxSingleTradeCashPercent;
  const availableCash = Math.max(0, Number(portfolio?.cash || 0));
  const maxTradeCash = Math.max(0, availableCash * maxSingleTradeCashPercent);
  const positions = new Map((portfolio?.positions || []).map((position) => [position.symbol, position]));
  const sessionProfit = Number(sessionPeakEquity || portfolio?.equity || 0) - Number(portfolio?.startingCash || 0);
  const currentProfit = Number(portfolio?.equity || 0) - Number(portfolio?.startingCash || 0);
  const givebackDollars = Math.max(0, sessionProfit - currentProfit);
  const startingCash = Number(portfolio?.startingCash || 3000);
  const dailyLossPercent = startingCash ? Math.abs(Math.min(0, currentProfit) / startingCash) * 100 : 0;
  const hardLossDollars = Math.max(25, startingCash * 0.025);
  const hardDailyLossStop = currentProfit <= -hardLossDollars || dailyLossPercent >= 2.5;
  const realisticProfitTarget = Math.min(100, Math.max(35, startingCash * 0.04));
  const secureDayProfit = sessionProfit >= realisticProfitTarget;
  const profitFloor =
    sessionProfit >= 75
      ? 55
      : sessionProfit >= 50
        ? 30
        : sessionProfit >= 25
          ? 10
          : 0;
  const floorGivebackStop = profitFloor > 0 && currentProfit < profitFloor;
  const gaveBackTooMuch = sessionProfit >= 15 && givebackDollars >= Math.max(8, sessionProfit * 0.3);
  const greenToRed = sessionProfit >= 10 && currentProfit <= 0;
  const profitLockStatus = {
    hardDailyLossStop,
    secureDayProfit,
    realisticProfitTarget: round(realisticProfitTarget),
    profitFloor: round(profitFloor),
    floorGivebackStop,
    hardLossDollars: round(hardLossDollars),
    sessionProfit: round(sessionProfit),
    currentProfit: round(currentProfit),
    givebackDollars: round(givebackDollars)
  };
  const openStockRisk = (portfolio?.positions || []).sort(
    (a, b) => Math.abs(Number(b.marketValue || 0)) - Math.abs(Number(a.marketValue || 0))
  )[0];
  const openOptionRisk = (portfolio?.optionPositions || []).sort(
    (a, b) => Math.abs(Number(b.marketValue || 0)) - Math.abs(Number(a.marketValue || 0))
  )[0];
  const openFutureRisk = (portfolio?.futuresPositions || []).sort(
    (a, b) => Math.abs(Number(b.marketValue || 0)) - Math.abs(Number(a.marketValue || 0))
  )[0];
  const largestRisk =
    [openFutureRisk && { ...openFutureRisk, assetType: "future" }, openOptionRisk && { ...openOptionRisk, assetType: "option" }, openStockRisk && { ...openStockRisk, assetType: "stock" }]
      .filter(Boolean)
      .sort((a, b) => Math.abs(Number(b.marketValue || 0)) - Math.abs(Number(a.marketValue || 0)))[0] || null;
  const categoryRanks = rankAutomationCategories(scanner?.results || [], watchlist);
  const bestCategory = categoryRanks[0] || null;
  const managedSymbols = bestCategory?.symbols?.length ? bestCategory.symbols : watchlist.length ? watchlist : symbols;
  const allowedSymbols = new Set(managedSymbols);
  const marketQuality = evaluateMarketQuality(scanner?.results || [], marketRegime, market);
  const selectiveOpportunityMode = marketQuality.score >= 60 && marketQuality.score < 70;
  const minBuyScore = adaptiveRisk.returnPercent < 0
    ? 88
    : selectiveOpportunityMode
      ? 84
      : mode === "bullish"
        ? 80
        : 76;
  if (marketQuality.verdict === "no-trade") {
    noTradeIntelligence.blockedReasons.push(marketQuality.reason);
  }
  noTradeIntelligence.canOpenNewEntry = noTradeIntelligence.blockedReasons.length === 0;
  const candidates = (scanner?.results || [])
    .filter((result) => allowedSymbols.has(result.symbol))
    .map((result) => {
      const selectedStrategy = strategyMap[result.symbol];
      const assetType = assetCatalog.futures.includes(result.symbol)
        ? "future"
        : assetCatalog.etfs.includes(result.symbol)
          ? "etf"
          : "stock";
      const learningAdjustment = getLearningAdjustment(learningMemory, {
        symbol: result.symbol,
        strategy: selectedStrategy?.strategy?.name || "n/a",
        assetType
      });
      return {
        ...result,
        rawScore: result.score,
        score: round(Math.max(0, Math.min(100, Number(result.score || 0) + learningAdjustment))),
        learningAdjustment
      };
    });
  const futuresCandidates = (scanner?.results || [])
    .filter((result) => assetCatalog.futures.includes(result.symbol))
    .map((result) => {
      const selectedStrategy = strategyMap[result.symbol];
      const learningAdjustment = getLearningAdjustment(learningMemory, {
        symbol: result.symbol,
        strategy: selectedStrategy?.strategy?.name || "n/a",
        assetType: "future"
      });
      return {
        ...result,
        rawScore: result.score,
        score: round(Math.max(0, Math.min(100, Number(result.score || 0) + learningAdjustment))),
        learningAdjustment
      };
    });
  const strongestTradableEtfSymbol = marketRegime.strongestEtf?.symbol || null;
  const optionsIdeas = buildOptionsIdeas(scanner?.results || []);
  const bestOptionIdea = optionsIdeas
    .filter((idea) => allowedSymbols.has(idea.underlying))
    .map((idea) => {
      const selectedStrategy = strategyMap[idea.underlying];
      const learningAdjustment = getLearningAdjustment(learningMemory, {
        symbol: idea.underlying,
        strategy: selectedStrategy?.strategy?.name || "n/a",
        assetType: "option"
      });
      return {
        ...idea,
        rawScore: idea.score,
        score: round(Math.max(0, Math.min(100, Number(idea.score || 0) + learningAdjustment))),
        learningAdjustment,
        permission: evaluateOptionPermission({
          idea: {
            ...idea,
            score: round(Math.max(0, Math.min(100, Number(idea.score || 0) + learningAdjustment)))
          },
          underlyingSetup: scanner?.results?.find((result) => result.symbol === idea.underlying),
          strategyScore: selectedStrategy?.score || 0,
          marketQuality,
          hasRequiredRealData,
          portfolio,
          maxTradeCash
        })
      };
    })
    .sort((a, b) => b.score - a.score)[0] || null;
  const dayTradeExit = dayTradeEnabled
    ? (portfolio?.positions || []).find((position) => {
        const pnlPercent = Number(position.unrealizedPnlPercent || 0);
        return (
          allowedSymbols.has(position.symbol) &&
          (pnlPercent >= (mode === "bullish" ? 0.45 : 0.25) || pnlPercent <= -0.35)
        );
      })
    : null;
  const breakevenExit = (portfolio?.positions || []).find((position) => {
    const pnlPercent = Number(position.unrealizedPnlPercent || 0);
    const peakPnlPercent = Number(position.peakPnlPercent || position.unrealizedPnlPercent || 0);
    return allowedSymbols.has(position.symbol) && peakPnlPercent >= 0.35 && pnlPercent <= 0.05;
  });
  const existingSell = candidates.find(
    (result) => result.action === "sell" && positions.has(result.symbol)
  );
  const futuresExit = (portfolio?.futuresPositions || []).find(
    (position) =>
      futuresPolicy.hardStop ||
      futuresPolicy.protectProfit ||
      futuresPolicy.maxHoldReached ||
      Number(position.unrealizedPnlPercent || 0) >= 1.25 ||
      Number(position.unrealizedPnlPercent || 0) <= -1.2
  );

  if (marketClosed && !futuresAllowedByClock) {
    return {
      action: "market-closed",
      reason: `Automation stopped: regular market is closed (${marketClock.label}). Save a market-close snapshot.`,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      marketClock,
      learningMemory,
      marketQuality,
      profitLock: profitLockStatus
    };
  }

  if ((hardDailyLossStop || secureDayProfit || floorGivebackStop || gaveBackTooMuch || greenToRed) && largestRisk) {
    if (largestRisk.assetType === "future") {
      return {
        action: largestRisk.quantity > 0 ? "sell-future" : "buy-future",
        symbol: largestRisk.symbol,
        quantity: Math.abs(largestRisk.quantity),
        reason: hardDailyLossStop
          ? `Daily kill switch: account is down ${round(Math.abs(currentProfit))} (${round(dailyLossPercent, 2)}%). Closing futures risk and stopping new trades.`
          : secureDayProfit
            ? `Profit secure: session profit reached ${round(sessionProfit)}. Closing futures risk and stopping new trades.`
            : floorGivebackStop
              ? `Profit floor: account was up ${round(sessionProfit)} and fell below the protected ${round(profitFloor)} floor. Closing futures risk.`
            : greenToRed
              ? `Profit lock: account went from green to flat/red after being up ${round(sessionProfit)}. Closing futures risk.`
              : `Profit lock: gave back ${round(givebackDollars)} of ${round(sessionProfit)} peak session profit. Closing futures risk.`,
        profile,
        bestCategory,
        categoryRanks,
        bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
        futuresPolicy,
        adaptiveRisk,
        profitLock: {
          hardDailyLossStop,
          secureDayProfit,
          realisticProfitTarget: round(realisticProfitTarget),
          profitFloor: round(profitFloor),
          floorGivebackStop,
          hardLossDollars: round(hardLossDollars),
          sessionProfit: round(sessionProfit),
          currentProfit: round(currentProfit),
          givebackDollars: round(givebackDollars)
        }
      };
    }

    if (largestRisk.assetType === "option") {
      const substantialOptionWin =
        Number(largestRisk.unrealizedPnl || 0) >= 150 ||
        Number(largestRisk.unrealizedPnlPercent || 0) >= 100;
      if (secureDayProfit && substantialOptionWin && largestRisk.quantity === 1 && !hardDailyLossStop && !floorGivebackStop && !gaveBackTooMuch && !greenToRed) {
        return {
          action: "hold",
          reason: `Profit secure: session profit reached ${round(sessionProfit)}. Keeping one substantial winning option as a defined runner; no new trades today unless it gives back profit.`,
          profile,
          bestCategory,
          categoryRanks,
          bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
          futuresPolicy,
          adaptiveRisk,
          profitLock: {
            secureDayProfit,
            hardDailyLossStop,
            substantialOptionWin,
            runnerLeft: true,
            realisticProfitTarget: round(realisticProfitTarget),
            profitFloor: round(profitFloor),
            floorGivebackStop,
            hardLossDollars: round(hardLossDollars),
            sessionProfit: round(sessionProfit),
            currentProfit: round(currentProfit),
            givebackDollars: round(givebackDollars)
          }
        };
      }
      const runnerQuantity =
        secureDayProfit && substantialOptionWin && largestRisk.quantity > 1
          ? Math.max(1, largestRisk.quantity - 1)
          : largestRisk.quantity;
      return {
        action: "sell-option",
        symbol: largestRisk.underlying,
        quantity: runnerQuantity,
        optionPosition: largestRisk,
        reason: hardDailyLossStop
          ? `Daily kill switch: account is down ${round(Math.abs(currentProfit))} (${round(dailyLossPercent, 2)}%). Closing option risk and stopping new trades.`
          : secureDayProfit
            ? substantialOptionWin && largestRisk.quantity > 1
              ? `Profit secure: session profit reached ${round(sessionProfit)}. Selling ${runnerQuantity} option contract(s) to secure profit and leaving one defined runner. No new trades today.`
              : `Profit secure: session profit reached ${round(sessionProfit)}. Closing option risk and stopping new trades.`
            : floorGivebackStop
              ? `Profit floor: account was up ${round(sessionProfit)} and fell below the protected ${round(profitFloor)} floor. Closing option risk.`
            : greenToRed
              ? `Profit lock: account went from green to flat/red after being up ${round(sessionProfit)}. Closing option risk.`
              : `Profit lock: gave back ${round(givebackDollars)} of ${round(sessionProfit)} peak session profit. Closing option risk.`,
        profile,
        bestCategory,
        categoryRanks,
        bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
        futuresPolicy,
        adaptiveRisk,
        profitLock: {
          secureDayProfit,
          hardDailyLossStop,
          substantialOptionWin,
          runnerLeft: secureDayProfit && substantialOptionWin && largestRisk.quantity > runnerQuantity,
          realisticProfitTarget: round(realisticProfitTarget),
          profitFloor: round(profitFloor),
          floorGivebackStop,
          hardLossDollars: round(hardLossDollars),
          sessionProfit: round(sessionProfit),
          currentProfit: round(currentProfit),
          givebackDollars: round(givebackDollars)
        }
      };
    }

    return {
      action: "sell",
      symbol: largestRisk.symbol,
      quantity: largestRisk.quantity,
      reason: hardDailyLossStop
        ? `Daily kill switch: account is down ${round(Math.abs(currentProfit))} (${round(dailyLossPercent, 2)}%). Closing stock/ETF risk and stopping new trades.`
        : secureDayProfit
          ? `Profit secure: session profit reached ${round(sessionProfit)}. Closing stock/ETF risk and stopping new trades.`
          : floorGivebackStop
            ? `Profit floor: account was up ${round(sessionProfit)} and fell below the protected ${round(profitFloor)} floor. Closing stock/ETF risk.`
          : greenToRed
            ? `Profit lock: account went from green to flat/red after being up ${round(sessionProfit)}. Closing stock/ETF risk.`
            : `Profit lock: gave back ${round(givebackDollars)} of ${round(sessionProfit)} peak session profit. Closing stock/ETF risk.`,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      profitLock: {
        hardDailyLossStop,
        secureDayProfit,
        realisticProfitTarget: round(realisticProfitTarget),
        profitFloor: round(profitFloor),
        floorGivebackStop,
        hardLossDollars: round(hardLossDollars),
        sessionProfit: round(sessionProfit),
        currentProfit: round(currentProfit),
        givebackDollars: round(givebackDollars)
      }
    };
  }

  if (hardDailyLossStop || secureDayProfit || floorGivebackStop || greenToRed) {
    return {
      action: "hold",
      reason: hardDailyLossStop
        ? `Daily kill switch: account is down ${round(Math.abs(currentProfit))} (${round(dailyLossPercent, 2)}%). No more new trades today.`
        : secureDayProfit
          ? `Profit secure: session profit reached ${round(sessionProfit)}. No more new trades today.`
          : floorGivebackStop
            ? `Profit floor: account was up ${round(sessionProfit)} and fell below the protected ${round(profitFloor)} floor. No more new trades today.`
          : `Profit lock: account was up ${round(sessionProfit)} and is no longer green. Stop new trades for the day.`,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      profitLock: {
        hardDailyLossStop,
        secureDayProfit,
        realisticProfitTarget: round(realisticProfitTarget),
        profitFloor: round(profitFloor),
        floorGivebackStop,
        hardLossDollars: round(hardLossDollars),
        sessionProfit: round(sessionProfit),
        currentProfit: round(currentProfit),
        givebackDollars: round(givebackDollars)
      }
    };
  }

  if (futuresExit) {
    return {
      action: futuresExit.quantity > 0 ? "sell-future" : "buy-future",
      symbol: futuresExit.symbol,
      quantity: Math.abs(futuresExit.quantity),
      reason: futuresPolicy.hardStop
        ? `Futures hard stop: daily loss reached ${round(Math.abs(futuresPolicy.totalReturnPercent), 2)}%, max ${futuresPolicy.maxDailyLossPercent}%.`
        : futuresPolicy.protectProfit
          ? "Futures profit protection: account is green but futures position is giving back gains."
          : futuresPolicy.maxHoldReached
            ? `Futures 8h guard: max hold time reached. Close and wait for the next 4h evaluation cycle.`
          : futuresExit.unrealizedPnlPercent >= 0
            ? `Futures 4h guard: secure ${round(futuresExit.unrealizedPnlPercent, 2)}% open gain.`
            : `Futures 4h guard: cut ${round(futuresExit.unrealizedPnlPercent, 2)}% open loss.`,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      adaptiveRisk,
      futuresPolicy
    };
  }

  if (dayTradeExit) {
    return {
      action: "sell",
      symbol: dayTradeExit.symbol,
      quantity: dayTradeExit.quantity,
      reason:
        dayTradeExit.unrealizedPnlPercent >= 0
          ? `Day-trade rule: lock ${round(dayTradeExit.unrealizedPnlPercent, 2)}% paper gain.`
          : `Day-trade rule: cut ${round(dayTradeExit.unrealizedPnlPercent, 2)}% paper loss.`,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk
    };
  }

  if (breakevenExit) {
    return {
      action: "sell",
      symbol: breakevenExit.symbol,
      quantity: breakevenExit.quantity,
      reason: `Breakeven guard: ${breakevenExit.symbol} was up ${round(Number(breakevenExit.peakPnlPercent || 0), 2)}% and faded near flat. Exit before it turns into a loss.`,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime,
      marketQuality,
      profitLock: profitLockStatus,
      noTradeIntelligence
    };
  }

  if (existingSell) {
    const position = positions.get(existingSell.symbol);
    return {
      action: "sell",
      symbol: existingSell.symbol,
      quantity: position.quantity,
      reason: `Automation exit: ${existingSell.reason}`,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime,
      marketQuality,
      profitLock: profitLockStatus,
      noTradeIntelligence
    };
  }

  if (realDataRequired && !hasRequiredRealData) {
    return {
      action: "hold",
      reason: "Real data required mode: load CSV or API candles for SPY, DIA, IWM, and QQQ before allowing new entries.",
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime,
      marketQuality,
      profitLock: profitLockStatus,
      noTradeIntelligence
    };
  }

  if (adaptiveRisk.returnPercent <= -2.5) {
    return {
      action: "hold",
      reason: `Capital protection hold: account is down ${round(Math.abs(adaptiveRisk.returnPercent), 2)}%. No new entries near the daily loss limit.`,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime,
      marketQuality,
      profitLock: profitLockStatus,
      noTradeIntelligence
    };
  }

  if (marketRegime.tradePermission === "blocked") {
    return {
      action: "hold",
      reason: `Market regime hold: ${marketRegime.reason}`,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime,
      marketQuality,
      profitLock: profitLockStatus,
      noTradeIntelligence
    };
  }

  if (marketQuality.verdict === "no-trade") {
    return {
      action: "hold",
      reason: marketQuality.reason,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime,
      marketQuality,
      profitLock: profitLockStatus,
      noTradeIntelligence
    };
  }

  if (bullishDiscipline.active && !bullishDiscipline.passed) {
    return {
      action: "hold",
      reason: bullishDiscipline.label,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime,
      marketQuality,
      profitLock: profitLockStatus,
      noTradeIntelligence
    };
  }

  if (dailyTradeLimit.reached) {
    return {
      action: "hold",
      reason: `Daily trade limit reached: ${dailyTradeLimit.todayEntryCount}/${dailyTradeLimit.maxTradesPerDay} automation entries used. No more new entries today.`,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime,
      noTradeIntelligence
    };
  }

  if (!decisionWindow.canOpenNewTrade) {
    const reason = decisionWindow.lossCooldownActive
      ? `Decision window hold: last closed paper trade was a loss. Cooling down for ${decisionWindow.lossCooldownMinutes} minutes before any new entry.`
      : decisionWindow.entryCooldownActive
        ? `Decision window hold: last entry was ${decisionWindow.minutesSinceEntry} minutes ago. Wait for the ${decisionWindow.windowMinutes}-minute window.`
        : `Decision window hold: new entries only open on ${decisionWindow.windowMinutes}-minute windows. Next window in about ${decisionWindow.minutesUntilNextWindow} minute(s).`;
    return {
      action: "hold",
      reason,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime,
      noTradeIntelligence
    };
  }

  const buyCandidate = candidates.find((result) => {
    const flags = result.intelligence?.riskFlags || [];
    const selectedStrategy = strategyMap[result.symbol];
    const strategyScore = Math.max(
      0,
      Math.min(100, Number(selectedStrategy?.score || 50) + Number(result.learningAdjustment || 0) * 0.5)
    );
    const isAiChip = assetCatalog.aiChips.includes(result.symbol);
    const isTradableEtf = assetCatalog.etfs.includes(result.symbol) && !isAiChip;
    const scannerThreshold = isAiChip
      ? adaptiveRisk.returnPercent < 0
        ? 90
        : selectiveOpportunityMode
          ? 88
          : mode === "bullish"
            ? 84
            : 80
      : minBuyScore;
    const strategyThreshold = isAiChip
      ? adaptiveRisk.returnPercent < 0
        ? 84
        : selectiveOpportunityMode
          ? 80
          : mode === "bullish"
            ? 76
            : 72
      : adaptiveRisk.returnPercent < 0
        ? 82
        : selectiveOpportunityMode
          ? 76
          : mode === "bullish"
            ? 74
            : 68;
    return (
      result.action === "buy" &&
      (isTradableEtf || isAiChip) &&
      (isAiChip || !strongestTradableEtfSymbol || result.symbol === strongestTradableEtfSymbol) &&
      result.score >= scannerThreshold &&
      strategyScore >= strategyThreshold &&
      !positions.has(result.symbol) &&
      result.intelligence?.liquidityGrade !== "avoid" &&
      !["high", "extreme"].includes(result.intelligence?.volatilityRegime) &&
      flags.length === 0
    );
  });

  if (!buyCandidate) {
    const futuresCandidate = futuresEnabled &&
      futuresAllowedByClock &&
      futuresPolicy.canTradeFutures &&
      adaptiveRisk.returnPercent > -1.5 &&
      marketQuality.score >= 60 &&
      Number(portfolio?.futuresExposurePercent || 0) <= 20 &&
      (!bullishDiscipline.active || bullishDiscipline.passed)
      ? futuresCandidates.find((result) => {
          const selectedStrategy = strategyMap[result.symbol];
          const strategyScore = Math.max(
            0,
            Math.min(100, Number(selectedStrategy?.score || 0) + Number(result.learningAdjustment || 0) * 0.5)
          );
          const flags = result.intelligence?.riskFlags || [];
          const futuresScoreThreshold = adaptiveRisk.returnPercent < 0
            ? 88
            : selectiveOpportunityMode
              ? 86
              : mode === "bullish"
                ? 82
                : 76;
          const futuresStrategyThreshold = adaptiveRisk.returnPercent < 0
            ? 82
            : selectiveOpportunityMode
              ? 78
              : mode === "bullish"
                ? 74
                : 68;
          const downsideFuturesAllowed =
            marketRegime.regime === "risk-off" &&
            adaptiveRisk.returnPercent >= 0 &&
            result.action === "sell";
          const upsideFuturesAllowed = result.action === "buy";
          return (
            assetCatalog.futures.includes(result.symbol) &&
            (upsideFuturesAllowed || downsideFuturesAllowed) &&
            result.score >= futuresScoreThreshold &&
            strategyScore >= futuresStrategyThreshold &&
            result.intelligence?.liquidityGrade !== "avoid" &&
            !["high", "extreme"].includes(result.intelligence?.volatilityRegime) &&
            flags.length === 0
          );
        })
      : null;

    if (futuresCandidate) {
      return {
        action: futuresCandidate.action === "sell" ? "sell-future" : "buy-future",
        symbol: futuresCandidate.symbol,
        quantity: 1,
        reason: `Smart futures ${futuresCandidate.action === "sell" ? "short" : "long"} entry: ${futuresCandidate.symbol} passed market quality ${marketQuality.score}/100, ${selectiveOpportunityMode ? "selective opportunity" : "standard"} threshold, 4h cycle, 8h max-hold, scanner, strategy, liquidity, volatility, and 8% hard-loss gates. Re-evaluate in ${futuresPolicy.cycleHours} hours.`,
        profile,
        bestCategory,
        categoryRanks,
        bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
        futuresPolicy,
        adaptiveRisk,
        decisionWindow,
        dailyTradeLimit,
        marketRegime,
        marketQuality,
        profitLock: profitLockStatus,
        noTradeIntelligence
      };
    }

    return {
      action: "hold",
      reason: "No watched setup passes automation score, liquidity, volatility, and position rules.",
      blockers: candidates.map((result) => ({
        symbol: result.symbol,
        action: result.action,
        scannerScore: result.score,
        strategy: strategyMap[result.symbol]?.strategy?.name || "n/a",
        strategyScore: strategyMap[result.symbol]?.score || 0,
        learningAdjustment: result.learningAdjustment || 0,
        liquidity: result.intelligence?.liquidityGrade || "unknown",
        volatility: result.intelligence?.volatilityRegime || "unknown",
        riskFlags: result.intelligence?.riskFlags || []
      })),
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime
    };
  }

  if ((portfolio?.exposurePercent || 0) >= maxExposurePercent) {
    return {
      action: "hold",
      reason: `Exposure limit reached for ${profile.name} mode.`,
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime,
      noTradeIntelligence
    };
  }

  const quantity = Math.floor(maxTradeCash / Number(buyCandidate.price || 1));

  if (quantity < 1) {
      const optionFallback =
      optionsEnabled &&
      !realDataRequired &&
      adaptiveRisk.returnPercent >= 0 &&
      bestOptionIdea &&
      bestOptionIdea.stance !== "hold" &&
      bestOptionIdea.permission?.allowed &&
      bestOptionIdea.notionalCost <= Math.max(50, maxTradeCash);

    if (optionFallback) {
      return {
        action: "buy-option",
        symbol: bestOptionIdea.underlying,
        quantity: 1,
        optionIdea: bestOptionIdea,
        reason: `Cash-aware sizing selected defined-risk option idea because one share of ${buyCandidate.symbol} exceeds per-trade cash limit. ${bestOptionIdea.permission.label}`,
        profile,
        bestCategory,
        categoryRanks,
        bestOptionIdea,
        futuresPolicy,
        adaptiveRisk,
        decisionWindow,
        dailyTradeLimit,
        marketRegime,
        noTradeIntelligence
      };
    }

    return {
      action: "hold",
      reason: `Cash-aware sizing blocked entry: ${profile.name} mode allows about ${round(
        maxSingleTradeCashPercent * 100
      )}% of cash per trade, not enough for one share of ${buyCandidate.symbol}.`,
      blockers: [
        {
          symbol: buyCandidate.symbol,
          action: buyCandidate.action,
          scannerScore: buyCandidate.score,
          strategy: strategyMap[buyCandidate.symbol]?.strategy?.name || "n/a",
          strategyScore: strategyMap[buyCandidate.symbol]?.score || 0,
          learningAdjustment: buyCandidate.learningAdjustment || 0,
          liquidity: buyCandidate.intelligence?.liquidityGrade || "unknown",
          volatility: buyCandidate.intelligence?.volatilityRegime || "unknown",
          riskFlags: ["Position size too large for current adaptive risk limits."]
        }
      ],
      profile,
      bestCategory,
      categoryRanks,
      bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
      futuresPolicy,
      adaptiveRisk,
      decisionWindow,
      dailyTradeLimit,
      marketRegime,
      noTradeIntelligence
    };
  }

  return {
    action: "buy",
    symbol: buyCandidate.symbol,
    quantity,
    reason: `Automation entry: ${buyCandidate.reason} Strategy: ${
      strategyMap[buyCandidate.symbol]?.strategy?.name || "selected scanner strategy"
    }. Learning adjustment: ${buyCandidate.learningAdjustment >= 0 ? "+" : ""}${buyCandidate.learningAdjustment}. Size capped at ${round(maxSingleTradeCashPercent * 100)}% of available cash.`,
    profile,
    bestCategory,
    categoryRanks,
    bestOptionIdea: optionsEnabled ? bestOptionIdea : null,
    futuresPolicy,
    adaptiveRisk,
    decisionWindow,
    dailyTradeLimit,
    marketRegime,
    noTradeIntelligence
  };
}

export function runBacktest(options = {}, dataBySymbol = {}) {
  const symbol = symbols.includes(String(options.symbol || "").toUpperCase())
    ? String(options.symbol).toUpperCase()
    : "SPY";
  const startingCash = clampNumber(options.startingCash, 3000, 1000, 10000000);
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
  const useAtrStops = options.useAtrStops !== false;
  const atrPeriod = Math.floor(clampNumber(options.atrPeriod, 14, 5, 50));
  const atrStopMultiplier = clampNumber(options.atrStopMultiplier, 1.5, 0.5, 5);
  const atrTargetMultiplier = clampNumber(options.atrTargetMultiplier, 2, 0.5, 8);
  const atrTrailMultiplier = clampNumber(options.atrTrailMultiplier, 1.2, 0.5, 5);
  const profitLockPercent = clampNumber(options.profitLockPercent, 1, 0, 20);
  const protectedProfitGivebackPercent = clampNumber(options.protectedProfitGivebackPercent, 1, 0.25, 20);
  const maxConsecutiveLosses = Math.floor(clampNumber(options.maxConsecutiveLosses, 3, 1, 20));
  const maxConsecutiveWins = Math.floor(clampNumber(options.maxConsecutiveWins, 4, 1, 20));
  const riskProfileId = riskProfiles.some((profile) => profile.id === options.riskProfile)
    ? options.riskProfile
    : "moderate";
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
      const atr = useAtrStops ? averageTrueRange(candles, index, atrPeriod) : null;
      const stopPrice = atr
        ? entryPrice - atr * atrStopMultiplier
        : entryPrice * (1 - stopLossPercent / 100);
      const takeProfitPrice = atr
        ? entryPrice + atr * atrTargetMultiplier
        : entryPrice * (1 + takeProfitPercent / 100);
      const trailingStopPrice = atr
        ? highestSinceEntry - atr * atrTrailMultiplier
        : trailingStopPercent > 0
          ? highestSinceEntry * (1 - trailingStopPercent / 100)
          : 0;

      if (candle.low <= stopPrice) {
        closePosition(candle, stopPrice, useAtrStops ? "ATR stop protected capital." : "Stop loss protected capital.", "stop-loss");
      } else if (candle.high >= takeProfitPrice) {
        closePosition(candle, takeProfitPrice, useAtrStops ? "ATR target captured volatility-based reward." : "Take profit captured target.", "take-profit");
      } else if (trailingStopPrice > entryPrice && candle.low <= trailingStopPrice) {
        closePosition(candle, trailingStopPrice, useAtrStops ? "ATR trailing stop protected open profit." : "Trailing stop protected open profit.", "trailing-stop");
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
      useAtrStops,
      atrPeriod,
      atrStopMultiplier,
      atrTargetMultiplier,
      atrTrailMultiplier,
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
            (3000 * riskPercent * Math.max(0.35, intelligence.volatilityScore / 100)) /
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
    const source = candles.dataSource || (candles.length ? "csv" : "simulated");
    return {
      symbol,
      source,
      interval: candles.dataInterval || (source === "simulated" ? "synthetic" : "daily"),
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

  const normalizedDate = String(dateString).slice(0, 10);
  const date = new Date(`${normalizedDate}T00:00:00Z`);
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
      label: "All watchlist symbols use real CSV/API data",
      passed:
        dataStatus.length === symbols.length &&
        dataStatus.every((item) => ["csv", "api-1min", "api-daily"].includes(item.source))
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
    cash: 3000,
    startingCash: 3000,
    realizedPnl: 0,
    withdrawnProfit: 0,
    trades: [],
    positions: {},
    optionPositions: {},
    futuresPositions: {}
  };
}

export function buildPortfolio(state, market) {
  const safeState = {
    ...state,
    positions: state.positions || {},
    optionPositions: state.optionPositions || {},
    futuresPositions: state.futuresPositions || {},
    withdrawnProfit: Number(state.withdrawnProfit || 0),
    trades: state.trades || []
  };
  const positions = Object.entries(safeState.positions).map(([symbol, position]) => {
    const quote = market.find((item) => item.symbol === symbol);
    const marketValue = quote ? quote.price * position.quantity : 0;
    const unrealizedPnl = marketValue - position.averagePrice * position.quantity;
    const unrealizedPnlPercent = position.averagePrice
      ? round((unrealizedPnl / (position.averagePrice * position.quantity)) * 100, 2)
      : 0;
    const peakPnlPercent = Math.max(Number(position.peakPnlPercent || 0), unrealizedPnlPercent);

    return {
      symbol,
      quantity: position.quantity,
      averagePrice: round(position.averagePrice),
      marketPrice: quote?.price ?? null,
      marketValue: round(marketValue),
      unrealizedPnl: round(unrealizedPnl),
      unrealizedPnlPercent,
      peakPnlPercent,
      openedAt: position.openedAt || null
    };
  });
  const optionPositions = Object.entries(safeState.optionPositions).map(([contractId, position]) => {
    const quote = market.find((item) => item.symbol === position.underlying);
    const markPremium = quote
      ? estimateOptionPremium({
          underlyingPrice: quote.price,
          strike: position.strike,
          contractType: position.contractType,
          volatilityScore: position.volatilityScore || 60
        })
      : position.averagePremium;
    const marketValue = markPremium * 100 * position.quantity;
    const costBasis = position.averagePremium * 100 * position.quantity;
    const unrealizedPnl = marketValue - costBasis;

    return {
      contractId,
      ...position,
      markPremium,
      marketValue: round(marketValue),
      unrealizedPnl: round(unrealizedPnl),
      unrealizedPnlPercent: costBasis ? round((unrealizedPnl / costBasis) * 100, 2) : 0
    };
  });
  const futuresPositions = Object.entries(safeState.futuresPositions).map(([symbol, position]) => {
    const quote = market.find((item) => item.symbol === symbol);
    const contract = futuresCatalog[symbol];
    const markPrice = quote?.price || position.averagePrice;
    const multiplier = contract?.pointValue || 1;
    const marketValue = contract?.marginEstimate * Math.abs(position.quantity);
    const unrealizedPnl = (markPrice - position.averagePrice) * multiplier * position.quantity;

    return {
      symbol,
      ...position,
      name: contract?.name || symbol,
      markPrice: round(markPrice),
      marketValue: round(marketValue),
      unrealizedPnl: round(unrealizedPnl),
      unrealizedPnlPercent: position.averagePrice
        ? round((unrealizedPnl / (contract?.marginEstimate * Math.abs(position.quantity) || 1)) * 100, 2)
        : 0
    };
  });

  const exposure = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const optionsExposure = optionPositions.reduce((sum, position) => sum + position.marketValue, 0);
  const futuresExposure = futuresPositions.reduce((sum, position) => sum + position.marketValue, 0);
  const futuresPnl = futuresPositions.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  const equity = safeState.cash + exposure + optionsExposure + futuresPnl;

  return {
    mode: "static paper",
    cash: round(safeState.cash),
    equity: round(equity),
    startingCash: safeState.startingCash,
    realizedPnl: round(safeState.realizedPnl || 0),
    withdrawnProfit: round(safeState.withdrawnProfit || 0),
    withdrawableProfit: round(Math.max(0, Math.min(safeState.cash, equity - safeState.startingCash))),
    totalReturn: round(equity - safeState.startingCash),
    totalReturnPercent: round(((equity - safeState.startingCash) / safeState.startingCash) * 100),
    exposure: round(exposure),
    optionsExposure: round(optionsExposure),
    futuresExposure: round(futuresExposure),
    exposurePercent: equity ? round((exposure / equity) * 100) : 0,
    optionsExposurePercent: equity ? round((optionsExposure / equity) * 100) : 0,
    futuresExposurePercent: equity ? round((futuresExposure / equity) * 100) : 0,
    positions,
    optionPositions,
    futuresPositions,
    trades: safeState.trades.slice(-30).reverse()
  };
}

export function withdrawPaperProfit(state, amount) {
  const withdrawalAmount = Number(amount);
  const safeState =
    typeof structuredClone === "function"
      ? structuredClone(state)
      : JSON.parse(JSON.stringify(state));

  if (!Number.isFinite(withdrawalAmount) || withdrawalAmount <= 0) {
    throw new Error("Withdrawal amount must be greater than zero.");
  }

  if (withdrawalAmount < 5) {
    throw new Error("Minimum paper profit withdrawal is $5.");
  }

  const cash = Number(safeState.cash || 0);
  const startingCash = Number(safeState.startingCash || 3000);
  const withdrawableProfit = Math.max(0, Math.min(cash, cash - startingCash));

  if (withdrawableProfit < 5) {
    throw new Error("No withdrawable paper profit yet. Minimum is $5 above starting cash.");
  }

  if (withdrawalAmount > withdrawableProfit) {
    throw new Error(`Withdrawal exceeds available paper profit. Available: $${round(withdrawableProfit)}.`);
  }

  safeState.cash = round(cash - withdrawalAmount);
  safeState.withdrawnProfit = round(Number(safeState.withdrawnProfit || 0) + withdrawalAmount);
  safeState.trades ||= [];
  safeState.trades.push({
    id:
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    assetType: "cash",
    symbol: "PROFIT",
    side: "withdraw",
    quantity: 1,
    price: round(withdrawalAmount),
    gross: round(withdrawalAmount),
    realizedPnl: 0,
    strategy: "Profit Withdrawal",
    reason: `Withdrew ${round(withdrawalAmount)} paper profit. Minimum withdrawal rule: $5.`,
    createdAt: new Date().toISOString()
  });

  return safeState;
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
    position.openedAt ||= new Date().toISOString();
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
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    assetType: assetCatalog.etfs.includes(symbol) ? "etf" : "stock",
    symbol,
    side,
    quantity,
    price: quote.price,
    gross: round(gross),
    realizedPnl: round(realizedPnl),
    strategy: order.strategy || "Manual",
    strategyScore: order.strategyScore || null,
    reason: order.reason || "Manual paper order",
    scannerScore: order.scannerScore || null,
    learningAdjustment: order.learningAdjustment || 0,
    decisionWindowMinutes: order.decisionWindowMinutes || null,
    marketClockLabel: order.marketClockLabel || null,
    mode: order.mode || null,
    createdAt: new Date().toISOString()
  });

  return next;
}

export function placePaperOptionTrade(state, optionIdea, order = {}) {
  const side = String(order.side || "buy").trim().toLowerCase();
  const quantity = Number(order.quantity || 1);
  const premium = Number(optionIdea.premium || 0);
  const contractId = `${optionIdea.underlying}-${optionIdea.expiry}-${optionIdea.strike}-${optionIdea.contractType}`.replaceAll(
    " ",
    "-"
  );

  if (!["buy", "sell"].includes(side)) {
    throw new Error("Option side must be buy or sell.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Option contract quantity must be greater than zero.");
  }

  if (!Number.isFinite(premium) || premium <= 0) {
    throw new Error("Option idea has no valid simulated premium.");
  }

  const next =
    typeof structuredClone === "function"
      ? structuredClone(state)
      : JSON.parse(JSON.stringify(state));
  next.optionPositions ||= {};
  next.trades ||= [];

  const gross = premium * 100 * quantity;
  const maxOptionsOrder = Math.max(50, next.startingCash * 0.2);
  const position = next.optionPositions[contractId] || {
    underlying: optionIdea.underlying,
    contractType: optionIdea.contractType,
    strike: optionIdea.strike,
    expiry: optionIdea.expiry,
    quantity: 0,
    averagePremium: 0,
    volatilityScore: optionIdea.volatilityScore || 60,
    openedAt: new Date().toISOString()
  };
  let realizedPnl = 0;

  if (side === "buy") {
    if (gross > maxOptionsOrder) {
      throw new Error(`Options paper order exceeds ${round((maxOptionsOrder / next.startingCash) * 100)}% risk cap.`);
    }
    if (gross > next.cash) {
      throw new Error("Insufficient paper cash for option premium.");
    }

    const totalCost = position.averagePremium * 100 * position.quantity + gross;
    position.quantity += quantity;
    position.averagePremium = totalCost / (position.quantity * 100);
    next.cash -= gross;
    next.optionPositions[contractId] = position;
  } else {
    if (position.quantity < quantity) {
      throw new Error("Cannot sell more option contracts than the paper portfolio holds.");
    }

    realizedPnl = (premium - position.averagePremium) * 100 * quantity;
    position.quantity -= quantity;
    next.cash += gross;
    next.realizedPnl = (next.realizedPnl || 0) + realizedPnl;

    if (position.quantity === 0) {
      delete next.optionPositions[contractId];
    } else {
      next.optionPositions[contractId] = position;
    }
  }

  next.trades.push({
    id:
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    assetType: "option",
    contractId,
    symbol: optionIdea.underlying,
    side,
    quantity,
    price: round(premium),
    gross: round(gross),
    realizedPnl: round(realizedPnl),
    strategy: order.strategy || "Manual",
    strategyScore: order.strategyScore || null,
    reason: order.reason || "Manual paper option order",
    scannerScore: order.scannerScore || optionIdea.score || null,
    learningAdjustment: order.learningAdjustment ?? optionIdea.learningAdjustment ?? 0,
    decisionWindowMinutes: order.decisionWindowMinutes || null,
    marketClockLabel: order.marketClockLabel || null,
    mode: order.mode || null,
    description: `${optionIdea.underlying} ${optionIdea.strike} ${optionIdea.contractType.toUpperCase()} ${optionIdea.expiry}`,
    createdAt: new Date().toISOString()
  });

  return next;
}

export function placePaperFuturesTrade(state, market, order = {}) {
  const symbol = String(order.symbol || "").trim().toUpperCase();
  const side = String(order.side || "buy").trim().toLowerCase();
  const quantity = Number(order.quantity || 1);
  const quote = market.find((item) => item.symbol === symbol);
  const contract = futuresCatalog[symbol];

  if (!contract || !quote) {
    throw new Error(`Unsupported paper futures contract: ${symbol}.`);
  }

  if (!["buy", "sell"].includes(side)) {
    throw new Error("Futures side must be buy or sell.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Futures quantity must be greater than zero.");
  }

  const next =
    typeof structuredClone === "function"
      ? structuredClone(state)
      : JSON.parse(JSON.stringify(state));
  next.futuresPositions ||= {};
  next.trades ||= [];

  const signedQuantity = side === "buy" ? quantity : -quantity;
  const marginRequired = contract.marginEstimate * Math.abs(quantity);
  const maxFuturesMargin = Math.max(100, next.startingCash * 0.35);

  if (marginRequired > maxFuturesMargin) {
    throw new Error("Futures paper order blocked by 35% margin risk cap.");
  }

  if (marginRequired > next.cash) {
    throw new Error("Insufficient paper cash for futures margin.");
  }

  const position = next.futuresPositions[symbol] || {
    quantity: 0,
    averagePrice: 0,
    openedAt: new Date().toISOString()
  };
  const closingOpposite =
    position.quantity !== 0 && Math.sign(position.quantity) !== Math.sign(signedQuantity);
  let realizedPnl = 0;

  if (closingOpposite) {
    const closingQuantity = Math.min(Math.abs(position.quantity), Math.abs(signedQuantity));
    realizedPnl =
      (quote.price - position.averagePrice) *
      contract.pointValue *
      closingQuantity *
      Math.sign(position.quantity);
    position.quantity += signedQuantity;
    next.realizedPnl = (next.realizedPnl || 0) + realizedPnl;
  } else {
    const totalContracts = Math.abs(position.quantity) + Math.abs(signedQuantity);
    position.averagePrice =
      totalContracts > 0
        ? (position.averagePrice * Math.abs(position.quantity) + quote.price * Math.abs(signedQuantity)) /
          totalContracts
        : quote.price;
    position.quantity += signedQuantity;
  }

  if (position.quantity === 0) {
    delete next.futuresPositions[symbol];
  } else {
    next.futuresPositions[symbol] = position;
  }

  next.trades.push({
    id:
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    assetType: "future",
    symbol,
    side,
    quantity,
    price: round(quote.price),
    gross: round(marginRequired),
    realizedPnl: round(realizedPnl),
    strategy: order.strategy || "Manual",
    strategyScore: order.strategyScore || null,
    reason: order.reason || "Manual paper futures order",
    scannerScore: order.scannerScore || null,
    learningAdjustment: order.learningAdjustment || 0,
    decisionWindowMinutes: order.decisionWindowMinutes || null,
    marketClockLabel: order.marketClockLabel || null,
    mode: order.mode || null,
    description: `${symbol} ${contract.name}`,
    createdAt: new Date().toISOString()
  });

  return next;
}
