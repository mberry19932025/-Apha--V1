import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  analyzeLearningJournal,
  assetCatalog,
  buildOptionsIdeas,
  buildPortfolio,
  buildStrategyMap,
  createInitialPortfolio,
  evaluateDiscipline,
  evaluateAutomationPlan,
  evaluateReadiness,
  getDataStatus,
  getMarketClock,
  getMarketSnapshot,
  getSignals,
  loadBundledData,
  placePaperFuturesTrade,
  placePaperOptionTrade,
  placePaperTrade,
  parseCandlesCsv,
  runBacktest,
  riskProfiles,
  rankAutomationCategories,
  scanMarket,
  strategies,
  symbols,
  tradingKnowledge
} from "./botEngine.js";
import { projectCapabilities, projectTests } from "./projectSpec.js";
import "./styles.css";

const portfolioKey = "apex-alpha-static-portfolio";
const uploadedDataKey = "apex-alpha-uploaded-data";
const learningJournalKey = "apex-alpha-learning-journal";
const watchlistKey = "apex-alpha-watchlist";
const automationLogKey = "apex-alpha-automation-log";
const automationSnapshotsKey = "apex-alpha-automation-snapshots";
const sessionPeakEquityKey = "apex-alpha-session-peak-equity";

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value || 0);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatCompact(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value || 0);
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function loadStoredArray(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : fallback;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadStoredNumber(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    const parsed = stored === null ? fallback : Number(stored);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
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
    startingCash: 3000,
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
    riskProfile: "moderate",
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
  const [watchlist, setWatchlist] = useState(() => loadStoredArray(watchlistKey, ["SPY", "QQQ"]));
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [automationMode, setAutomationMode] = useState("moderate");
  const [dayTradeEnabled, setDayTradeEnabled] = useState(true);
  const [optionsEnabled, setOptionsEnabled] = useState(false);
  const [allowFuturesExtendedHours, setAllowFuturesExtendedHours] = useState(false);
  const [marketClock, setMarketClock] = useState(() => getMarketClock());
  const [marketCloseSnapshotSaved, setMarketCloseSnapshotSaved] = useState(false);
  const [sessionPeakEquity, setSessionPeakEquity] = useState(() =>
    loadStoredNumber(sessionPeakEquityKey, 3000)
  );
  const [automationLog, setAutomationLog] = useState(() => loadStoredArray(automationLogKey, []));
  const [automationSnapshots, setAutomationSnapshots] = useState(() =>
    loadStoredArray(automationSnapshotsKey, [])
  );
  const [backtest, setBacktest] = useState(null);

  const signals = useMemo(() => getSignals(market), [market]);
  const portfolio = useMemo(() => buildPortfolio(portfolioState, market), [portfolioState, market]);
  const dataStatus = useMemo(() => getDataStatus(dataBySymbol), [dataBySymbol]);
  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.symbol === tradeForm.symbol),
    [signals, tradeForm.symbol]
  );
  const bestSetup = scanner?.results?.[0];
  const marketIntelligence = scanner?.results || [];
  const optionsIdeas = useMemo(() => buildOptionsIdeas(scanner?.results || [], market), [scanner, market]);
  const categoryRanks = useMemo(
    () => rankAutomationCategories(scanner?.results || [], watchlist),
    [scanner, watchlist]
  );
  const strategyMap = useMemo(() => {
    const config = {
      ...backtestForm,
      riskPercent: Number(backtestForm.riskPercent) / 100
    };
    return buildStrategyMap(config, dataBySymbol, symbols);
  }, [backtestForm, dataBySymbol]);
  const todayAutomationSnapshots = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return automationSnapshots.filter((snapshot) => snapshot.tradeDate === today);
  }, [automationSnapshots]);
  const equityPath = buildPath(backtest?.equityCurve || []);
  const currentEvaluation = useMemo(
    () => evaluateDiscipline(backtest, disciplineForm),
    [backtest, disciplineForm]
  );
  const learningSummary = useMemo(() => analyzeLearningJournal(learningJournal), [learningJournal]);
  const readiness = useMemo(
    () =>
      evaluateReadiness({
        backtest,
        currentEvaluation,
        dataStatus,
        learningSummary,
        portfolio
      }),
    [backtest, currentEvaluation, dataStatus, learningSummary, portfolio]
  );
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
          readiness,
          scanner,
          strategyComparison
        })
      })),
    [backtest, currentEvaluation, dataStatus, learningSummary, portfolio, readiness, scanner, strategyComparison]
  );
  const passedTests = selfTests.filter((test) => test.passed).length;
  const automationPlan = useMemo(
    () =>
      evaluateAutomationPlan({
        scanner,
        portfolio,
        mode: automationMode,
        watchlist,
        dayTradeEnabled,
        optionsEnabled,
        strategyMap,
        automationLog,
        futuresEnabled: true,
        marketClock,
        allowFuturesExtendedHours,
        sessionPeakEquity
      }),
    [
      scanner,
      portfolio,
      automationMode,
      watchlist,
      dayTradeEnabled,
      optionsEnabled,
      strategyMap,
      automationLog,
      marketClock,
      allowFuturesExtendedHours,
      sessionPeakEquity
    ]
  );

  useEffect(() => {
    async function init() {
      try {
        const loadedBundledData = await loadBundledData();
        const mergedData = { ...loadedBundledData, ...uploadedData };
        const config = {
          ...backtestForm,
          riskPercent: Number(backtestForm.riskPercent) / 100
        };
        setBundledData(loadedBundledData);
        setDataBySymbol(mergedData);
        setBacktest(runBacktest(config, mergedData));
        setScanner(scanMarket(config, mergedData, market));
      } catch (error) {
        setMessage(`Loaded paper trading mode, but historical data failed: ${error.message}`);
      } finally {
        setLoading(false);
      }
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
    localStorage.setItem(watchlistKey, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem(automationLogKey, JSON.stringify(automationLog));
  }, [automationLog]);

  useEffect(() => {
    localStorage.setItem(automationSnapshotsKey, JSON.stringify(automationSnapshots));
  }, [automationSnapshots]);

  useEffect(() => {
    setSessionPeakEquity((current) => Math.max(current, portfolio.equity));
  }, [portfolio.equity]);

  useEffect(() => {
    localStorage.setItem(sessionPeakEquityKey, String(sessionPeakEquity));
  }, [sessionPeakEquity]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMarket(getMarketSnapshot());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setMarketClock(getMarketClock());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (marketClock.isRegularSession) {
      setMarketCloseSnapshotSaved(false);
      return;
    }

    if (automationEnabled && !allowFuturesExtendedHours) {
      setAutomationEnabled(false);
      recordAutomation({
        action: "market-closed",
        symbol: "-",
        quantity: 0,
        reason: `Automation stopped at market close (${marketClock.label}).`
      });
    }

    if (marketClock.isAfterClose && !marketCloseSnapshotSaved) {
      saveAutomationSnapshot(`Market-close snapshot saved at ${marketClock.label}.`);
      setMarketCloseSnapshotSaved(true);
    }
  }, [marketClock, automationEnabled, allowFuturesExtendedHours, marketCloseSnapshotSaved]);

  useEffect(() => {
    if (!automationEnabled) {
      return undefined;
    }

    const timer = setInterval(() => {
      runAutomationCycle();
    }, 20000);

    return () => clearInterval(timer);
  }, [
    automationEnabled,
    automationPlan,
    portfolioState,
    market,
    dayTradeEnabled,
    optionsEnabled,
    allowFuturesExtendedHours,
    marketClock
  ]);

  function syncSymbol(symbol) {
    setTradeForm((current) => ({ ...current, symbol }));
    setBacktestForm((current) => ({ ...current, symbol }));
  }

  function executePaperOrder(order) {
    const activeMarket = market.length ? market : getMarketSnapshot();
      const selectedStrategy = strategyMap[order.symbol];
      const normalizedOrder = {
        ...order,
        quantity: Math.max(1, Number(order.quantity || 1)),
        strategy: selectedStrategy?.strategy?.name || "Best available",
        strategyScore: selectedStrategy?.score || null
      };

    const nextPortfolioState = placePaperTrade(portfolioState, activeMarket, normalizedOrder);
    setPortfolioState(nextPortfolioState);
    const latestTrade = nextPortfolioState.trades.at(-1);
      setMessage(
        `${normalizedOrder.side.toUpperCase()} filled: ${latestTrade.quantity} ${latestTrade.symbol} at ${formatMoney(
          latestTrade.price
        )}. Strategy: ${normalizedOrder.strategy}.`
      );
  }

  function submitTrade(event) {
    event?.preventDefault();
    setMessage("");

    try {
      executePaperOrder(tradeForm);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function quickTrade(side) {
    setMessage("");

    try {
      const order = { symbol: "SPY", side, quantity: 1 };
      setTradeForm(order);
      executePaperOrder(order);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function tradeOptionIdea(idea, side) {
    setMessage("");

    try {
      const selectedStrategy = strategyMap[idea.underlying];
      const nextPortfolioState = placePaperOptionTrade(portfolioState, idea, {
        side,
        quantity: 1,
        strategy: selectedStrategy?.strategy?.name || "Best available",
        strategyScore: selectedStrategy?.score || null
      });
      setPortfolioState(nextPortfolioState);
      const latestTrade = nextPortfolioState.trades.at(-1);
      setMessage(
        `${side.toUpperCase()} option filled: ${latestTrade.description} x ${latestTrade.quantity} at ${formatMoney(
          latestTrade.price
        )} premium. Strategy: ${latestTrade.strategy}.`
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  function tradeFuture(symbol, side) {
    setMessage("");

    try {
      const selectedStrategy = strategyMap[symbol];
      const nextPortfolioState = placePaperFuturesTrade(portfolioState, market, {
        symbol,
        side,
        quantity: 1,
        strategy: selectedStrategy?.strategy?.name || "Best available",
        strategyScore: selectedStrategy?.score || null
      });
      setPortfolioState(nextPortfolioState);
      const latestTrade = nextPortfolioState.trades.at(-1);
      setMessage(
        `${side.toUpperCase()} future filled: ${latestTrade.description} x ${latestTrade.quantity} at ${formatMoney(
          latestTrade.price
        )}. Strategy: ${latestTrade.strategy}.`
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  function toggleWatch(symbol) {
    setWatchlist((current) =>
      current.includes(symbol)
        ? current.filter((item) => item !== symbol)
        : [...current, symbol]
    );
  }

  function recordAutomation(entry) {
    setAutomationLog((current) => [
      { id: makeId(), createdAt: new Date().toISOString(), ...entry },
      ...current
    ].slice(0, 25));
  }

  function saveAutomationSnapshot(reason) {
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      tradeDate: today,
      reason,
      mode: automationMode,
      dayTradeEnabled,
      optionsEnabled,
      watchlist,
      bestCategory: automationPlan.bestCategory,
      bestOptionIdea: automationPlan.bestOptionIdea,
      portfolio,
      scannerTop: scanner?.results?.slice(0, 5) || []
    };
    setAutomationSnapshots((current) => [snapshot, ...current].slice(0, 50));
    setLearningJournal((current) => [
      {
        id: makeId(),
        createdAt: snapshot.createdAt,
        symbol: automationPlan.symbol || snapshot.bestCategory?.category || "AUTO",
        strategy: `Automation ${automationMode}`,
        config: {
          mode: automationMode,
          dayTradeEnabled,
          optionsEnabled,
          watchlist,
          startingCash: portfolio.startingCash
        },
        summary: {
          finalEquity: portfolio.equity,
          totalReturn: portfolio.totalReturn,
          returnPercent: portfolio.totalReturnPercent,
          averageTradeReturnPercent: portfolio.totalReturnPercent,
          maxDrawdownPercent: 0,
          winRatePercent: portfolio.totalReturn >= 0 ? 100 : 0,
          completedTrades: portfolio.trades.length,
          profitFactor: portfolio.totalReturn > 0 ? 99 : 0
        },
        evaluation: {
          score: portfolio.totalReturn >= 0 ? 100 : 60,
          verdict: portfolio.totalReturn >= 0 ? "qualified" : "watch"
        }
      },
      ...current
    ].slice(0, 100));
  }

  function runAutomationCycle() {
    setMessage("");

    try {
      const plan = evaluateAutomationPlan({
        scanner,
        portfolio,
        mode: automationMode,
        watchlist,
        dayTradeEnabled,
        optionsEnabled,
        strategyMap,
        automationLog,
        futuresEnabled: true,
        marketClock,
        allowFuturesExtendedHours,
        sessionPeakEquity
      });

      if (plan.action === "hold" || plan.action === "market-closed") {
        recordAutomation({ action: "hold", symbol: "-", quantity: 0, reason: plan.reason });
        setMessage(`Automation HOLD: ${plan.reason}`);
        if (plan.action === "market-closed" || (plan.profitLock?.secureDayProfit && !plan.profitLock?.runnerLeft)) {
          setAutomationEnabled(false);
          saveAutomationSnapshot(plan.reason);
        }
        return;
      }

      if (plan.action === "buy-option") {
        const selectedStrategy = strategyMap[plan.symbol];
        const nextPortfolioState = placePaperOptionTrade(portfolioState, plan.optionIdea, {
          side: "buy",
          quantity: 1,
          strategy: selectedStrategy?.strategy?.name || "Best available",
          strategyScore: selectedStrategy?.score || null
        });
        setPortfolioState(nextPortfolioState);
        recordAutomation({
          action: "buy-option",
          symbol: plan.symbol,
          quantity: 1,
          reason: plan.reason
        });
        setMessage(`Automation BUY OPTION: ${plan.optionIdea.underlying} ${plan.optionIdea.contractType.toUpperCase()} · ${plan.reason}`);
        saveAutomationSnapshot(plan.reason);
        return;
      }

      if (plan.action === "sell-option") {
        const position = plan.optionPosition;
        const optionIdea = {
          underlying: position.underlying,
          contractType: position.contractType,
          strike: position.strike,
          expiry: position.expiry,
          premium: position.markPremium || position.averagePremium
        };
        const nextPortfolioState = placePaperOptionTrade(portfolioState, optionIdea, {
          side: "sell",
          quantity: plan.quantity,
          strategy: "Profit lock",
          strategyScore: null
        });
        setPortfolioState(nextPortfolioState);
        recordAutomation({
          action: "sell-option",
          symbol: plan.symbol,
          quantity: plan.quantity,
          reason: plan.reason
        });
        setMessage(`Automation SELL OPTION: ${plan.symbol} · ${plan.reason}`);
        saveAutomationSnapshot(plan.reason);
        if (plan.profitLock?.secureDayProfit && !plan.profitLock?.runnerLeft) {
          setAutomationEnabled(false);
        }
        return;
      }

      if (["buy-future", "sell-future"].includes(plan.action)) {
        const selectedStrategy = strategyMap[plan.symbol];
        const side = plan.action === "buy-future" ? "buy" : "sell";
        const nextPortfolioState = placePaperFuturesTrade(portfolioState, market, {
          symbol: plan.symbol,
          side,
          quantity: plan.quantity,
          strategy: selectedStrategy?.strategy?.name || "Best available",
          strategyScore: selectedStrategy?.score || null
        });
        setPortfolioState(nextPortfolioState);
        recordAutomation({
          action: plan.action,
          symbol: plan.symbol,
          quantity: plan.quantity,
          reason: plan.reason
        });
        setMessage(`Automation ${plan.action.toUpperCase()}: ${plan.symbol} · ${plan.reason}`);
        saveAutomationSnapshot(plan.reason);
        if (plan.profitLock?.secureDayProfit && !plan.profitLock?.runnerLeft) {
          setAutomationEnabled(false);
        }
        return;
      }

      const order = { symbol: plan.symbol, side: plan.action, quantity: plan.quantity };
      executePaperOrder(order);
      recordAutomation({ ...order, reason: plan.reason });
      if (plan.action === "sell" || portfolio.totalReturn >= 0) {
        saveAutomationSnapshot(plan.reason);
      }
      if (plan.profitLock?.secureDayProfit && !plan.profitLock?.runnerLeft) {
        setAutomationEnabled(false);
      }
    } catch (error) {
      recordAutomation({ action: "error", symbol: "-", quantity: 0, reason: error.message });
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

  function resetTodaySession() {
    const next = createInitialPortfolio();
    setPortfolioState(next);
    setAutomationLog([]);
    setAutomationSnapshots([]);
    setLearningJournal([]);
    setSessionPeakEquity(next.equity || next.startingCash);
    setMessage("Today paper session reset to $3,000 starting cash.");
  }

  function watchTopSetup() {
    if (!bestSetup) {
      setMessage("Scanner is still loading.");
      return;
    }
    setWatchlist((current) => (current.includes(bestSetup.symbol) ? current : [bestSetup.symbol, ...current]));
    setMessage(`${bestSetup.symbol} added to watchlist.`);
  }

  function useBestCategoryWatchlist() {
    const topCategory = categoryRanks[0];
    if (!topCategory) {
      setMessage("Category ranking is still loading.");
      return;
    }
    setWatchlist(topCategory.symbols);
    setMessage(`Watchlist set to best category: ${topCategory.category.toUpperCase()}.`);
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
      id: makeId(),
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

      {portfolio.startingCash !== 3000 && (
        <section className="alert danger-alert">
          Your browser is using an older saved paper portfolio with {formatMoney(portfolio.startingCash)} starting
          cash. For today’s realistic test, reset to $3,000.
          <button type="button" className="secondary mini" onClick={resetTodaySession}>
            Reset to $3,000 Today
          </button>
        </section>
      )}

      <section className="card quick-trade-card">
        <div>
          <p className="eyebrow">Paper Trade Test</p>
          <h2>Quick SPY Order</h2>
          <p className="signal-note">
            Use this to verify paper trading immediately. It only changes the simulated browser portfolio.
          </p>
        </div>
        <div className="quick-actions">
          <button type="button" className="buy-button" onClick={() => quickTrade("buy")}>
            Quick Buy 1 SPY
          </button>
          <button type="button" className="secondary" onClick={() => quickTrade("sell")}>
            Quick Sell 1 SPY
          </button>
        </div>
      </section>

      <section className="automation-grid">
        <article className="card">
          <div className="card-header">
            <h2>Rule-Based Paper Automation</h2>
            <span className={`pill ${automationEnabled ? "buy" : "hold"}`}>
              {automationEnabled ? "running" : "stopped"}
            </span>
          </div>
          <div className="form-row">
            <label>
              Automation Mode
              <select
                value={automationMode}
                onChange={(event) => setAutomationMode(event.target.value)}
              >
                <option value="moderate">Moderate</option>
                <option value="bullish">Bullish</option>
              </select>
            </label>
            <label>
              Watched Symbols
              <input value={watchlist.join(", ")} readOnly />
            </label>
          </div>
          <div className="toggle-row">
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={dayTradeEnabled}
                onChange={(event) => setDayTradeEnabled(event.target.checked)}
              />
              Allow day-trade exits
            </label>
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={optionsEnabled}
                onChange={(event) => setOptionsEnabled(event.target.checked)}
              />
              Include options watch ideas
            </label>
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={allowFuturesExtendedHours}
                onChange={(event) => setAllowFuturesExtendedHours(event.target.checked)}
              />
              Allow futures extended-hours paper cycles
            </label>
          </div>
          <p className="signal-note">
            Market clock: <strong>{marketClock.label}</strong> · regular session{" "}
            <strong>{marketClock.isRegularSession ? "open" : "closed"}</strong>
            {marketClock.isRegularSession
              ? ` · ${marketClock.minutesUntilClose} minutes until close`
              : " · automation stops unless futures extended-hours is enabled"}
          </p>
          <p className="signal-note">
            Current plan: <strong>{automationPlan.action.toUpperCase()}</strong>{" "}
            {automationPlan.symbol ? `${automationPlan.symbol} x ${automationPlan.quantity}` : ""} ·{" "}
            {automationPlan.reason}
          </p>
          <p className="signal-note">
            Cash management: <strong>$3,000 adaptive sizing</strong> · max single trade{" "}
            {formatPercent((automationPlan.adaptiveRisk?.maxSingleTradeCashPercent || 0) * 100)} cash · max exposure{" "}
            {formatPercent(automationPlan.adaptiveRisk?.maxExposurePercent)} · live $1k equivalent risk{" "}
            {formatMoney(automationPlan.adaptiveRisk?.live1000Equivalent?.maxSingleTradeDollars)} per trade.
          </p>
          {automationPlan.adaptiveRisk?.returnPercent < 0 && (
            <p className="signal-note loss">
              Loss mode active: new entries require stronger evidence, size is reduced, and options fallback is disabled.
            </p>
          )}
          <p className="signal-note">
            Profit lock: session peak <strong>{formatMoney(sessionPeakEquity)}</strong> · current profit{" "}
            <strong className={portfolio.totalReturn >= 0 ? "gain" : "loss"}>
              {formatMoney(portfolio.totalReturn)}
            </strong>
            . If profit gives back too much, automation closes risk before new entries.
            <br />
            Hard target: once session profit reaches <strong>$100</strong>, automation secures the day and stops.
            Substantial option winners can keep one runner only; no new trades are allowed while runner mode is active.
          </p>
          <p className="signal-note">
            Futures policy: <strong>4-hour evaluation cycle</strong> · max daily loss{" "}
            {formatPercent(automationPlan.futuresPolicy?.maxDailyLossPercent)} · profit protect starts at{" "}
            {formatPercent(automationPlan.futuresPolicy?.profitProtectPercent)} · next futures cycle{" "}
            {automationPlan.futuresPolicy?.cycleDue ? "due now" : "not due"}.
          </p>
          {automationPlan.symbol && strategyMap[automationPlan.symbol] && (
            <p className="signal-note">
              Strategy selected for next trade:{" "}
              <strong>
                {strategyMap[automationPlan.symbol].strategy.name} · {strategyMap[automationPlan.symbol].score}/100
                · {strategyMap[automationPlan.symbol].evidenceGrade}
              </strong>
            </p>
          )}
          <p className="signal-note">
            Best category today:{" "}
            <strong>
              {automationPlan.bestCategory
                ? `${automationPlan.bestCategory.category.toUpperCase()} · ${automationPlan.bestCategory.rankScore}`
                : "waiting for scanner"}
            </strong>
            {automationPlan.bestOptionIdea && (
              <>
                {" "}
                · Option watch:{" "}
                <strong>
                  {automationPlan.bestOptionIdea.underlying}{" "}
                  {automationPlan.bestOptionIdea.contractType.toUpperCase()}
                </strong>
              </>
            )}
          </p>
          <div className="quick-actions">
            <button
              type="button"
              className="buy-button"
              onClick={() => setAutomationEnabled((current) => !current)}
            >
              {automationEnabled ? "Stop Automation" : "Start Automation"}
            </button>
            <button type="button" className="secondary" onClick={runAutomationCycle}>
              Run One Cycle Now
            </button>
            <button type="button" className="secondary" onClick={() => saveAutomationSnapshot("Manual save for today's check")}>
              Save Today Snapshot
            </button>
            <button type="button" className="secondary" onClick={watchTopSetup}>
              Watch Top Setup
            </button>
            <button type="button" className="secondary" onClick={useBestCategoryWatchlist}>
              Use Best Category
            </button>
          </div>
          {automationPlan.blockers?.length ? (
            <div className="brief-list blocker-list">
              {automationPlan.blockers.slice(0, 4).map((blocker) => (
                <div className="brief-item" key={blocker.symbol}>
                  <span className="xmark">!</span>
                  <span>
                    <strong>
                      {blocker.symbol}: scanner {blocker.scannerScore}, strategy {blocker.strategyScore}
                    </strong>
                    <small>
                      Action {blocker.action}; strategy {blocker.strategy}; liquidity {blocker.liquidity};
                      volatility {blocker.volatility}
                      {blocker.riskFlags.length ? `; ${blocker.riskFlags.join(" ")}` : ""}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </article>

        <article className="card">
          <div className="card-header">
            <h2>Automation Log</h2>
            <button type="button" className="secondary danger" onClick={() => setAutomationLog([])}>
              Clear
            </button>
          </div>
          <div className="brief-list">
            {automationLog.length ? (
              automationLog.slice(0, 5).map((entry) => (
                <div className="brief-item" key={entry.id}>
                  <span className={`pill ${entry.action === "buy" ? "buy" : entry.action === "sell" ? "sell" : "hold"}`}>
                    {entry.action}
                  </span>
                  <span>
                    <strong>
                      {entry.symbol} {entry.quantity ? `x ${entry.quantity}` : ""}
                    </strong>
                    <small>{entry.reason}</small>
                  </span>
                </div>
              ))
            ) : (
              <p className="signal-note">No automation cycles yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="knowledge-grid">
        <article className="card">
          <div className="card-header">
            <h2>Best Categories Today</h2>
            <span className="pill hold">scanner ranked</span>
          </div>
          <div className="brief-list">
            {categoryRanks.length ? (
              categoryRanks.map((category) => (
                <div className="brief-item" key={category.category}>
                  <span className="checkmark">{category.category === "etfs" ? "E" : "S"}</span>
                  <span>
                    <strong>
                      {category.category.toUpperCase()} · {category.rankScore}
                    </strong>
                    <small>
                      Avg score {category.averageScore}; buy signals {category.buySignals}; symbols{" "}
                      {category.symbols.join(", ")}
                    </small>
                  </span>
                </div>
              ))
            ) : (
              <p className="signal-note">Scanner is still building category ranks.</p>
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <h2>Today Saved Runs</h2>
            <span className="pill hold">{todayAutomationSnapshots.length}</span>
          </div>
          <div className="brief-list">
            {todayAutomationSnapshots.length ? (
              todayAutomationSnapshots.slice(0, 5).map((snapshot) => (
                <div className="brief-item" key={snapshot.id}>
                  <span className="checkmark">✓</span>
                  <span>
                    <strong>
                      {new Date(snapshot.createdAt).toLocaleTimeString()} · {formatMoney(snapshot.portfolio.equity)}
                    </strong>
                    <small>
                      {snapshot.reason} · mode {snapshot.mode} · best{" "}
                      {snapshot.bestCategory?.category || "n/a"}
                    </small>
                  </span>
                </div>
              ))
            ) : (
              <p className="signal-note">
                Successful automation runs and manual snapshots will save here for today’s market-close review.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="knowledge-grid">
        <article className="card">
          <div className="card-header">
            <h2>Asset Coverage</h2>
            <span className="pill hold">stocks + ETFs + options + futures</span>
          </div>
          <div className="brief-list">
            <div className="brief-item">
              <span className="checkmark">✓</span>
              <span>
                <strong>Stocks</strong>
                <small>{assetCatalog.stocks.join(", ")}</small>
              </span>
            </div>
            <div className="brief-item">
              <span className="checkmark">✓</span>
              <span>
                <strong>ETFs</strong>
                <small>{assetCatalog.etfs.join(", ")}</small>
              </span>
            </div>
            <div className="brief-item">
              <span className="checkmark">✓</span>
              <span>
                <strong>Options</strong>
                <small>Simulated watch ideas only. No real options execution.</small>
              </span>
            </div>
            <div className="brief-item">
              <span className="checkmark">✓</span>
              <span>
                <strong>Micro Futures</strong>
                <small>{assetCatalog.futures.join(", ")} · simulated margin-capped paper trades only.</small>
              </span>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <h2>Options Watch</h2>
            <span className="pill hold">paper ideas</span>
          </div>
          <div className="brief-list">
            {optionsIdeas.map((idea) => (
              <div className="brief-item" key={`${idea.underlying}-${idea.contractType}`}>
                <span className={`pill ${idea.stance === "buy" ? "buy" : idea.stance === "sell" ? "sell" : "hold"}`}>
                  {idea.contractType}
                </span>
                <span>
                  <strong>
                    {idea.underlying} {idea.strike} {idea.contractType.toUpperCase()}
                  </strong>
                  <small>
                    {idea.expiry} · est. premium {formatMoney(idea.premium)} · max loss{" "}
                    {formatMoney(idea.notionalCost)} · score {idea.score}/100 · {idea.note}
                  </small>
                  <small>
                    Best underlying strategy:{" "}
                    <strong>
                      {strategyMap[idea.underlying]?.strategy?.name || "calculating"}{" "}
                      {strategyMap[idea.underlying]?.score
                        ? `· ${strategyMap[idea.underlying].score}/100`
                        : ""}
                      {strategyMap[idea.underlying]?.evidenceGrade
                        ? ` · ${strategyMap[idea.underlying].evidenceGrade}`
                        : ""}
                    </strong>
                  </small>
                  <span className="quick-actions inline-actions">
                    <button type="button" className="secondary mini" onClick={() => tradeOptionIdea(idea, "buy")}>
                      Paper Buy
                    </button>
                    <button type="button" className="secondary mini" onClick={() => tradeOptionIdea(idea, "sell")}>
                      Paper Sell
                    </button>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card data-card">
        <div className="card-header">
          <h2>Futures Watch</h2>
          <span className="pill hold">micro paper futures</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Contract</th>
              <th>Price</th>
              <th>Scanner</th>
              <th>Best Strategy</th>
              <th>Risk</th>
              <th>Paper Action</th>
            </tr>
          </thead>
          <tbody>
            {assetCatalog.futures.map((symbol) => {
              const quote = market.find((item) => item.symbol === symbol);
              const setup = scanner?.results?.find((result) => result.symbol === symbol);
              const selectedStrategy = strategyMap[symbol];
              return (
                <tr key={symbol}>
                  <td>{symbol}</td>
                  <td>{formatMoney(quote?.price)}</td>
                  <td>
                    {setup ? (
                      <span className={`pill ${setup.action}`}>{setup.action} {setup.score}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {selectedStrategy
                      ? `${selectedStrategy.strategy.name} · ${selectedStrategy.score}/100`
                      : "calculating"}
                  </td>
                  <td>
                    <small>35% margin cap · one micro contract default</small>
                  </td>
                  <td>
                    <span className="quick-actions inline-actions">
                      <button type="button" className="secondary mini" onClick={() => tradeFuture(symbol, "buy")}>
                        Paper Long
                      </button>
                      <button type="button" className="secondary mini" onClick={() => tradeFuture(symbol, "sell")}>
                        Paper Short
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

      <section className="card data-card">
        <div className="card-header">
          <h2>Market Intelligence</h2>
          <span className="pill hold">liquidity + volatility</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Liquidity</th>
              <th>Vol Regime</th>
              <th>Ann. Vol</th>
              <th>ATR %</th>
              <th>$ Volume</th>
              <th>Score Adj</th>
              <th>Risk Flags</th>
            </tr>
          </thead>
          <tbody>
            {marketIntelligence.map((result) => (
              <tr key={result.symbol}>
                <td>{result.symbol}</td>
                <td>
                  <span className={`pill ${result.intelligence?.liquidityGrade === "deep" ? "buy" : "hold"}`}>
                    {result.intelligence?.liquidityGrade || "-"}
                  </span>
                </td>
                <td>{result.intelligence?.volatilityRegime || "-"}</td>
                <td>{formatPercent(result.intelligence?.annualizedVolatility)}</td>
                <td>{formatPercent(result.intelligence?.atrPercent)}</td>
                <td>{formatMoney(result.intelligence?.averageDollarVolume)}</td>
                <td className={(result.intelligence?.scoreAdjustment || 0) >= 0 ? "gain" : "loss"}>
                  {result.intelligence?.scoreAdjustment > 0 ? "+" : ""}
                  {result.intelligence?.scoreAdjustment || 0}
                </td>
                <td>
                  <small>
                    {result.intelligence?.riskFlags?.length
                      ? result.intelligence.riskFlags.join(" ")
                      : "No major liquidity/volatility warnings."}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="knowledge-grid">
        <article className="card">
          <div className="card-header">
            <h2>Knowledge Base</h2>
            <span className="pill hold">research layer</span>
          </div>
          <div className="brief-list">
            {tradingKnowledge.principles.map((principle) => (
              <div className="brief-item" key={principle.id}>
                <span className="checkmark">✓</span>
                <span>
                  <strong>{principle.label}</strong>
                  <small>{principle.lesson}</small>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <h2>Reading Map</h2>
            <span className="pill hold">{formatCompact(tradingKnowledge.readingList.length)} books</span>
          </div>
          <div className="brief-list">
            {tradingKnowledge.readingList.map((book) => (
              <div className="brief-item" key={`${book.title}-${book.author}`}>
                <span className="checkmark">•</span>
                <span>
                  <strong>{book.title}</strong>
                  <small>
                    {book.author} · {book.topic}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="knowledge-grid">
        <article className="card">
          <div className="card-header">
            <h2>Trader Training Library</h2>
            <span className="pill hold">{tradingKnowledge.traderModels.length} models</span>
          </div>
          <div className="brief-list">
            {tradingKnowledge.traderModels.map((model) => (
              <div className="brief-item" key={model.name}>
                <span className="checkmark">T</span>
                <span>
                  <strong>
                    {model.name} · {model.window}
                  </strong>
                  <small>{model.edge}</small>
                  <small>
                    Bot lesson: <strong>{model.botLesson}</strong>
                  </small>
                  <small>{model.evidence}</small>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <h2>Evidence Rules</h2>
            <span className="pill hold">anti-overfit</span>
          </div>
          <div className="brief-list">
            {tradingKnowledge.evidenceRules.map((item) => (
              <div className="brief-item" key={item.id}>
                <span className="checkmark">✓</span>
                <span>
                  <strong>{item.id}</strong>
                  <small>{item.rule}</small>
                </span>
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
              <div className="scan-row" key={result.symbol}>
                <div>
                  <strong>{result.symbol}</strong>
                  <small>{result.reason}</small>
                  <small>
                    Best strategy:{" "}
                    <strong>
                      {strategyMap[result.symbol]?.strategy?.name || "calculating"}{" "}
                      {strategyMap[result.symbol]?.score
                        ? `· ${strategyMap[result.symbol].score}/100`
                        : ""}
                      {strategyMap[result.symbol]?.evidenceGrade
                        ? ` · ${strategyMap[result.symbol].evidenceGrade}`
                        : ""}
                    </strong>
                  </small>
                </div>
                <div className="scan-score">
                  <span className={`pill ${result.action}`}>{result.action}</span>
                  <strong>{result.score}</strong>
                  <button type="button" className="secondary mini" onClick={() => useScanPick(result)}>
                    Use
                  </button>
                  <button type="button" className="secondary mini" onClick={() => toggleWatch(result.symbol)}>
                    {watchlist.includes(result.symbol) ? "Watching" : "Watch"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Paper Order Ticket</h2>
          <div className="trade-form">
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
            <button type="button" className="buy-button" onClick={submitTrade}>
              Submit Paper Order
            </button>
          </div>
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

      <section className="card readiness-card">
        <div className="card-header">
          <h2>V1 Readiness Gate</h2>
          <div className="result-badges">
            <span className={`pill ${readiness.status === "ready" ? "buy" : "hold"}`}>
              {readiness.status}
            </span>
            <span className="pill hold">{readiness.score}/100</span>
          </div>
        </div>
        <div className="metrics four">
          <div>
            <small>Checks Passed</small>
            <strong>
              {readiness.passedChecks}/{readiness.totalChecks}
            </strong>
          </div>
          <div>
            <small>Newest Data</small>
            <strong>{readiness.newestDataDate || "-"}</strong>
          </div>
          <div>
            <small>Qualified Runs</small>
            <strong>{learningSummary.qualifiedRuns}</strong>
          </div>
          <div>
            <small>Mode</small>
            <strong>{portfolio.mode}</strong>
          </div>
        </div>
        <div className="readiness-list">
          {readiness.checks.map((check) => (
            <div className="brief-item" key={check.id}>
              <span className={check.passed ? "checkmark" : "xmark"}>
                {check.passed ? "✓" : "!"}
              </span>
              <span>
                {check.label}
                {check.detail ? <small>{check.detail}</small> : null}
              </span>
            </div>
          ))}
        </div>
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
          <h2>Paper Option Positions</h2>
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Qty</th>
                <th>Avg</th>
                <th>Mark</th>
                <th>Value</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.optionPositions.length ? (
                portfolio.optionPositions.map((position) => (
                  <tr key={position.contractId}>
                    <td>
                      {position.underlying} {position.strike} {position.contractType.toUpperCase()}
                    </td>
                    <td>{position.quantity}</td>
                    <td>{formatMoney(position.averagePremium)}</td>
                    <td>{formatMoney(position.markPremium)}</td>
                    <td>{formatMoney(position.marketValue)}</td>
                    <td className={position.unrealizedPnl >= 0 ? "gain" : "loss"}>
                      {formatMoney(position.unrealizedPnl)} · {formatPercent(position.unrealizedPnlPercent)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">No paper option positions.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>

        <article className="card">
          <h2>Paper Futures Positions</h2>
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Qty</th>
                <th>Avg</th>
                <th>Mark</th>
                <th>Margin</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.futuresPositions.length ? (
                portfolio.futuresPositions.map((position) => (
                  <tr key={position.symbol}>
                    <td>{position.symbol}</td>
                    <td>{position.quantity}</td>
                    <td>{formatMoney(position.averagePrice)}</td>
                    <td>{formatMoney(position.markPrice)}</td>
                    <td>{formatMoney(position.marketValue)}</td>
                    <td className={position.unrealizedPnl >= 0 ? "gain" : "loss"}>
                      {formatMoney(position.unrealizedPnl)} · {formatPercent(position.unrealizedPnlPercent)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">No paper futures positions.</td>
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
                <th>Strategy</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.trades.length ? (
                portfolio.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td>{new Date(trade.createdAt).toLocaleTimeString()}</td>
                    <td>{trade.assetType === "option" || trade.assetType === "future" ? trade.description : trade.symbol}</td>
                    <td>
                      <span className={`pill ${trade.side}`}>{trade.side}</span>
                    </td>
                    <td>{trade.quantity}</td>
                    <td>{formatMoney(trade.gross)}</td>
                    <td>{trade.strategy || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">No paper trades yet.</td>
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
