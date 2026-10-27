import { promises as fs } from "fs";
import path from "path";
import { CONFIG } from "./config.js";

const CACHE_DIR = path.join(process.cwd(), "cache");
const CACHE_FILE = path.join(CACHE_DIR, "signals.json");
const STATS_FILE = path.join(CACHE_DIR, "stats.json");
const DAILY_REPORT_FILE = path.join(CACHE_DIR, "daily-report.json");

const MAX_AGE_MS = 12 * 60 * 60 * 1000;

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function makeKey(symbol, timeframe) {
  return symbol + ":" + timeframe;
}

export async function readCache() {
  try {
    await ensureCacheDir();
    const content = await fs.readFile(CACHE_FILE, "utf-8");
    const data = JSON.parse(content);

    if (!data || typeof data !== "object") {
      return { lastUpdated: new Date().toISOString(), signals: {} };
    }

    if (!data.signals || typeof data.signals !== "object") {
      data.signals = {};
    }

    return data;
  } catch (e) {
    return { lastUpdated: new Date().toISOString(), signals: {} };
  }
}

export async function writeCache(data) {
  await ensureCacheDir();
  const payload = {
    lastUpdated: new Date().toISOString(),
    signals: data && data.signals ? data.signals : {}
  };
  await fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), "utf-8");
}

export function cleanOldSignals(signals, maxAgeMs = MAX_AGE_MS) {
  const now = Date.now();
  const cleaned = {};

  for (const [key, entry] of Object.entries(signals || {})) {
    if (!entry || !entry.sentAt) continue;

    const sentAt = new Date(entry.sentAt).getTime();

    if (!Number.isFinite(sentAt)) continue;
    if (now - sentAt > maxAgeMs) continue;

    cleaned[key] = entry;
  }

  return cleaned;
}

export function hasRecentSignal(signals, symbol, timeframe, maxAgeMs = MAX_AGE_MS) {
  if (!signals || !symbol || !timeframe) return false;

  const key = makeKey(symbol, timeframe);
  const entry = signals[key];
  if (!entry || !entry.sentAt) return false;

  const sentAt = new Date(entry.sentAt).getTime();
  if (!Number.isFinite(sentAt)) return false;

  return Date.now() - sentAt <= maxAgeMs;
}

export function addSignal(signals, symbol, timeframe, data) {
  const result = { ...(signals || {}) };

  const key = makeKey(symbol, timeframe);

  result[key] = {
    sentAt: new Date().toISOString(),
    symbol: symbol,
    timeframe: timeframe,
    direction: data && data.direction ? data.direction : null,
    score: data && Number.isFinite(data.score) ? data.score : null,
    entry: data && Number.isFinite(data.entry) ? data.entry : null,
    stop: data && Number.isFinite(data.stop) ? data.stop : null
  };

  return result;
}

function createEmptyStats() {
  return {
    lastUpdated: new Date().toISOString(),
    allTime: {
      total: 0,
      tp1Hit: 0,
      tp2Hit: 0,
      tp3Hit: 0,
      stopped: 0,
      active: 0,
      tp1Rate: 0,
      tp2Rate: 0,
      tp3Rate: 0,
      stopRate: 0
    },
    byTimeframe: {
      "15m": { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 },
      "30m": { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 },
      "1h":  { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 },
      "2h":  { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 }
    },
    byDirection: {
      bullish: { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 },
      bearish: { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 }
    },
    weekly: null,
    recentSignals: []
  };
}

export async function readStats() {
  try {
    await ensureCacheDir();
    const content = await fs.readFile(STATS_FILE, "utf-8");
    const data = JSON.parse(content);

    if (!data || typeof data !== "object") {
      return createEmptyStats();
    }

    return data;
  } catch (e) {
    return createEmptyStats();
  }
}

export async function writeStats(data) {
  await ensureCacheDir();
  const payload = {
    ...data,
    lastUpdated: new Date().toISOString()
  };
  await fs.writeFile(STATS_FILE, JSON.stringify(payload, null, 2), "utf-8");
}

function createEmptyDailyReport() {
  return {
    lastUpdated: new Date().toISOString(),
    lastReportSentDate: null,
    buckets: {}
  };
}

export async function readDailyReport() {
  try {
    await ensureCacheDir();
    const content = await fs.readFile(DAILY_REPORT_FILE, "utf-8");
    const data = JSON.parse(content);

    if (!data || typeof data !== "object") {
      return createEmptyDailyReport();
    }

    if (!data.buckets || typeof data.buckets !== "object") {
      data.buckets = {};
    }

    if (typeof data.lastReportSentDate !== "string") {
      data.lastReportSentDate = null;
    }

    return data;
  } catch (e) {
    return createEmptyDailyReport();
  }
}

export async function writeDailyReport(data) {
  await ensureCacheDir();

  const payload = {
    lastUpdated: new Date().toISOString(),
    lastReportSentDate:
      data && typeof data.lastReportSentDate === "string"
        ? data.lastReportSentDate
        : null,
    buckets: data && data.buckets && typeof data.buckets === "object"
      ? data.buckets
      : {}
  };

  await fs.writeFile(
    DAILY_REPORT_FILE,
    JSON.stringify(payload, null, 2),
    "utf-8"
  );
}

export function getTehranDateKey(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  const offsetMs =
    (Number.isFinite(CONFIG.TEHRAN_OFFSET_MINUTES)
      ? CONFIG.TEHRAN_OFFSET_MINUTES
      : 210) * 60 * 1000;

  const tehran = new Date(date.getTime() + offsetMs);

  const year = tehran.getUTCFullYear();
  const month = String(tehran.getUTCMonth() + 1).padStart(2, "0");
  const day = String(tehran.getUTCDate()).padStart(2, "0");

  return year + "-" + month + "-" + day;
}

export function getTehranDateTime(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  const offsetMs =
    (Number.isFinite(CONFIG.TEHRAN_OFFSET_MINUTES)
      ? CONFIG.TEHRAN_OFFSET_MINUTES
      : 210) * 60 * 1000;

  const tehran = new Date(date.getTime() + offsetMs);

  return {
    year: tehran.getUTCFullYear(),
    month: tehran.getUTCMonth() + 1,
    day: tehran.getUTCDate(),
    hour: tehran.getUTCHours(),
    minute: tehran.getUTCMinutes(),
    second: tehran.getUTCSeconds()
  };
}

export function isInDailyReportWindow(dateInput) {
  const dt = getTehranDateTime(dateInput);

  if (!dt) {
    return false;
  }

  const startHour = Number.isFinite(CONFIG.DAILY_REPORT_HOUR_TEHRAN)
    ? Math.max(0, Math.min(23, Math.trunc(CONFIG.DAILY_REPORT_HOUR_TEHRAN)))
    : 0;

  const windowMinutes =
    Number.isFinite(CONFIG.DAILY_REPORT_WINDOW_MINUTES) &&
    CONFIG.DAILY_REPORT_WINDOW_MINUTES > 0
      ? Math.min(60, Math.trunc(CONFIG.DAILY_REPORT_WINDOW_MINUTES))
      : 30;

  const startTotalMinutes = startHour * 60;
  const endTotalMinutes = startTotalMinutes + windowMinutes;

  const currentTotalMinutes = dt.hour * 60 + dt.minute;

  if (endTotalMinutes <= 1440) {
    return (
      currentTotalMinutes >= startTotalMinutes &&
      currentTotalMinutes < endTotalMinutes
    );
  }

  const overflow = endTotalMinutes - 1440;

  return (
    currentTotalMinutes >= startTotalMinutes ||
    currentTotalMinutes < overflow
  );
}

export function hasReportBeenSentToday(dailyReport, tehranDateKey) {
  if (!dailyReport || typeof dailyReport !== "object") {
    return false;
  }

  if (typeof tehranDateKey !== "string" || !tehranDateKey) {
    return false;
  }

  return dailyReport.lastReportSentDate === tehranDateKey;
}

export function markReportAsSent(dailyReport, tehranDateKey) {
  const result =
    dailyReport && typeof dailyReport === "object"
      ? { ...dailyReport }
      : createEmptyDailyReport();

  if (!result.buckets || typeof result.buckets !== "object") {
    result.buckets = {};
  }

  if (typeof tehranDateKey === "string" && tehranDateKey) {
    result.lastReportSentDate = tehranDateKey;
  }

  return result;
}

export function appendClosedSignal(dailyReport, signalData) {
  const result =
    dailyReport && typeof dailyReport === "object"
      ? {
          ...dailyReport,
          buckets:
            dailyReport.buckets && typeof dailyReport.buckets === "object"
              ? { ...dailyReport.buckets }
              : {}
        }
      : createEmptyDailyReport();

  if (!signalData || typeof signalData !== "object") {
    return result;
  }

  const closedAt = signalData.closedAt
    ? new Date(signalData.closedAt)
    : new Date();

  if (!Number.isFinite(closedAt.getTime())) {
    return result;
  }

  const dateKey = getTehranDateKey(closedAt);

  if (!dateKey) {
    return result;
  }

  const existingBucket =
    result.buckets[dateKey] && typeof result.buckets[dateKey] === "object"
      ? result.buckets[dateKey]
      : null;

  const bucket = existingBucket
    ? {
        ...existingBucket,
        closedSignals: Array.isArray(existingBucket.closedSignals)
          ? existingBucket.closedSignals.slice()
          : [],
        openSignals: Array.isArray(existingBucket.openSignals)
          ? existingBucket.openSignals.slice()
          : []
      }
    : { closedSignals: [], openSignals: [] };

  const entry = {
    symbol:
      typeof signalData.symbol === "string" ? signalData.symbol : null,
    timeframe:
      typeof signalData.timeframe === "string" ? signalData.timeframe : null,
    direction:
      typeof signalData.direction === "string" ? signalData.direction : null,
    entry: Number.isFinite(signalData.entry) ? signalData.entry : null,
    stop: Number.isFinite(signalData.stop) ? signalData.stop : null,
    finalStatus:
      typeof signalData.finalStatus === "string"
        ? signalData.finalStatus
        : null,
    lastTpHit:
      typeof signalData.lastTpHit === "string" ? signalData.lastTpHit : null,
    profitPct: Number.isFinite(signalData.profitPct)
      ? Math.round(signalData.profitPct * 100) / 100
      : null,
    maxR: Number.isFinite(signalData.maxR)
      ? Math.round(signalData.maxR * 100) / 100
      : null,
    closedAt: closedAt.toISOString()
  };

  bucket.closedSignals.push(entry);

  result.buckets[dateKey] = bucket;

  return result;
}

export function appendOpenSignal(dailyReport, signalData) {
  const result =
    dailyReport && typeof dailyReport === "object"
      ? {
          ...dailyReport,
          buckets:
            dailyReport.buckets && typeof dailyReport.buckets === "object"
              ? { ...dailyReport.buckets }
              : {}
        }
      : createEmptyDailyReport();

  if (!signalData || typeof signalData !== "object") {
    return result;
  }

  const sentAt = signalData.sentAt
    ? new Date(signalData.sentAt)
    : new Date();

  if (!Number.isFinite(sentAt.getTime())) {
    return result;
  }

  const dateKey = getTehranDateKey(sentAt);

  if (!dateKey) {
    return result;
  }

  const existingBucket =
    result.buckets[dateKey] && typeof result.buckets[dateKey] === "object"
      ? result.buckets[dateKey]
      : null;

  const bucket = existingBucket
    ? {
        ...existingBucket,
        closedSignals: Array.isArray(existingBucket.closedSignals)
          ? existingBucket.closedSignals.slice()
          : [],
        openSignals: Array.isArray(existingBucket.openSignals)
          ? existingBucket.openSignals.slice()
          : []
      }
    : { closedSignals: [], openSignals: [] };

  const key =
    (typeof signalData.symbol === "string" ? signalData.symbol : "") +
    ":" +
    (typeof signalData.timeframe === "string" ? signalData.timeframe : "");

  const alreadyTracked = bucket.openSignals.some(
    (item) =>
      item &&
      item.symbol === signalData.symbol &&
      item.timeframe === signalData.timeframe
  );

  if (!alreadyTracked) {
    const entry = {
      symbol:
        typeof signalData.symbol === "string" ? signalData.symbol : null,
      timeframe:
        typeof signalData.timeframe === "string"
          ? signalData.timeframe
          : null,
      direction:
        typeof signalData.direction === "string"
          ? signalData.direction
          : null,
      entry: Number.isFinite(signalData.entry) ? signalData.entry : null,
      stop: Number.isFinite(signalData.stop) ? signalData.stop : null,
      sentAt: sentAt.toISOString()
    };

    bucket.openSignals.push(entry);
  }

  result.buckets[dateKey] = bucket;

  return result;
}

export function removeOpenSignal(dailyReport, symbol, timeframe, dateKey) {
  if (!dailyReport || typeof dailyReport !== "object") {
    return dailyReport;
  }

  if (!symbol || !timeframe || !dateKey) {
    return dailyReport;
  }

  const existingBucket = dailyReport.buckets
    ? dailyReport.buckets[dateKey]
    : null;

  if (!existingBucket || !Array.isArray(existingBucket.openSignals)) {
    return dailyReport;
  }

  const filtered = existingBucket.openSignals.filter(
    (item) =>
      !(
        item &&
        item.symbol === symbol &&
        item.timeframe === timeframe
      )
  );

  if (filtered.length === existingBucket.openSignals.length) {
    return dailyReport;
  }

  const updatedBucket = {
    ...existingBucket,
    openSignals: filtered
  };

  return {
    ...dailyReport,
    buckets: {
      ...dailyReport.buckets,
      [dateKey]: updatedBucket
    }
  };
}

export function cleanOldDailyBuckets(dailyReport, retentionDays) {
  const result =
    dailyReport && typeof dailyReport === "object"
      ? {
          ...dailyReport,
          buckets:
            dailyReport.buckets && typeof dailyReport.buckets === "object"
              ? { ...dailyReport.buckets }
              : {}
        }
      : createEmptyDailyReport();

  const days =
    Number.isFinite(retentionDays) && retentionDays > 0
      ? Math.trunc(retentionDays)
      : Number.isFinite(CONFIG.DAILY_REPORT_RETENTION_DAYS) &&
          CONFIG.DAILY_REPORT_RETENTION_DAYS > 0
        ? Math.trunc(CONFIG.DAILY_REPORT_RETENTION_DAYS)
        : 7;

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const cutoffKey = getTehranDateKey(cutoffDate);

  if (!cutoffKey) {
    return result;
  }

  const cleanedBuckets = {};

  for (const [key, bucket] of Object.entries(result.buckets)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      continue;
    }

    if (key >= cutoffKey) {
      cleanedBuckets[key] = bucket;
    }
  }

  return {
    ...result,
    buckets: cleanedBuckets
  };
}

export function getDailyBucket(dailyReport, dateKey) {
  if (!dailyReport || typeof dailyReport !== "object") {
    return null;
  }

  if (!dailyReport.buckets || typeof dailyReport.buckets !== "object") {
    return null;
  }

  if (typeof dateKey !== "string" || !dateKey) {
    return null;
  }

  const bucket = dailyReport.buckets[dateKey];

  if (!bucket || typeof bucket !== "object") {
    return null;
  }

  return bucket;
}

export function removeDailyBucket(dailyReport, dateKey) {
  if (!dailyReport || typeof dailyReport !== "object") {
    return dailyReport;
  }

  if (!dailyReport.buckets || typeof dailyReport.buckets !== "object") {
    return dailyReport;
  }

  if (typeof dateKey !== "string" || !dateKey) {
    return dailyReport;
  }

  if (!Object.prototype.hasOwnProperty.call(dailyReport.buckets, dateKey)) {
    return dailyReport;
  }

  const updatedBuckets = { ...dailyReport.buckets };
  delete updatedBuckets[dateKey];

  return {
    ...dailyReport,
    buckets: updatedBuckets
  };
}

export function markSignalClosedForThrottle(signals, symbol, timeframe, closedAt) {
  if (!signals || typeof signals !== "object") {
    return signals;
  }

  const key = makeKey(symbol, timeframe);
  const entry = signals[key];

  if (!entry || typeof entry !== "object") {
    return signals;
  }

  const closedTime = closedAt ? new Date(closedAt) : new Date();

  if (!Number.isFinite(closedTime.getTime())) {
    return signals;
  }

  return {
    ...signals,
    [key]: {
      ...entry,
      closedAt: closedTime.toISOString()
    }
  };
}
