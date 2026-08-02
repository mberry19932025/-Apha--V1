import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");

function parseNumber(value) {
  const parsed = Number(String(value || "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(header) {
  return header.toLowerCase().replace(/[^a-z]/g, "");
}

export function readCsvCandles(symbol) {
  const safeSymbol = String(symbol || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  if (!safeSymbol) {
    return null;
  }

  const filePath = path.join(dataDir, `${safeSymbol}.csv`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const rows = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    return null;
  }

  const headers = parseCsvLine(rows[0]).map(normalizeHeader);
  const indexes = {
    date: headers.findIndex((header) => ["date", "timestamp", "time"].includes(header)),
    open: headers.findIndex((header) => header === "open"),
    high: headers.findIndex((header) => header === "high"),
    low: headers.findIndex((header) => header === "low"),
    close: headers.findIndex((header) => ["close", "adjustedclose", "adjclose"].includes(header)),
    volume: headers.findIndex((header) => header === "volume")
  };

  if (Object.values(indexes).some((index) => index < 0)) {
    throw new Error(
      `${safeSymbol}.csv must include date, open, high, low, close or adjusted close, and volume columns.`
    );
  }

  const candles = rows
    .slice(1)
    .map((row) => {
      const columns = parseCsvLine(row);
      const candle = {
        date: columns[indexes.date],
        open: parseNumber(columns[indexes.open]),
        high: parseNumber(columns[indexes.high]),
        low: parseNumber(columns[indexes.low]),
        close: parseNumber(columns[indexes.close]),
        volume: parseNumber(columns[indexes.volume])
      };

      if (
        !candle.date ||
        candle.open === null ||
        candle.high === null ||
        candle.low === null ||
        candle.close === null ||
        candle.volume === null
      ) {
        return null;
      }

      return candle;
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (candles.length < 2) {
    return null;
  }

  return {
    source: "csv",
    filePath,
    candles
  };
}

export function getDataStatus(symbols) {
  return symbols.map((symbol) => {
    const data = readCsvCandles(symbol);
    return {
      symbol,
      source: data ? "csv" : "simulated",
      rows: data?.candles.length || 0,
      firstDate: data?.candles[0]?.date || null,
      lastDate: data?.candles.at(-1)?.date || null
    };
  });
}
