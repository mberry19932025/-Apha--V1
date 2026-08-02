import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const symbols = process.argv.slice(2).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

if (!apiKey) {
  console.error("Missing ALPHA_VANTAGE_API_KEY.");
  console.error("Run: ALPHA_VANTAGE_API_KEY=your_free_key npm run data:alpha --workspace backend -- AAPL SPY");
  process.exit(1);
}

if (!symbols.length) {
  console.error("Pass at least one symbol.");
  console.error("Example: npm run data:alpha --workspace backend -- AAPL SPY QQQ");
  process.exit(1);
}

function normalizeAlphaVantageCsv(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2 || !lines[0].toLowerCase().includes("timestamp")) {
    throw new Error(csv.slice(0, 220));
  }

  return [
    "date,open,high,low,close,volume",
    ...lines.slice(1).map((line) => {
      const [timestamp, open, high, low, close, volume] = line.split(",");
      return [timestamp, open, high, low, close, volume].join(",");
    })
  ].join("\n");
}

await fs.mkdir(dataDir, { recursive: true });

for (const symbol of symbols) {
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "TIME_SERIES_DAILY");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("outputsize", "compact");
  url.searchParams.set("datatype", "csv");
  url.searchParams.set("apikey", apiKey);

  console.log(`Downloading ${symbol}...`);
  const response = await fetch(url);
  const csv = await response.text();

  if (!response.ok) {
    throw new Error(`${symbol} request failed: ${response.status} ${csv.slice(0, 120)}`);
  }

  const normalized = normalizeAlphaVantageCsv(csv);
  const outputPath = path.join(dataDir, `${symbol}.csv`);
  await fs.writeFile(outputPath, `${normalized}\n`, "utf8");
  console.log(`Saved ${outputPath}`);
}
