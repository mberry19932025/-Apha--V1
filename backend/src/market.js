const symbols = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY", "QQQ"];

const basePrices = {
  AAPL: 212.45,
  MSFT: 426.8,
  NVDA: 118.72,
  TSLA: 231.6,
  SPY: 552.38,
  QQQ: 472.19
};

export function getMarketSnapshot() {
  const now = Date.now();

  return symbols.map((symbol, index) => {
    const wave = Math.sin(now / 900000 + index) * 0.018;
    const drift = Math.cos(now / 1300000 + index * 2) * 0.006;
    const price = basePrices[symbol] * (1 + wave + drift);
    const changePercent = (wave + drift) * 100;

    return {
      symbol,
      price: Number(price.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      volume: Math.floor(950000 + Math.abs(Math.sin(now / 500000 + index)) * 8000000)
    };
  });
}

export function getQuote(symbol) {
  return getMarketSnapshot().find((quote) => quote.symbol === symbol.toUpperCase());
}

export function getSignals() {
  return getMarketSnapshot().map((quote) => {
    const action =
      quote.changePercent > 1.2 ? "sell" : quote.changePercent < -1.2 ? "buy" : "hold";
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
