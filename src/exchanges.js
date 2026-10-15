import { CONFIG, INTERVAL_MS } from "./config.js";

const CACHE_TTL = {
  SYMBOLS: CONFIG.SYMBOL_CACHE_SECONDS,
  TICKERS: 300,
  KLINES: CONFIG.KLINE_CACHE_SECONDS,
  SNAPSHOT: 60
};

let symbolCache = {
  timestamp: 0,
  symbols: []
};

let tickersCache = {
  timestamp: 0,
  data: []
};

const klineCache = {};
const snapshotCache = {};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function genericFetch(baseUrl, path, params = {}, options = {}) {
  const url = new URL(baseUrl + path);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const maxAttempts = options.maxAttempts || 3;
  const baseDelay = options.baseDelay || 400;
  const timeoutMs = options.timeout || CONFIG.MARKET_TIMEOUT;
  const label = options.label || "HTTP";

  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });

      if (response.status === 429) {
        lastError = new Error(label + " HTTP 429");

        const retryAfter = response.headers.get("Retry-After");
        const retrySeconds = parseFloat(retryAfter);

        if (Number.isFinite(retrySeconds) && retrySeconds > 0) {
          await sleep(Math.min(retrySeconds * 1000, 15000));
        } else {
          await sleep(baseDelay * (attempt + 1));
        }

        continue;
      }

      if (response.status === 418) {
        lastError = new Error(label + " IP banned (418)");
        await sleep(Math.min(5000 * (attempt + 1), 30000));
        continue;
      }

      if (!response.ok) {
        const error = new Error(label + " HTTP " + response.status);
        error.status = response.status;

        const retryable = response.status >= 500;
        if (!retryable || attempt === maxAttempts - 1) {
          throw error;
        }

        lastError = error;
        await sleep(baseDelay * (attempt + 1));
        continue;
      }

      const json = await response.json();
      return json;
    } catch (e) {
      lastError = e;

      const status = e && e.status ? e.status : 0;
      const retryable =
        status === 429 ||
        status === 418 ||
        status >= 500 ||
        status === 0 ||
        e.name === "AbortError";

      if (!retryable || attempt === maxAttempts - 1) {
        break;
      }

      await sleep(baseDelay * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error(label + " خطای ناشناخته");
}

export function okxFetch(path, params = {}, options = {}) {
  return genericFetch(CONFIG.OKX_BASE_URL, path, params, {
    ...options,
    label: "OKX"
  }).then((json) => {
    if (json.code !== "0") {
      const error = new Error(
        "OKX error: " + (json.msg || json.code || "unknown")
      );
      error.code = json.code;
      throw error;
    }
    return json;
  });
}

export function binanceFetch(path, params = {}, options = {}) {
  return genericFetch(CONFIG.BINANCE_BASE_URL, path, params, {
    ...options,
    label: "Binance"
  });
}

export function mexcFetch(path, params = {}, options = {}) {
  return genericFetch(CONFIG.MEXC_BASE_URL, path, params, {
    ...options,
    label: "MEXC"
  }).then((json) => {
    if (json && json.success === false) {
      const error = new Error(
        "MEXC error: " + (json.message || json.code || "unknown")
      );
      error.code = json.code;
      throw error;
    }
    return json;
  });
}

export function kucoinFetch(path, params = {}, options = {}) {
  return genericFetch(CONFIG.KUCOIN_BASE_URL, path, params, {
    ...options,
    label: "KuCoin"
  });
}

export function gateFetch(path, params = {}, options = {}) {
  return genericFetch(CONFIG.GATE_BASE_URL, path, params, {
    ...options,
    label: "Gate"
  });
}

export function resolveSymbolAliases(symbol) {
  const normalized = String(symbol || "")
    .toUpperCase()
    .replace(/[-_/:\s]/g, "");

  const aliases = CONFIG.SYMBOL_ALIASES[normalized];

  if (aliases && aliases.length > 0) {
    return [normalized, ...aliases];
  }

  return [normalized];
}

export async function getExchangeSymbols(force = false) {
  const now = Date.now() / 1000;

  if (
    !force &&
    symbolCache.symbols.length > 0 &&
    now - symbolCache.timestamp < CACHE_TTL.SYMBOLS
  ) {
    return symbolCache.symbols;
  }

  const allSymbols = new Map();

  try {
    const okxJson = await okxFetch(
      "/api/v5/public/instruments",
      { instType: "SWAP" }
    );

    if (Array.isArray(okxJson.data)) {
      for (const item of okxJson.data) {
        if (item.state !== "live") continue;
        if (item.settleCcy !== "USDT") continue;
        if (!String(item.instId || "").endsWith("-USDT-SWAP")) continue;

        const base = item.ctValCcy || item.baseCcy || "";
        if (!base) continue;
        if (CONFIG.EXCLUDED_BASE_ASSETS.includes(base)) continue;
        if (/^X[A-Z]{4,}$/.test(base)) continue;

        allSymbols.set(base + "USDT", {
          symbol: base + "USDT",
          base: base,
          quote: "USDT",
          exchange: "okx"
        });
      }
    }
  } catch (e) {
    console.error("OKX symbols error:", e.message || e);
  }

  try {
    const binanceJson = await binanceFetch("/api/v3/exchangeInfo");

    if (binanceJson && Array.isArray(binanceJson.symbols)) {
      for (const item of binanceJson.symbols) {
        if (item.status !== "TRADING") continue;
        if (item.quoteAsset !== "USDT") continue;
        if (item.isSpotTradingAllowed !== true) continue;

        const base = String(item.baseAsset || "").toUpperCase();
        if (!base) continue;
        if (CONFIG.EXCLUDED_BASE_ASSETS.includes(base)) continue;
        if (/^X[A-Z]{4,}$/.test(base)) continue;

        const symbol = base + "USDT";

        if (!allSymbols.has(symbol)) {
          allSymbols.set(symbol, {
            symbol: symbol,
            base: base,
            quote: "USDT",
            exchange: "binance"
          });
        }
      }
    }
  } catch (e) {
    console.error("Binance symbols error:", e.message || e);
  }

  try {
    const mexcJson = await mexcFetch("/api/v1/contract/detail");

    if (mexcJson && mexcJson.success && Array.isArray(mexcJson.data)) {
      for (const item of mexcJson.data) {
        if (item.state !== 0 && item.state !== "0") continue;
        if (item.quoteCoin !== "USDT") continue;

        const base = String(item.baseCoin || "").toUpperCase();
        if (!base) continue;
        if (CONFIG.EXCLUDED_BASE_ASSETS.includes(base)) continue;
        if (/^X[A-Z]{4,}$/.test(base)) continue;

        const symbol = base + "USDT";

        if (!allSymbols.has(symbol)) {
          allSymbols.set(symbol, {
            symbol: symbol,
            base: base,
            quote: "USDT",
            exchange: "mexc"
          });
        }
      }
    }
  } catch (e) {
    console.error("MEXC symbols error:", e.message || e);
  }

  try {
    const kucoinJson = await kucoinFetch("/api/v1/contracts/active");

    if (kucoinJson && kucoinJson.code === "200000" && Array.isArray(kucoinJson.data)) {
      for (const item of kucoinJson.data) {
        if (item.status !== "Open") continue;
        if (item.quoteCurrency !== "USDT") continue;
        if (item.settleCurrency !== "USDT") continue;

        const symbolRaw = String(item.symbol || "").toUpperCase();
        const match = symbolRaw.match(/^([A-Z0-9]+)USDTM$/);
        if (!match) continue;

        const base = match[1];
        if (!base) continue;
        if (CONFIG.EXCLUDED_BASE_ASSETS.includes(base)) continue;
        if (/^X[A-Z]{4,}$/.test(base)) continue;

        const symbol = base + "USDT";

        if (!allSymbols.has(symbol)) {
          allSymbols.set(symbol, {
            symbol: symbol,
            base: base,
            quote: "USDT",
            exchange: "kucoin"
          });
        }
      }
    }
  } catch (e) {
    console.error("KuCoin symbols error:", e.message || e);
  }

  try {
    const gateJson = await gateFetch("/api/v4/futures/usdt/contracts");

    if (Array.isArray(gateJson)) {
      for (const item of gateJson) {
        const contract = String(item.name || "").toUpperCase();
        if (!contract.endsWith("_USDT")) continue;

        const base = contract.replace(/_USDT$/, "");
        if (!base) continue;
        if (CONFIG.EXCLUDED_BASE_ASSETS.includes(base)) continue;
        if (/^X[A-Z]{4,}$/.test(base)) continue;

        const symbol = base + "USDT";

        if (!allSymbols.has(symbol)) {
          allSymbols.set(symbol, {
            symbol: symbol,
            base: base,
            quote: "USDT",
            exchange: "gate"
          });
        }
      }
    }
  } catch (e) {
    console.error("Gate symbols error:", e.message || e);
  }

  const result = Array.from(allSymbols.values());
  result.sort((a, b) => a.symbol.localeCompare(b.symbol));

  symbolCache.symbols = result;
  symbolCache.timestamp = now;

  return result;
}

export async function getTickers(force = false) {
  const now = Date.now() / 1000;

  if (
    !force &&
    tickersCache.data.length > 0 &&
    now - tickersCache.timestamp < CACHE_TTL.TICKERS
  ) {
    return tickersCache.data;
  }

  const validSymbols = await getExchangeSymbols();
  const validSet = new Set(validSymbols.map((s) => s.symbol));

  const result = [];

  try {
    const okxJson = await okxFetch(
      "/api/v5/market/tickers",
      { instType: "SWAP" }
    );

    if (Array.isArray(okxJson.data)) {
      for (const item of okxJson.data) {
        if (!item.instId || !item.instId.endsWith("-USDT-SWAP")) continue;

        const base = item.instId.split("-")[0];

        if (CONFIG.EXCLUDED_BASE_ASSETS.includes(base)) continue;
        if (base.includes("TEST")) continue;

        const symbol = base + "USDT";
        if (!validSet.has(symbol)) continue;

        const last = parseFloat(item.last || "0");
        const open24h = parseFloat(item.open24h || "0");
        const volCcy24h = parseFloat(item.volCcy24h || "0");
        const vol24h = parseFloat(item.vol24h || "0");

        if (!Number.isFinite(last) || last <= 0) continue;

        const quoteVolume = Number.isFinite(volCcy24h) && volCcy24h > 0
          ? volCcy24h
          : (Number.isFinite(vol24h) ? vol24h * last : 0);

        let changePercent = 0;
        if (Number.isFinite(open24h) && open24h > 0) {
          changePercent = ((last - open24h) / open24h) * 100;
        }

        result.push({
          symbol: symbol,
          base: base,
          quote: "USDT",
          price: last,
          change: changePercent,
          quote_volume: quoteVolume
        });
      }
    }
  } catch (e) {
    console.error("OKX tickers error:", e.message || e);
  }

  try {
    const binanceJson = await binanceFetch("/api/v3/ticker/24hr");

    if (Array.isArray(binanceJson)) {
      const seen = new Set(result.map((t) => t.symbol));

      for (const item of binanceJson) {
        const symbol = String(item.symbol || "").toUpperCase();
        if (!symbol.endsWith("USDT")) continue;

        const base = symbol.replace(/USDT$/, "");

        if (CONFIG.EXCLUDED_BASE_ASSETS.includes(base)) continue;
        if (base.includes("TEST")) continue;

        if (seen.has(symbol)) continue;
        if (!validSet.has(symbol)) continue;

        const last = parseFloat(item.lastPrice || "0");
        const open24h = parseFloat(item.openPrice || "0");
        const quoteVolume = parseFloat(item.quoteVolume || "0");

        if (!Number.isFinite(last) || last <= 0) continue;

        let changePercent = 0;
        if (Number.isFinite(open24h) && open24h > 0) {
          changePercent = ((last - open24h) / open24h) * 100;
        }

        result.push({
          symbol: symbol,
          base: base,
          quote: "USDT",
          price: last,
          change: changePercent,
          quote_volume: quoteVolume
        });

        seen.add(symbol);
      }
    }
  } catch (e) {
    console.error("Binance tickers error:", e.message || e);
  }

  try {
    const mexcJson = await mexcFetch("/api/v1/contract/ticker");

    if (mexcJson && mexcJson.success && Array.isArray(mexcJson.data)) {
      const seen = new Set(result.map((t) => t.symbol));

      for (const item of mexcJson.data) {
        const symbol = String(item.symbol || "").toUpperCase();
        if (!symbol.endsWith("_USDT")) continue;

        const base = symbol.replace(/_USDT$/, "");

        if (CONFIG.EXCLUDED_BASE_ASSETS.includes(base)) continue;
        if (base.includes("TEST")) continue;

        const normalized = base + "USDT";
        if (seen.has(normalized)) continue;
        if (!validSet.has(normalized)) continue;

        const last = parseFloat(item.lastPrice || "0");
        const quoteVolume = parseFloat(item.amount24 || item.volume24 || "0");

        if (!Number.isFinite(last) || last <= 0) continue;

        let changePercent = 0;
        if (Number.isFinite(item.riseFallRate) && item.riseFallRate !== null) {
          changePercent = parseFloat(item.riseFallRate) * 100;
        }

        result.push({
          symbol: normalized,
          base: base,
          quote: "USDT",
          price: last,
          change: changePercent,
          quote_volume: quoteVolume
        });

        seen.add(normalized);
      }
    }
  } catch (e) {
    console.error("MEXC tickers error:", e.message || e);
  }

  try {
    const kucoinJson = await kucoinFetch("/api/v1/contracts/active");

    if (kucoinJson && kucoinJson.code === "200000" && Array.isArray(kucoinJson.data)) {
      const seen = new Set(result.map((t) => t.symbol));

      for (const item of kucoinJson.data) {
        if (item.status !== "Open") continue;
        if (item.quoteCurrency !== "USDT") continue;

        const symbolRaw = String(item.symbol || "").toUpperCase();
        const match = symbolRaw.match(/^([A-Z0-9]+)USDTM$/);
        if (!match) continue;

        const base = match[1];
        const normalized = base + "USDT";

        if (CONFIG.EXCLUDED_BASE_ASSETS.includes(base)) continue;
        if (base.includes("TEST")) continue;

        if (seen.has(normalized)) continue;
        if (!validSet.has(normalized)) continue;

        const last = parseFloat(item.lastTradePrice || "0");
        const quoteVolume = parseFloat(item.turnoverOf24h || "0");

        if (!Number.isFinite(last) || last <= 0) continue;

        result.push({
          symbol: normalized,
          base: base,
          quote: "USDT",
          price: last,
          change: 0,
          quote_volume: quoteVolume
        });

        seen.add(normalized);
      }
    }
  } catch (e) {
    console.error("KuCoin tickers error:", e.message || e);
  }

  try {
    const gateJson = await gateFetch("/api/v4/futures/usdt/tickers");

    if (Array.isArray(gateJson)) {
      const seen = new Set(result.map((t) => t.symbol));

      for (const item of gateJson) {
        const contract = String(item.contract || "").toUpperCase();
        if (!contract.endsWith("_USDT")) continue;

        const base = contract.replace(/_USDT$/, "");
        const normalized = base + "USDT";

        if (CONFIG.EXCLUDED_BASE_ASSETS.includes(base)) continue;
        if (base.includes("TEST")) continue;

        if (seen.has(normalized)) continue;
        if (!validSet.has(normalized)) continue;

        const last = parseFloat(item.last || "0");
        const quoteVolume = parseFloat(item.volume_24h_quote || item.volume_24h_settle || "0");

        if (!Number.isFinite(last) || last <= 0) continue;

        let changePercent = 0;
        if (Number.isFinite(item.change_percentage)) {
          changePercent = parseFloat(item.change_percentage);
        }

        result.push({
          symbol: normalized,
          base: base,
          quote: "USDT",
          price: last,
          change: changePercent,
          quote_volume: quoteVolume
        });

        seen.add(normalized);
      }
    }
  } catch (e) {
    console.error("Gate tickers error:", e.message || e);
  }

  result.sort((a, b) => b.quote_volume - a.quote_volume);

  tickersCache.data = result;
  tickersCache.timestamp = now;

  return result;
}

export async function getTopSymbols(limit = CONFIG.MARKET_TOP_LIMIT) {
  const symbols = await getExchangeSymbols();
  const tickers = await getTickers();

  const allowed = new Set(symbols.map((s) => s.symbol));
  const ranked = [];

  for (const ticker of tickers) {
    if (!allowed.has(ticker.symbol)) continue;

    if (
      !Number.isFinite(ticker.quote_volume) ||
      ticker.quote_volume < CONFIG.MIN_QUOTE_VOLUME_24H
    ) {
      continue;
    }

    ranked.push(ticker);
  }

  ranked.sort((a, b) => b.quote_volume - a.quote_volume);

  return ranked.slice(0, Math.min(limit, CONFIG.MARKET_MAX_SYMBOLS));
}

export function normalizeCandles(rawCandles, interval) {
  const intervalMs = INTERVAL_MS[interval] || 0;
  const now = Date.now();

  const normalized = [];
  const incompleteCandles = [];

  for (const raw of rawCandles) {
    const openTime = raw.time;
    const open = raw.open;
    const high = raw.high;
    const low = raw.low;
    const close = raw.close;
    const volume = raw.volume;
    const quoteVolume = raw.quoteVolume;
    const confirm = raw.confirm;

    if (
      !Number.isFinite(openTime) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    const candleObj = {
      time: openTime,
      open_time: openTime,
      close_time: intervalMs > 0 ? openTime + intervalMs - 1 : openTime,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
      quote_volume: Number.isFinite(quoteVolume) ? quoteVolume : 0,
      trades: 0,
      incomplete: confirm === "0"
    };

    if (confirm === "0") {
      incompleteCandles.push(candleObj);
      continue;
    }

    normalized.push(candleObj);
  }

  normalized.sort((a, b) => a.time - b.time);

  if (incompleteCandles.length > 0) {
    const openCandle = incompleteCandles[0];
    const latestPrice = openCandle.close;

    if (Number.isFinite(latestPrice) && latestPrice > 0) {
      const updatedHigh = Math.max(openCandle.high, latestPrice);
      const updatedLow = Math.min(openCandle.low, latestPrice);

      normalized.push({
        time: openCandle.time,
        open_time: openCandle.open_time,
        close_time: openCandle.close_time,
        open: openCandle.open,
        high: updatedHigh,
        low: updatedLow,
        close: latestPrice,
        volume: openCandle.volume,
        quote_volume: openCandle.quote_volume,
        trades: 0,
        incomplete: true,
        updated_at: now
      });
    }
  }

  const unique = [];
  const seen = new Set();

  for (const candle of normalized) {
    if (seen.has(candle.time)) continue;
    seen.add(candle.time);
    unique.push(candle);
  }

  unique.sort((a, b) => a.time - b.time);

  return unique;
}

async function getKlinesOKX(symbol, interval, limit) {
  const base = symbol.replace(/USDT$/, "");
  const okxSymbol = base + "-USDT-SWAP";
  const okxInterval = CONFIG.OKX_INTERVAL_MAP[interval];

  if (!okxInterval) {
    throw new Error("OKX interval unsupported: " + interval);
  }

  const barLimit = Math.min(limit, CONFIG.EXCHANGES.okx.maxCandles);

  const json = await okxFetch(
    "/api/v5/market/candles",
    {
      instId: okxSymbol,
      bar: okxInterval,
      limit: String(barLimit)
    },
    { maxAttempts: 5, baseDelay: 400 }
  );

  if (!Array.isArray(json.data)) {
    throw new Error("OKX klines پاسخ نامعتبر");
  }

  const rawCandles = [];

  for (const row of json.data) {
    const openTime = parseInt(row[0], 10);
    const open = parseFloat(row[1]);
    const high = parseFloat(row[2]);
    const low = parseFloat(row[3]);
    const close = parseFloat(row[4]);
    const volume = parseFloat(row[5]);
    const quoteVolume = parseFloat(row[6]);
    const confirm = String(row[8] ?? "1");

    rawCandles.push({
      time: openTime,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume,
      confirm
    });
  }

  rawCandles.reverse();

  return normalizeCandles(rawCandles, interval);
}

async function getKlinesBinance(symbol, interval, limit) {
  const binanceSymbol = symbol.toUpperCase();
  const binanceInterval = CONFIG.BINANCE_INTERVAL_MAP[interval];

  if (!binanceInterval) {
    throw new Error("Binance interval unsupported: " + interval);
  }

  const size = Math.min(limit, CONFIG.EXCHANGES.binance.maxCandles);

  const json = await binanceFetch("/api/v3/klines", {
    symbol: binanceSymbol,
    interval: binanceInterval,
    limit: String(size)
  });

  if (!Array.isArray(json)) {
    throw new Error("Binance klines پاسخ نامعتبر");
  }

  const rawCandles = [];

  for (const row of json) {
    if (!Array.isArray(row) || row.length < 7) continue;

    const openTime = parseInt(row[0], 10);
    const open = parseFloat(row[1]);
    const high = parseFloat(row[2]);
    const low = parseFloat(row[3]);
    const close = parseFloat(row[4]);
    const volume = parseFloat(row[5]);
    const closeTime = parseInt(row[6], 10);
    const quoteVolume = parseFloat(row[7] || "0");
    const isClosed = Date.now() > closeTime;

    rawCandles.push({
      time: openTime,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume,
      confirm: isClosed ? "1" : "0"
    });
  }

  rawCandles.reverse();

  return normalizeCandles(rawCandles, interval);
}

async function getKlinesMEXC(symbol, interval, limit) {
  const base = symbol.replace(/USDT$/, "");
  const mexcSymbol = base + "_USDT";
  const mexcInterval = CONFIG.MEXC_INTERVAL_MAP[interval];

  if (!mexcInterval) {
    throw new Error("MEXC interval unsupported: " + interval);
  }

  const size = Math.min(limit, CONFIG.EXCHANGES.mexc.maxCandles);

  const now = Math.floor(Date.now() / 1000);
  const intervalSec = Math.floor((INTERVAL_MS[interval] || 3600000) / 1000);
  const start = now - (size * intervalSec);

  const json = await mexcFetch("/api/v1/contract/kline/" + mexcSymbol, {
    interval: mexcInterval,
    start: String(start),
    end: String(now)
  });

  if (!json || !json.success || !json.data) {
    throw new Error("MEXC klines پاسخ نامعتبر");
  }

  const data = json.data;

  if (
    !Array.isArray(data.time) ||
    !Array.isArray(data.open) ||
    !Array.isArray(data.high) ||
    !Array.isArray(data.low) ||
    !Array.isArray(data.close) ||
    !Array.isArray(data.vol)
  ) {
    throw new Error("MEXC klines ساختار نامعتبر");
  }

  const length = Math.min(
    data.time.length,
    data.open.length,
    data.high.length,
    data.low.length,
    data.close.length,
    data.vol.length
  );

  const rawCandles = [];
  const nowMs = Date.now();

  for (let i = 0; i < length; i++) {
    const openTimeMs = data.time[i] * 1000;
    const open = parseFloat(data.open[i]);
    const high = parseFloat(data.high[i]);
    const low = parseFloat(data.low[i]);
    const close = parseFloat(data.close[i]);
    const volume = parseFloat(data.vol[i]);

    if (
      !Number.isFinite(openTimeMs) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    const closeTime = openTimeMs + (intervalSec * 1000) - 1;
    const isClosed = nowMs > closeTime;

    rawCandles.push({
      time: openTimeMs,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume: 0,
      confirm: isClosed ? "1" : "0"
    });
  }

  rawCandles.sort((a, b) => a.time - b.time);

  return normalizeCandles(rawCandles, interval);
}

async function getKlinesKuCoin(symbol, interval, limit) {
  const base = symbol.replace(/USDT$/, "");
  const kucoinSymbol = base + "USDTM";
  const granularity = CONFIG.KUCOIN_INTERVAL_MAP[interval];

  if (!granularity) {
    throw new Error("KuCoin interval unsupported: " + interval);
  }

  const now = Date.now();
  const intervalMs = INTERVAL_MS[interval] || 3600000;
  const size = Math.min(limit, CONFIG.EXCHANGES.kucoin.maxCandles);
  const from = now - (size * intervalMs);

  const json = await kucoinFetch("/api/v1/kline/query", {
    symbol: kucoinSymbol,
    granularity: granularity,
    from: String(from)
  });

  if (!json || json.code !== "200000" || !Array.isArray(json.data)) {
    throw new Error("KuCoin klines پاسخ نامعتبر");
  }

  const rawCandles = [];
  const nowMs = Date.now();

  for (const row of json.data) {
    if (!Array.isArray(row) || row.length < 5) continue;

    const openTimeMs = parseInt(row[0], 10);
    const open = parseFloat(row[1]);
    const high = parseFloat(row[2]);
    const low = parseFloat(row[3]);
    const close = parseFloat(row[4]);
    const volume = parseFloat(row[5] || "0");

    if (
      !Number.isFinite(openTimeMs) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    const closeTime = openTimeMs + intervalMs - 1;
    const isClosed = nowMs > closeTime;

    rawCandles.push({
      time: openTimeMs,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume: 0,
      confirm: isClosed ? "1" : "0"
    });
  }

  rawCandles.sort((a, b) => a.time - b.time);

  return normalizeCandles(rawCandles, interval);
}

async function getKlinesGate(symbol, interval, limit) {
  const base = symbol.replace(/USDT$/, "");
  const gateContract = base + "_USDT";
  const gateInterval = CONFIG.GATE_INTERVAL_MAP[interval];

  if (!gateInterval) {
    throw new Error("Gate interval unsupported: " + interval);
  }

  const size = Math.min(limit, CONFIG.EXCHANGES.gate.maxCandles);

  const json = await gateFetch("/api/v4/futures/usdt/candlesticks", {
    contract: gateContract,
    interval: gateInterval,
    limit: String(size)
  });

  if (!Array.isArray(json)) {
    throw new Error("Gate klines پاسخ نامعتبر");
  }

  const rawCandles = [];
  const nowMs = Date.now();
  const intervalMs = INTERVAL_MS[interval] || 3600000;

  for (const row of json) {
    if (!row || typeof row !== "object") continue;

    const openTimeSec = Number(row.t);
    const open = parseFloat(row.o);
    const high = parseFloat(row.h);
    const low = parseFloat(row.l);
    const close = parseFloat(row.c);
    const volume = parseFloat(row.v || "0");

    if (
      !Number.isFinite(openTimeSec) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    const openTimeMs = openTimeSec * 1000;
    const closeTime = openTimeMs + intervalMs - 1;
    const isClosed = nowMs > closeTime;

    rawCandles.push({
      time: openTimeMs,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume: 0,
      confirm: isClosed ? "1" : "0"
    });
  }

  rawCandles.sort((a, b) => a.time - b.time);

  return normalizeCandles(rawCandles, interval);
}

export async function getKlinesFromExchange(exchangeKey, symbol, interval, limit) {
  const aliases = resolveSymbolAliases(symbol);

  let lastError = null;

  for (const alias of aliases) {
    try {
      let candles;

      switch (exchangeKey) {
        case "okx":
          candles = await getKlinesOKX(alias, interval, limit);
          break;
        case "binance":
          candles = await getKlinesBinance(alias, interval, limit);
          break;
        case "mexc":
          candles = await getKlinesMEXC(alias, interval, limit);
          break;
        case "kucoin":
          candles = await getKlinesKuCoin(alias, interval, limit);
          break;
        case "gate":
          candles = await getKlinesGate(alias, interval, limit);
          break;
        default:
          throw new Error("Unknown exchange: " + exchangeKey);
      }

      if (candles && candles.length > 0) {
        return candles;
      }
    } catch (e) {
      lastError = e;
      continue;
    }
  }

  throw lastError || new Error("No candles for " + symbol + " on " + exchangeKey);
}

function getExchangeOrder() {
  const keys = Object.keys(CONFIG.EXCHANGES);
  keys.sort((a, b) => CONFIG.EXCHANGES[a].priority - CONFIG.EXCHANGES[b].priority);
  return keys.filter((k) => CONFIG.EXCHANGES[k].enabled);
}

export async function getKlines(
  symbol,
  interval,
  limit = CONFIG.KLINE_LIMIT
) {
  const cacheKey = symbol + ":" + interval;
  const cached = klineCache[cacheKey];

  if (
    cached &&
    Date.now() - cached.time < CACHE_TTL.KLINES * 1000
  ) {
    return cached.candles;
  }

  const exchanges = getExchangeOrder();

  const attempts = exchanges.map(async (exchangeKey) => {
    const candles = await getKlinesFromExchange(
      exchangeKey,
      symbol,
      interval,
      limit
    );

    if (!candles || candles.length < CONFIG.MIN_CANDLES) {
      throw new Error(
        "Not enough candles from " + exchangeKey + " (" + (candles ? candles.length : 0) + ")"
      );
    }

    return { candles, exchange: exchangeKey };
  });

  try {
    const winner = await Promise.any(attempts);

    klineCache[cacheKey] = {
      time: Date.now(),
      candles: winner.candles,
      exchange: winner.exchange
    };

    return winner.candles;
  } catch (aggErr) {
    throw new Error("هیچ صرافی داده‌ای برنگرداند");
  }
}

export async function getMarketSnapshot(symbol, timeframe) {
  const snapshotKey = symbol + ":" + timeframe;
  const cached = snapshotCache[snapshotKey];

  if (cached && Date.now() - cached.time < CACHE_TTL.SNAPSHOT * 1000) {
    return cached.snapshot;
  }

  const htf = Object.prototype.hasOwnProperty.call(
    CONFIG.HTF_MAP,
    timeframe
  )
    ? CONFIG.HTF_MAP[timeframe]
    : null;

  const htf2 =
    CONFIG.HTF_SECOND_LEVEL &&
    htf &&
    Object.prototype.hasOwnProperty.call(CONFIG.HTF_MAP, htf)
      ? CONFIG.HTF_MAP[htf]
      : null;

  const [current, higher, higher2] = await Promise.all([
    getKlines(symbol, timeframe),
    htf ? getKlines(symbol, htf) : Promise.resolve([]),
    htf2 && htf2 !== timeframe
      ? getKlines(symbol, htf2)
      : Promise.resolve([])
  ]);

  const snapshot = {
    current,
    higher,
    higher2,
    timeframe,
    htf,
    htf2
  };

  snapshotCache[snapshotKey] = {
    time: Date.now(),
    snapshot
  };

  return snapshot;
}
