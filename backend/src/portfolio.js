import { getQuote } from "./market.js";

const state = {
  cash: 100000,
  startingCash: 100000,
  realizedPnl: 0,
  trades: [],
  positions: {}
};

export function getPortfolio() {
  const positions = Object.entries(state.positions).map(([symbol, position]) => {
    const quote = getQuote(symbol);
    const marketValue = quote ? quote.price * position.quantity : 0;
    const unrealizedPnl = marketValue - position.averagePrice * position.quantity;

    return {
      symbol,
      quantity: position.quantity,
      averagePrice: Number(position.averagePrice.toFixed(2)),
      marketPrice: quote?.price ?? null,
      marketValue: Number(marketValue.toFixed(2)),
      unrealizedPnl: Number(unrealizedPnl.toFixed(2))
    };
  });

  const equity = positions.reduce((sum, position) => sum + position.marketValue, state.cash);
  const exposure = positions.reduce((sum, position) => sum + position.marketValue, 0);

  return {
    mode: process.env.TRADING_MODE || "paper",
    cash: Number(state.cash.toFixed(2)),
    equity: Number(equity.toFixed(2)),
    startingCash: state.startingCash,
    realizedPnl: Number(state.realizedPnl.toFixed(2)),
    totalReturn: Number((equity - state.startingCash).toFixed(2)),
    totalReturnPercent: Number((((equity - state.startingCash) / state.startingCash) * 100).toFixed(2)),
    exposure: Number(exposure.toFixed(2)),
    exposurePercent: Number(((exposure / equity) * 100).toFixed(2)),
    positions,
    trades: state.trades.slice(-20).reverse()
  };
}

export function placeTrade({ symbol, side, quantity }) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const normalizedSide = String(side || "").trim().toLowerCase();
  const normalizedQuantity = Number(quantity);

  if (!normalizedSymbol) {
    throw new Error("Symbol is required.");
  }

  if (!["buy", "sell"].includes(normalizedSide)) {
    throw new Error("Side must be buy or sell.");
  }

  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  const quote = getQuote(normalizedSymbol);
  if (!quote) {
    throw new Error(`Unsupported symbol: ${normalizedSymbol}.`);
  }

  const gross = quote.price * normalizedQuantity;
  const position = state.positions[normalizedSymbol] || { quantity: 0, averagePrice: 0 };

  if (normalizedSide === "buy") {
    if (gross > state.cash) {
      throw new Error("Insufficient paper cash.");
    }

    const totalCost = position.averagePrice * position.quantity + gross;
    position.quantity += normalizedQuantity;
    position.averagePrice = totalCost / position.quantity;
    state.cash -= gross;
    state.positions[normalizedSymbol] = position;
  } else {
    if (position.quantity < normalizedQuantity) {
      throw new Error("Cannot sell more shares than the paper portfolio holds.");
    }

    state.realizedPnl += (quote.price - position.averagePrice) * normalizedQuantity;
    position.quantity -= normalizedQuantity;
    state.cash += gross;

    if (position.quantity === 0) {
      delete state.positions[normalizedSymbol];
    } else {
      state.positions[normalizedSymbol] = position;
    }
  }

  const trade = {
    id: crypto.randomUUID(),
    symbol: normalizedSymbol,
    side: normalizedSide,
    quantity: normalizedQuantity,
    price: quote.price,
    gross: Number(gross.toFixed(2)),
    realizedPnl:
      normalizedSide === "sell"
        ? Number(((quote.price - position.averagePrice) * normalizedQuantity).toFixed(2))
        : 0,
    createdAt: new Date().toISOString()
  };

  state.trades.push(trade);
  return trade;
}

export function resetPortfolio() {
  state.cash = state.startingCash;
  state.realizedPnl = 0;
  state.trades = [];
  state.positions = {};
  return getPortfolio();
}
