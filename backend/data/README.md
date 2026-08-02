Place daily OHLCV CSV files here using uppercase symbol filenames:

```csv
date,open,high,low,close,volume
2026-01-02,100,105,99,104,1200000
```

Examples:

- `AAPL.csv`
- `SPY.csv`
- `NVDA.csv`

When a matching CSV exists, the backtester and scanner use it. When it does not, the app falls back to simulated data.
