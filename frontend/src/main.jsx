import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  analyzeLearningJournal,
  buildPortfolio,
  createInitialPortfolio,
  evaluateDiscipline,
  getDataStatus,
  getMarketSnapshot,
  getSignals,
  loadBundledData,
  placePaperTrade,
  parseCandlesCsv,
  runBacktest,
  riskProfiles,
  scanMarket,
  strategies,
  symbols
} from "./botEngine.js";
import { projectCapabilities, projectTests } from "./projectSpec.js";
import "./styles.css";

const portfolioKey = "apex-alpha-static-portfolio";
const uploadedDataKey = "apex-alpha-uploaded-data";
const learningJournalKey = "apex-alpha-learning-journal";

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value || 0);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function buildPath(points) {
  if (!points.length) {
    return "";
  }

  const width = 640;
  const height = 180;
  const values = points.map((point) => point.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point.equity - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function loadStoredPortfolio() {
  try {
    const stored = localStorage.getItem(portfolioKey);
    return stored ? JSON.parse(stored) : createInitialPortfolio();
  } catch {
    return createInitialPortfolio();
  }
}

function loadUploadedData() {
  try {
    const stored = localStorage.getItem(uploadedDataKey);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function loadLearningJournal() {
  try {
    const stored = localStorage.getItem(learningJournalKey);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function App() {
  const [dataBySymbol, setDataBySymbol] = useState({});
  const [bundledData, setBundledData] = useState({});
  const [uploadedData, setUploadedData] = useState(loadUploadedData);
  const [market, setMarket] = useState(() => getMarketSnapshot());
  const [scanner, setScanner] = useState(null);
  const [portfolioState, setPortfolioState] = useState(loadStoredPortfolio);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [tradeForm, setTradeForm] = useState({ symbol: "AAPL", side: "buy", quantity: 1 });
  const [backtestForm, setBacktestForm] = useState({
    symbol: "SPY",
    startingCash: 100000,
    shortWindow: 20,
    longWindow: 50,
    lookbackDays: 260,
    riskPercent: 25,
    slippagePercent: 0.05,
    commission: 0,
    targetProfitPercent: 2,
    stopLossPercent: 2,
    takeProfitPercent: 3,
    trailingStopPercent: 1.25,
    profitLockPercent: 1,
    protectedProfitGivebackPercent: 1,
    maxConsecutiveLosses: 3,
    maxConsecutiveWins: 4,
    riskProfile: "moderate-bullish",
    strategy: "ma-crossover"
  });
  const [disciplineForm, setDisciplineForm] = useState({
    minProfitPercent: 1,
    maxProfitPercent: 3,
    maxDrawdownPercent: 5,
    minWinRatePercent: 45,
    minTrades: 2
  });
  const [learningJournal, setLearningJournal] = useState(loadLearningJournal);
  const [backtest, setBacktest] = useState(null);

  const signals = useMemo(() => getSignals(market), [market]);
  const portfolio = useMemo(() => buildPortfolio(portfolioState, market), [portfolioState, market]);
  const dataStatus = useMemo(() => getDataStatus(dataBySymbol), [dataBySymbol]);
  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.symbol === tradeForm.symbol),
    [signals, tradeForm.symbol]
  );
  const bestSetup = scanner?.results?.[0];
  const equityPath = buildPath(backtest?.equityCurve || []);
  const currentEvaluation = useMemo(
    () => evaluateDiscipline(backtest, disciplineForm),
    [backtest, disciplineForm]
  );
  const learningSummary = useMemo(() => analyzeLearningJournal(learningJournal), [learningJournal]);
  const strategyComparison = useMemo(
    () =>
      strategies.map((strategy) => {
        const result = runBacktest(
          {
            ...backtestForm,
            strategy: strategy.id,
            riskPercent: Number(backtestForm.riskPercent) / 100
          },
          dataBySymbol
        );
        return { strategy, result };
      }),
    [backtestForm, dataBySymbol]
  );
  const selfTests = useMemo(
    () =>
      projectTests.map((test) => ({
        ...test,
        passed: test.run({
          backtest,
          currentEvaluation,
          dataStatus,
          learningSummary,
          portfolio,
          scanner,
          strategyComparison
        })
      })),
    [backtest, currentEvaluation, dataStatus, learningSummary, portfolio, scanner, strategyComparison]
  );
  const passedTests = selfTests.filter((test) => test.passed).length;

  useEffect(() => {
    async function init() {
      const loadedBundledData = await loadBundledData();
      const mergedData = { ...loadedBundledData, ...uploadedData };
      const config = {
        ...backtestForm,
        riskPercent: Number(backtestForm.riskPercent) / 100
      };
      setBundledData(loadedBundledData);
      setDataBySymbol(mergedData);
      setBacktest(runBacktest(config, mergedData));
      setScanner(
        scanMarket(
          config,
          mergedData,
          market
        )
      );
      setLoading(false);
    }

    init();
  }, []);

  useEffect(() => {
    localStorage.setItem(portfolioKey, JSON.stringify(portfolioState));
  }, [portfolioState]);

  useEffect(() => {
    localStorage.setItem(uploadedDataKey, JSON.stringify(uploadedData));
    setDataBySymbol({ ...bundledData, ...uploadedData });
  }, [uploadedData, bundledData]);

  useEffect(() => {
    localStorage.setItem(learningJournalKey, JSON.stringify(learningJournal));
  }, [learningJournal]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMarket(getMarketSnapshot());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  function syncSymbol(symbol) {
    setTradeForm((current) => ({ ...current, symbol }));
    setBacktestForm((current) => ({ ...current, symbol }));
  }

  function submitTrade(event) {
    event.preventDefault();
    setMessage("");

    try {
      setPortfolioState((current) => placePaperTrade(current, market, tradeForm));
      setMessage(`${tradeForm.side.toUpperCase()} filled: ${tradeForm.quantity} ${tradeForm.symbol}.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function runBacktestFromForm(event) {
    event?.preventDefault();
    setMessage("");
    setBacktestLoading(true);

    const config = {
      ...backtestForm,
      riskPercent: Number(backtestForm.riskPercent) / 100
    };

    setBacktest(runBacktest(config, dataBySymbol));
    setScanner(scanMarket(config, dataBySymbol, market));
    setBacktestLoading(false);
  }

  function resetPortfolio() {
    setPortfolioState(createInitialPortfolio());
    setMessage("Paper portfolio reset.");
  }

  async function uploadCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const symbolFromName = file.name.replace(/\.[^.]+$/, "").trim().toUpperCase();
    const symbol = symbols.includes(symbolFromName) ? symbolFromName : backtestForm.symbol;

    try {
      const text = await file.text();
      const candles = parseCandlesCsv(text);

      if (candles.length < 2) {
        throw new Error("CSV must include date, open, high, low, close, and volume columns.");
      }

      const nextUploadedData = { ...uploadedData, [symbol]: candles };
      const mergedData = { ...bundledData, ...nextUploadedData };
      setUploadedData(nextUploadedData);
      setDataBySymbol(mergedData);
      setBacktest(
        runBacktest(
          { ...backtestForm, symbol, riskPercent: Number(backtestForm.riskPercent) / 100 },
          mergedData
        )
      );
      setScanner(
        scanMarket(
          { ...backtestForm, symbol, riskPercent: Number(backtestForm.riskPercent) / 100 },
          mergedData,
          market
        )
      );
      syncSymbol(symbol);
      setMessage(`Uploaded ${candles.length} rows for ${symbol}.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function clearUploadedData() {
    const config = {
      ...backtestForm,
      riskPercent: Number(backtestForm.riskPercent) / 100
    };
    setUploadedData({});
    setDataBySymbol(bundledData);
    setBacktest(runBacktest(config, bundledData));
    setScanner(scanMarket(config, bundledData, market));
    setMessage("Uploaded CSV data cleared.");
  }

  function saveLearningRun() {
    if (!backtest) {
      return;
    }

    const strategyName =
      strategies.find((strategy) => strategy.id === backtest.config.strategy)?.name ||
      backtest.config.strategy;
    const run = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      symbol: backtest.config.symbol,
      strategy: strategyName,
      config: backtest.config,
      summary: backtest.summary,
      evaluation: currentEvaluation
    };
    setLearningJournal((current) => [run, ...current].slice(0, 100));
    setMessage(`Saved ${run.symbol} ${strategyName} test run with ${currentEvaluation.score}/100 discipline score.`);
  }

  function clearLearningJournal() {
    setLearningJournal([]);
    setMessage("Learning journal cleared.");
  }

  function useScanPick(result) {
    syncSymbol(result.symbol);
    setTradeForm({
      symbol: result.symbol,
      side: result.action === "sell" ? "sell" : "buy",
      quantity: result.suggestedQuantity
    });
    setBacktestForm((current) => ({ ...current, symbol: result.symbol }));
  }

  return (
    <main className="app">
      <section className="hero">
        <div>
          <p className="eyebrow">Static Paper Bot</p>
          <h1>Apex Alpha AI</h1>
          <p className="lede">
            Scan, backtest, paper trade, and monitor risk without a paid backend.
          </p>
        </div>
        <div className="status-card">
          <span className="dot online" />
          <div>
            <strong>Static App Ready</strong>
            <small>browser paper mode</small>
          </div>
        </div>
      </section>

      {message && <div className="alert">{message}</div>}

      <section className="summary-strip">
        <div>
          <small>Portfolio Equity</small>
          <strong>{formatMoney(portfolio.equity)}</strong>
        </div>
        <div>
          <small>Total Return</small>
          <strong className={portfolio.totalReturn >= 0 ? "gain" : "loss"}>
            {formatMoney(portfolio.totalReturn)} · {formatPercent(portfolio.totalReturnPercent)}
          </strong>
        </div>
        <div>
          <small>Market Exposure</small>
          <strong>{formatMoney(portfolio.exposure)} · {formatPercent(portfolio.exposurePercent)}</strong>
        </div>
        <div>
          <small>Top Setup</small>
          <strong>{bestSetup ? `${bestSetup.symbol} · ${bestSetup.score}` : "Scanning"}</strong>
        </div>
        <div>
          <small>Learning Score</small>
          <strong>{learningSummary.totalRuns ? `${learningSummary.averageScore}/100` : "0/100"}</strong>
        </div>
      </section>

      <section className="brief-grid">
        <article className="card">
          <div className="card-header">
            <h2>Alpha V1 Brief</h2>
            <span className="pill buy">V1</span>
          </div>
          <div className="brief-list">
            {projectCapabilities.map((capability) => (
              <div className="brief-item" key={capability}>
                <span className="checkmark">✓</span>
                <span>{capability}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <h2>Self Tests</h2>
            <span className="pill hold">
              {passedTests}/{selfTests.length}
            </span>
          </div>
          <div className="brief-list">
            {selfTests.map((test) => (
              <div className="brief-item" key={test.id}>
                <span className={test.passed ? "checkmark" : "xmark"}>
                  {test.passed ? "✓" : "!"}
                </span>
                <span>{test.label}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="scanner-grid">
        <article className="card">
          <div className="card-header">
            <h2>Market Scanner</h2>
            <button type="button" className="secondary" onClick={runBacktestFromForm} disabled={backtestLoading}>
              Refresh
            </button>
          </div>
          <div className="signals">
            {scanner?.results?.map((result) => (
              <button
                type="button"
                className="scan-row"
                key={result.symbol}
                onClick={() => useScanPick(result)}
              >
                <div>
                  <strong>{result.symbol}</strong>
                  <small>{result.reason}</small>
                </div>
                <div className="scan-score">
                  <span className={`pill ${result.action}`}>{result.action}</span>
                  <strong>{result.score}</strong>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Paper Order Ticket</h2>
          <form onSubmit={submitTrade} className="trade-form">
            <label>
              Symbol
              <select value={tradeForm.symbol} onChange={(event) => syncSymbol(event.target.value)}>
                {symbols.map((symbol) => (
                  <option key={symbol}>{symbol}</option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Side
                <select
                  value={tradeForm.side}
                  onChange={(event) => setTradeForm({ ...tradeForm, side: event.target.value })}
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
                  value={tradeForm.quantity}
                  onChange={(event) =>
                    setTradeForm({ ...tradeForm, quantity: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <button type="submit" disabled={loading}>
              Submit Paper Order
            </button>
          </form>
          {selectedSignal && (
            <p className="signal-note">
              Live signal: <strong>{selectedSignal.action.toUpperCase()}</strong> ·{" "}
              {selectedSignal.confidence}% confidence
            </p>
          )}
        </article>
      </section>

      <section className="card upload-card">
        <div className="card-header">
          <h2>Update Market Data</h2>
          <button type="button" className="secondary danger" onClick={clearUploadedData}>
            Clear Uploads
          </button>
        </div>
        <div className="upload-row">
          <label className="file-picker">
            Upload CSV
            <input type="file" accept=".csv,text/csv" onChange={uploadCsv} />
          </label>
          <p className="signal-note">
            Name files by symbol, like AAPL.csv or SPY.csv. Uploaded data stays in this browser.
          </p>
        </div>
      </section>

      <section className="backtest-layout">
        <article className="card">
          <h2>Backtest Control</h2>
          <form onSubmit={runBacktestFromForm} className="trade-form">
            <label>
              Symbol
              <select value={backtestForm.symbol} onChange={(event) => syncSymbol(event.target.value)}>
                {symbols.map((symbol) => (
                  <option key={symbol}>{symbol}</option>
                ))}
              </select>
            </label>
            <label>
              Strategy
              <select
                value={backtestForm.strategy}
                onChange={(event) =>
                  setBacktestForm({ ...backtestForm, strategy: event.target.value })
                }
              >
                {strategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Risk Profile
              <select
                value={backtestForm.riskProfile}
                onChange={(event) =>
                  setBacktestForm({ ...backtestForm, riskProfile: event.target.value })
                }
              >
                {riskProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Starting Cash
              <input
                type="number"
                min="1000"
                step="1000"
                value={backtestForm.startingCash}
                onChange={(event) =>
                  setBacktestForm({ ...backtestForm, startingCash: Number(event.target.value) })
                }
              />
            </label>
            <div className="form-row">
              <label>
                Fast MA
                <input
                  type="number"
                  min="3"
                  max="100"
                  value={backtestForm.shortWindow}
                  onChange={(event) =>
                    setBacktestForm({ ...backtestForm, shortWindow: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Slow MA
                <input
                  type="number"
                  min="4"
                  max="220"
                  value={backtestForm.longWindow}
                  onChange={(event) =>
                    setBacktestForm({ ...backtestForm, longWindow: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Days
                <input
                  type="number"
                  min="80"
                  max="900"
                  value={backtestForm.lookbackDays}
                  onChange={(event) =>
                    setBacktestForm({ ...backtestForm, lookbackDays: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Risk %
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={backtestForm.riskPercent}
                  onChange={(event) =>
                    setBacktestForm({ ...backtestForm, riskPercent: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Slippage %
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.01"
                  value={backtestForm.slippagePercent}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      slippagePercent: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                Commission
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={backtestForm.commission}
                  onChange={(event) =>
                    setBacktestForm({ ...backtestForm, commission: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <label>
              Trade Target %
              <input
                type="number"
                min="0.25"
                max="20"
                step="0.25"
                value={backtestForm.targetProfitPercent}
                onChange={(event) =>
                  setBacktestForm({
                    ...backtestForm,
                    targetProfitPercent: Number(event.target.value)
                  })
                }
              />
            </label>
            <div className="form-row">
              <label>
                Stop Loss %
                <input
                  type="number"
                  min="0.25"
                  max="20"
                  step="0.25"
                  value={backtestForm.stopLossPercent}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      stopLossPercent: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                Take Profit %
                <input
                  type="number"
                  min="0.25"
                  max="30"
                  step="0.25"
                  value={backtestForm.takeProfitPercent}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      takeProfitPercent: Number(event.target.value)
                    })
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Trail Stop %
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.25"
                  value={backtestForm.trailingStopPercent}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      trailingStopPercent: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                Profit Lock %
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.25"
                  value={backtestForm.profitLockPercent}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      profitLockPercent: Number(event.target.value)
                    })
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Giveback %
                <input
                  type="number"
                  min="0.25"
                  max="20"
                  step="0.25"
                  value={backtestForm.protectedProfitGivebackPercent}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      protectedProfitGivebackPercent: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                Max Bad Trades
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={backtestForm.maxConsecutiveLosses}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      maxConsecutiveLosses: Number(event.target.value)
                    })
                  }
                />
              </label>
            </div>
            <label>
              Max Good Trades Before Stop
              <input
                type="number"
                min="1"
                max="20"
                step="1"
                value={backtestForm.maxConsecutiveWins}
                onChange={(event) =>
                  setBacktestForm({
                    ...backtestForm,
                    maxConsecutiveWins: Number(event.target.value)
                  })
                }
              />
            </label>
            <button type="submit" disabled={backtestLoading}>
              {backtestLoading ? "Running..." : "Run Backtest"}
            </button>
          </form>
        </article>

        <article className="card results-card">
          <div className="card-header">
            <h2>Backtest Results</h2>
            <div className="result-badges">
              <span className="pill hold">
                {strategies.find((strategy) => strategy.id === backtest?.config?.strategy)?.name ||
                  "Strategy"}
              </span>
              <span className={`pill ${backtest?.data?.source === "csv" ? "buy" : "hold"}`}>
                {backtest?.data?.source || "simulated"}
              </span>
              <span className={`pill ${currentEvaluation.verdict === "qualified" ? "buy" : "hold"}`}>
                {currentEvaluation.verdict}
              </span>
              <span className="pill hold">
                {riskProfiles.find((profile) => profile.id === backtest?.config?.riskProfile)?.name ||
                  "Risk"}
              </span>
            </div>
          </div>
          <div className="metrics six">
            <div>
              <small>Final Equity</small>
              <strong>{formatMoney(backtest?.summary?.finalEquity)}</strong>
            </div>
            <div>
              <small>Return</small>
              <strong className={backtest?.summary?.returnPercent >= 0 ? "gain" : "loss"}>
                {formatPercent(backtest?.summary?.returnPercent)}
              </strong>
            </div>
            <div>
              <small>Max Drawdown</small>
              <strong className="loss">{formatPercent(backtest?.summary?.maxDrawdownPercent)}</strong>
            </div>
            <div>
              <small>Win Rate</small>
              <strong>{formatPercent(backtest?.summary?.winRatePercent)}</strong>
            </div>
            <div>
              <small>Avg Trade</small>
              <strong className={backtest?.summary?.averageTradeReturnPercent >= 0 ? "gain" : "loss"}>
                {formatPercent(backtest?.summary?.averageTradeReturnPercent)}
              </strong>
            </div>
            <div>
              <small>Target Hits</small>
              <strong>{formatPercent(backtest?.summary?.targetHitRatePercent)}</strong>
            </div>
            <div>
              <small>Profit Factor</small>
              <strong>{Number(backtest?.summary?.profitFactor || 0).toFixed(2)}</strong>
            </div>
            <div>
              <small>Stop Exits</small>
              <strong>{backtest?.summary?.stopLossExits || 0}</strong>
            </div>
            <div>
              <small>Profit Exits</small>
              <strong>{backtest?.summary?.takeProfitExits || 0}</strong>
            </div>
            <div>
              <small>Trail Exits</small>
              <strong>{backtest?.summary?.trailingStopExits || 0}</strong>
            </div>
            <div>
              <small>Protected Stops</small>
              <strong>{backtest?.summary?.protectedHalts || 0}</strong>
            </div>
            <div>
              <small>Pattern Entries</small>
              <strong>{backtest?.summary?.patternConfirmedEntries || 0}</strong>
            </div>
          </div>
          {backtest?.summary?.halted && (
            <p className="signal-note">
              Protection halt: <strong>{backtest.summary.haltReason}</strong>
            </p>
          )}
          <div className="chart" aria-label="Backtest equity curve">
            <svg viewBox="0 0 640 180" role="img">
              <path className="chart-fill" d={`${equityPath} L 640 180 L 0 180 Z`} />
              <path className="chart-line" d={equityPath} />
            </svg>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Fees</th>
                <th>Exit</th>
                <th>Trade %</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>
              {backtest?.trades?.length ? (
                backtest.trades.map((trade) => (
                  <tr key={`${trade.date}-${trade.side}-${trade.price}`}>
                    <td>{trade.date}</td>
                    <td>
                      <span className={`pill ${trade.side === "buy" ? "buy" : "sell"}`}>
                        {trade.side}
                      </span>
                    </td>
                    <td>{trade.quantity}</td>
                    <td>{formatMoney(trade.price)}</td>
                    <td>{formatMoney(trade.commission)}</td>
                    <td>{trade.exitType || "-"}</td>
                    <td className={(trade.returnPercent || 0) >= 0 ? "gain" : "loss"}>
                      {trade.returnPercent === undefined ? "-" : formatPercent(trade.returnPercent)}
                    </td>
                    <td className={(trade.pnl || 0) >= 0 ? "gain" : "loss"}>
                      {trade.pnl === undefined ? "-" : formatMoney(trade.pnl)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">No trades triggered.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      </section>

      <section className="discipline-grid">
        <article className="card">
          <div className="card-header">
            <h2>Discipline Rules</h2>
            <span className={`pill ${currentEvaluation.verdict === "qualified" ? "buy" : "hold"}`}>
              {currentEvaluation.score}/100
            </span>
          </div>
          <div className="form-row">
            <label>
              Min Trade %
              <input
                type="number"
                min="0"
                max="20"
                step="0.25"
                value={disciplineForm.minProfitPercent}
                onChange={(event) =>
                  setDisciplineForm({
                    ...disciplineForm,
                    minProfitPercent: Number(event.target.value)
                  })
                }
              />
            </label>
            <label>
              Max Trade %
              <input
                type="number"
                min="0.25"
                max="50"
                step="0.25"
                value={disciplineForm.maxProfitPercent}
                onChange={(event) =>
                  setDisciplineForm({
                    ...disciplineForm,
                    maxProfitPercent: Number(event.target.value)
                  })
                }
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Max Drawdown %
              <input
                type="number"
                min="0.25"
                max="80"
                step="0.25"
                value={disciplineForm.maxDrawdownPercent}
                onChange={(event) =>
                  setDisciplineForm({
                    ...disciplineForm,
                    maxDrawdownPercent: Number(event.target.value)
                  })
                }
              />
            </label>
            <label>
              Min Win Rate %
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={disciplineForm.minWinRatePercent}
                onChange={(event) =>
                  setDisciplineForm({
                    ...disciplineForm,
                    minWinRatePercent: Number(event.target.value)
                  })
                }
              />
            </label>
          </div>
          <label>
            Min Completed Trades
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={disciplineForm.minTrades}
              onChange={(event) =>
                setDisciplineForm({ ...disciplineForm, minTrades: Number(event.target.value) })
              }
            />
          </label>
          <div className="brief-list discipline-checks">
            {currentEvaluation.checks.map((check) => (
              <div className="brief-item" key={check.id}>
                <span className={check.passed ? "checkmark" : "xmark"}>
                  {check.passed ? "✓" : "!"}
                </span>
                <span>{check.label}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={saveLearningRun}>
            Save Test Run
          </button>
        </article>

        <article className="card">
          <div className="card-header">
            <h2>Learning Journal</h2>
            <button type="button" className="secondary danger" onClick={clearLearningJournal}>
              Clear
            </button>
          </div>
          <div className="metrics four">
            <div>
              <small>Saved Runs</small>
              <strong>{learningSummary.totalRuns}</strong>
            </div>
            <div>
              <small>Qualified</small>
              <strong>{learningSummary.qualifiedRuns}</strong>
            </div>
            <div>
              <small>Avg Score</small>
              <strong>{learningSummary.averageScore}/100</strong>
            </div>
            <div>
              <small>Evidence</small>
              <strong>{learningSummary.evidenceLevel}</strong>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Setup</th>
                <th>Avg Trade</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {learningJournal.length ? (
                learningJournal.slice(0, 8).map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.createdAt).toLocaleDateString()}</td>
                    <td>
                      {run.symbol} · {run.strategy}
                    </td>
                    <td
                      className={
                        run.summary.averageTradeReturnPercent >= 0 ? "gain" : "loss"
                      }
                    >
                      {formatPercent(run.summary.averageTradeReturnPercent)}
                    </td>
                    <td>{run.evaluation.score}/100</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4">Save repeated paper tests to build evidence.</td>
                </tr>
              )}
            </tbody>
          </table>
          {learningSummary.bestStrategy && (
            <p className="signal-note">
              Best repeated setup: <strong>{learningSummary.bestStrategy.strategy}</strong> ·{" "}
              {learningSummary.bestStrategy.averageScore}/100 average.
            </p>
          )}
        </article>
      </section>

      <section className="card data-card">
        <h2>Strategy Comparison</h2>
        <table>
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Return</th>
              <th>Max DD</th>
              <th>Win Rate</th>
              <th>Avg Trade</th>
              <th>Stops</th>
              <th>Halts</th>
              <th>Trades</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {strategyComparison.map(({ strategy, result }) => (
              <tr key={strategy.id}>
                <td>{strategy.name}</td>
                <td className={result.summary.returnPercent >= 0 ? "gain" : "loss"}>
                  {formatPercent(result.summary.returnPercent)}
                </td>
                <td className="loss">{formatPercent(result.summary.maxDrawdownPercent)}</td>
                <td>{formatPercent(result.summary.winRatePercent)}</td>
                <td className={result.summary.averageTradeReturnPercent >= 0 ? "gain" : "loss"}>
                  {formatPercent(result.summary.averageTradeReturnPercent)}
                </td>
                <td>{result.summary.stopLossExits}</td>
                <td>{result.summary.protectedHalts}</td>
                <td>{result.summary.totalTrades}</td>
                <td>
                  <span className={`pill ${result.data.source === "csv" ? "buy" : "hold"}`}>
                    {result.data.source}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid">
        <article className="card">
          <div className="card-header">
            <h2>Portfolio</h2>
            <button type="button" className="secondary danger" onClick={resetPortfolio}>
              Reset
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Qty</th>
                <th>Avg</th>
                <th>Value</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.positions.length ? (
                portfolio.positions.map((position) => (
                  <tr key={position.symbol}>
                    <td>{position.symbol}</td>
                    <td>{position.quantity}</td>
                    <td>{formatMoney(position.averagePrice)}</td>
                    <td>{formatMoney(position.marketValue)}</td>
                    <td className={position.unrealizedPnl >= 0 ? "gain" : "loss"}>
                      {formatMoney(position.unrealizedPnl)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">No paper positions.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>

        <article className="card">
          <h2>Recent Paper Trades</h2>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Gross</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.trades.length ? (
                portfolio.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td>{new Date(trade.createdAt).toLocaleTimeString()}</td>
                    <td>{trade.symbol}</td>
                    <td>
                      <span className={`pill ${trade.side}`}>{trade.side}</span>
                    </td>
                    <td>{trade.quantity}</td>
                    <td>{formatMoney(trade.gross)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">No paper trades yet.</td>
                </tr>
              )}
            </tbody>
          </table>
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

      <section className="card data-card">
        <h2>Data Sources</h2>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Source</th>
              <th>Rows</th>
              <th>First Date</th>
              <th>Last Date</th>
            </tr>
          </thead>
          <tbody>
            {dataStatus.map((item) => (
              <tr key={item.symbol}>
                <td>{item.symbol}</td>
                <td>
                  <span className={`pill ${item.source === "csv" ? "buy" : "hold"}`}>
                    {item.source}
                  </span>
                </td>
                <td>{item.rows}</td>
                <td>{item.firstDate || "-"}</td>
                <td>{item.lastDate || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
