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

const SCAN_TIMEFRAMES = ["15m", "30m", "1h", "2h"];
const PRIMARY_TIMEFRAME = "1h";

const MAX_SCORE = 14;
const CONCURRENCY = 5;
const MESSAGE_DELAY_MS = 1500;
const TOTAL_TIMEOUT_MS = 55 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendTelegramMessage(token, chatId, text) {
  const url = "https://api.telegram.org/bot" + token + "/sendMessage";

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  const responseText = await response.text();

  let data = null;

  try {
    data = JSON.parse(responseText);
  } catch {
    data = null;
  }

  if (!response.ok || !data || data.ok !== true) {
    const description =
      data && data.description
        ? data.description
        : "Telegram API error (HTTP " + response.status + ")";

    throw new Error(description);
  }

  return data;
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
  console.log("⏱  Timeframes           : " + SCAN_TIMEFRAMES.join(", "));
  console.log("🎯 Primary TF (multi)   : " + PRIMARY_TIMEFRAME);
  console.log("🎯 Required Score       : " + MAX_SCORE + "/" + MAX_SCORE);
  console.log("📈 Total symbol×TF      : " + summary.total);
  console.log("⏭  Skipped (cached)     : " + summary.skipped);
  console.log("🔎 Analyzed             : " + summary.analyzed);
  console.log("✨ Signals detected     : " + summary.signals);
  console.log("📤 Sent (after merge)   : " + summary.sent);
  console.log("📥 Cache entries        : " + summary.cacheEntries);
  console.log("🕐 Elapsed              : " + elapsedSec + "s");
  console.log("═══════════════════════════════════════════");
  console.log("");
}

function selectSignalForSymbol(signalsByTF) {
  const tfs = Object.keys(signalsByTF);

  if (tfs.length === 0) return null;

  if (tfs.length === 1) {
    const tf = tfs[0];
    return { timeframe: tf, ...signalsByTF[tf] };
  }

  if (signalsByTF[PRIMARY_TIMEFRAME]) {
    return {
      timeframe: PRIMARY_TIMEFRAME,
      ...signalsByTF[PRIMARY_TIMEFRAME]
    };
  }

  let best = null;

  for (const tf of tfs) {
    const s = signalsByTF[tf];
    if (!best) {
      best = { timeframe: tf, ...s };
      continue;
    }

    const bestScore = best.active.score || 0;
    const curScore = s.active.score || 0;

    if (curScore > bestScore) {
      best = { timeframe: tf, ...s };
      continue;
    }

    if (curScore === bestScore) {
      const bestRR = best.active.rr1 || 0;
      const curRR = s.active.rr1 || 0;
      if (curRR > bestRR) best = { timeframe: tf, ...s };
    }
  }

  return best;
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
    signals: 0,
    sent: 0,
    cacheEntries: 0,
    elapsedMs: 0
  };

  console.log("");
  console.log("🚀 Starting crypto scan...");
  console.log("⏱  Timeframes: " + SCAN_TIMEFRAMES.join(", "));
  console.log("🎯 Primary TF for multi-signal: " + PRIMARY_TIMEFRAME);
  console.log("🎯 Required score: " + MAX_SCORE + "/" + MAX_SCORE);
  console.log("");

  let cache = await readCache();
  cache.signals = cleanOldSignals(cache.signals);

  console.log(
    "📥 Loaded cache: " + Object.keys(cache.signals).length + " active signal(s)"
  );

  let symbols = [];

  try {
    symbols = await getTopSymbols(CONFIG.MARKET_TOP_LIMIT);
  } catch (e) {
    console.error("❌ Failed to fetch top symbols:", e.message || e);
    process.exit(1);
  }

  summary.total = symbols.length * SCAN_TIMEFRAMES.length;

  console.log(
    "📈 Fetched " +
      symbols.length +
      " symbols × " +
      SCAN_TIMEFRAMES.length +
      " timeframes = " +
      summary.total +
      " tasks"
  );
  console.log("");

  const tasks = [];
  for (const item of symbols) {
    for (const tf of SCAN_TIMEFRAMES) {
      tasks.push({ symbol: item.symbol, timeframe: tf });
    }
  }

  const results = await runWithConcurrency(tasks, CONCURRENCY, async (task) => {
    const { symbol, timeframe } = task;

    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
      return { symbol, timeframe, status: "timeout" };
    }

    if (hasRecentSignal(cache.signals, symbol, timeframe)) {
      return { symbol, timeframe, status: "skipped" };
    }

    let analysis;

    try {
      analysis = await analyze(symbol, timeframe);
    } catch (e) {
      return {
        symbol,
        timeframe,
        status: "error",
        error: (e && e.message) || "unknown"
      };
    }

    const active =
      analysis && analysis.range_setups && analysis.range_setups.active;

    if (
      !active ||
      !Number.isFinite(active.score) ||
      active.score !== MAX_SCORE
    ) {
      return { symbol, timeframe, status: "no_signal" };
    }

    return {
      symbol,
      timeframe,
      status: "signal",
      analysis,
      active
    };
  });

  const signalsBySymbol = new Map();

  for (const result of results) {
    if (!result) continue;

    if (result.status === "skipped") {
      summary.skipped++;
    } else if (result.status === "no_signal" || result.status === "error") {
      summary.analyzed++;
    } else if (result.status === "signal") {
      summary.analyzed++;
      summary.signals++;

      if (!signalsBySymbol.has(result.symbol)) {
        signalsBySymbol.set(result.symbol, {});
      }
      signalsBySymbol.get(result.symbol)[result.timeframe] = {
        analysis: result.analysis,
        active: result.active
      };
    }
  }

  console.log(
    "✅ Scan complete: " +
      summary.analyzed +
      " analyzed, " +
      summary.skipped +
      " skipped, " +
      summary.signals +
      " raw signal(s)"
  );

  const toSend = [];

  for (const [symbol, tfMap] of signalsBySymbol.entries()) {
    const selected = selectSignalForSymbol(tfMap);
    if (!selected) continue;

    const tfCount = Object.keys(tfMap).length;

    if (tfCount > 1) {
      console.log(
        "🔀 " +
          symbol +
          " → " +
          tfCount +
          " TFs signaled (" +
          Object.keys(tfMap).join(", ") +
          ") → sending " +
          selected.timeframe
      );
    }

    toSend.push({
      symbol,
      timeframe: selected.timeframe,
      analysis: selected.analysis,
      active: selected.active,
      multiTF: tfCount > 1
    });
  }

  if (toSend.length > 0) {
    console.log("");
    console.log("📨 " + toSend.length + " final message(s) to send");
    console.log("");
  }

  for (const signal of toSend) {
    const { symbol, timeframe, analysis, active, multiTF } = signal;

    try {
      const text = formatAnalysis(analysis);

      await sendTelegramMessage(token, chatId, text);

      cache.signals = addSignal(cache.signals, symbol, timeframe, {
        direction: active.direction,
        score: active.score,
        entry: active.entry,
        stop: active.stop
      });

      if (multiTF) {
        const tfMap = signalsBySymbol.get(symbol);
        if (tfMap) {
          for (const otherTF of Object.keys(tfMap)) {
            if (otherTF === timeframe) continue;
            const otherActive = tfMap[otherTF].active;
            cache.signals = addSignal(
              cache.signals,
              symbol,
              otherTF,
              {
                direction: otherActive.direction,
                score: otherActive.score,
                entry: otherActive.entry,
                stop: otherActive.stop
              }
            );
          }
        }
      }

      try {
        await writeCache(cache);
      } catch (e) {
        console.error(
          "⚠️ Failed to write cache after send:",
          (e && e.message) || e
        );
      }

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
          "/14" +
          (multiTF ? ", merged" : "") +
          ")"
      );
    } catch (e) {
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
