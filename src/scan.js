import {
  readCache,
  writeCache,
  cleanOldSignals,
  hasRecentSignal,
  addSignal,
  readStats,
  writeStats
} from "./cache.js";
import { CONFIG } from "./config.js";
import { getTopSymbols } from "./exchanges.js";
import { analyze } from "./analysis.js";
import { formatAnalysis, formatSignalResult, formatTradeClosed } from "./format.js";
import { updateSignalStatus, computeStats } from "./tracker.js";

const SCAN_TIMEFRAMES = ["15m", "30m", "1h", "2h"];
const PRIMARY_TIMEFRAME = "1h";

const MAX_SCORE = 14;
const CONCURRENCY = 5;
const MESSAGE_DELAY_MS = 1500;
const TOTAL_TIMEOUT_MS = 55 * 60 * 1000;
const MAX_RECENT_SIGNALS = 200;

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
  console.log("🔄 Tracked (updated)    : " + summary.tracked);
  console.log("🚫 Missed/Invalidated   : " + summary.missed);
  console.log("🧹 Cleaned (completed)  : " + summary.cleaned);
  console.log("📥 Cache entries        : " + summary.cacheEntries);
  console.log("🕐 Elapsed              : " + elapsedSec + "s");
  console.log("═══════════════════════════════════════════");
  console.log("");
}

function isSetupValid(active, currentPrice) {
  if (!active || !Number.isFinite(currentPrice)) return false;

  const direction = active.direction;
  const entry = active.entry;
  const stop = active.stop;
  const zoneLow = active.zone_low;
  const zoneHigh = active.zone_high;

  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(zoneLow) || !Number.isFinite(zoneHigh)) {
    return false;
  }

  const isBullish = direction === "bullish";

  if (isBullish && currentPrice <= stop) return false;
  if (!isBullish && currentPrice >= stop) return false;

  const riskDist = Math.abs(entry - stop);
  const tolerance = riskDist * 0.30;

  if (isBullish && currentPrice > zoneHigh + tolerance) return false;
  if (!isBullish && currentPrice < zoneLow - tolerance) return false;

  return true;
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

function getClosedReason(sig, eventType, maxR) {
  if (eventType === "stopped") {
    if (!maxR || maxR <= 0) {
      return "stopped_without_tp";
    }
    return "stopped_after_tp";
  }
  return eventType;
}

function shouldCloseTrade(sig, eventType, maxR) {
  if (eventType === "stopped") {
    return true;
  }

  if (eventType === "tp3_hit" && sig.tp3) {
    return true;
  }

  if (eventType === "tp2_hit" && !sig.tp3) {
    return true;
  }

  if (eventType === "tp1_hit" && !sig.tp2 && !sig.tp3) {
    return true;
  }

  return false;
}

function computeTotalR(sig, eventType, maxR) {
  if (eventType === "stopped") {
    if (sig.tp2Reached && sig.rr2) return sig.rr2;
    if (sig.tp1Reached && sig.rr1) return sig.rr1;
    return maxR || 0;
  }

  if (eventType === "tp3_hit") return sig.rr3 || 0;
  if (eventType === "tp2_hit") return sig.rr2 || 0;
  if (eventType === "tp1_hit") return sig.rr1 || 0;

  return maxR || 0;
}

function isNotified(sig, eventType) {
  if (eventType === "tp1_hit") return sig._tp1Notified === true;
  if (eventType === "tp2_hit") return sig._tp2Notified === true;
  if (eventType === "tp3_hit") return sig._tp3Notified === true;
  if (eventType === "stopped") return sig._stoppedNotified === true;
  return false;
}

function markNotified(sig, eventType) {
  if (eventType === "tp1_hit") sig._tp1Notified = true;
  else if (eventType === "tp2_hit") sig._tp2Notified = true;
  else if (eventType === "tp3_hit") sig._tp3Notified = true;
  else if (eventType === "stopped") sig._stoppedNotified = true;
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
    tracked: 0,
    missed: 0,
    cleaned: 0,
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

  let stats = await readStats();

  console.log(
    "📥 Loaded cache: " + Object.keys(cache.signals).length + " active signal(s)"
  );
  console.log(
    "📊 Loaded stats: " + (stats.recentSignals ? stats.recentSignals.length : 0) + " tracked signal(s)"
  );

  if (!Array.isArray(stats.recentSignals)) {
    stats.recentSignals = [];
  }

  console.log("");
  console.log("🔄 Updating existing signal statuses...");

  const trackingTasks = stats.recentSignals
    .map((sig, idx) => ({ sig, idx }))
    .filter(({ sig }) => sig && (sig.status === "active" || sig.status === "pending" || sig.status === "tp1_hit" || sig.status === "tp2_hit"));

  const trackedResults = await runWithConcurrency(trackingTasks, 3, async ({ sig, idx }) => {
    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
      return { idx, status: sig.status, maxR: sig.maxR || 0, activated: sig.activated, skipped: true, events: [], tp1Reached: sig.tp1Reached || false, tp2Reached: sig.tp2Reached || false, tp3Reached: sig.tp3Reached || false };
    }
    const result = await updateSignalStatus(sig);
    return { idx, ...result };
  });

  for (const r of trackedResults) {
    if (!r || r.skipped) continue;
    const sig = stats.recentSignals[r.idx];
    if (!sig) continue;

    if (typeof r.tp1Reached === "boolean") sig.tp1Reached = r.tp1Reached;
    if (typeof r.tp2Reached === "boolean") sig.tp2Reached = r.tp2Reached;
    if (typeof r.tp3Reached === "boolean") sig.tp3Reached = r.tp3Reached;

    const events = Array.isArray(r.events) ? r.events : [];

    for (const event of events) {
      if (event.type === "tp1_hit" || event.type === "tp2_hit" || event.type === "tp3_hit" || event.type === "stopped") {
        if (isNotified(sig, event.type)) {
          continue;
        }

        try {
          const willClose = shouldCloseTrade(sig, event.type, r.maxR);

          if (willClose) {
            const closedReason = getClosedReason(sig, event.type, r.maxR);
            const totalR = computeTotalR(sig, event.type, r.maxR);
            const closeText = formatTradeClosed(sig, closedReason, totalR, r.maxR);
            await sendTelegramMessage(token, chatId, closeText);
            await sleep(MESSAGE_DELAY_MS);
            console.log("   🏁 Trade closed: " + sig.symbol + " (" + closedReason + ")");
            markNotified(sig, event.type);
          } else {
            const resultText = formatSignalResult(sig, event.type);
            if (resultText && resultText.trim() !== "") {
              await sendTelegramMessage(token, chatId, resultText);
              await sleep(MESSAGE_DELAY_MS);
              console.log("   📤 Sent: " + sig.symbol + " → " + event.type);
              markNotified(sig, event.type);
            }
          }
        } catch (e) {
          console.error("❌ Failed to send result for " + sig.symbol + " (" + event.type + "):", (e && e.message) || e);
        }
      }
    }

    if (sig.status !== r.status) {
      summary.tracked++;
      console.log(
        "   📊 " + sig.symbol + " [" + sig.timeframe + "] → " + r.status +
        (Number.isFinite(r.maxR) ? " (maxR: " + r.maxR.toFixed(2) + ")" : "")
      );
    }

    sig.status = r.status;
    if (typeof r.activated === "boolean") sig.activated = r.activated;
    if (Number.isFinite(r.maxR)) sig.maxR = Math.round(r.maxR * 100) / 100;
    sig.statusUpdatedAt = new Date().toISOString();
  }

  const beforeCleanup = stats.recentSignals.length;
  stats.recentSignals = stats.recentSignals.filter(
    (sig) => sig && sig.status !== "tp3_hit" && sig.status !== "stopped"
  );
  summary.cleaned = beforeCleanup - stats.recentSignals.length;

  if (summary.cleaned > 0) {
    console.log("🧹 Removed " + summary.cleaned + " completed signal(s)");
  }

  console.log("✅ Tracking complete: " + summary.tracked + " status change(s)");
  console.log("");

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

    const currentPrice = analysis.current_price;
    const isValid = isSetupValid(active, currentPrice);

    if (!isValid) {
      return {
        symbol,
        timeframe,
        status: "missed",
        reason: "فرصت ورود از دست رفته یا ستاپ باطل شده"
      };
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
    } else if (result.status === "missed") {
      summary.analyzed++;
      summary.missed++;
      console.log("   🚫 " + result.symbol + " [" + result.timeframe + "] — " + result.reason);
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
      " raw signal(s), " +
      summary.missed +
      " missed/invalidated"
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

      const currentPrice = analysis.current_price;
      const isBullish = active.direction === "bullish";

      let isActivatedNow = false;
      if (Number.isFinite(currentPrice)) {
        if (isBullish && currentPrice <= active.entry) isActivatedNow = true;
        else if (!isBullish && currentPrice >= active.entry) isActivatedNow = true;
      }

      stats.recentSignals.push({
        symbol,
        timeframe,
        direction: active.direction,
        entry: active.entry,
        stop: active.stop,
        tp1: active.tp1,
        tp2: active.tp2,
        tp3: active.tp3,
        rr1: active.rr1,
        rr2: active.rr2,
        rr3: active.rr3,
        score: active.score,
        sentAt: new Date().toISOString(),
        status: isActivatedNow ? "active" : "pending",
        activated: isActivatedNow,
        statusUpdatedAt: new Date().toISOString(),
        maxR: 0,
        tp1Reached: false,
        tp2Reached: false,
        tp3Reached: false,
        _tp1Notified: false,
        _tp2Notified: false,
        _tp3Notified: false,
        _stoppedNotified: false
      });

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
          (isActivatedNow ? ", activated" : ", pending") +
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

  if (stats.recentSignals.length > MAX_RECENT_SIGNALS) {
    stats.recentSignals = stats.recentSignals.slice(-MAX_RECENT_SIGNALS);
  }

  const computed = computeStats(stats.recentSignals);
  stats.allTime = computed.allTime;
  stats.byTimeframe = computed.byTimeframe;
  stats.byDirection = computed.byDirection;

  try {
    await writeCache(cache);
  } catch (e) {
    console.error("❌ Failed to write cache:", (e && e.message) || e);
  }

  try {
    await writeStats(stats);
  } catch (e) {
    console.error("❌ Failed to write stats:", (e && e.message) || e);
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
