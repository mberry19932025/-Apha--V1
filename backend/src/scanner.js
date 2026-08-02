import { getHistoricalCandlesWithSource, movingAverage, runBacktest } from "./backtest.js";
import { getMarketSnapshot, getSupportedSymbols } from "./market.js";

function round(value, decimals = 2) {
  return Number(value.toFixed(decimals));
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

export function scanMarket(options = {}) {
  const shortWindow = Number(options.shortWindow || 20);
  const longWindow = Number(options.longWindow || 50);
  const lookbackDays = Number(options.lookbackDays || 260);
  const riskPercent = Number(options.riskPercent || 0.25);
  const quotes = getMarketSnapshot();

  const results = getSupportedSymbols()
    .map((symbol) => {
      const backtest = runBacktest({ symbol, shortWindow, longWindow, lookbackDays, riskPercent });
      const data = getHistoricalCandlesWithSource(symbol, Math.max(lookbackDays, longWindow + 5), longWindow + 5);
      const candles = data.candles;
      const lastIndex = candles.length - 1;
      const quote = quotes.find((item) => item.symbol === symbol);
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
