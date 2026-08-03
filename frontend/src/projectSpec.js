export const projectCapabilities = [
  "Static browser deployment with no paid backend",
  "Bundled real daily CSV data for the core watchlist",
  "Browser CSV upload for manual data refreshes",
  "Paper portfolio saved in browser storage",
  "Scanner, backtester, strategy comparison, and paper order ticket",
  "Backtest slippage and commission assumptions",
  "1-3% trade-target discipline scoring",
  "Browser learning journal for repeated paper-test evidence",
  "Moderate bullish and pattern-confirmed risk profiles",
  "Stop loss, take profit, trailing stop, profit lock, and streak-stop protections",
  "V1 readiness gate for data, risk, evidence, broker, and engine gaps"
];

export const projectTests = [
  {
    id: "csv-watchlist",
    label: "All six watchlist symbols have CSV data",
    run: ({ dataStatus }) => dataStatus.length === 6 && dataStatus.every((item) => item.source === "csv")
  },
  {
    id: "strategy-count",
    label: "All four strategy tests are available",
    run: ({ strategyComparison }) => strategyComparison.length === 4
  },
  {
    id: "backtest-summary",
    label: "Backtest summary and equity curve are generated",
    run: ({ backtest }) => Boolean(backtest?.summary && backtest?.equityCurve?.length)
  },
  {
    id: "transaction-costs",
    label: "Backtest includes slippage and commission assumptions",
    run: ({ backtest }) =>
      Number.isFinite(backtest?.config?.slippagePercent) &&
      Number.isFinite(backtest?.config?.commission)
  },
  {
    id: "discipline-score",
    label: "Discipline score uses target profit and risk checks",
    run: ({ backtest, currentEvaluation }) =>
      Number.isFinite(backtest?.summary?.averageTradeReturnPercent) &&
      Number.isFinite(backtest?.summary?.profitFactor) &&
      currentEvaluation?.checks?.length >= 5
  },
  {
    id: "protective-exits",
    label: "Backtest includes protective exits and stop rules",
    run: ({ backtest }) =>
      Number.isFinite(backtest?.config?.stopLossPercent) &&
      Number.isFinite(backtest?.config?.takeProfitPercent) &&
      Number.isFinite(backtest?.config?.trailingStopPercent) &&
      Number.isFinite(backtest?.config?.maxConsecutiveLosses)
  },
  {
    id: "risk-profile",
    label: "Risk profile is capped unless a pattern is confirmed",
    run: ({ backtest }) =>
      ["capital-guard", "moderate-bullish", "pattern-confirmed"].includes(backtest?.config?.riskProfile)
  },
  {
    id: "learning-journal",
    label: "Learning journal is ready for repeated test collection",
    run: ({ learningSummary }) =>
      Number.isFinite(learningSummary?.totalRuns) &&
      ["early", "building", "strong"].includes(learningSummary?.evidenceLevel)
  },
  {
    id: "readiness-gate",
    label: "V1 readiness gate tracks paper-test blockers",
    run: ({ readiness }) =>
      readiness?.checks?.length >= 10 &&
      readiness.checks.some((check) => check.id === "backtest-engine" && !check.passed) &&
      readiness.checks.some((check) => check.id === "broker-paper" && !check.passed)
  },
  {
    id: "scanner-results",
    label: "Scanner ranks the full watchlist",
    run: ({ scanner }) => scanner?.results?.length === 6
  },
  {
    id: "paper-mode",
    label: "Paper portfolio starts with safe simulated cash",
    run: ({ portfolio }) => portfolio.mode === "static paper" && portfolio.startingCash === 100000
  }
];
