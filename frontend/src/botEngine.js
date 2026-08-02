const DAY_MS = 24 * 60 * 60 * 1000;

export const symbols = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY", "QQQ"];

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
        const response = await fetch(`/data/${symbol}.csv`, { cache: "no-store" });
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

export function runBacktest(options = {}, dataBySymbol = {}) {
  const symbol = symbols.includes(String(options.symbol || "").toUpperCase())
    ? String(options.symbol).toUpperCase()
    : "SPY";
  const startingCash = clampNumber(options.startingCash, 100000, 1000, 10000000);
  const shortWindow = Math.floor(clampNumber(options.shortWindow, 20, 3, 100));
  const longWindow = Math.floor(clampNumber(options.longWindow, 50, shortWindow + 1, 220));
  const lookbackDays = Math.floor(clampNumber(options.lookbackDays, 260, longWindow + 30, 900));
  const riskPercent = clampNumber(options.riskPercent, 0.25, 0.05, 1);
  const data = getHistoricalCandlesWithSource(symbol, lookbackDays, longWindow + 2, dataBySymbol);
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
        const quantity = Math.floor((equity * riskPercent) / candle.close);
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

  return {
    config: { symbol, startingCash, shortWindow, longWindow, lookbackDays, riskPercent },
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
      winRatePercent: sellTrades.length ? round((winningTrades.length / sellTrades.length) * 100, 2) : 0
    },
    candles: candles.slice(-90),
    equityCurve: equityCurve.slice(-160),
    trades: trades.slice(-30).reverse()
  };
}

function classifySetup({ shortAverage, longAverage, price, returnPercent, maxDrawdownPercent }) {
  const trendSpread = ((shortAverage - longAverage) / longAverage) * 100;
  const priceStrength = ((price - longAverage) / longAverage) * 100;
  const score = Math.round(
    50 + trendSpread * 8 + returnPercent * 1.8 + priceStrength * 1.2 - maxDrawdownPercent * 1.4
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

  const results = symbols
    .map((symbol) => {
      const backtest = runBacktest({ symbol, shortWindow, longWindow, lookbackDays, riskPercent }, dataBySymbol);
      const data = getHistoricalCandlesWithSource(
        symbol,
        Math.max(lookbackDays, longWindow + 5),
        longWindow + 5,
        dataBySymbol
      );
      const candles = data.candles;
      const lastIndex = candles.length - 1;
      const quote = market.find((item) => item.symbol === symbol);
      const shortAverage = movingAverage(candles, lastIndex, shortWindow);
      const longAverage = movingAverage(candles, lastIndex, longWindow);
      const setup = classifySetup({
        shortAverage,
        longAverage,
        price: candles[lastIndex].close,
        returnPercent: backtest.summary.returnPercent,
        maxDrawdownPercent: backtest.summary.maxDrawdownPercent
      });

      return {
        symbol,
        action: setup.action,
        score: setup.score,
        reason: setup.reason,
        price: quote?.price || candles[lastIndex].close,
        changePercent: quote?.changePercent || 0,
        backtestReturnPercent: backtest.summary.returnPercent,
        maxDrawdownPercent: backtest.summary.maxDrawdownPercent,
        winRatePercent: backtest.summary.winRatePercent,
        dataSource: data.source,
        shortAverage: round(shortAverage),
        longAverage: round(longAverage),
        suggestedQuantity: Math.max(1, Math.floor((100000 * riskPercent) / (quote?.price || candles[lastIndex].close)))
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date().toISOString(),
    config: { shortWindow, longWindow, lookbackDays, riskPercent },
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

  const next = structuredClone(state);
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
    id: crypto.randomUUID(),
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
