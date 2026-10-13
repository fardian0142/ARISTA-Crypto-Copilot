import {
  readCache,
  writeCache,
  cleanOldSignals,
  hasRecentSignal,
  addSignal
} from "./cache.js";
import { CONFIG } from "./config.js";
import { getTopSymbols } from "./exchanges.js";
import { analyze } from "./analysis.js";
import { formatAnalysis } from "./format.js";

const TIMEFRAMES = Array.isArray(CONFIG.SIGNAL_TIMEFRAMES) && CONFIG.SIGNAL_TIMEFRAMES.length > 0
  ? CONFIG.SIGNAL_TIMEFRAMES
  : ["15m"];

const TIMEFRAME_PRIORITY = {
  "15m": 1,
  "30m": 2
};

const MAX_SCORE = 14;
const CONCURRENCY = 5;
const MESSAGE_DELAY_MS = 1500;
const TOTAL_TIMEOUT_MS = 55 * 60 * 1000;

const TELEGRAM_MAX_ATTEMPTS = 5;
const TELEGRAM_BASE_RETRY_MS = 3000;
const TELEGRAM_MAX_RETRY_MS = 90000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTimeframePriority(tf) {
  return Object.prototype.hasOwnProperty.call(TIMEFRAME_PRIORITY, tf)
    ? TIMEFRAME_PRIORITY[tf]
    : 99;
}

function parseRetryAfter(data, fallbackMs) {
  if (data && Number.isFinite(data.retry_after) && data.retry_after > 0) {
    return Math.min(data.retry_after * 1000 + 1000, TELEGRAM_MAX_RETRY_MS);
  }

  if (data && typeof data.description === "string") {
    const match = data.description.match(/retry after (\d+)/i);

    if (match) {
      const seconds = parseInt(match[1], 10);

      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.min(seconds * 1000 + 1000, TELEGRAM_MAX_RETRY_MS);
      }
    }
  }

  return Math.min(fallbackMs, TELEGRAM_MAX_RETRY_MS);
}

async function sendTelegramMessage(token, chatId, text) {
  const url = "https://api.telegram.org/bot" + token + "/sendMessage";

  let lastError = null;

  for (let attempt = 1; attempt <= TELEGRAM_MAX_ATTEMPTS; attempt++) {
    let response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      });
    } catch (e) {
      lastError = e;

      if (attempt === TELEGRAM_MAX_ATTEMPTS) {
        throw e;
      }

      const backoff = Math.min(
        TELEGRAM_BASE_RETRY_MS * attempt,
        TELEGRAM_MAX_RETRY_MS
      );

      await sleep(backoff);
      continue;
    }

    const responseText = await response.text();

    let data = null;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = null;
    }

    if (response.ok && data && data.ok === true) {
      return data;
    }

    const description =
      data && data.description
        ? data.description
        : "Telegram API error (HTTP " + response.status + ")";

    const isRateLimit =
      response.status === 429 ||
      (typeof description === "string" &&
        description.toLowerCase().includes("too many requests"));

    lastError = new Error(description);

    if (!isRateLimit || attempt === TELEGRAM_MAX_ATTEMPTS) {
      throw lastError;
    }

    const waitMs = parseRetryAfter(
      data,
      TELEGRAM_BASE_RETRY_MS * attempt
    );

    console.log(
      "⏳ Telegram rate limit — waiting " +
        Math.ceil(waitMs / 1000) +
        "s before retry (attempt " +
        attempt +
        "/" +
        TELEGRAM_MAX_ATTEMPTS +
        ")"
    );

    await sleep(waitMs);
  }

  throw lastError || new Error("Telegram send failed");
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;

      try {
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      } catch (e) {
        results[currentIndex] = { error: e };
      }
    }
  }

  const runners = [];

  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    runners.push(runner());
  }

  await Promise.all(runners);

  return results;
}

function logSummary(summary) {
  const elapsedSec = (summary.elapsedMs / 1000).toFixed(1);

  console.log("");
  console.log("═══════════════════════════════════════════");
  console.log("📊 SCAN SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log("⏱  Timeframes           : " + TIMEFRAMES.join(" , "));
  console.log("🎯 Required Score       : " + MAX_SCORE + "/" + MAX_SCORE);
  console.log("📈 Total symbols        : " + summary.total);
  console.log("⏭  Skipped (cached)     : " + summary.skipped);
  console.log("🔎 Analyzed             : " + summary.analyzed);
  console.log("📤 Sent                 : " + summary.sent);
  console.log("⚠️  Failed               : " + summary.failed);
  console.log("📥 Cache entries        : " + summary.cacheEntries);
  console.log("🕐 Elapsed              : " + elapsedSec + "s");
  console.log("═══════════════════════════════════════════");
  console.log("");
}

async function main() {
  const startTime = Date.now();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error(
      "❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables."
    );
    process.exit(1);
  }

  const summary = {
    total: 0,
    skipped: 0,
    analyzed: 0,
    sent: 0,
    failed: 0,
    cacheEntries: 0,
    elapsedMs: 0
  };

  console.log("");
  console.log("🚀 Starting crypto scan...");
  console.log("⏱  Timeframes: " + TIMEFRAMES.join(" , "));
  console.log("🎯 Required score: " + MAX_SCORE + "/" + MAX_SCORE);
  console.log("");

  let cache = await readCache();

  cache.signals = cleanOldSignals(cache.signals);

  console.log(
    "📥 Loaded cache: " +
      Object.keys(cache.signals).length +
      " active signal(s)"
  );

  let symbols = [];

  try {
    symbols = await getTopSymbols(CONFIG.MARKET_TOP_LIMIT);
  } catch (e) {
    console.error("❌ Failed to fetch top symbols:", e.message || e);
    process.exit(1);
  }

  summary.total = symbols.length;

  console.log("📈 Fetched " + symbols.length + " symbols to scan");
  console.log("");

  const results = await runWithConcurrency(
    symbols,
    CONCURRENCY,
    async (item) => {
      const symbol = item.symbol;

      if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
        return { symbol, status: "timeout" };
      }

      const candidates = [];

      for (const timeframe of TIMEFRAMES) {
        if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
          break;
        }

        if (hasRecentSignal(cache.signals, symbol, timeframe)) {
          continue;
        }

        let analysis;

        try {
          analysis = await analyze(symbol, timeframe);
        } catch (e) {
          continue;
        }

        const active =
          analysis &&
          analysis.range_setups &&
          analysis.range_setups.active;

        if (
          !active ||
          !Number.isFinite(active.score) ||
          active.score !== MAX_SCORE
        ) {
          continue;
        }

        candidates.push({
          symbol,
          timeframe,
          analysis,
          active
        });
      }

      if (candidates.length === 0) {
        const allCached = TIMEFRAMES.every((tf) =>
          hasRecentSignal(cache.signals, symbol, tf)
        );

        if (allCached) {
          return { symbol, status: "skipped" };
        }

        return { symbol, status: "no_signal" };
      }

      candidates.sort((a, b) => {
        const pa = getTimeframePriority(a.timeframe);
        const pb = getTimeframePriority(b.timeframe);
        if (pa !== pb) return pa - pb;
        return b.active.score - a.active.score;
      });

      return {
        symbol,
        status: "signal",
        winner: candidates[0]
      };
    }
  );

  const signalsToSend = [];

  for (const result of results) {
    if (!result) continue;

    if (result.status === "skipped") {
      summary.skipped++;
    } else if (
      result.status === "no_signal" ||
      result.status === "error" ||
      result.status === "timeout"
    ) {
      summary.analyzed++;
    } else if (result.status === "signal") {
      summary.analyzed++;
      signalsToSend.push(result.winner);
    }
  }

  console.log(
    "✅ Scan complete: " +
      summary.analyzed +
      " analyzed, " +
      summary.skipped +
      " skipped"
  );

  if (signalsToSend.length > 0) {
    console.log("");
    console.log(
      "📨 " + signalsToSend.length + " qualifying signal(s) to send"
    );
    console.log("");
  }

  for (const signal of signalsToSend) {
    const { symbol, timeframe, analysis, active } = signal;

    try {
      const text = formatAnalysis(analysis);

      await sendTelegramMessage(token, chatId, text);

      cache.signals = addSignal(cache.signals, symbol, timeframe, {
        direction: active.direction,
        score: active.score,
        entry: active.entry,
        stop: active.stop
      });

      summary.sent++;

      console.log(
        "📤 Sent: " +
          symbol +
          " [" +
          timeframe +
          "] (" +
          active.direction +
          ", score " +
          active.score +
          "/14)"
      );
    } catch (e) {
      summary.failed++;

      console.error(
        "❌ Failed to send " + symbol + " [" + timeframe + "]:",
        (e && e.message) || e
      );
    }

    await sleep(MESSAGE_DELAY_MS);
  }

  cache.signals = cleanOldSignals(cache.signals);

  try {
    await writeCache(cache);
  } catch (e) {
    console.error("❌ Failed to write cache:", (e && e.message) || e);
  }

  summary.cacheEntries = Object.keys(cache.signals).length;
  summary.elapsedMs = Date.now() - startTime;

  logSummary(summary);

  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Fatal error:", (e && e.stack) || e);
  process.exit(1);
});
