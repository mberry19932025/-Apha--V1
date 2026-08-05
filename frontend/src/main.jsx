import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  analyzeLearningJournal,
  assetCatalog,
  buildOptionsIdeas,
  buildPaperLearningMemory,
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
  tradingKnowledge,
  withdrawPaperProfit
} from "./botEngine.js";
import { projectCapabilities, projectTests } from "./projectSpec.js";
import "./styles.css";

const portfolioKey = "apex-alpha-static-portfolio";
const uploadedDataKey = "apex-alpha-uploaded-data";
const apiDataKey = "apex-alpha-api-data";
const polygonApiKeyStorageKey = "apex-alpha-polygon-api-key";
const autoApiRefreshKey = "apex-alpha-auto-api-refresh";
const autoStartWhenReadyKey = "apex-alpha-auto-start-ready";
const learningJournalKey = "apex-alpha-learning-journal";
const watchlistKey = "apex-alpha-watchlist";
const automationLogKey = "apex-alpha-automation-log";
const automationSnapshotsKey = "apex-alpha-automation-snapshots";
const sessionPeakEquityKey = "apex-alpha-session-peak-equity";
const emergencyStopKey = "apex-alpha-emergency-stop";
const recoveryWatchlist = ["SPY", "DIA", "IWM", "QQQ"];
const apiUpdateWatchlist = ["SPY", "QQQ", "DIA", "IWM"];
const realDataSources = ["csv", "api-1min", "api-daily"];
const autoRefreshIntervalMs = 5 * 60 * 1000;
const autoStartMarketQualityThreshold = 60;
const opportunityWatchlist = [
  {
    symbol: "GLD",
    category: "Gold",
    stance: "watch-only",
    rule: "Only consider after fresh GLD candles are loaded and it beats the core ETF setup."
  },
  {
    symbol: "MGC",
    category: "Gold futures",
    stance: "paper-only",
    rule: "Micro gold futures remain paper-only and require smart futures after-hours gates."
  },
  {
    symbol: "MBT",
    category: "Bitcoin futures",
    stance: "paper-only",
    rule: "Bitcoin is volatile; monitor trend only and do not use for small-account recovery mode."
  },
  {
    symbol: "VNQ / XLRE",
    category: "REITs",
    stance: "research",
    rule: "Add real candle CSV/API data before backtesting or trading."
  },
  {
    symbol: "LIT / lithium",
    category: "Lithium",
    stance: "avoid for now",
    rule: "No automation until liquidity, trend, and strategy evidence are proven."
  }
];

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

function markCandles(candles, source = "csv", interval = "daily") {
  if (!Array.isArray(candles)) {
    return [];
  }
  candles.dataSource = source;
  candles.dataInterval = interval;
  return candles;
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
    const parsed = stored ? JSON.parse(stored) : {};
    return Object.fromEntries(
      Object.entries(parsed).map(([symbol, candles]) => [symbol, markCandles(candles, "csv", "daily")])
    );
  } catch {
    return {};
  }
}

function loadApiData() {
  try {
    const stored = localStorage.getItem(apiDataKey);
    const parsed = stored ? JSON.parse(stored) : {};
    return Object.fromEntries(
      Object.entries(parsed).map(([symbol, payload]) => {
        if (Array.isArray(payload)) {
          return [symbol, markCandles(payload, "api-1min", "1-minute")];
        }
        return [
          symbol,
          markCandles(payload?.candles || [], payload?.source || "api-1min", payload?.interval || "1-minute")
        ];
      })
    );
  } catch {
    return {};
  }
}

function loadStoredString(key, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function getIsoDateOffset(daysBack = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

function mergeLatestApiQuotes(currentMarket, apiCandlesBySymbol) {
  const syntheticMarket = currentMarket?.length ? currentMarket : getMarketSnapshot();
  return symbols.map((symbol) => {
    const existingQuote = syntheticMarket.find((quote) => quote.symbol === symbol);
    const candles = apiCandlesBySymbol[symbol] || [];
    const latest = candles.at(-1);
    const previous = candles.at(-2);

    if (!latest?.close) {
      return existingQuote || getMarketSnapshot().find((quote) => quote.symbol === symbol);
    }

    const changePercent = previous?.close
      ? ((Number(latest.close) - Number(previous.close)) / Number(previous.close)) * 100
      : existingQuote?.changePercent || 0;

    return {
      symbol,
      price: Number(latest.close),
      changePercent,
      volume: Number(latest.volume || existingQuote?.volume || 0),
      source: candles.dataSource || "api-1min",
      updatedAt: latest.date
    };
  });
}

function getTradeHourLabel(dateString) {
  const date = new Date(dateString || Date.now());
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }
  return `${String(date.getHours()).padStart(2, "0")}:00`;
}

function buildWindowMemory(trades = []) {
  const today = new Date().toISOString().slice(0, 10);
  const closed = (trades || []).filter(
    (trade) => String(trade.createdAt || "").slice(0, 10) === today && Number(trade.realizedPnl || 0) !== 0
  );
  const windows = Object.values(
    closed.reduce((map, trade) => {
      const hour = getTradeHourLabel(trade.createdAt);
      map[hour] ||= { hour, trades: 0, pnl: 0, wins: 0, losses: 0 };
      map[hour].trades += 1;
      map[hour].pnl += Number(trade.realizedPnl || 0);
      if (Number(trade.realizedPnl || 0) > 0) map[hour].wins += 1;
      if (Number(trade.realizedPnl || 0) < 0) map[hour].losses += 1;
      return map;
    }, {})
  ).map((window) => ({
    ...window,
    averagePnl: window.trades ? window.pnl / window.trades : 0,
    winRate: window.trades ? (window.wins / window.trades) * 100 : 0
  }));
  const bestWindow = [...windows]
    .filter((window) => window.trades >= 2 && window.pnl > 0)
    .sort((a, b) => b.pnl - a.pnl || b.winRate - a.winRate)[0] || null;
  return {
    closedTrades: closed,
    windows,
    bestWindow,
    currentHour: getTradeHourLabel(new Date().toISOString()),
    hasEnoughEvidence: closed.length >= 4 && Boolean(bestWindow)
  };
}

function buildAutoModeDecision({
  automationMode,
  beginnerSafeMode,
  portfolio,
  portfolioState,
  scanner,
  hasEnoughRealEtfData,
  decisionWindowMinutes,
  maxTradesPerDay
}) {
  const windowMemory = buildWindowMemory(portfolioState?.trades || []);

  if (automationMode !== "auto") {
    return {
      requested: automationMode,
      mode: automationMode,
      active: false,
      windowMemory,
      reason: "Manual automation mode selected."
    };
  }

  const coreResults = recoveryWatchlist
    .map((symbol) => scanner?.results?.find((result) => result.symbol === symbol))
    .filter(Boolean);
  const averageScore = coreResults.length
    ? coreResults.reduce((sum, result) => sum + Number(result.score || 0), 0) / coreResults.length
    : 0;
  const buyCount = coreResults.filter((result) => result.action === "buy").length;
  const sellCount = coreResults.filter((result) => result.action === "sell").length;
  const strongestScore = coreResults.length ? Math.max(...coreResults.map((result) => Number(result.score || 0))) : 0;
  const todayClosed = windowMemory.closedTrades;
  const wins = todayClosed.filter((trade) => Number(trade.realizedPnl || 0) > 0);
  const losses = todayClosed.filter((trade) => Number(trade.realizedPnl || 0) < 0);
  const realizedPnl = todayClosed.reduce((sum, trade) => sum + Number(trade.realizedPnl || 0), 0);
  const lastClosed = [...todayClosed].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  const lastWinAgeMinutes = wins.length
    ? (Date.now() - new Date([...wins].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt).getTime()) / 60000
    : Infinity;
  const windowOk = !windowMemory.hasEnoughEvidence || windowMemory.bestWindow?.hour === windowMemory.currentHour;
  const blockers = [
    !hasEnoughRealEtfData && "real API/CSV data not ready",
    beginnerSafeMode && portfolio.totalReturn <= 0 && "safe mode keeps red/flat account moderate",
    Number(portfolio.totalReturn || 0) < 10 && "session profit below $10",
    todayClosed.length < 2 && "needs at least 2 closed trades today",
    wins.length < 2 && "needs 2 winning closed trades today",
    losses.length > wins.length && "losses outnumber wins",
    lastClosed && Number(lastClosed.realizedPnl || 0) < 0 && "last closed trade was a loss",
    realizedPnl <= 0 && "realized P/L is not positive",
    averageScore < 72 && "core ETF average score below 72",
    strongestScore < 78 && "strongest ETF score below 78",
    buyCount < 2 && "fewer than 2 core ETFs are bullish",
    sellCount >= 2 && "too many core ETFs are sell signals",
    decisionWindowMinutes < 2 && "entry window is too fast",
    maxTradesPerDay > 3 && "daily entry limit is too high",
    lastWinAgeMinutes > 45 && "bullish boost window expired after 45 minutes",
    !windowOk && `current hour is not proven best window (${windowMemory.bestWindow?.hour})`
  ].filter(Boolean);

  return {
    requested: "auto",
    mode: blockers.length ? "moderate" : "bullish",
    active: true,
    windowMemory,
    stats: {
      averageScore: Number(averageScore.toFixed(1)),
      buyCount,
      sellCount,
      strongestScore,
      realizedPnl,
      wins: wins.length,
      losses: losses.length,
      lastWinAgeMinutes: Number.isFinite(lastWinAgeMinutes) ? Number(lastWinAgeMinutes.toFixed(1)) : null
    },
    reason: blockers.length
      ? `Auto mode using Moderate: ${blockers.join("; ")}.`
      : "Auto mode temporarily promoted to Bullish for up to 45 minutes because trades, market quality, and timing are aligned.",
    blockers
  };
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

function loadStoredBoolean(key, fallback = false) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === "true";
  } catch {
    return fallback;
  }
}

function App() {
  const [dataBySymbol, setDataBySymbol] = useState({});
  const [bundledData, setBundledData] = useState({});
  const [uploadedData, setUploadedData] = useState(loadUploadedData);
  const [apiData, setApiData] = useState(loadApiData);
  const [polygonApiKey, setPolygonApiKey] = useState(() => loadStoredString(polygonApiKeyStorageKey));
  const [apiLoading, setApiLoading] = useState(false);
  const [apiLookbackDays, setApiLookbackDays] = useState(5);
  const [autoApiRefresh, setAutoApiRefresh] = useState(() => loadStoredBoolean(autoApiRefreshKey, true));
  const [autoStartWhenReady, setAutoStartWhenReady] = useState(() =>
    loadStoredBoolean(autoStartWhenReadyKey, true)
  );
  const [market, setMarket] = useState(() => getMarketSnapshot());
  const [scanner, setScanner] = useState(null);
  const [portfolioState, setPortfolioState] = useState(loadStoredPortfolio);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [tradeForm, setTradeForm] = useState({ symbol: "AAPL", side: "buy", quantity: 1 });
  const [withdrawalAmount, setWithdrawalAmount] = useState(5);
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
    useAtrStops: true,
    atrPeriod: 14,
    atrStopMultiplier: 1.5,
    atrTargetMultiplier: 2,
    atrTrailMultiplier: 1.2,
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
  const [watchlist, setWatchlist] = useState(() => loadStoredArray(watchlistKey, recoveryWatchlist));
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [emergencyStopActive, setEmergencyStopActive] = useState(() =>
    loadStoredBoolean(emergencyStopKey, false)
  );
  const [automationMode, setAutomationMode] = useState("auto");
  const [dayTradeEnabled, setDayTradeEnabled] = useState(true);
  const [optionsEnabled, setOptionsEnabled] = useState(false);
  const [beginnerSafeMode, setBeginnerSafeMode] = useState(true);
  const [allowFuturesExtendedHours, setAllowFuturesExtendedHours] = useState(true);
  const [decisionWindowMinutes, setDecisionWindowMinutes] = useState(2);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState(3);
  const [realDataRequired, setRealDataRequired] = useState(true);
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
  const lastAutoRefreshAt = useRef(0);
  const lastAutoStartAt = useRef(0);

  const signals = useMemo(() => getSignals(market), [market]);
  const portfolio = useMemo(() => buildPortfolio(portfolioState, market), [portfolioState, market]);
  const dataStatus = useMemo(() => getDataStatus(dataBySymbol), [dataBySymbol]);
  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.symbol === tradeForm.symbol),
    [signals, tradeForm.symbol]
  );
  const bestSetup = scanner?.results?.[0];
  const marketIntelligence = scanner?.results || [];
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
  const paperLearningMemory = useMemo(
    () => buildPaperLearningMemory(portfolioState.trades || []),
    [portfolioState.trades]
  );
  const dailyReport = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayTrades = (portfolioState.trades || []).filter((trade) => String(trade.createdAt || "").slice(0, 10) === today);
    const closedTrades = todayTrades.filter((trade) => Number(trade.realizedPnl || 0) !== 0);
    const entryTrades = todayTrades.filter((trade) => ["buy"].includes(trade.side));
    const realizedPnl = closedTrades.reduce((sum, trade) => sum + Number(trade.realizedPnl || 0), 0);
    const wins = closedTrades.filter((trade) => Number(trade.realizedPnl || 0) > 0);
    const losses = closedTrades.filter((trade) => Number(trade.realizedPnl || 0) < 0);
    const sortedByPnl = [...closedTrades].sort((a, b) => Number(b.realizedPnl || 0) - Number(a.realizedPnl || 0));
    const strategyStats = Object.values(
      closedTrades.reduce((stats, trade) => {
        const key = trade.strategy || "Unknown";
        stats[key] ||= { strategy: key, trades: 0, pnl: 0, wins: 0, losses: 0 };
        stats[key].trades += 1;
        stats[key].pnl += Number(trade.realizedPnl || 0);
        if (Number(trade.realizedPnl || 0) > 0) stats[key].wins += 1;
        if (Number(trade.realizedPnl || 0) < 0) stats[key].losses += 1;
        return stats;
      }, {})
    ).sort((a, b) => b.pnl - a.pnl);

    return {
      tradeDate: today,
      startingBalance: portfolio.startingCash,
      endingBalance: portfolio.equity,
      netChange: portfolio.totalReturn,
      netChangePercent: portfolio.totalReturnPercent,
      totalTrades: todayTrades.length,
      entries: entryTrades.length,
      closedTrades: closedTrades.length,
      realizedPnl,
      winRate: closedTrades.length ? (wins.length / closedTrades.length) * 100 : 0,
      bestTrade: sortedByPnl[0] || null,
      worstTrade: sortedByPnl.at(-1) || null,
      strategyStats,
      lesson:
        losses.length >= 2
          ? "Loss cluster detected: reduce size, wait for cleaner windows, and avoid repeating the weakest setup."
          : wins.length > losses.length && wins.length > 0
            ? "Positive closed-trade edge today: keep the winning setup, but stop after target."
            : closedTrades.length
              ? "Mixed results: keep collecting evidence before increasing risk."
              : "No closed trades yet: report will update after exits."
    };
  }, [portfolioState.trades, portfolio]);
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
  const realEtfDataCount = dataStatus.filter(
    (item) => recoveryWatchlist.includes(item.symbol) && realDataSources.includes(item.source) && item.rows >= 60
  ).length;
  const hasEnoughRealEtfData = realEtfDataCount >= recoveryWatchlist.length;
  const requiredEtfDataStatus = recoveryWatchlist.map((symbol) => {
    const status = dataStatus.find((item) => item.symbol === symbol);
    const ready = Boolean(realDataSources.includes(status?.source) && status.rows >= 60);
    return {
      symbol,
      ready,
      rows: status?.rows || 0,
      source: status?.source || "missing",
      lastDate: status?.lastDate || null
    };
  });
  const missingRequiredEtfs = requiredEtfDataStatus
    .filter((item) => !item.ready)
    .map((item) => item.symbol);
  const autoModeDecision = useMemo(
    () =>
      buildAutoModeDecision({
        automationMode,
        beginnerSafeMode,
        portfolio,
        portfolioState,
        scanner,
        hasEnoughRealEtfData,
        decisionWindowMinutes,
        maxTradesPerDay
      }),
    [
      automationMode,
      beginnerSafeMode,
      portfolio,
      portfolioState,
      scanner,
      hasEnoughRealEtfData,
      decisionWindowMinutes,
      maxTradesPerDay
    ]
  );
  const effectiveAutomationMode =
    beginnerSafeMode && portfolio.totalReturn <= 0 ? "moderate" : autoModeDecision.mode;
  const beginnerOptionsBlocked = beginnerSafeMode && portfolio.totalReturn <= 0;
  const effectiveOptionsEnabled = optionsEnabled && !beginnerOptionsBlocked;
  const effectiveFuturesExtendedHours = allowFuturesExtendedHours;
  const automationPlan = useMemo(
    () =>
      evaluateAutomationPlan({
        scanner,
        portfolio,
        mode: effectiveAutomationMode,
        watchlist,
        dayTradeEnabled,
        optionsEnabled: effectiveOptionsEnabled,
        strategyMap,
        automationLog,
        learningMemory: paperLearningMemory,
        futuresEnabled: true,
        marketClock,
        allowFuturesExtendedHours: effectiveFuturesExtendedHours,
        decisionWindowMinutes,
        maxTradesPerDay,
        realDataRequired,
        hasRequiredRealData: hasEnoughRealEtfData,
        sessionPeakEquity
      }),
    [
      scanner,
      portfolio,
      effectiveAutomationMode,
      watchlist,
      dayTradeEnabled,
      effectiveOptionsEnabled,
      strategyMap,
      automationLog,
      paperLearningMemory,
      marketClock,
      effectiveFuturesExtendedHours,
      decisionWindowMinutes,
      maxTradesPerDay,
      realDataRequired,
      hasEnoughRealEtfData,
      sessionPeakEquity
    ]
  );
  const optionsIdeas = useMemo(() => {
    const planBest = automationPlan?.bestOptionIdea;
    return buildOptionsIdeas(scanner?.results || [], market).map((idea) => {
      if (planBest?.underlying === idea.underlying && planBest?.contractType === idea.contractType) {
        return { ...idea, permission: planBest.permission };
      }

      const setup = scanner?.results?.find((result) => result.symbol === idea.underlying);
      const strategyScore = strategyMap[idea.underlying]?.score || 0;
      const marketQualityScore = Number(automationPlan?.marketQuality?.score || 0);
      const reasons = [];
      const expectedContract = setup?.action === "sell" ? "put" : setup?.action === "buy" ? "call" : null;

      if (!hasEnoughRealEtfData) reasons.push("real ETF API/CSV data required");
      if (marketQualityScore < 75) reasons.push("market quality must be 75+ for options");
      if (!expectedContract || idea.contractType !== expectedContract) reasons.push("call/put direction not confirmed");
      if ((setup?.score || 0) < 78) reasons.push("underlying scanner score must be 78+");
      if (strategyScore < 72) reasons.push("underlying strategy score must be 72+");
      if (setup?.intelligence?.liquidityGrade !== "deep") reasons.push("underlying liquidity must be deep");
      if (!["normal", "quiet"].includes(setup?.intelligence?.volatilityRegime)) {
        reasons.push("volatility must be normal or quiet");
      }
      if (portfolio.totalReturn < 10) reasons.push("paper session profit must be at least $10");

      return {
        ...idea,
        permission: {
          allowed: reasons.length === 0,
          reasons,
          label: reasons.length
            ? `Options blocked: ${reasons.join("; ")}.`
            : `${idea.contractType.toUpperCase()} permission passed.`
        }
      };
    });
  }, [scanner, market, automationPlan, strategyMap, hasEnoughRealEtfData, portfolio.totalReturn]);
  const opportunitySignals = useMemo(
    () =>
      opportunityWatchlist.map((opportunity) => {
        const scannerResult = scanner?.results?.find((result) => result.symbol === opportunity.symbol);
        const dataItem = dataStatus.find((item) => item.symbol === opportunity.symbol);
        const quote = market.find((item) => item.symbol === opportunity.symbol);
        const hasTradableSymbol = symbols.includes(opportunity.symbol);
        const hasRealData = realDataSources.includes(dataItem?.source) && dataItem.rows >= 60;
        return {
          ...opportunity,
          scannerResult,
          dataItem,
          quote,
          hasTradableSymbol,
          hasRealData,
          status: !hasTradableSymbol
            ? "not loaded"
            : hasRealData
              ? `${dataItem.source} ready`
              : dataItem?.source
                ? `${dataItem.source} data`
                : "no data"
        };
      }),
    [scanner, dataStatus, market]
  );
  const startGateIssues = [
    !hasEnoughRealEtfData && `Missing required ETF CSV/API data: ${missingRequiredEtfs.join(", ")}`,
    emergencyStopActive && "Emergency Stop is active.",
    !beginnerSafeMode && "Beginner Safe Mode is off.",
    effectiveAutomationMode !== "moderate" &&
      !automationPlan.noTradeIntelligence?.bullishDiscipline?.passed &&
      "Bullish mode is selected but bullish discipline has not passed.",
    effectiveOptionsEnabled && "Options are still enabled.",
    maxTradesPerDay > 3 && "Max entries is above beginner limit.",
    decisionWindowMinutes < 2 && "Entry window is faster than 2 minutes.",
    automationPlan.noTradeIntelligence?.blockedReasons?.length &&
      automationPlan.noTradeIntelligence.blockedReasons.join(" "),
    automationPlan.profitLock?.hardDailyLossStop && "Daily kill switch is active.",
    automationPlan.profitLock?.secureDayProfit && !automationPlan.profitLock?.runnerLeft &&
      "Profit target already secured for the day.",
    !marketClock.isRegularSession && !effectiveFuturesExtendedHours && "Regular market is closed."
  ].filter(Boolean);
  const startGateReady = startGateIssues.length === 0;

  useEffect(() => {
    async function init() {
      try {
        const loadedBundledData = await loadBundledData();
        const mergedData = { ...loadedBundledData, ...uploadedData, ...apiData };
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
    setDataBySymbol({ ...bundledData, ...uploadedData, ...apiData });
  }, [uploadedData, bundledData, apiData]);

  useEffect(() => {
    localStorage.setItem(apiDataKey, JSON.stringify(apiData));
    setDataBySymbol({ ...bundledData, ...uploadedData, ...apiData });
  }, [apiData, bundledData, uploadedData]);

  useEffect(() => {
    localStorage.setItem(polygonApiKeyStorageKey, polygonApiKey.trim());
  }, [polygonApiKey]);

  useEffect(() => {
    localStorage.setItem(autoApiRefreshKey, String(autoApiRefresh));
  }, [autoApiRefresh]);

  useEffect(() => {
    localStorage.setItem(autoStartWhenReadyKey, String(autoStartWhenReady));
  }, [autoStartWhenReady]);

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
    if (!portfolio.positions.length) {
      return;
    }

    setPortfolioState((current) => {
      let changed = false;
      const nextPositions = { ...(current.positions || {}) };
      portfolio.positions.forEach((position) => {
        const stored = nextPositions[position.symbol];
        if (!stored) {
          return;
        }
        const nextPeak = Math.max(Number(stored.peakPnlPercent || 0), Number(position.peakPnlPercent || 0));
        if (nextPeak !== Number(stored.peakPnlPercent || 0)) {
          nextPositions[position.symbol] = { ...stored, peakPnlPercent: nextPeak };
          changed = true;
        }
      });
      return changed ? { ...current, positions: nextPositions } : current;
    });
  }, [portfolio.positions]);

  useEffect(() => {
    localStorage.setItem(sessionPeakEquityKey, String(sessionPeakEquity));
  }, [sessionPeakEquity]);

  useEffect(() => {
    localStorage.setItem(emergencyStopKey, String(emergencyStopActive));
    if (emergencyStopActive && automationEnabled) {
      setAutomationEnabled(false);
    }
  }, [emergencyStopActive, automationEnabled]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMarket(mergeLatestApiQuotes(getMarketSnapshot(), apiData));
    }, 15000);
    return () => clearInterval(timer);
  }, [apiData]);

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

    if (automationEnabled && !effectiveFuturesExtendedHours) {
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
  }, [marketClock, automationEnabled, effectiveFuturesExtendedHours, marketCloseSnapshotSaved]);

  useEffect(() => {
    if (!automationEnabled || emergencyStopActive) {
      return undefined;
    }

    const timer = setInterval(() => {
      runAutomationCycle();
    }, 20000);

    return () => clearInterval(timer);
  }, [
    automationEnabled,
    emergencyStopActive,
    automationPlan,
    portfolioState,
    market,
    dayTradeEnabled,
    effectiveOptionsEnabled,
    effectiveFuturesExtendedHours,
    paperLearningMemory,
    decisionWindowMinutes,
    marketClock
  ]);

  useEffect(() => {
    if (!autoApiRefresh || !polygonApiKey.trim() || apiLoading) {
      return undefined;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const marketOk = marketClock.isRegularSession || effectiveFuturesExtendedHours;
      if (!marketOk || now - lastAutoRefreshAt.current < autoRefreshIntervalMs) {
        return;
      }

      lastAutoRefreshAt.current = now;
      refreshApiCandles({ silent: true });
    }, 60000);

    return () => clearInterval(timer);
  }, [autoApiRefresh, polygonApiKey, apiLoading, marketClock, effectiveFuturesExtendedHours]);

  useEffect(() => {
    if (!autoStartWhenReady || automationEnabled || emergencyStopActive || loading) {
      return;
    }

    const marketQualityReady = Number(automationPlan.marketQuality?.score || 0) >= autoStartMarketQualityThreshold;
    const marketOk = marketClock.isRegularSession || effectiveFuturesExtendedHours;
    const cooldownOk = Date.now() - lastAutoStartAt.current >= 2 * 60 * 1000;

    if (!startGateReady || !marketQualityReady || !marketOk || !cooldownOk) {
      return;
    }

    lastAutoStartAt.current = Date.now();
    setAutomationEnabled(true);
    recordAutomation({
      action: "auto-start",
      symbol: "-",
      quantity: 0,
      reason: `Auto-started because readiness passed and market quality is ${automationPlan.marketQuality?.score}/100.`
    });
    setMessage(`Automation auto-started. Market quality ${automationPlan.marketQuality?.score}/100.`);
    runAutomationCycle();
  }, [
    autoStartWhenReady,
    automationEnabled,
    emergencyStopActive,
    loading,
    startGateReady,
    automationPlan,
    marketClock,
    effectiveFuturesExtendedHours
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

  function applyRecoveryPreset() {
    setAutomationEnabled(false);
    setBeginnerSafeMode(true);
    setAutomationMode("auto");
    setOptionsEnabled(false);
    setAllowFuturesExtendedHours(true);
    setDecisionWindowMinutes(2);
    setMaxTradesPerDay(3);
    setRealDataRequired(true);
    setWatchlist(recoveryWatchlist);
    recordAutomation({
      action: "recovery-preset",
      symbol: "-",
      quantity: 0,
      reason: "Applied recovery preset: SPY, DIA, IWM, QQQ; Auto Disciplined; Safe Mode; no options; smart futures after-hours allowed with 4h/8h gates; 5-minute windows; max 3 entries."
    });
    setMessage("Recovery preset applied. Automation is stopped; run one cycle only after the account stabilizes.");
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
      effectiveMode: effectiveAutomationMode,
      dayTradeEnabled,
      optionsEnabled,
      effectiveOptionsEnabled,
      allowFuturesExtendedHours,
      effectiveFuturesExtendedHours,
      beginnerSafeMode,
      decisionWindowMinutes,
      maxTradesPerDay,
      paperLearningMemory,
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
        strategy: `Automation ${effectiveAutomationMode}`,
        config: {
          mode: automationMode,
          effectiveMode: effectiveAutomationMode,
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

  function toggleAutomation() {
    setMessage("");

    if (automationEnabled) {
      setAutomationEnabled(false);
      recordAutomation({
        action: "stopped",
        symbol: "-",
        quantity: 0,
        reason: "Automation stopped manually."
      });
      setMessage("Automation stopped manually.");
      return;
    }

    if (!startGateReady) {
      const reason = `Automation not started: ${startGateIssues.join(" ")}`;
      recordAutomation({
        action: "start-blocked",
        symbol: "-",
        quantity: 0,
        reason
      });
      setMessage(reason);
      return;
    }

    if (emergencyStopActive) {
      const reason = "Automation not started: emergency stop is active. Clear emergency stop only when you are ready to paper test again.";
      recordAutomation({
        action: "start-blocked",
        symbol: "-",
        quantity: 0,
        reason
      });
      setMessage(reason);
      return;
    }

    if (!marketClock.isRegularSession && !effectiveFuturesExtendedHours) {
      const reason = `Automation not started: regular market is closed (${marketClock.label}). Enable smart futures after-hours paper cycles if you intentionally want futures-only testing.`;
      recordAutomation({
        action: "start-blocked",
        symbol: "-",
        quantity: 0,
        reason
      });
      setMessage(reason);
      return;
    }

    if (automationPlan.profitLock?.hardDailyLossStop) {
      const reason = "Automation not started: daily kill switch is active. Reset the paper session or wait for the next trading day.";
      recordAutomation({
        action: "start-blocked",
        symbol: "-",
        quantity: 0,
        reason
      });
      setMessage(reason);
      return;
    }

    if (automationPlan.profitLock?.secureDayProfit && !automationPlan.profitLock?.runnerLeft) {
      const reason = "Automation not started: profit target was already secured for the day.";
      recordAutomation({
        action: "start-blocked",
        symbol: "-",
        quantity: 0,
        reason
      });
      setMessage(reason);
      return;
    }

    setAutomationEnabled(true);
    recordAutomation({
      action: "started",
      symbol: "-",
      quantity: 0,
      reason: `Automation started in ${effectiveAutomationMode} mode with ${decisionWindowMinutes}-minute entry windows.`
    });
    setMessage(`Automation started. ${automationPlan.reason}`);
    runAutomationCycle();
  }

  function triggerEmergencyStop() {
    setEmergencyStopActive(true);
    setAutomationEnabled(false);
    recordAutomation({
      action: "emergency-stop",
      symbol: "-",
      quantity: 0,
      reason: "Emergency stop pressed. Automation locked off."
    });
    setMessage("Emergency stop active. Automation is locked off. Refreshing the page will keep it stopped.");
  }

  function clearEmergencyStop() {
    setEmergencyStopActive(false);
    recordAutomation({
      action: "emergency-cleared",
      symbol: "-",
      quantity: 0,
      reason: "Emergency stop cleared manually."
    });
    setMessage("Emergency stop cleared. Automation is still stopped until you press Start.");
  }

  function runAutomationCycle() {
    setMessage("");

    try {
      if (emergencyStopActive) {
        setAutomationEnabled(false);
        setMessage("Emergency stop active. Automation cycle blocked.");
        return;
      }

      const plan = evaluateAutomationPlan({
        scanner,
        portfolio,
        mode: effectiveAutomationMode,
        watchlist,
        dayTradeEnabled,
        optionsEnabled: effectiveOptionsEnabled,
        strategyMap,
        automationLog,
        learningMemory: paperLearningMemory,
        futuresEnabled: true,
        marketClock,
        allowFuturesExtendedHours: effectiveFuturesExtendedHours,
        decisionWindowMinutes,
        maxTradesPerDay,
        realDataRequired,
        hasRequiredRealData: hasEnoughRealEtfData,
        sessionPeakEquity
      });

      if (plan.action === "hold" || plan.action === "market-closed") {
        recordAutomation({ action: "hold", symbol: "-", quantity: 0, reason: plan.reason });
        setMessage(`Automation HOLD: ${plan.reason}`);
        if (
          plan.action === "market-closed" ||
          plan.profitLock?.hardDailyLossStop ||
          (plan.profitLock?.secureDayProfit && !plan.profitLock?.runnerLeft)
        ) {
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
          strategyScore: selectedStrategy?.score || null,
          reason: plan.reason,
          scannerScore: plan.bestOptionIdea?.score || null,
          learningAdjustment: plan.bestOptionIdea?.learningAdjustment || 0,
          decisionWindowMinutes,
          marketClockLabel: marketClock.label,
          mode: effectiveAutomationMode
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
          strategyScore: null,
          reason: plan.reason,
          decisionWindowMinutes,
          marketClockLabel: marketClock.label,
          mode: effectiveAutomationMode
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
        if (plan.profitLock?.hardDailyLossStop || (plan.profitLock?.secureDayProfit && !plan.profitLock?.runnerLeft)) {
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
          strategyScore: selectedStrategy?.score || null,
          reason: plan.reason,
          scannerScore: scanner?.results?.find((result) => result.symbol === plan.symbol)?.score || null,
          learningAdjustment: scanner?.results?.find((result) => result.symbol === plan.symbol)?.learningAdjustment || 0,
          decisionWindowMinutes,
          marketClockLabel: marketClock.label,
          mode: effectiveAutomationMode
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
        if (plan.profitLock?.hardDailyLossStop || (plan.profitLock?.secureDayProfit && !plan.profitLock?.runnerLeft)) {
          setAutomationEnabled(false);
        }
        return;
      }

      const planSignal = scanner?.results?.find((result) => result.symbol === plan.symbol);
      const order = {
        symbol: plan.symbol,
        side: plan.action,
        quantity: plan.quantity,
        reason: plan.reason,
        scannerScore: planSignal?.score || null,
        learningAdjustment: planSignal?.learningAdjustment || 0,
        decisionWindowMinutes,
        marketClockLabel: marketClock.label,
        mode: effectiveAutomationMode
      };
      executePaperOrder(order);
      recordAutomation({ ...order, reason: plan.reason });
      if (plan.action === "sell" || portfolio.totalReturn >= 0) {
        saveAutomationSnapshot(plan.reason);
      }
      if (plan.profitLock?.hardDailyLossStop || (plan.profitLock?.secureDayProfit && !plan.profitLock?.runnerLeft)) {
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

  function submitProfitWithdrawal(event) {
    event?.preventDefault();
    setMessage("");

    try {
      const nextPortfolioState = withdrawPaperProfit(portfolioState, withdrawalAmount);
      setPortfolioState(nextPortfolioState);
      recordAutomation({
        action: "withdraw",
        symbol: "PROFIT",
        quantity: 1,
        reason: `Paper profit withdrawal completed: ${formatMoney(withdrawalAmount)}.`
      });
      setMessage(`Paper profit withdrawal completed: ${formatMoney(withdrawalAmount)}.`);
    } catch (error) {
      setMessage(error.message);
    }
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
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    try {
      const nextUploadedData = { ...uploadedData };
      const loaded = [];
      const skipped = [];

      for (const file of files) {
        const symbolFromName = file.name.replace(/\.[^.]+$/, "").trim().toUpperCase();
        const symbol = symbols.includes(symbolFromName) ? symbolFromName : files.length === 1 ? backtestForm.symbol : null;

        if (!symbol) {
          skipped.push(`${file.name}: filename must match a supported symbol`);
          continue;
        }

        const text = await file.text();
        const candles = markCandles(parseCandlesCsv(text), "csv", "daily");

        if (candles.length < 2) {
          skipped.push(`${file.name}: missing date/open/high/low/close/volume columns`);
          continue;
        }

        nextUploadedData[symbol] = candles;
        loaded.push(`${symbol} ${candles.length} rows`);
      }

      if (!loaded.length) {
        throw new Error(skipped[0] || "No valid CSV files loaded.");
      }

      const mergedData = { ...bundledData, ...nextUploadedData };
      const primarySymbol = loaded[0].split(" ")[0];
      setUploadedData(nextUploadedData);
      setDataBySymbol(mergedData);
      setBacktest(
        runBacktest(
          { ...backtestForm, symbol: primarySymbol, riskPercent: Number(backtestForm.riskPercent) / 100 },
          mergedData
        )
      );
      setScanner(
        scanMarket(
          { ...backtestForm, symbol: primarySymbol, riskPercent: Number(backtestForm.riskPercent) / 100 },
          mergedData,
          market
        )
      );
      syncSymbol(primarySymbol);
      setMessage(
        `Uploaded ${loaded.join(", ")}.${skipped.length ? ` Skipped: ${skipped.join("; ")}.` : ""}`
      );
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
    const mergedData = { ...bundledData, ...apiData };
    setDataBySymbol(mergedData);
    setBacktest(runBacktest(config, mergedData));
    setScanner(scanMarket(config, mergedData, market));
    setMessage("Uploaded CSV data cleared.");
  }

  async function fetchPolygonMinuteCandles(symbol) {
    const token = polygonApiKey.trim();
    if (!token) {
      throw new Error("Polygon API key is required.");
    }

    const from = getIsoDateOffset(apiLookbackDays);
    const to = getIsoDateOffset(0);
    const url = new URL(
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/minute/${from}/${to}`
    );
    url.searchParams.set("adjusted", "true");
    url.searchParams.set("sort", "asc");
    url.searchParams.set("limit", "50000");
    url.searchParams.set("apiKey", token);

    const response = await fetch(url.toString());
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || `${symbol}: Polygon request failed.`);
    }

    if (!Array.isArray(payload.results) || !payload.results.length) {
      throw new Error(payload?.message || `${symbol}: Polygon returned no 1-minute candles.`);
    }

    return markCandles(
      payload.results.map((bar) => ({
        date: new Date(bar.t).toISOString(),
        open: Number(bar.o),
        high: Number(bar.h),
        low: Number(bar.l),
        close: Number(bar.c),
        volume: Number(bar.v || 0)
      })),
      "api-1min",
      "1-minute"
    );
  }

  async function refreshApiCandles({ silent = false } = {}) {
    if (!silent) {
      setMessage("");
    }

    if (!polygonApiKey.trim()) {
      if (!silent) {
        setMessage("Add your free Polygon API key first. It stays in this browser.");
      }
      return;
    }

    setApiLoading(true);

    try {
      const nextApiData = { ...apiData };
      const loaded = [];
      const skipped = [];

      for (const symbol of apiUpdateWatchlist) {
        try {
          const candles = await fetchPolygonMinuteCandles(symbol);
          nextApiData[symbol] = candles;
          loaded.push(`${symbol} ${candles.length} 1-min bars`);
        } catch (error) {
          skipped.push(`${symbol}: ${error.message}`);
        }
      }

      if (!loaded.length) {
        throw new Error(skipped.join(" ") || "No API candles loaded.");
      }

      const mergedData = { ...bundledData, ...uploadedData, ...nextApiData };
      const config = {
        ...backtestForm,
        symbol: apiUpdateWatchlist[0],
        riskPercent: Number(backtestForm.riskPercent) / 100
      };
      const apiMarket = mergeLatestApiQuotes(market, nextApiData);

      setApiData(nextApiData);
      setDataBySymbol(mergedData);
      setMarket(apiMarket);
      setBacktest(runBacktest(config, mergedData));
      setScanner(scanMarket(config, mergedData, apiMarket));
      if (!silent) {
        setMessage(
          `API candles updated: ${loaded.join(", ")}.${
            skipped.length ? ` Skipped: ${skipped.join("; ")}.` : ""
          } Free Polygon keys are rate-limited, so wait at least one minute before refreshing again.`
        );
      } else {
        recordAutomation({
          action: "api-refresh",
          symbol: "DATA",
          quantity: loaded.length,
          reason: `Auto-refreshed Polygon 1-minute candles: ${loaded.join(", ")}.`
        });
      }
    } catch (error) {
      if (!silent) {
        setMessage(error.message);
      } else {
        recordAutomation({
          action: "api-refresh-failed",
          symbol: "DATA",
          quantity: 0,
          reason: error.message
        });
      }
    } finally {
      setApiLoading(false);
    }
  }

  function clearApiCandles() {
    const config = {
      ...backtestForm,
      riskPercent: Number(backtestForm.riskPercent) / 100
    };
    setApiData({});
    const mergedData = { ...bundledData, ...uploadedData };
    setDataBySymbol(mergedData);
    setBacktest(runBacktest(config, mergedData));
    setScanner(scanMarket(config, mergedData, market));
    setMessage("API candle cache cleared. The app is back to uploaded/bundled CSV data.");
  }

  function downloadCsvTemplate() {
    const rows = [
      "date,open,high,low,close,volume",
      "2026-08-01,100.00,101.50,99.50,101.00,1000000",
      "2026-08-02,101.00,102.25,100.75,101.80,1200000"
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "SPY.csv";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Downloaded CSV template. Rename copies to SPY.csv, QQQ.csv, DIA.csv, and IWM.csv.");
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
          <p className="eyebrow">Paper Trading Command Center</p>
          <h1>Apex Alpha AI</h1>
          <p className="lede">
            Strategy scanner, live candle updater, paper automation, and risk controls in one dashboard.
          </p>
        </div>
        <div className="status-card">
          <span className="dot online" />
          <div>
            <strong>Command Center Ready</strong>
            <small>paper mode · risk gated</small>
          </div>
        </div>
      </section>

      {message && <div className="alert">{message}</div>}

      <section className="alert danger-alert emergency-bar">
        <span>
          <strong>{emergencyStopActive ? "Emergency Stop Active" : "Emergency Stop"}</strong>{" "}
          {emergencyStopActive
            ? "Automation is locked off and cannot restart until cleared."
            : "Press this if the bot is losing or the regular Stop button does not respond."}
        </span>
        <div className="quick-actions">
          <button type="button" className="secondary danger" onClick={triggerEmergencyStop}>
            Emergency Stop
          </button>
          {emergencyStopActive && (
            <button type="button" className="secondary mini" onClick={clearEmergencyStop}>
              Clear Lock
            </button>
          )}
        </div>
      </section>

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
                <option value="auto">Auto Disciplined</option>
                <option value="moderate">Moderate</option>
                <option value="bullish">Bullish</option>
              </select>
            </label>
            <label>
              Watched Symbols
              <input value={watchlist.join(", ")} readOnly />
            </label>
            <label>
              Entry Decision Window
              <select
                value={decisionWindowMinutes}
                onChange={(event) => setDecisionWindowMinutes(Number(event.target.value))}
              >
                <option value={2}>2 minutes disciplined</option>
                <option value={5}>5 minutes selective</option>
                <option value={15}>15 minutes selective</option>
              </select>
            </label>
            <label>
              Max Entries Today
              <select
                value={maxTradesPerDay}
                onChange={(event) => setMaxTradesPerDay(Number(event.target.value))}
              >
                <option value={3}>3 beginner</option>
                <option value={5}>5 moderate</option>
                <option value={8}>8 paper test</option>
              </select>
            </label>
          </div>
          <div className="toggle-row">
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={beginnerSafeMode}
                onChange={(event) => setBeginnerSafeMode(event.target.checked)}
              />
              Beginner Safe Mode
            </label>
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
              Allow smart futures after-hours paper cycles
            </label>
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={realDataRequired}
                onChange={(event) => setRealDataRequired(event.target.checked)}
              />
              Real Data Required
            </label>
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={autoApiRefresh}
                onChange={(event) => setAutoApiRefresh(event.target.checked)}
              />
              Auto-refresh Polygon every 5m
            </label>
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={autoStartWhenReady}
                onChange={(event) => setAutoStartWhenReady(event.target.checked)}
              />
              Auto-start when ready
            </label>
          </div>
          <p className="signal-note">
            Beginner Safe Mode: <strong>{beginnerSafeMode ? "on" : "off"}</strong> ·{" "}
            {beginnerSafeMode
              ? "keeps the bot disciplined for a realistic small account: uses moderate evaluation while red, blocks option entries while the session is red, and keeps smart futures under 4h/8h gates."
              : "advanced risk gates are relaxed; use this only for paper testing."}
            {beginnerOptionsBlocked && " Options are blocked until the paper session is green."}
          </p>
          <p className="signal-note">
            Market clock: <strong>{marketClock.label}</strong> · regular session{" "}
            <strong>{marketClock.isRegularSession ? "open" : "closed"}</strong>
            {marketClock.isRegularSession
              ? ` · ${marketClock.minutesUntilClose} minutes until close`
              : " · automation stops unless smart futures after-hours is enabled"}
          </p>
          <div className="brief-list blocker-list">
            <div className="brief-item">
              <span className={startGateReady ? "checkmark" : "xmark"}>
                {startGateReady ? "✓" : "!"}
              </span>
              <span>
                <strong>Start Readiness Gate: {startGateReady ? "READY FOR ONE CYCLE" : "WAIT"}</strong>
                <small>
                  {startGateReady
                    ? "Run One Cycle Now first. Only start full automation if that result is sane."
                    : startGateIssues.join(" ")}
                </small>
              </span>
            </div>
          </div>
          <p className="signal-note">
            Current plan: <strong>{automationPlan.action.toUpperCase()}</strong>{" "}
            {automationPlan.symbol ? `${automationPlan.symbol} x ${automationPlan.quantity}` : ""} ·{" "}
            {automationPlan.reason} · effective mode <strong>{effectiveAutomationMode}</strong>
          </p>
          {autoModeDecision.active && (
            <p className={`signal-note ${autoModeDecision.mode === "bullish" ? "gain" : ""}`}>
              Auto governor: <strong>{autoModeDecision.mode.toUpperCase()}</strong> · {autoModeDecision.reason}
              <br />
              Best practice window:{" "}
              <strong>
                {autoModeDecision.windowMemory.bestWindow
                  ? `${autoModeDecision.windowMemory.bestWindow.hour} · ${formatMoney(
                      autoModeDecision.windowMemory.bestWindow.pnl
                    )} P/L · ${formatPercent(autoModeDecision.windowMemory.bestWindow.winRate)} win rate`
                  : "collecting today’s closed-trade evidence"}
              </strong>
              . Current hour: <strong>{autoModeDecision.windowMemory.currentHour}</strong>.
            </p>
          )}
          <p className="signal-note">
            Market regime: <strong>{automationPlan.marketRegime?.regime || "checking"}</strong> ·{" "}
            {automationPlan.marketRegime?.reason || "Waiting for ETF scanner."} Strongest ETF:{" "}
            <strong>
              {automationPlan.marketRegime?.strongestEtf
                ? `${automationPlan.marketRegime.strongestEtf.symbol} · ${automationPlan.marketRegime.strongestEtf.score}`
                : "n/a"}
            </strong>
          </p>
          <p
            className={`signal-note ${
              automationPlan.marketQuality?.verdict === "no-trade" ? "loss" : "gain"
            }`}
          >
            Market quality: <strong>{automationPlan.marketQuality?.score ?? 0}/100</strong> ·{" "}
            {automationPlan.marketQuality?.reason || "Waiting for core ETF scanner data."} Auto-start requires{" "}
            <strong>{autoStartMarketQualityThreshold}+</strong>.
          </p>
          {automationPlan.noTradeIntelligence?.bullishDiscipline?.active && (
            <p
              className={`signal-note ${
                automationPlan.noTradeIntelligence.bullishDiscipline.passed ? "gain" : "loss"
              }`}
            >
              Bullish discipline:{" "}
              <strong>
                {automationPlan.noTradeIntelligence.bullishDiscipline.passed ? "passed" : "blocked"}
              </strong>
              . {automationPlan.noTradeIntelligence.bullishDiscipline.label}
            </p>
          )}
          {!hasEnoughRealEtfData && (
            <p className="signal-note loss">
              Real candle warning: ETF backtests are using simulated/bundled data until CSV/API candles are loaded for{" "}
              {recoveryWatchlist.join(", ")}. Do not trust paper gains as strategy proof yet.
            </p>
          )}
          <p className="signal-note">
            No-trade intelligence:{" "}
            <strong>{automationPlan.noTradeIntelligence?.canOpenNewEntry ? "clear" : "blocking new entries"}</strong>
            {automationPlan.noTradeIntelligence?.blockedReasons?.length ? (
              <>
                {" "}
                · {automationPlan.noTradeIntelligence.blockedReasons.join(" ")}
              </>
            ) : (
              " · required checks passed."
            )}
          </p>
          <p className="signal-note">
            Decision window: <strong>{decisionWindowMinutes} minute(s)</strong> · new entries{" "}
            <strong>{automationPlan.decisionWindow?.canOpenNewTrade ? "allowed now" : "waiting"}</strong>
            {automationPlan.decisionWindow?.lossCooldownActive &&
              ` · loss cooldown active (${automationPlan.decisionWindow.lossCooldownMinutes} minutes)`}
            {!automationPlan.decisionWindow?.canOpenNewTrade &&
              !automationPlan.decisionWindow?.lossCooldownActive &&
              ` · next entry window in about ${automationPlan.decisionWindow?.minutesUntilNextWindow ?? decisionWindowMinutes} minute(s)`}
            . Exits, profit locks, and kill switch still run immediately.
          </p>
          <p className="signal-note">
            Daily trade limit:{" "}
            <strong>
              {automationPlan.dailyTradeLimit?.todayEntryCount ?? dailyReport.entries}/
              {automationPlan.dailyTradeLimit?.maxTradesPerDay ?? maxTradesPerDay}
            </strong>{" "}
            entries used. New entries stop when this limit is reached; exits still work.
          </p>
          <p className="signal-note">
            Paper learning: <strong>{paperLearningMemory.closedTrades}</strong> closed result
            {paperLearningMemory.closedTrades === 1 ? "" : "s"} · {paperLearningMemory.summary}
            {paperLearningMemory.weakest?.scoreAdjustment < 0 && (
              <>
                {" "}
                Weak spot: <strong>{paperLearningMemory.weakest.id}</strong>{" "}
                {paperLearningMemory.weakest.scoreAdjustment}.
              </>
            )}
          </p>
          <p className="signal-note">
            Cash management: <strong>$3,000 adaptive sizing</strong> · max single trade{" "}
            {formatPercent((automationPlan.adaptiveRisk?.maxSingleTradeCashPercent || 0) * 100)} cash · max exposure{" "}
            {formatPercent(automationPlan.adaptiveRisk?.maxExposurePercent)} · live $1k equivalent risk{" "}
            {formatMoney(automationPlan.adaptiveRisk?.live1000Equivalent?.maxSingleTradeDollars)} per trade.
          </p>
          {automationPlan.adaptiveRisk?.returnPercent < 0 && (
            <p className="signal-note loss">
              Recovery mode active: shallow red accounts require exceptional setups and reduced sizing; near the daily loss limit, new entries stop.
            </p>
          )}
          <p className="signal-note">
            Profit lock: session peak <strong>{formatMoney(sessionPeakEquity)}</strong> · current profit{" "}
            <strong className={portfolio.totalReturn >= 0 ? "gain" : "loss"}>
              {formatMoney(portfolio.totalReturn)}
            </strong>
            . If profit gives back too much, automation closes risk before new entries.
            <br />
            Secure target: once session profit reaches{" "}
            <strong>{formatMoney(automationPlan.profitLock?.realisticProfitTarget || 100)}</strong>, automation secures the day and stops.
            Profit floor:{" "}
            <strong>
              {automationPlan.profitLock?.profitFloor
                ? formatMoney(automationPlan.profitLock.profitFloor)
                : "$0.00"}
            </strong>{" "}
            protected after $25/$50/$75 session peaks.
            Daily kill switch: down{" "}
            <strong>{formatMoney(automationPlan.profitLock?.hardLossDollars || 75)}</strong> or 2.5%, close risk and stop.
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
          {automationPlan.bestOptionIdea?.permission && (
            <p
              className={`signal-note ${
                automationPlan.bestOptionIdea.permission.allowed ? "gain" : "loss"
              }`}
            >
              Calls/Puts permission:{" "}
              <strong>{automationPlan.bestOptionIdea.permission.allowed ? "allowed" : "blocked"}</strong>.{" "}
              {automationPlan.bestOptionIdea.permission.label}
            </p>
          )}
          <div className="quick-actions">
            <button
              type="button"
              className="buy-button"
              onClick={toggleAutomation}
            >
              {emergencyStopActive ? "Emergency Stop Locked" : automationEnabled ? "Stop Automation" : "Start Automation"}
            </button>
            <button type="button" className="secondary" onClick={runAutomationCycle}>
              Run One Cycle Now
            </button>
            <button type="button" className="secondary" onClick={applyRecoveryPreset}>
              Apply Recovery Preset
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

        <article className="card">
          <div className="card-header">
            <h2>Daily Report Card</h2>
            <span className={`pill ${dailyReport.netChange >= 0 ? "buy" : "sell"}`}>
              {dailyReport.netChange >= 0 ? "green" : "red"}
            </span>
          </div>
          <div className="metric-grid compact">
            <div>
              <small>Start</small>
              <strong>{formatMoney(dailyReport.startingBalance)}</strong>
            </div>
            <div>
              <small>Now</small>
              <strong>{formatMoney(dailyReport.endingBalance)}</strong>
            </div>
            <div>
              <small>Net</small>
              <strong className={dailyReport.netChange >= 0 ? "gain" : "loss"}>
                {formatMoney(dailyReport.netChange)} · {formatPercent(dailyReport.netChangePercent)}
              </strong>
            </div>
            <div>
              <small>Win Rate</small>
              <strong>{formatPercent(dailyReport.winRate)}</strong>
            </div>
          </div>
          <p className="signal-note">
            Entries {dailyReport.entries}/{maxTradesPerDay} · closed trades {dailyReport.closedTrades} · realized P/L{" "}
            <strong className={dailyReport.realizedPnl >= 0 ? "gain" : "loss"}>
              {formatMoney(dailyReport.realizedPnl)}
            </strong>
            . Lesson: {dailyReport.lesson}
          </p>
          <p className="signal-note">
            Best:{" "}
            <strong>
              {dailyReport.bestTrade
                ? `${dailyReport.bestTrade.symbol} ${formatMoney(dailyReport.bestTrade.realizedPnl)}`
                : "n/a"}
            </strong>{" "}
            · Worst:{" "}
            <strong>
              {dailyReport.worstTrade
                ? `${dailyReport.worstTrade.symbol} ${formatMoney(dailyReport.worstTrade.realizedPnl)}`
                : "n/a"}
            </strong>
          </p>
          {dailyReport.strategyStats.length ? (
            <div className="brief-list">
              {dailyReport.strategyStats.slice(0, 3).map((stat) => (
                <div className="brief-item" key={stat.strategy}>
                  <span className={`pill ${stat.pnl >= 0 ? "buy" : "sell"}`}>
                    {stat.trades}
                  </span>
                  <span>
                    <strong>{stat.strategy}</strong>
                    <small>
                      P/L {formatMoney(stat.pnl)} · wins {stat.wins} · losses {stat.losses}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
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
            <h2>Opportunity Watchlist</h2>
            <span className="pill hold">monitor only</span>
          </div>
          <p className="signal-note">
            These are extra markets to watch for context. Automation still starts from the recovery ETFs:{" "}
            <strong>{recoveryWatchlist.join(", ")}</strong>.
          </p>
          <div className="brief-list opportunity-list">
            {opportunitySignals.map((opportunity) => (
              <div className="brief-item opportunity-item" key={`${opportunity.category}-${opportunity.symbol}`}>
                <span
                  className={
                      opportunity.hasRealData || opportunity.scannerResult?.score >= 75
                      ? "checkmark"
                      : opportunity.hasTradableSymbol
                        ? "pill hold compact-pill"
                        : "xmark"
                  }
                >
                  {opportunity.hasRealData || opportunity.scannerResult?.score >= 75
                    ? "✓"
                    : opportunity.hasTradableSymbol
                      ? "?"
                      : "!"}
                </span>
                <span>
                  <strong>
                    {opportunity.category}: {opportunity.symbol}
                  </strong>
                  <small>
                    {opportunity.stance} · {opportunity.status}
                    {opportunity.quote?.price ? ` · quote ${formatMoney(opportunity.quote.price)}` : ""}
                    {opportunity.scannerResult
                      ? ` · scanner ${opportunity.scannerResult.action} ${opportunity.scannerResult.score}`
                      : ""}
                  </small>
                  <small>{opportunity.rule}</small>
                </span>
              </div>
            ))}
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
                  {idea.permission && (
                    <small className={idea.permission.allowed ? "gain" : "loss"}>
                      Calls/Puts gate: {idea.permission.allowed ? "allowed" : "blocked"} · {idea.permission.label}
                    </small>
                  )}
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
                    <button
                      type="button"
                      className="secondary mini"
                      disabled={!idea.permission?.allowed}
                      onClick={() => tradeOptionIdea(idea, "buy")}
                    >
                      Paper Buy
                    </button>
                    <button
                      type="button"
                      className="secondary mini"
                      disabled={!idea.permission?.allowed}
                      onClick={() => tradeOptionIdea(idea, "sell")}
                    >
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
          <div className="quick-actions">
            <button type="button" className="secondary mini" onClick={refreshApiCandles} disabled={apiLoading}>
              {apiLoading ? "Updating..." : "Update 1-Min API"}
            </button>
            <button type="button" className="secondary mini" onClick={downloadCsvTemplate}>
              CSV Template
            </button>
            <button type="button" className="secondary danger" onClick={clearUploadedData}>
              Clear Uploads
            </button>
            <button type="button" className="secondary danger" onClick={clearApiCandles}>
              Clear API Cache
            </button>
          </div>
        </div>
        <div className="form-row">
          <label>
            Polygon API Key
            <input
              type="password"
              value={polygonApiKey}
              placeholder="Paste free Polygon key here"
              onChange={(event) => setPolygonApiKey(event.target.value)}
            />
            <small>
              Status: <strong>{polygonApiKey.trim() ? "key saved in this browser" : "no key yet"}</strong>. Get a
              free key from Polygon/Massive, paste it here, then update 1-minute candles.
            </small>
          </label>
          <label>
            API Candle Window
            <select value={apiLookbackDays} onChange={(event) => setApiLookbackDays(Number(event.target.value))}>
              <option value={2}>1-minute bars · 2 days</option>
              <option value={5}>1-minute bars · 5 days</option>
              <option value={10}>1-minute bars · 10 days</option>
            </select>
          </label>
        </div>
        <p className="signal-note">
          API mode fetches 1-minute Polygon candles for <strong>{apiUpdateWatchlist.join(", ")}</strong> and caches
          them in this browser. Free keys are rate-limited; use this before market open or when you need a fresh
          paper-test update. If API refresh fails, the bot keeps using uploaded or bundled CSV fallback data.
          <br />
          Auto-refresh is <strong>{autoApiRefresh ? "on" : "off"}</strong>; auto-start is{" "}
          <strong>{autoStartWhenReady ? "on" : "off"}</strong>. Auto-start only fires when the readiness gate passes
          and market quality is at least <strong>{autoStartMarketQualityThreshold}/100</strong>.
        </p>
        <div className="upload-row">
          <label className="file-picker">
            Upload Required ETF CSVs
            <input type="file" accept=".csv,text/csv" multiple onChange={uploadCsv} />
          </label>
          <p className="signal-note">
            Upload <strong>SPY.csv, QQQ.csv, DIA.csv, and IWM.csv</strong>. Required columns:
            date, open, high, low, close, volume. Uploaded data stays in this browser as a fallback.
          </p>
        </div>
        <div className="brief-list">
          {requiredEtfDataStatus.map((item) => (
            <div className="brief-item" key={item.symbol}>
              <span className={item.ready ? "checkmark" : "xmark"}>{item.ready ? "✓" : "!"}</span>
              <span>
                <strong>
                  {item.symbol} · {item.ready ? "ready" : "needed"}
                </strong>
                <small>
                  Source {item.source}; interval {item.interval}; rows {item.rows}; latest {item.lastDate || "-"}.
                  {item.ready ? " Meets real-data requirement." : " Needs at least 60 real CSV/API rows."}
                </small>
              </span>
            </div>
          ))}
        </div>
        {!hasEnoughRealEtfData && (
          <p className="signal-note loss">
            Automation will block new entries until these ETF CSV/API candles are loaded: {missingRequiredEtfs.join(", ")}.
          </p>
        )}
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
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={backtestForm.useAtrStops}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      useAtrStops: event.target.checked
                    })
                  }
                />
                Use ATR Stops
              </label>
            </div>
            <div className="form-row">
              <label>
                ATR Period
                <input
                  type="number"
                  min="5"
                  max="50"
                  step="1"
                  value={backtestForm.atrPeriod}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      atrPeriod: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                ATR Stop x
                <input
                  type="number"
                  min="0.5"
                  max="5"
                  step="0.1"
                  value={backtestForm.atrStopMultiplier}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      atrStopMultiplier: Number(event.target.value)
                    })
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                ATR Target x
                <input
                  type="number"
                  min="0.5"
                  max="8"
                  step="0.1"
                  value={backtestForm.atrTargetMultiplier}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      atrTargetMultiplier: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                ATR Trail x
                <input
                  type="number"
                  min="0.5"
                  max="5"
                  step="0.1"
                  value={backtestForm.atrTrailMultiplier}
                  onChange={(event) =>
                    setBacktestForm({
                      ...backtestForm,
                      atrTrailMultiplier: Number(event.target.value)
                    })
                  }
                />
              </label>
            </div>
            <div className="form-row">
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
              <span className={`pill ${realDataSources.includes(backtest?.data?.source) ? "buy" : "hold"}`}>
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
                  <span className={`pill ${realDataSources.includes(result.data.source) ? "buy" : "hold"}`}>
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
          <div className="metric-grid compact">
            <div>
              <small>Cash</small>
              <strong>{formatMoney(portfolio.cash)}</strong>
            </div>
            <div>
              <small>Withdrawn Profit</small>
              <strong>{formatMoney(portfolio.withdrawnProfit)}</strong>
            </div>
            <div>
              <small>Available to Withdraw</small>
              <strong className={portfolio.withdrawableProfit >= 5 ? "gain" : ""}>
                {formatMoney(portfolio.withdrawableProfit)}
              </strong>
            </div>
          </div>
          <form className="trade-form" onSubmit={submitProfitWithdrawal}>
            <div className="form-row">
              <label>
                Profit Withdrawal
                <input
                  type="number"
                  min="5"
                  step="1"
                  value={withdrawalAmount}
                  onChange={(event) => setWithdrawalAmount(Number(event.target.value))}
                />
              </label>
              <label>
                Rule
                <input value="Minimum $5 · closed/cash profit only" readOnly />
              </label>
            </div>
            <button
              type="submit"
              className="secondary"
              disabled={portfolio.withdrawableProfit < 5}
            >
              Withdraw Paper Profit
            </button>
          </form>
          <p className="signal-note">
            Withdrawals are simulated. The button only unlocks after closed paper profit creates at least $5 of
            cash above starting capital.
          </p>
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
                <th>Replay</th>
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
                    <td>
                      <small>
                        {trade.reason || "No reason saved"}{" "}
                        {trade.marketClockLabel ? `· ${trade.marketClockLabel}` : ""}
                        {trade.decisionWindowMinutes ? ` · ${trade.decisionWindowMinutes}m window` : ""}
                      </small>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">No paper trades yet.</td>
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
        <div className="card-header">
          <h2>Data Sources</h2>
          <span className={`pill ${hasEnoughRealEtfData ? "buy" : "hold"}`}>
            {hasEnoughRealEtfData ? "real ready" : "needs data"}
          </span>
        </div>
        <p className="signal-note">
          Recovery ETF candle coverage: <strong>{realEtfDataCount}/{recoveryWatchlist.length}</strong>. Load CSV/API
          candles for {recoveryWatchlist.join(", ")} before trusting backtests.
        </p>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Source</th>
              <th>Interval</th>
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
                  <span className={`pill ${realDataSources.includes(item.source) ? "buy" : "hold"}`}>
                    {item.source}
                  </span>
                </td>
                <td>{item.interval || "-"}</td>
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
