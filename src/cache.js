import fs from "node:fs";
import path from "node:path";
import { CACHE_FILE, CACHE_TTL_HOURS } from "./config.js";

const TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return {};
    }

    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const now = Date.now();
    const cleaned = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;

      const ts = Number(value.cached_at);
      if (!Number.isFinite(ts)) continue;

      if (now - ts < TTL_MS) {
        cleaned[key] = value;
      }
    }

    return cleaned;
  } catch (e) {
    console.error("loadCache error:", e && e.message);
    return {};
  }
}

export function saveCache(cache) {
  try {
    ensureDir(CACHE_FILE);
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify(cache, null, 2),
      "utf8"
    );
  } catch (e) {
    console.error("saveCache error:", e && e.message);
  }
}

export function isCached(cache, symbol) {
  if (!cache || typeof cache !== "object") {
    return false;
  }

  const entry = cache[symbol];
  if (!entry || typeof entry !== "object") {
    return false;
  }

  const ts = Number(entry.cached_at);
  if (!Number.isFinite(ts)) {
    return false;
  }

  return Date.now() - ts < TTL_MS;
}

export function addToCache(cache, symbol, payload) {
  cache[symbol] = {
    cached_at: Date.now(),
    timeframe: payload.timeframe,
    direction: payload.direction,
    entry: payload.entry,
    stop_loss: payload.stop_loss,
    targets: payload.targets,
    strength: payload.strength,
    risk: payload.risk
  };
}
