function round(value, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function percentileRank(values, value) {
  if (!values.length) {
    return 0;
  }

  const below = values.filter((item) => item <= value).length;
  return (below / values.length) * 100;
}

export const tradingKnowledge = {
  principles: [
    {
      id: "capital-preservation",
      label: "Capital preservation first",
      lesson: "No signal should outrank position sizing, stop logic, drawdown limits, and the ability to stop trading."
    },
    {
      id: "liquidity",
      label: "Liquidity is execution quality",
      lesson: "Prefer symbols with enough volume and dollar volume to enter and exit without materially moving price."
    },
    {
      id: "volatility",
      label: "Volatility expands both opportunity and risk",
      lesson: "Higher realized volatility requires smaller size, wider error tolerance, and stronger confirmation."
    },
    {
      id: "probabilistic-thinking",
      label: "Think in probabilities",
      lesson: "A trade setup is a distribution of outcomes, not a prediction. Judge systems over repeated samples."
    },
    {
      id: "process-over-prediction",
      label: "Process beats prediction",
      lesson: "Backtests, journals, and predefined exits matter more than a single confident forecast."
    }
  ],
  readingList: [
    {
      title: "Market Wizards",
      author: "Jack D. Schwager",
      topic: "Trader interviews, risk process, psychology"
    },
    {
      title: "Technical Analysis of the Financial Markets",
      author: "John J. Murphy",
      topic: "Trend, momentum, support/resistance, indicators"
    },
    {
      title: "Trading in the Zone",
      author: "Mark Douglas",
      topic: "Probabilistic mindset and discipline"
    },
    {
      title: "Reminiscences of a Stock Operator",
      author: "Edwin Lefèvre",
      topic: "Speculation psychology and risk errors"
    },
    {
      title: "Algorithmic Trading",
      author: "Ernie Chan",
      topic: "Systematic strategy design and validation"
    },
    {
      title: "Advances in Financial Machine Learning",
      author: "Marcos López de Prado",
      topic: "Modern research workflow, leakage control, labeling"
    }
  ],
  riskRules: [
    "Avoid increasing size after a hot streak without new evidence.",
    "Treat low liquidity as a trade blocker, not a small inconvenience.",
    "Cut strategy size when volatility regime is extreme.",
    "Never trust a backtest without slippage, fees, and out-of-sample thinking.",
    "Prefer repeatable process metrics over one-off P/L."
  ]
};

export function assessMarketIntelligence(candles = [], quote = null) {
  const usableCandles = candles.filter(
    (candle) =>
      Number.isFinite(candle.close) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.volume)
  );

  if (usableCandles.length < 25) {
    return {
      liquidityGrade: "unknown",
      volatilityRegime: "unknown",
      scoreAdjustment: -10,
      riskFlags: ["Not enough market history for liquidity/volatility scoring."]
    };
  }

  const recent = usableCandles.slice(-20);
  const previousCloseReturns = usableCandles.slice(1).map((candle, index) => {
    const prior = usableCandles[index];
    return (candle.close - prior.close) / prior.close;
  });
  const recentReturns = previousCloseReturns.slice(-20);
  const annualizedVolatility = standardDeviation(recentReturns) * Math.sqrt(252) * 100;
  const averageDailyVolume = average(recent.map((candle) => candle.volume));
  const averageDollarVolume = average(recent.map((candle) => candle.volume * candle.close));
  const volumeRank = percentileRank(
    usableCandles.slice(-120).map((candle) => candle.volume),
    recent.at(-1).volume
  );
  const atrPercent =
    (average(recent.map((candle) => candle.high - candle.low)) / recent.at(-1).close) * 100;
  const currentPrice = quote?.price || recent.at(-1).close;
  const spreadProxyPercent = clamp(100 / Math.sqrt(Math.max(averageDollarVolume, 1)), 0.01, 2.5);

  const liquidityScore = clamp(
    Math.round(20 + Math.log10(Math.max(averageDollarVolume, 1)) * 9 + volumeRank * 0.25),
    1,
    100
  );
  const volatilityScore = clamp(Math.round(100 - Math.abs(annualizedVolatility - 22) * 1.8 - atrPercent * 2), 1, 100);
  const liquidityGrade =
    liquidityScore >= 80 ? "deep" : liquidityScore >= 60 ? "tradable" : liquidityScore >= 40 ? "thin" : "avoid";
  const volatilityRegime =
    annualizedVolatility >= 55 ? "extreme" : annualizedVolatility >= 32 ? "high" : annualizedVolatility >= 14 ? "normal" : "quiet";

  const riskFlags = [];
  if (liquidityScore < 45) {
    riskFlags.push("Liquidity is weak; simulated fills may be unrealistic.");
  }
  if (annualizedVolatility > 55) {
    riskFlags.push("Volatility is extreme; reduce size or wait for confirmation.");
  }
  if (atrPercent > 5) {
    riskFlags.push("Wide daily range increases stop-out and slippage risk.");
  }
  if (volumeRank < 25) {
    riskFlags.push("Current volume is below its recent range.");
  }

  const scoreAdjustment = clamp(
    Math.round((liquidityScore - 60) * 0.18 + (volatilityScore - 55) * 0.16 - riskFlags.length * 3),
    -20,
    18
  );

  return {
    currentPrice: round(currentPrice),
    averageDailyVolume: Math.round(averageDailyVolume),
    averageDollarVolume: round(averageDollarVolume, 0),
    volumeRank: round(volumeRank, 1),
    annualizedVolatility: round(annualizedVolatility, 2),
    atrPercent: round(atrPercent, 2),
    spreadProxyPercent: round(spreadProxyPercent, 3),
    liquidityScore,
    volatilityScore,
    liquidityGrade,
    volatilityRegime,
    scoreAdjustment,
    riskFlags
  };
}
