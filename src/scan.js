import { SCAN_TIMEFRAME } from "./config.js";
import { getTopSymbols } from "./exchanges.js";
import { analyze } from "./analysis.js";
import { formatAnalysis } from "./format.js";
import { loadCache, saveCache, isCached, addToCache } from "./cache.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

async function tgApi(method, body) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN تنظیم نشده است.");
  }

  const url =
    "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/" + method;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Telegram پاسخ JSON معتبر ارسال نکرد.");
  }

  if (!response.ok || data.ok !== true) {
    throw new Error(data.description || "Telegram API error");
  }

  return data;
}

async function sendMessage(chatId, text) {
  return await tgApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldSignal(result) {
  if (!result) return false;

  if (result.setup_active === false) return false;

  if (result.status !== "LONG" && result.status !== "SHORT") {
    return false;
  }

  if (
    result.strength === null ||
    result.strength === undefined ||
    !Number.isFinite(result.strength) ||
    result.strength <= 0
  ) {
    return false;
  }

  const profile = result._profile || null;
  const minStrength = profile && Number.isFinite(profile.minStrength)
    ? profile.minStrength
    : 65;

  if (result.strength < minStrength) {
    return false;
  }

  if (!Array.isArray(result.targets) || result.targets.length < 2) {
    return false;
  }

  if (!Number.isFinite(result.entry) || result.entry <= 0) {
    return false;
  }

  if (!Number.isFinite(result.stop_loss) || result.stop_loss <= 0) {
    return false;
  }

  return true;
}

async function main() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("TELEGRAM_BOT_TOKEN یا TELEGRAM_CHAT_ID تنظیم نشده است.");
    process.exit(1);
  }

  const cache = loadCache();

  console.log("Scan started | TF=" + SCAN_TIMEFRAME);
  console.log("Cached symbols: " + Object.keys(cache).length);

  let symbols;

  try {
    symbols = await getTopSymbols(1000);
  } catch (e) {
    console.error("getTopSymbols error:", e && e.message);
    process.exit(1);
  }

  if (!Array.isArray(symbols) || symbols.length === 0) {
    console.error("هیچ نمادی دریافت نشد.");
    process.exit(1);
  }

  console.log("Symbols to scan: " + symbols.length);

  let analyzed = 0;
  let signaled = 0;
  let skipped = 0;
  let errors = 0;

  const messages = [];

  for (const item of symbols) {
    const symbol = item.symbol;

    if (!symbol) continue;

    if (isCached(cache, symbol)) {
      skipped++;
      continue;
    }

    try {
      const result = await analyze(symbol, SCAN_TIMEFRAME);

      analyzed++;

      if (shouldSignal(result)) {
        const text = formatAnalysis(result);

        messages.push({
          symbol,
          text,
          result
        });

        addToCache(cache, symbol, {
          timeframe: SCAN_TIMEFRAME,
          direction: result.direction,
          entry: result.entry,
          stop_loss: result.stop_loss,
          targets: result.targets,
          strength: result.strength,
          risk: result.risk
        });

        signaled++;
      }
    } catch (e) {
      errors++;
      console.error(
        "analyze error [" + symbol + "]:",
        e && e.message
      );
    }

    await sleep(200);
  }

  console.log(
    "Scan done | analyzed=" +
      analyzed +
      " signaled=" +
      signaled +
      " skipped=" +
      skipped +
      " errors=" +
      errors
  );

  if (messages.length === 0) {
    saveCache(cache);
    console.log("No new signals to send.");
    return;
  }

  for (const msg of messages) {
    try {
      await sendMessage(TELEGRAM_CHAT_ID, msg.text);
      console.log("Sent signal: " + msg.symbol);
    } catch (e) {
      console.error(
        "sendMessage error [" + msg.symbol + "]:",
        e && e.message
      );
    }

    await sleep(1500);
  }

  saveCache(cache);

  console.log("Cache saved. Total signals sent: " + messages.length);
}

main().catch((e) => {
  console.error("Fatal error:", e && e.message);
  process.exit(1);
});
