export const projectCapabilities = [
  "Static browser deployment with no paid backend",
  "Bundled real daily CSV data for the core watchlist",
  "Browser CSV upload for manual data refreshes",
  "Paper portfolio saved in browser storage",
  "Scanner, backtester, strategy comparison, and paper order ticket"
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
