# Apex Alpha AI Version 1 PDF Spec

Source PDF: `/Users/michh/Documents/72x3 Stock Market Control.pdf`

## Extraction Note

The source PDF is 85 pages. Text extraction found readable body content on pages 82-85; pages 1-81 appear blank except for ChatGPT export headers and footers. This spec preserves the actionable plan from the readable portion so the project does not need to be recreated from memory.

## Core Direction

- Do not pay for QuantConnect or other paid cloud backtesting plans during Version 1.
- Build locally first in VS Code.
- Use GitHub for source control.
- Use static hosting for the dashboard when possible.
- Use Render only for the static frontend unless a backend becomes necessary later.
- Treat paid backtesting/data services as a later validation step, not a starting dependency.

## Version 1 Scope

- Static browser app.
- No paid backend required.
- Paper trading only.
- Real daily CSV data bundled into the app.
- Browser CSV upload for updating data without redeploying.
- Market scanner for `AAPL`, `MSFT`, `NVDA`, `TSLA`, `SPY`, and `QQQ`.
- Backtesting with configurable cash, risk, lookback, and strategy settings.
- Strategy comparison before paper trading.
- Portfolio state saved locally in the browser.

## Strategies

- Moving-average crossover.
- RSI reversion.
- MACD trend.
- Buy-and-hold benchmark.

## Data Requirements

CSV files must include:

```csv
date,open,high,low,close,volume
```

Bundled CSV files live in:

```text
frontend/public/data/
```

Uploaded CSV files are stored in browser localStorage and take priority over bundled files.

## Acceptance Tests

- App builds with `npm run build`.
- Public static site loads without backend API calls.
- All six bundled watchlist symbols load CSV data.
- Backtest returns an equity curve and summary.
- Scanner ranks all six symbols.
- Paper buy orders update portfolio positions.
- Paper reset clears local positions and trades.
- Strategy comparison runs all supported strategies for the selected symbol.

## Future Version Candidates

- GitHub Action for automated nightly CSV refresh.
- Exportable backtest reports.
- More indicators and strategy rules.
- Better price/equity charting.
- Optional backend only if automation or broker integration becomes necessary.
