import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value || 0);
}

function App() {
  const [health, setHealth] = useState(null);
  const [market, setMarket] = useState([]);
  const [signals, setSignals] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [form, setForm] = useState({ symbol: "AAPL", side: "buy", quantity: 1 });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [healthRes, marketRes, signalsRes, portfolioRes] = await Promise.all([
        fetch(`${API_URL}/api/health`),
        fetch(`${API_URL}/api/market`),
        fetch(`${API_URL}/api/signals`),
        fetch(`${API_URL}/api/portfolio`)
      ]);

      if (!healthRes.ok || !marketRes.ok || !signalsRes.ok || !portfolioRes.ok) {
        throw new Error("API request failed.");
      }

      setHealth(await healthRes.json());
      setMarket((await marketRes.json()).quotes);
      setSignals((await signalsRes.json()).signals);
      setPortfolio(await portfolioRes.json());
    } catch (error) {
      setMessage(`Could not connect to backend: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.symbol === form.symbol),
    [signals, form.symbol]
  );

  async function submitTrade(event) {
    event.preventDefault();
    setMessage("");

    try {
      const res = await fetch(`${API_URL}/api/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Trade failed.");
      }

      setPortfolio(data.portfolio);
      setMessage(`${form.side.toUpperCase()} order filled for ${form.quantity} ${form.symbol}.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="app">
      <section className="hero">
        <div>
          <p className="eyebrow">Paper Trading</p>
          <h1>TradeBot Dashboard</h1>
          <p className="lede">
            Monitor simulated market signals, execute paper trades, and track portfolio exposure.
          </p>
        </div>
        <div className="status-card">
          <span className={health?.ok ? "dot online" : "dot"} />
          <div>
            <strong>{health?.ok ? "API Online" : "API Offline"}</strong>
            <small>{health?.mode || "paper"} mode</small>
          </div>
        </div>
      </section>

      {message && <div className="alert">{message}</div>}

      <section className="grid">
        <article className="card">
          <h2>Portfolio</h2>
          <div className="metrics">
            <div>
              <small>Equity</small>
              <strong>{formatMoney(portfolio?.equity)}</strong>
            </div>
            <div>
              <small>Cash</small>
              <strong>{formatMoney(portfolio?.cash)}</strong>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Qty</th>
                <th>Value</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio?.positions?.length ? (
                portfolio.positions.map((position) => (
                  <tr key={position.symbol}>
                    <td>{position.symbol}</td>
                    <td>{position.quantity}</td>
                    <td>{formatMoney(position.marketValue)}</td>
                    <td className={position.unrealizedPnl >= 0 ? "gain" : "loss"}>
                      {formatMoney(position.unrealizedPnl)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4">No paper positions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>

        <article className="card">
          <h2>Place Paper Trade</h2>
          <form onSubmit={submitTrade} className="trade-form">
            <label>
              Symbol
              <select
                value={form.symbol}
                onChange={(event) => setForm({ ...form, symbol: event.target.value })}
              >
                {market.map((quote) => (
                  <option key={quote.symbol}>{quote.symbol}</option>
                ))}
              </select>
            </label>
            <label>
              Side
              <select
                value={form.side}
                onChange={(event) => setForm({ ...form, side: event.target.value })}
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </label>
            <label>
              Quantity
              <input
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
              />
            </label>
            <button type="submit" disabled={loading}>
              Submit Paper Order
            </button>
          </form>
          {selectedSignal && (
            <p className="signal-note">
              Current signal: <strong>{selectedSignal.action.toUpperCase()}</strong> ·{" "}
              {selectedSignal.confidence}% confidence
            </p>
          )}
        </article>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Market</h2>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Price</th>
                <th>Change</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {market.map((quote) => (
                <tr key={quote.symbol}>
                  <td>{quote.symbol}</td>
                  <td>{formatMoney(quote.price)}</td>
                  <td className={quote.changePercent >= 0 ? "gain" : "loss"}>
                    {quote.changePercent}%
                  </td>
                  <td>{quote.volume.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="card">
          <h2>Strategy Signals</h2>
          <div className="signals">
            {signals.map((signal) => (
              <div className="signal" key={signal.symbol}>
                <div>
                  <strong>{signal.symbol}</strong>
                  <small>{signal.reason}</small>
                </div>
                <span className={`pill ${signal.action}`}>{signal.action}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
