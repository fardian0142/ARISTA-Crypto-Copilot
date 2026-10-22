import { CONFIG, INTERVAL_MS, TIMEFRAME_PROFILES } from "./config.js";

export function emaSeries(values, period) {
  if (!Array.isArray(values) || values.length < period) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const series = new Array(values.length).fill(null);

  let prev =
    values.slice(0, period).reduce((a, b) => a + b, 0) / period;

  series[period - 1] = prev;

  for (let i = period; i < values.length; i++) {
    prev = (values[i] - prev) * multiplier + prev;
    series[i] = prev;
  }

  return series;
}

export function emaTrendCalc(candles) {
  if (!candles || candles.length < CONFIG.EMA_SLOW + 2) {
    return {
      fast: null,
      slow: null,
      fast_prev: null,
      slow_prev: null,
      trend: "neutral",
      cross: "none",
      price_above_fast: false,
      price_above_slow: false,
      price_side: "neutral",
      distance_atr: 0
    };
  }

  const closes = candles.map((c) => c.close);

  const fastSeries = emaSeries(closes, CONFIG.EMA_FAST);
  const slowSeries = emaSeries(closes, CONFIG.EMA_SLOW);

  const lastIndex = closes.length - 1;

  const fast = fastSeries[lastIndex];
  const slow = slowSeries[lastIndex];

  const fastPrev = lastIndex - 1 >= 0 ? fastSeries[lastIndex - 1] : null;
  const slowPrev = lastIndex - 1 >= 0 ? slowSeries[lastIndex - 1] : null;

  if (fast === null || slow === null) {
    return {
      fast: null,
      slow: null,
      fast_prev: null,
      slow_prev: null,
      trend: "neutral",
      cross: "none",
      price_above_fast: false,
      price_above_slow: false,
      price_side: "neutral",
      distance_atr: 0
    };
  }

  let trend = "neutral";

  if (fast > slow) trend = "bullish";
  else if (fast < slow) trend = "bearish";

  let cross = "none";

  if (fastPrev !== null && slowPrev !== null) {
    if (fastPrev <= slowPrev && fast > slow) cross = "golden";
    else if (fastPrev >= slowPrev && fast < slow) cross = "death";
  }

  const currentPrice = closes[lastIndex];

  const priceAboveFast = currentPrice > fast;
  const priceAboveSlow = currentPrice > slow;

  let priceSide = "neutral";

  if (priceAboveFast && priceAboveSlow) priceSide = "bullish";
  else if (!priceAboveFast && !priceAboveSlow) priceSide = "bearish";

  const atrValue = atrCalc(candles);

  const distanceAtr =
    atrValue && atrValue > 0
      ? Math.abs(currentPrice - slow) / atrValue
      : 0;

  return {
    fast,
    slow,
    fast_prev: fastPrev,
    slow_prev: slowPrev,
    trend,
    cross,
    price_above_fast: priceAboveFast,
    price_above_slow: priceAboveSlow,
    price_side: priceSide,
    distance_atr: distanceAtr
  };
}

export function atrCalc(candles, period = CONFIG.ATR_PERIOD) {
  if (!candles || candles.length < period) {
    return null;
  }

  const trs = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    if (i === 0) {
      trs.push(c.high - c.low);
    } else {
      const prevClose = candles[i - 1].close;

      trs.push(
        Math.max(
          c.high - c.low,
          Math.abs(c.high - prevClose),
          Math.abs(c.low - prevClose)
        )
      );
    }
  }

  let value = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < trs.length; i++) {
    value = ((value * (period - 1)) + trs[i]) / period;
  }

  return value;
}

export function rsiCalc(candles, period = CONFIG.RSI_PERIOD) {
  if (!candles || candles.length <= period) {
    return null;
  }

  const values = candles.map((c) => c.close);

  const gains = [];
  const losses = [];

  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }

  let avgGain =
    gains.slice(0, period).reduce((a, b) => a + b, 0) / period;

  let avgLoss =
    losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
  }

  if (avgLoss === 0) {
    if (avgGain === 0) {
      return 50;
    }
    return 100;
  }

  const rs = avgGain / avgLoss;

  return 100 - (100 / (1 + rs));
}

export function rsiSeriesCalc(candles, period = CONFIG.RSI_PERIOD) {
  if (!candles || candles.length <= period) {
    return [];
  }

  const values = candles.map((c) => c.close);
  const result = new Array(values.length).fill(null);

  const gains = [];
  const losses = [];

  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }

  let avgGain =
    gains.slice(0, period).reduce((a, b) => a + b, 0) / period;

  let avgLoss =
    losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) {
    result[period] = avgGain === 0 ? 50 : 100;
  } else {
    const rs = avgGain / avgLoss;
    result[period] = 100 - (100 / (1 + rs));
  }

  for (let i = period; i < gains.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

    const idx = i + 1;

    if (avgLoss === 0) {
      result[idx] = avgGain === 0 ? 50 : 100;
    } else {
      const rs = avgGain / avgLoss;
      result[idx] = 100 - (100 / (1 + rs));
    }
  }

  return result;
}

export function rsiZoneCalc(rsiValue) {
  if (rsiValue === null || rsiValue === undefined || !Number.isFinite(rsiValue)) {
    return {
      value: null,
      zone: "نامشخص",
      label: "نامشخص",
      bias: "neutral",
      icon: "❔",
      description: "داده کافی نیست",
      position: 50
    };
  }

  const v = Math.max(0, Math.min(100, rsiValue));
  const position = v;

  let zone;
  let label;
  let bias;
  let icon;
  let description;

  if (v >= 80) {
    zone = "extreme_overbought";
    label = "اشباع خرید شدید";
    bias = "bearish";
    icon = "🔴";
    description = "احتمال اصلاح نزولی قوی - ورود LONG پرخطر";
  } else if (v > 70) {
    zone = "overbought";
    label = "اشباع خرید";
    bias = "bearish";
    icon = "🟠";
    description = "احتمال اصلاح نزولی - مراقب باش";
  } else if (v >= 60) {
    zone = "bullish_momentum";
    label = "قدرت خرید";
    bias = "bullish";
    icon = "🟢";
    description = "خریداران کنترل بازار را در دست دارند";
  } else if (v > 40) {
    zone = "neutral";
    label = "ناحیه خنثی";
    bias = "neutral";
    icon = "🟡";
    description = "تعادل بین خریداران و فروشندگان";
  } else if (v >= 30) {
    zone = "bearish_momentum";
    label = "قدرت فروش";
    bias = "bearish";
    icon = "🟠";
    description = "فروشندگان کنترل بازار را در دست دارند";
  } else if (v > 20) {
    zone = "oversold";
    label = "اشباع فروش";
    bias = "bullish";
    icon = "🟢";
    description = "احتمال بازگشت صعودی - مراقب باش";
  } else {
    zone = "extreme_oversold";
    label = "اشباع فروش شدید";
    bias = "bullish";
    icon = "🟢";
    description = "احتمال بازگشت صعودی قوی - ورود SHORT پرخطر";
  }

  return {
    value: v,
    zone,
    label,
    bias,
    icon,
    description,
    position
  };
}

export function rsiDivergenceCalc(candles, rsiValues, swings) {
  const emptyResult = {
    detected: false,
    type: null,
    strength: 0,
    severity: "none",
    pointA: null,
    pointB: null,
    rsiA: null,
    rsiB: null,
    priceA: null,
    priceB: null,
    rsiDelta: 0,
    priceDelta: 0,
    description: "",
    hidden: false,
    midDrop: 0,
    capped: false
  };

  if (!candles || !rsiValues || rsiValues.length === 0) {
    return emptyResult;
  }

  if (!swings) {
    swings = detectSwings(candles);
  }

  const candlesLen = candles.length;
  const minDistance = CONFIG.RSI_DIV_MIN_DISTANCE;
  const maxDistance = Math.min(
    CONFIG.RSI_DIV_MAX_DISTANCE,
    CONFIG.RSI_DIV_MAX_PEAK_GAP
  );
  const minPriceDiff = CONFIG.RSI_DIV_MIN_PRICE_DIFF;
  const minRsiDiff = CONFIG.RSI_DIV_MIN_RSI_DIFF;
  const minMidDrop = CONFIG.RSI_DIV_MIN_MIDDROP;
  const maxStrength = CONFIG.RSI_DIV_MAX_STRENGTH;

  const confirmedHighs = (swings.highs || []).filter((s) =>
    isSwingConfirmed(s, candlesLen - 1)
  );
  const confirmedLows = (swings.lows || []).filter((s) =>
    isSwingConfirmed(s, candlesLen - 1)
  );

  const lookbackStart = Math.max(0, candlesLen - CONFIG.RSI_DIV_LOOKBACK);

  const recentHighs = confirmedHighs.filter((s) => s.index >= lookbackStart);
  const recentLows = confirmedLows.filter((s) => s.index >= lookbackStart);

  const hasMeaningfulMidDrop = (aIndex, bIndex) => {
    if (bIndex - aIndex < 3) return 0;

    let lowest = Infinity;

    for (let k = aIndex + 1; k < bIndex; k++) {
      const lowVal = cLow(candles[k]);
      if (lowVal < lowest) lowest = lowVal;
    }

    if (!Number.isFinite(lowest)) return 0;

    const ref = cHigh(candles[aIndex]);
    if (ref <= 0) return 0;

    return (ref - lowest) / ref;
  };

  const hasMeaningfulMidRise = (aIndex, bIndex) => {
    if (bIndex - aIndex < 3) return 0;

    let highest = -Infinity;

    for (let k = aIndex + 1; k < bIndex; k++) {
      const highVal = cHigh(candles[k]);
      if (highVal > highest) highest = highVal;
    }

    if (!Number.isFinite(highest)) return 0;

    const ref = cLow(candles[aIndex]);
    if (ref <= 0) return 0;

    return (highest - ref) / ref;
  };

  let bestBearish = null;
  let bestBullish = null;
  let bestHiddenBullish = null;
  let bestHiddenBearish = null;

  for (let i = 0; i < recentHighs.length; i++) {
    for (let j = i + 1; j < recentHighs.length; j++) {
      const a = recentHighs[i];
      const b = recentHighs[j];

      const dist = b.index - a.index;
      if (dist < minDistance || dist > maxDistance) continue;

      const rsiA = rsiValues[a.index];
      const rsiB = rsiValues[b.index];

      if (rsiA === null || rsiB === null) continue;
      if (!Number.isFinite(rsiA) || !Number.isFinite(rsiB)) continue;

      const priceDiffPct = (b.price - a.price) / a.price;
      const rsiDiff = rsiB - rsiA;

      if (priceDiffPct >= minPriceDiff && rsiDiff <= -minRsiDiff) {
        if (rsiA < CONFIG.RSI_DIV_BEARISH_MIN_RSI_A) continue;
        if (rsiB < CONFIG.RSI_DIV_BEARISH_MIN_RSI_B) continue;

        const midDrop = hasMeaningfulMidDrop(a.index, b.index);
        if (midDrop < minMidDrop) continue;

        const strength = Math.abs(rsiDiff);

        if (!bestBearish || strength > bestBearish.strength) {
          bestBearish = {
            pointA: a,
            pointB: b,
            rsiA,
            rsiB,
            priceA: a.price,
            priceB: b.price,
            rsiDelta: rsiDiff,
            priceDelta: priceDiffPct,
            strength,
            midDrop,
            distance: dist,
            hidden: false
          };
        }
      }

      if (
        CONFIG.RSI_DIV_HIDDEN_ENABLED &&
        priceDiffPct <= -minPriceDiff &&
        rsiDiff >= minRsiDiff
      ) {
        if (rsiA < CONFIG.RSI_DIV_HIDDEN_BEARISH_MIN_RSI_A) continue;
        if (rsiB < CONFIG.RSI_DIV_HIDDEN_BEARISH_MIN_RSI_B) continue;

        const midDrop = hasMeaningfulMidDrop(b.index, a.index);
        const strength = Math.abs(rsiDiff);

        if (!bestHiddenBearish || strength > bestHiddenBearish.strength) {
          bestHiddenBearish = {
            pointA: a,
            pointB: b,
            rsiA,
            rsiB,
            priceA: a.price,
            priceB: b.price,
            rsiDelta: rsiDiff,
            priceDelta: priceDiffPct,
            strength,
            midDrop,
            distance: dist,
            hidden: true
          };
        }
      }
    }
  }

  for (let i = 0; i < recentLows.length; i++) {
    for (let j = i + 1; j < recentLows.length; j++) {
      const a = recentLows[i];
      const b = recentLows[j];

      const dist = b.index - a.index;
      if (dist < minDistance || dist > maxDistance) continue;

      const rsiA = rsiValues[a.index];
      const rsiB = rsiValues[b.index];

      if (rsiA === null || rsiB === null) continue;
      if (!Number.isFinite(rsiA) || !Number.isFinite(rsiB)) continue;

      const priceDiffPct = (a.price - b.price) / a.price;
      const rsiDiff = rsiB - rsiA;

      if (priceDiffPct >= minPriceDiff && rsiDiff >= minRsiDiff) {
        if (rsiA > CONFIG.RSI_DIV_BULLISH_MAX_RSI_A) continue;
        if (rsiB > CONFIG.RSI_DIV_BULLISH_MAX_RSI_B) continue;

        const midRise = hasMeaningfulMidRise(a.index, b.index);
        if (midRise < minMidDrop) continue;

        const strength = Math.abs(rsiDiff);

        if (!bestBullish || strength > bestBullish.strength) {
          bestBullish = {
            pointA: a,
            pointB: b,
            rsiA,
            rsiB,
            priceA: a.price,
            priceB: b.price,
            rsiDelta: rsiDiff,
            priceDelta: priceDiffPct,
            strength,
            midDrop: midRise,
            distance: dist,
            hidden: false
          };
        }
      }

      if (
        CONFIG.RSI_DIV_HIDDEN_ENABLED &&
        priceDiffPct <= -minPriceDiff &&
        rsiDiff <= -minRsiDiff
      ) {
        if (rsiA > CONFIG.RSI_DIV_HIDDEN_BULLISH_MAX_RSI_A) continue;
        if (rsiB > CONFIG.RSI_DIV_HIDDEN_BULLISH_MAX_RSI_B) continue;

        const midRise = hasMeaningfulMidRise(b.index, a.index);
        const strength = Math.abs(rsiDiff);

        if (!bestHiddenBullish || strength > bestHiddenBullish.strength) {
          bestHiddenBullish = {
            pointA: a,
            pointB: b,
            rsiA,
            rsiB,
            priceA: a.price,
            priceB: b.price,
            rsiDelta: rsiDiff,
            priceDelta: priceDiffPct,
            strength,
            midDrop: midRise,
            distance: dist,
            hidden: true
          };
        }
      }
    }
  }

  const candidates = [];

  if (bestBearish) {
    candidates.push({
      type: "bearish",
      data: bestBearish,
      priority: bestBearish.strength + bestBearish.midDrop * 100
    });
  }

  if (bestBullish) {
    candidates.push({
      type: "bullish",
      data: bestBullish,
      priority: bestBullish.strength + bestBullish.midDrop * 100
    });
  }

  if (bestHiddenBearish) {
    candidates.push({
      type: "hidden_bearish",
      data: bestHiddenBearish,
      priority: bestHiddenBearish.strength * 0.7
    });
  }

  if (bestHiddenBullish) {
    candidates.push({
      type: "hidden_bullish",
      data: bestHiddenBullish,
      priority: bestHiddenBullish.strength * 0.7
    });
  }

  if (candidates.length === 0) {
    return emptyResult;
  }

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.data.distance - b.data.distance;
  });

  const best = candidates[0];
  const data = best.data;

  const rawStrength = data.strength;
  const cappedStrength = Math.min(rawStrength, maxStrength);
  const wasCapped = rawStrength > maxStrength;

  let severity = "weak";

  if (cappedStrength >= CONFIG.RSI_DIV_STRONG_THRESHOLD) {
    severity = "strong";
  } else if (cappedStrength >= CONFIG.RSI_DIV_MEDIUM_THRESHOLD) {
    severity = "medium";
  }

  let description = "";

  if (best.type === "bearish") {
    description = "قیمت سقف بالاتر (HH) ولی RSI سقف پایین‌تر (LH) — ضعف قدرت خرید";
  } else if (best.type === "bullish") {
    description = "قیمت کف پایین‌تر (LL) ولی RSI کف بالاتر (HL) — ضعف قدرت فروش";
  } else if (best.type === "hidden_bearish") {
    description = "قیمت سقف پایین‌تر (LH) ولی RSI سقف بالاتر (HH) — ادامه روند نزولی";
  } else if (best.type === "hidden_bullish") {
    description = "قیمت کف بالاتر (HL) ولی RSI کف پایین‌تر (LL) — ادامه روند صعودی";
  }

  return {
    detected: true,
    type: best.type,
    strength: cappedStrength,
    rawStrength,
    capped: wasCapped,
    severity,
    pointA: data.pointA,
    pointB: data.pointB,
    rsiA: data.rsiA,
    rsiB: data.rsiB,
    priceA: data.priceA,
    priceB: data.priceB,
    rsiDelta: data.rsiDelta,
    priceDelta: data.priceDelta,
    midDrop: data.midDrop,
    distance: data.distance,
    description,
    hidden: data.hidden
  };
}

export function rsiDivergenceScore(divergence, direction) {
  if (!divergence || !divergence.detected) {
    return {
      scoreDelta: 0,
      aligned: false,
      opposed: false,
      reason: ""
    };
  }

  const type = divergence.type;
  const strength = divergence.strength;

  let scoreDelta = 0;

  if (strength >= CONFIG.RSI_DIV_STRONG_THRESHOLD) {
    scoreDelta = CONFIG.RSI_DIV_SCORE_STRONG;
  } else if (strength >= CONFIG.RSI_DIV_MEDIUM_THRESHOLD) {
    scoreDelta = CONFIG.RSI_DIV_SCORE_MEDIUM;
  } else {
    scoreDelta = CONFIG.RSI_DIV_SCORE_WEAK;
  }

  const isBullishType = type === "bullish" || type === "hidden_bullish";
  const isBearishType = type === "bearish" || type === "hidden_bearish";

  const aligned =
    (direction === "bullish" && isBullishType) ||
    (direction === "bearish" && isBearishType);

  const opposed =
    (direction === "bullish" && isBearishType) ||
    (direction === "bearish" && isBullishType);

  let reason = "";

  if (aligned) {
    if (type === "bullish") {
      reason = "واگرایی صعودی RSI — تأیید بازگشت/ادامه صعود";
    } else if (type === "bearish") {
      reason = "واگرایی نزولی RSI — تأیید بازگشت/ادامه نزول";
    } else if (type === "hidden_bullish") {
      reason = "واگرایی مخفی صعودی RSI — تأیید ادامه روند صعودی";
    } else if (type === "hidden_bearish") {
      reason = "واگرایی مخفی نزولی RSI — تأیید ادامه روند نزولی";
    }
    return {
      scoreDelta: scoreDelta,
      aligned: true,
      opposed: false,
      reason
    };
  }

  if (opposed) {
    let penalty = scoreDelta;

    if (strength >= CONFIG.RSI_DIV_STRONG_THRESHOLD) {
      penalty = CONFIG.RSI_DIV_PENALTY_STRONG;
    } else if (strength >= CONFIG.RSI_DIV_MEDIUM_THRESHOLD) {
      penalty = CONFIG.RSI_DIV_PENALTY_MEDIUM;
    } else {
      penalty = CONFIG.RSI_DIV_PENALTY_WEAK;
    }

    if (type === "bearish") {
      reason = "واگرایی نزولی RSI — هشدار ضعف قدرت خرید";
    } else if (type === "bullish") {
      reason = "واگرایی صعودی RSI — هشدار ضعف قدرت فروش";
    } else if (type === "hidden_bearish") {
      reason = "واگرایی مخفی نزولی RSI — خلاف جهت ستاپ صعودی";
    } else if (type === "hidden_bullish") {
      reason = "واگرایی مخفی صعودی RSI — خلاف جهت ستاپ نزولی";
    }

    return {
      scoreDelta: -penalty,
      aligned: false,
      opposed: true,
      reason
    };
  }

  return {
    scoreDelta: 0,
    aligned: false,
    opposed: false,
    reason: ""
  };
}

export function volumeRatioCalc(candles, period = CONFIG.VOLUME_LOOKBACK) {
  if (!candles || candles.length <= period) {
    return 1;
  }

  const currentCandle = candles[candles.length - 1];
  const current = currentCandle.volume;

  let adjustedCurrent = current;

  if (currentCandle.incomplete && currentCandle.open_time) {
    const intervalMs = INTERVAL_MS[
      currentCandle.timeframe || ""
    ] || (currentCandle.close_time - currentCandle.open_time + 1);

    const elapsed = Date.now() - currentCandle.open_time;
    const progress = Math.min(elapsed / Math.max(intervalMs, 1), 1);

    if (progress >= 0.1 && progress < 1) {
      adjustedCurrent = current / progress;
    }
  }

  const values = candles
    .slice(-period - 1, -1)
    .filter((c) => !c.incomplete)
    .map((c) => c.volume)
    .filter((v) => Number.isFinite(v) && v > 0);

  if (values.length === 0) {
    return 1;
  }

  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  if (avg <= 0) {
    return 1;
  }

  return adjustedCurrent / avg;
}

export function cHigh(c) { return c.high; }
export function cLow(c) { return c.low; }
export function cOpen(c) { return c.open; }
export function cClose(c) { return c.close; }
export function cVol(c) { return c.volume || 0; }
export function cRange(c) { return Math.max(cHigh(c) - cLow(c), 0); }
export function cBody(c) { return Math.abs(cClose(c) - cOpen(c)); }
export function isBull(c) { return cClose(c) > cOpen(c); }
export function isBear(c) { return cClose(c) < cOpen(c); }

export function averageVolume(candles, endIndex, lookback = CONFIG.VOLUME_LOOKBACK) {
  const start = Math.max(0, endIndex - lookback);
  const values = [];

  for (let i = start; i < endIndex; i++) {
    const v = cVol(candles[i]);
    if (v > 0) {
      values.push(v);
    }
  }

  if (values.length === 0) {
    return 0;
  }

  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function detectSwings(candles, left = CONFIG.SWING_LEFT, right = CONFIG.SWING_RIGHT) {
  const highs = [];
  const lows = [];

  if (!candles || candles.length < left + right + 1) {
    return { highs, lows };
  }

  for (let i = left; i < candles.length - right; i++) {
    const ch = cHigh(candles[i]);
    const cl = cLow(candles[i]);

    let isHigh = true;
    let isLow = true;

    for (let j = i - left; j < i; j++) {
      if (cHigh(candles[j]) >= ch) isHigh = false;
      if (cLow(candles[j]) <= cl) isLow = false;
    }

    for (let j = i + 1; j <= i + right; j++) {
      if (cHigh(candles[j]) >= ch) isHigh = false;
      if (cLow(candles[j]) <= cl) isLow = false;
    }

    if (isHigh) {
      highs.push({ index: i, price: ch, confirmed_index: i + right });
    }

    if (isLow) {
      lows.push({ index: i, price: cl, confirmed_index: i + right });
    }
  }

  return { highs, lows };
}

export function isSwingConfirmed(swing, candleIndex) {
  if (!swing) {
    return false;
  }

  const confirmationIndex = Number.isFinite(swing.confirmed_index)
    ? swing.confirmed_index
    : swing.index + CONFIG.SWING_RIGHT;

  return confirmationIndex <= candleIndex;
}

export function buildConfirmedSwingTimeline(swings, candlesLength) {
  const highs = swings.highs || [];
  const lows = swings.lows || [];

  const timelineHighs = new Array(candlesLength);
  const timelineLows = new Array(candlesLength);

  let hIdx = 0;
  let lIdx = 0;

  const cumulativeHighs = [];
  const cumulativeLows = [];

  for (let i = 0; i < candlesLength; i++) {
    while (
      hIdx < highs.length &&
      isSwingConfirmed(highs[hIdx], i)
    ) {
      cumulativeHighs.push(highs[hIdx]);
      hIdx++;
    }

    while (
      lIdx < lows.length &&
      isSwingConfirmed(lows[lIdx], i)
    ) {
      cumulativeLows.push(lows[lIdx]);
      lIdx++;
    }

    timelineHighs[i] = cumulativeHighs;
    timelineLows[i] = cumulativeLows;
  }

  return {
    highs: timelineHighs,
    lows: timelineLows
  };
}

export function getConfirmedSwings(swings, candleIndex) {
  return {
    highs: (swings.highs || []).filter(
      (x) => isSwingConfirmed(x, candleIndex)
    ),
    lows: (swings.lows || []).filter(
      (x) => isSwingConfirmed(x, candleIndex)
    )
  };
}

function _labelSwings(swings) {
  const highs = swings.highs || [];
  const lows = swings.lows || [];

  const highLabels = highs.map((s, i) => ({
    ...s,
    label:
      i === 0
        ? "H"
        : s.price > highs[i - 1].price
          ? "HH"
          : "LH"
  }));

  const lowLabels = lows.map((s, i) => ({
    ...s,
    label:
      i === 0
        ? "L"
        : s.price > lows[i - 1].price
          ? "HL"
          : "LL"
  }));

  return { highLabels, lowLabels };
}

function _isUptrend(highLabels, lowLabels, count) {
  if (highLabels.length < count || lowLabels.length < count) {
    return false;
  }

  const recentHighs = highLabels.slice(-count);
  const recentLows = lowLabels.slice(-count);

  for (let i = 1; i < recentHighs.length; i++) {
    if (recentHighs[i].price <= recentHighs[i - 1].price) {
      return false;
    }
  }

  for (let i = 1; i < recentLows.length; i++) {
    if (recentLows[i].price <= recentLows[i - 1].price) {
      return false;
    }
  }

  return true;
}

function _isDowntrend(highLabels, lowLabels, count) {
  if (highLabels.length < count || lowLabels.length < count) {
    return false;
  }

  const recentHighs = highLabels.slice(-count);
  const recentLows = lowLabels.slice(-count);

  for (let i = 1; i < recentHighs.length; i++) {
    if (recentHighs[i].price >= recentHighs[i - 1].price) {
      return false;
    }
  }

  for (let i = 1; i < recentLows.length; i++) {
    if (recentLows[i].price >= recentLows[i - 1].price) {
      return false;
    }
  }

  return true;
}

export function marketStructure(candles, swings) {
  if (!swings) {
    swings = detectSwings(candles);
  }

  const { highLabels, lowLabels } = _labelSwings(swings);

  const checkCount = Math.max(2, Math.min(CONFIG.STRUCTURE_SWINGS, 3));

  const bullish = _isUptrend(highLabels, lowLabels, checkCount);
  const bearish = _isDowntrend(highLabels, lowLabels, checkCount);

  let trend = "neutral";
  if (bullish) trend = "bullish";
  else if (bearish) trend = "bearish";

  return {
    trend,
    highs: highLabels,
    lows: lowLabels,
    last_high:
      highLabels.length > 0
        ? highLabels[highLabels.length - 1]
        : null,
    last_low:
      lowLabels.length > 0
        ? lowLabels[lowLabels.length - 1]
        : null
  };
}

export function detectBosChoch(candles, swings, structure) {
  if (!candles || candles.length < 10) {
    return null;
  }

  if (!swings) {
    swings = detectSwings(candles);
  }

  const start = Math.max(
    CONFIG.SWING_LEFT + CONFIG.SWING_RIGHT,
    candles.length - CONFIG.BOS_LOOKBACK
  );

  const events = [];
  const brokenLevels = new Set();

  const timeline = buildConfirmedSwingTimeline(swings, candles.length);

  for (let i = 0; i < start; i++) {
    const confirmedHighs = timeline.highs[i] || [];
    const confirmedLows = timeline.lows[i] || [];

    const pHigh =
      confirmedHighs.length > 0
        ? confirmedHighs[confirmedHighs.length - 1]
        : null;

    const pLow =
      confirmedLows.length > 0
        ? confirmedLows[confirmedLows.length - 1]
        : null;

    const closePrice = cClose(candles[i]);

    if (pHigh && closePrice > pHigh.price) {
      brokenLevels.add("bullish-" + pHigh.index);
    }

    if (pLow && closePrice < pLow.price) {
      brokenLevels.add("bearish-" + pLow.index);
    }
  }

  for (let i = start; i < candles.length; i++) {
    const closePrice = cClose(candles[i]);
    const confirmedHighs = timeline.highs[i] || [];
    const confirmedLows = timeline.lows[i] || [];

    const pHigh =
      confirmedHighs.length > 0
        ? confirmedHighs[confirmedHighs.length - 1]
        : null;

    const pLow =
      confirmedLows.length > 0
        ? confirmedLows[confirmedLows.length - 1]
        : null;

    let prior = "neutral";

    if (confirmedHighs.length >= 2 && confirmedLows.length >= 2) {
      const hh =
        confirmedHighs[confirmedHighs.length - 1].price >
        confirmedHighs[confirmedHighs.length - 2].price;

      const hl =
        confirmedLows[confirmedLows.length - 1].price >
        confirmedLows[confirmedLows.length - 2].price;

      const lh =
        confirmedHighs[confirmedHighs.length - 1].price <
        confirmedHighs[confirmedHighs.length - 2].price;

      const ll =
        confirmedLows[confirmedLows.length - 1].price <
        confirmedLows[confirmedLows.length - 2].price;

      if (hh && hl) prior = "bullish";
      else if (lh && ll) prior = "bearish";
    }

    if (pHigh && closePrice > pHigh.price) {
      const key = "bullish-" + pHigh.index;
      if (!brokenLevels.has(key)) {
        brokenLevels.add(key);

        events.push({
          index: i,
          direction: "bullish",
          type: prior === "bearish" ? "CHoCH" : "BOS",
          broken_level: pHigh.price,
          swing_index: pHigh.index,
          close: closePrice,
          prior_structure: prior
        });
      }
    }

    if (pLow && closePrice < pLow.price) {
      const key = "bearish-" + pLow.index;
      if (!brokenLevels.has(key)) {
        brokenLevels.add(key);

        events.push({
          index: i,
          direction: "bearish",
          type: prior === "bullish" ? "CHoCH" : "BOS",
          broken_level: pLow.price,
          swing_index: pLow.index,
          close: closePrice,
          prior_structure: prior
        });
      }
    }
  }

  if (events.length === 0) {
    return null;
  }

  events.sort((a, b) => a.index - b.index);

  return events[events.length - 1];
}

export function detectLiquiditySweeps(candles, swings, lookback = CONFIG.SWEEP_LOOKBACK) {
  if (!candles || candles.length < 10) {
    return [];
  }

  if (!swings) {
    swings = detectSwings(candles);
  }

  const start = Math.max(
    CONFIG.SWING_LEFT + CONFIG.SWING_RIGHT,
    candles.length - lookback
  );

  const candidates = [];
  const timeline = buildConfirmedSwingTimeline(swings, candles.length);

  for (let i = start; i < candles.length; i++) {
    const candle = candles[i];
    const confirmedHighs = timeline.highs[i] || [];
    const confirmedLows = timeline.lows[i] || [];

    for (let k = confirmedLows.length - 1; k >= 0; k--) {
      const level = confirmedLows[k];

      if (cLow(candle) < level.price && cClose(candle) > level.price) {
        const dist = level.price - cLow(candle);

        candidates.push({
          index: i,
          direction: "bullish",
          type: "sell_side_sweep",
          level: level.price,
          swept_index: level.index,
          distance: dist,
          close: cClose(candle),
          wick_size: dist,
          rejection: dist / Math.max(cRange(candle), 1e-12)
        });

        break;
      }
    }

    for (let k = confirmedHighs.length - 1; k >= 0; k--) {
      const level = confirmedHighs[k];

      if (cHigh(candle) > level.price && cClose(candle) < level.price) {
        const dist = cHigh(candle) - level.price;

        candidates.push({
          index: i,
          direction: "bearish",
          type: "buy_side_sweep",
          level: level.price,
          swept_index: level.index,
          distance: dist,
          close: cClose(candle),
          wick_size: dist,
          rejection: dist / Math.max(cRange(candle), 1e-12)
        });

        break;
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.index !== b.index) return b.index - a.index;
    if (a.rejection !== b.rejection) return b.rejection - a.rejection;
    return b.distance - a.distance;
  });

  return candidates;
}

export function detectDisplacement(candles, atrValue, index) {
  if (!candles || !atrValue || atrValue <= 0) {
    return null;
  }

  const i =
    index === undefined || index === null
      ? candles.length - 1
      : index;

  if (i < 1 || i >= candles.length) {
    return null;
  }

  const candle = candles[i];
  const candleRange = cRange(candle);

  if (candleRange <= 0) {
    return null;
  }

  const bodyRatio = cBody(candle) / candleRange;
  const rangeRatio = candleRange / atrValue;

  const avgVol = averageVolume(candles, i);
  const curVol = cVol(candle);
  const volumeRatio = avgVol > 0 ? curVol / avgVol : 1;

  const valid =
    rangeRatio >= CONFIG.DISPLACEMENT_ATR &&
    bodyRatio >= CONFIG.DISPLACEMENT_BODY &&
    volumeRatio >= CONFIG.DISPLACEMENT_VOLUME;

  if (!valid) {
    return null;
  }

  let direction;
  if (isBull(candle)) direction = "bullish";
  else if (isBear(candle)) direction = "bearish";
  else return null;

  return {
    index: i,
    direction,
    range: candleRange,
    body: cBody(candle),
    body_ratio: bodyRatio,
    range_ratio: rangeRatio,
    volume_ratio: volumeRatio,
    open: cOpen(candle),
    high: cHigh(candle),
    low: cLow(candle),
    close: cClose(candle)
  };
}

export function findEventDisplacement(candles, atrValue, event, sweep, lookback = 16) {
  if (!event) {
    return null;
  }

  const eventIndex = event.index;
  const direction = event.direction;

  const minimumIndex = sweep
    ? Math.max(eventIndex, sweep.index + 1)
    : eventIndex;

  const forwardWindow = Math.max(
    3,
    Math.min(Math.floor(lookback / 2), 6)
  );

  const end = Math.min(
    candles.length - 1,
    eventIndex + forwardWindow
  );

  const candidates = [];

  for (let i = minimumIndex; i <= end; i++) {
    const item = detectDisplacement(candles, atrValue, i);

    if (!item) continue;
    if (item.direction !== direction) continue;

    const distance = item.index - eventIndex;
    if (distance < 0) continue;

    candidates.push({
      distance,
      strength: item.range_ratio,
      item
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return b.strength - a.strength;
  });

  return candidates[0].item;
}

export function detectFvgs(
  candles,
  atrValue,
  structureEvent,
  sweep,
  displacement,
  lookback = CONFIG.FVG_LOOKBACK
) {
  if (!candles || candles.length < 3) {
    return [];
  }

  const start = Math.max(2, candles.length - lookback);

  const eventIndex = structureEvent ? structureEvent.index : null;
  const eventDirection = structureEvent ? structureEvent.direction : null;
  const sweepIndex = sweep ? sweep.index : null;
  const displacementIndex = displacement ? displacement.index : null;

  const result = [];

  for (let i = start; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];

    const bullishGap = cHigh(c1) < cLow(c3);
    const bearishGap = cLow(c1) > cHigh(c3);

    if (!bullishGap && !bearishGap) {
      continue;
    }

    let direction, lowVal, highVal;

    if (bullishGap) {
      direction = "bullish";
      lowVal = cHigh(c1);
      highVal = cLow(c3);
    } else {
      direction = "bearish";
      lowVal = cHigh(c3);
      highVal = cLow(c1);
    }

    const gapSize = highVal - lowVal;
    if (gapSize <= 0) continue;

    if (structureEvent && direction !== eventDirection) continue;
    if (eventIndex !== null && i < eventIndex) continue;
    if (sweepIndex !== null && i <= sweepIndex) continue;

    let displacementMatch = false;
    if (displacementIndex !== null) {
      displacementMatch =
        i >= displacementIndex &&
        i - displacementIndex <= 1 &&
        direction === displacement.direction;
    }

    let eventMatch = false;
    if (eventIndex !== null) {
      eventMatch =
        i >= eventIndex &&
        i - eventIndex <= 3 &&
        direction === eventDirection;
    }

    const sweepMatch =
      sweepIndex !== null &&
      sweepIndex < i &&
      i - sweepIndex <= 8 &&
      direction === sweep.direction;

    if (displacement && !displacementMatch) {
      if (!eventMatch) {
        continue;
      }
    }

    let touched = false;
    let invalidated = false;

    for (let j = i + 1; j < candles.length; j++) {
      const check = candles[j];

      if (direction === "bullish") {
        if (cClose(check) < lowVal) {
          invalidated = true;
          break;
        }
        if (cLow(check) <= highVal) touched = true;
      } else {
        if (cClose(check) > highVal) {
          invalidated = true;
          break;
        }
        if (cHigh(check) >= lowVal) touched = true;
      }
    }

    if (invalidated) continue;

    const currentPrice = cClose(candles[candles.length - 1]);

    let status;

    if (direction === "bullish") {
      if (currentPrice < lowVal) status = "invalidated";
      else if (currentPrice <= highVal || touched) status = "partial";
      else status = "fresh";
    } else {
      if (currentPrice > highVal) status = "invalidated";
      else if (currentPrice >= lowVal || touched) status = "partial";
      else status = "fresh";
    }

    if (status === "invalidated") continue;

    let quality = 0;
    if (displacementMatch) quality += 5;
    if (eventMatch) quality += 3;
    if (sweepMatch) quality += 2;
    if (eventDirection === direction) quality += 2;
    if (atrValue > 0 && gapSize >= atrValue * 0.15) quality += 1;
    if (status === "fresh") quality += 2;

    result.push({
      index: i,
      direction,
      low: lowVal,
      high: highVal,
      mid: (lowVal + highVal) / 2,
      size: gapSize,
      status,
      quality,
      displacement_match: displacementMatch,
      event_match: eventMatch,
      sweep_match: sweepMatch,
      fresh: status === "fresh"
    });
  }

  result.sort((a, b) => {
    if (a.quality !== b.quality) return b.quality - a.quality;
    const aF = a.fresh ? 1 : 0;
    const bF = b.fresh ? 1 : 0;
    if (aF !== bF) return bF - aF;
    return b.index - a.index;
  });

  return result;
}

export function detectOrderBlocks(
  candles,
  atrValue,
  structureEvent,
  displacement,
  sweep,
  lookback = CONFIG.OB_LOOKBACK
) {
  if (!candles || candles.length < 5 || !atrValue || atrValue <= 0) {
    return [];
  }

  let direction;
  let referenceIndex;

  if (displacement) {
    direction = displacement.direction;
    referenceIndex = displacement.index;
  } else if (structureEvent) {
    direction = structureEvent.direction;
    referenceIndex = structureEvent.index;
  } else if (sweep) {
    direction = sweep.direction;
    referenceIndex = sweep.index;
  } else {
    return [];
  }

  if (direction !== "bullish" && direction !== "bearish") {
    return [];
  }

  if (
    !Number.isInteger(referenceIndex) ||
    referenceIndex < 1 ||
    referenceIndex >= candles.length
  ) {
    return [];
  }

  if (structureEvent) {
    if (
      structureEvent.direction !== direction ||
      !Number.isInteger(structureEvent.index) ||
      structureEvent.index < 1 ||
      structureEvent.index >= candles.length
    ) {
      return [];
    }
  }

  if (displacement) {
    if (
      displacement.direction !== direction ||
      !Number.isInteger(displacement.index) ||
      displacement.index < 1 ||
      displacement.index >= candles.length
    ) {
      return [];
    }
  }

  if (sweep) {
    if (
      sweep.direction !== direction ||
      !Number.isInteger(sweep.index) ||
      sweep.index < 1 ||
      sweep.index >= candles.length
    ) {
      return [];
    }
  }

  if (displacement && structureEvent) {
    if (displacement.index < structureEvent.index) {
      return [];
    }

    if (displacement.index > structureEvent.index + 6) {
      return [];
    }
  }

  if (sweep && displacement) {
    if (sweep.index >= displacement.index) {
      return [];
    }

    if (displacement.index - sweep.index > 8) {
      return [];
    }
  }

  const start = Math.max(1, referenceIndex - lookback);
  const end = Math.min(referenceIndex, candles.length - 1);

  const candidates = [];

  for (let i = start; i < end; i++) {
    const candle = candles[i];

    if (direction === "bullish" && !isBear(candle)) continue;
    if (direction === "bearish" && !isBull(candle)) continue;

    if (displacement) {
      const dist = referenceIndex - i;
      if (dist < 1 || dist > 8) continue;
    }

    const maxForward = Math.min(candles.length - 1, i + 8);
    let displacementIndex = null;

    for (let j = i + 1; j <= maxForward; j++) {
      const future = candles[j];

      if (direction === "bullish" && !isBull(future)) continue;
      if (direction === "bearish" && !isBear(future)) continue;

      const futureRange = cRange(future);
      if (futureRange <= 0) continue;

      const futureBodyRatio = cBody(future) / futureRange;

      const futureAvgVol = averageVolume(candles, j);
      const futureVolumeRatio =
        futureAvgVol > 0 ? cVol(future) / futureAvgVol : 1;

      const valid =
        futureRange >= atrValue * CONFIG.DISPLACEMENT_ATR &&
        futureBodyRatio >= CONFIG.DISPLACEMENT_BODY &&
        futureVolumeRatio >= CONFIG.DISPLACEMENT_VOLUME;

      if (valid) {
        displacementIndex = j;
        break;
      }
    }

    if (displacementIndex === null) continue;

    if (displacement && displacementIndex !== displacement.index) {
      continue;
    }

    if (structureEvent) {
      if (displacementIndex < structureEvent.index) continue;
      if (displacementIndex > structureEvent.index + 6) continue;
    }

    if (sweep) {
      if (sweep.index >= displacementIndex) continue;

      if (displacementIndex - sweep.index > 8) {
        continue;
      }
    }

    const zoneLow = cLow(candle);
    const zoneHigh = cHigh(candle);

    if (zoneHigh <= zoneLow) continue;

    const displacementCandle = candles[displacementIndex];

    if (
      direction === "bullish" &&
      cClose(displacementCandle) <= zoneHigh
    ) {
      continue;
    }

    if (
      direction === "bearish" &&
      cClose(displacementCandle) >= zoneLow
    ) {
      continue;
    }

    let invalidated = false;

    for (let j = i + 1; j < candles.length; j++) {
      const check = candles[j];

      if (direction === "bullish" && cClose(check) < zoneLow) {
        invalidated = true;
        break;
      }

      if (direction === "bearish" && cClose(check) > zoneHigh) {
        invalidated = true;
        break;
      }
    }

    if (invalidated) continue;

    const volAvg = averageVolume(candles, i);
    const volumeRatio = volAvg > 0 ? cVol(candle) / volAvg : 1;
    const freshness = candles.length - 1 - i;

    let quality = 0;

    if (structureEvent) quality += 4;
    if (displacement) quality += 5;

    if (
      sweep &&
      sweep.index < displacementIndex &&
      displacementIndex - sweep.index <= 8
    ) {
      quality += 3;
    }

    if (volumeRatio >= CONFIG.DISPLACEMENT_VOLUME) {
      quality += 1;
    }

    if (freshness <= 12) {
      quality += 1;
    }

    if (displacementIndex === referenceIndex) {
      quality += 2;
    }

    if (sweep && displacement && i <= sweep.index) {
      quality += 1;
    }

    candidates.push({
      index: i,
      direction,
      low: zoneLow,
      high: zoneHigh,
      mid: (zoneLow + zoneHigh) / 2,
      quality,
      displacement_index: displacementIndex,
      volume_ratio: volumeRatio,
      freshness,
      valid: true
    });
  }

  candidates.sort((a, b) => {
    if (a.quality !== b.quality) {
      return b.quality - a.quality;
    }

    if (a.freshness !== b.freshness) {
      return a.freshness - b.freshness;
    }

    return b.index - a.index;
  });

  return candidates;
}

export function computeVolumeProfile(candles, startIndex, endIndex, binCount) {
  if (!candles || candles.length === 0) return null;
  if (startIndex < 0) startIndex = 0;
  if (endIndex >= candles.length) endIndex = candles.length - 1;
  if (startIndex >= endIndex) return null;

  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (let i = startIndex; i <= endIndex; i++) {
    const c = candles[i];
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  }

  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
    return null;
  }

  const range = maxPrice - minPrice;
  if (range <= 0) return null;

  const binSize = range / binCount;

  const bins = new Array(binCount).fill(0);
  const binLowPrices = new Array(binCount);
  const binHighPrices = new Array(binCount);

  for (let b = 0; b < binCount; b++) {
    binLowPrices[b] = minPrice + b * binSize;
    binHighPrices[b] = binLowPrices[b] + binSize;
  }

  for (let i = startIndex; i <= endIndex; i++) {
    const c = candles[i];
    const cLowV = c.low;
    const cHighV = c.high;
    const cCloseV = c.close;
    const cVolV = c.volume || 0;

    if (cVolV <= 0 || cHighV <= cLowV) continue;

    let startBin = Math.floor((cLowV - minPrice) / binSize);
    let endBin = Math.floor((cHighV - minPrice) / binSize);

    if (startBin < 0) startBin = 0;
    if (endBin >= binCount) endBin = binCount - 1;
    if (startBin > endBin) continue;

    let closeBin = Math.floor((cCloseV - minPrice) / binSize);
    if (closeBin < 0) closeBin = 0;
    if (closeBin >= binCount) closeBin = binCount - 1;

    const touchedBins = endBin - startBin + 1;

    if (touchedBins === 1) {
      bins[startBin] += cVolV;
      continue;
    }

    const closeWeight = 0.5;
    const otherWeight = (1 - closeWeight) / (touchedBins - 1);

    for (let b = startBin; b <= endBin; b++) {
      if (b === closeBin) {
        bins[b] += cVolV * closeWeight;
      } else {
        bins[b] += cVolV * otherWeight;
      }
    }
  }

  let pocIndex = 0;
  let pocVolume = bins[0];

  for (let b = 1; b < binCount; b++) {
    if (bins[b] > pocVolume) {
      pocVolume = bins[b];
      pocIndex = b;
    }
  }

  const totalVolume = bins.reduce((a, b) => a + b, 0);
  const valueAreaTarget = totalVolume * CONFIG.FRVP_VALUE_AREA;

  let vaVolume = bins[pocIndex];
  let vaLow = pocIndex;
  let vaHigh = pocIndex;

  while (
    vaVolume < valueAreaTarget &&
    (vaLow > 0 || vaHigh < binCount - 1)
  ) {
    const volBelow = vaLow > 0 ? bins[vaLow - 1] : -1;
    const volAbove = vaHigh < binCount - 1 ? bins[vaHigh + 1] : -1;

    if (volAbove > volBelow) {
      vaHigh++;
      vaVolume += volAbove;
    } else if (volBelow > 0) {
      vaLow--;
      vaVolume += volBelow;
    } else {
      break;
    }
  }

  return {
    minPrice,
    maxPrice,
    binSize,
    binCount,
    bins,
    binLowPrices,
    binHighPrices,
    poc: {
      index: pocIndex,
      price: (binLowPrices[pocIndex] + binHighPrices[pocIndex]) / 2,
      volume: pocVolume
    },
    valueArea: {
      low: binLowPrices[vaLow],
      high: binHighPrices[vaHigh],
      volume: vaVolume
    },
    totalVolume,
    vaLowIndex: vaLow,
    vaHighIndex: vaHigh
  };
}

export function extractVolumeNodes(profile, hvnThreshold, lvnThreshold) {
  if (!profile) return { hvn: [], lvn: [], poc: null };

  const { bins, binLowPrices, binHighPrices, poc } = profile;

  let maxVol = 0;
  for (let b = 0; b < bins.length; b++) {
    if (bins[b] > maxVol) maxVol = bins[b];
  }

  if (maxVol <= 0) return { hvn: [], lvn: [], poc };

  const hvn = [];
  const lvn = [];

  for (let b = 0; b < bins.length; b++) {
    const vol = bins[b];
    const ratio = vol / maxVol;

    const neighbors = [];
    if (b > 0) neighbors.push(bins[b - 1]);
    if (b < bins.length - 1) neighbors.push(bins[b + 1]);

    const avgNeighbor =
      neighbors.length > 0
        ? neighbors.reduce((a, c) => a + c, 0) / neighbors.length
        : 0;

    if (ratio >= hvnThreshold && vol >= avgNeighbor * 1.1) {
      hvn.push({
        index: b,
        price: (binLowPrices[b] + binHighPrices[b]) / 2,
        low: binLowPrices[b],
        high: binHighPrices[b],
        volume: vol,
        ratio
      });
    }

    if (ratio <= lvnThreshold && vol < avgNeighbor * 0.7) {
      lvn.push({
        index: b,
        price: (binLowPrices[b] + binHighPrices[b]) / 2,
        low: binLowPrices[b],
        high: binHighPrices[b],
        volume: vol,
        ratio
      });
    }
  }

  const mergeAdjacent = (nodes, maxGap) => {
    if (nodes.length === 0) return [];

    const merged = [];
    let current = { ...nodes[0] };

    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.index - current.index <= maxGap) {
        current.high = n.high;
        current.volume = current.volume + n.volume;
        current.ratio = Math.max(current.ratio, n.ratio);
        current.price = (current.low + current.high) / 2;
        current.index = n.index;
      } else {
        merged.push(current);
        current = { ...n };
      }
    }
    merged.push(current);

    return merged;
  };

  return {
    hvn: mergeAdjacent(hvn, 1),
    lvn: mergeAdjacent(lvn, 1),
    poc
  };
}

export function volumeNodesToLevels(candles, currentPrice, atrValue, count, lookbackBars) {
  if (!candles || candles.length < 50 || !atrValue || atrValue <= 0) {
    return { bullish: [], bearish: [], poc: null, valueArea: null };
  }

  const startIndex = Math.max(0, candles.length - lookbackBars);
  const endIndex = candles.length - 1;

  const profile = computeVolumeProfile(
    candles,
    startIndex,
    endIndex,
    CONFIG.FRVP_BIN_COUNT
  );

  if (!profile) {
    return { bullish: [], bearish: [], poc: null, valueArea: null };
  }

  const nodes = extractVolumeNodes(
    profile,
    CONFIG.FRVP_HVN_THRESHOLD,
    CONFIG.FRVP_LVN_THRESHOLD
  );

  const maxDistance = atrValue * CONFIG.FRVP_MAX_DISTANCE_ATR;
  const minDistance = atrValue * CONFIG.FRVP_MIN_DISTANCE_ATR;

  const supports = [];
  const resistances = [];

  for (const node of nodes.hvn) {
    const distance = Math.abs(node.price - currentPrice);

    if (distance > maxDistance) continue;
    if (distance < minDistance) continue;

    const item = {
      price: node.price,
      low: node.low,
      high: node.high,
      mid: node.price,
      volume: node.volume,
      ratio: node.ratio,
      distance,
      distanceAtr: distance / atrValue,
      source: "frvp_hvn"
    };

    if (node.price < currentPrice) {
      supports.push(item);
    } else {
      resistances.push(item);
    }
  }

  const pocDistance = Math.abs(profile.poc.price - currentPrice);
  if (pocDistance <= maxDistance && pocDistance >= minDistance) {
    const pocItem = {
      price: profile.poc.price,
      low: profile.poc.price - profile.binSize / 2,
      high: profile.poc.price + profile.binSize / 2,
      mid: profile.poc.price,
      volume: profile.poc.volume,
      ratio: 1.0,
      distance: pocDistance,
      distanceAtr: pocDistance / atrValue,
      source: "frvp_poc",
      isPoc: true
    };

    if (profile.poc.price < currentPrice) {
      supports.push(pocItem);
    } else {
      resistances.push(pocItem);
    }
  }

  const dedupe = (arr) => {
    const result = [];
    for (const item of arr) {
      let dup = false;
      for (const r of result) {
        if (Math.abs(r.mid - item.mid) / atrValue < 0.4) {
          dup = true;
          if (item.ratio > r.ratio) {
            Object.assign(r, item);
          }
          break;
        }
      }
      if (!dup) result.push(item);
    }
    return result;
  };

  const uniqueSupports = dedupe(supports);
  const uniqueResistances = dedupe(resistances);

  uniqueSupports.sort((a, b) => a.distance - b.distance);
  uniqueResistances.sort((a, b) => a.distance - b.distance);

  return {
    bullish: uniqueSupports.slice(0, count),
    bearish: uniqueResistances.slice(0, count),
    poc: profile.poc,
    valueArea: profile.valueArea,
    profile
  };
}

export function collectNearbyOrderBlocks(candles, swings, currentPrice, atrValue, count) {
  if (!candles || candles.length < 10 || !atrValue || atrValue <= 0) {
    return { bullish: [], bearish: [] };
  }

  const lookback = Math.min(
    candles.length - 5,
    CONFIG.OBS_DISPLAY_LOOKBACK
  );

  const startIndex = Math.max(2, candles.length - lookback);
  const bullishZones = [];
  const bearishZones = [];

  for (let i = candles.length - 3; i >= startIndex; i--) {
    const candle = candles[i];

    if (isBear(candle) && cBody(candle) > 0) {
      const maxForward = Math.min(candles.length - 1, i + 10);

      for (let j = i + 1; j <= maxForward; j++) {
        const future = candles[j];

        if (!isBull(future)) continue;

        const futureRange = cRange(future);
        if (futureRange <= 0) continue;

        const futureBodyRatio = cBody(future) / futureRange;
        const futureAvgVol = averageVolume(candles, j);
        const futureVolumeRatio =
          futureAvgVol > 0 ? cVol(future) / futureAvgVol : 1;

        const isDisp =
          futureRange >= atrValue * CONFIG.DISPLACEMENT_ATR &&
          futureBodyRatio >= CONFIG.DISPLACEMENT_BODY &&
          futureVolumeRatio >= CONFIG.DISPLACEMENT_VOLUME;

        if (!isDisp) continue;

        const zoneLow = cLow(candle);
        const zoneHigh = cHigh(candle);
        if (zoneHigh <= zoneLow) continue;

        if (cClose(future) <= zoneHigh) continue;

        let invalidated = false;
        for (let k = j + 1; k < candles.length; k++) {
          if (cClose(candles[k]) < zoneLow) {
            invalidated = true;
            break;
          }
        }
        if (invalidated) break;

        if (zoneHigh >= currentPrice) break;

        const volAvg = averageVolume(candles, i);
        const volumeRatio = volAvg > 0 ? cVol(candle) / volAvg : 1;
        const freshness = candles.length - 1 - i;
        const distance = currentPrice - zoneHigh;

        let quality = 0;
        if (volumeRatio >= 1.5) quality += 3;
        else if (volumeRatio >= 1.0) quality += 2;
        else quality += 1;

        if (freshness <= 10) quality += 3;
        else if (freshness <= 30) quality += 2;
        else quality += 1;

        if (futureVolumeRatio >= 1.5) quality += 2;
        else if (futureVolumeRatio >= 1.2) quality += 1;

        const distanceAtr = distance / atrValue;
        if (distanceAtr <= 3) quality += 2;
        else if (distanceAtr <= 5) quality += 1;

        bullishZones.push({
          index: i,
          direction: "bullish",
          low: zoneLow,
          high: zoneHigh,
          mid: (zoneLow + zoneHigh) / 2,
          quality,
          freshness,
          distance: distanceAtr,
          displacement_index: j
        });

        break;
      }
    }

    if (isBull(candle) && cBody(candle) > 0) {
      const maxForward = Math.min(candles.length - 1, i + 10);

      for (let j = i + 1; j <= maxForward; j++) {
        const future = candles[j];

        if (!isBear(future)) continue;

        const futureRange = cRange(future);
        if (futureRange <= 0) continue;

        const futureBodyRatio = cBody(future) / futureRange;
        const futureAvgVol = averageVolume(candles, j);
        const futureVolumeRatio =
          futureAvgVol > 0 ? cVol(future) / futureAvgVol : 1;

        const isDisp =
          futureRange >= atrValue * CONFIG.DISPLACEMENT_ATR &&
          futureBodyRatio >= CONFIG.DISPLACEMENT_BODY &&
          futureVolumeRatio >= CONFIG.DISPLACEMENT_VOLUME;

        if (!isDisp) continue;

        const zoneLow = cLow(candle);
        const zoneHigh = cHigh(candle);
        if (zoneHigh <= zoneLow) continue;

        if (cClose(future) >= zoneLow) continue;

        let invalidated = false;
        for (let k = j + 1; k < candles.length; k++) {
          if (cClose(candles[k]) > zoneHigh) {
            invalidated = true;
            break;
          }
        }
        if (invalidated) break;

        if (zoneLow <= currentPrice) break;

        const volAvg = averageVolume(candles, i);
        const volumeRatio = volAvg > 0 ? cVol(candle) / volAvg : 1;
        const freshness = candles.length - 1 - i;
        const distance = zoneLow - currentPrice;

        let quality = 0;
        if (volumeRatio >= 1.5) quality += 3;
        else if (volumeRatio >= 1.0) quality += 2;
        else quality += 1;

        if (freshness <= 10) quality += 3;
        else if (freshness <= 30) quality += 2;
        else quality += 1;

        if (futureVolumeRatio >= 1.5) quality += 2;
        else if (futureVolumeRatio >= 1.2) quality += 1;

        const distanceAtr = distance / atrValue;
        if (distanceAtr <= 3) quality += 2;
        else if (distanceAtr <= 5) quality += 1;

        bearishZones.push({
          index: i,
          direction: "bearish",
          low: zoneLow,
          high: zoneHigh,
          mid: (zoneLow + zoneHigh) / 2,
          quality,
          freshness,
          distance: distanceAtr,
          displacement_index: j
        });

        break;
      }
    }
  }

  const dedupe = (arr) => {
    const result = [];
    for (const item of arr) {
      let dup = false;

      for (const r of result) {
        if (
          Math.abs(r.mid - item.mid) / Math.max(atrValue, 1e-12) < 0.5
        ) {
          dup = true;
          break;
        }
      }

      if (!dup) result.push(item);
    }
    return result;
  };

  const uniqueBullish = dedupe(bullishZones);
  const uniqueBearish = dedupe(bearishZones);

  uniqueBullish.sort((a, b) => {
    if (Math.abs(a.distance - b.distance) > 0.5) {
      return a.distance - b.distance;
    }
    return b.quality - a.quality;
  });

  uniqueBearish.sort((a, b) => {
    if (Math.abs(a.distance - b.distance) > 0.5) {
      return a.distance - b.distance;
    }
    return b.quality - a.quality;
  });

  return {
    bullish: uniqueBullish.slice(0, count),
    bearish: uniqueBearish.slice(0, count)
  };
}

export function findNearestImportantNodeBelow(candles, currentPrice, swingLows, atrValue, maxLookback = CONFIG.SL_MARKET_STRUCTURE_LOOKBACK) {
  if (!candles || candles.length < 10) {
    return null;
  }

  const lookback = Math.min(
    candles.length - 1,
    maxLookback
  );

  const start = Math.max(0, candles.length - lookback);

  const belowZones = [];

  for (let i = start; i < candles.length - 1; i++) {
    const candle = candles[i];
    const high = cHigh(candle);

    if (high >= currentPrice) continue;

    const range = cRange(candle);
    if (range <= 0) continue;

    const body = cBody(candle);
    const bodyRatio = body / range;

    const upperWick = high - Math.max(cOpen(candle), cClose(candle));
    const lowerWick = Math.min(cOpen(candle), cClose(candle)) - cLow(candle);
    const upperWickRatio = upperWick / range;
    const lowerWickRatio = lowerWick / range;

    const avgVol = averageVolume(candles, i);
    const volumeRatio = avgVol > 0 ? cVol(candle) / avgVol : 1;

    const isRejection =
      (upperWickRatio >= 0.4 || lowerWickRatio >= 0.4) &&
      bodyRatio >= 0.2;

    const isDisplacement =
      range >= atrValue * CONFIG.DISPLACEMENT_ATR &&
      bodyRatio >= CONFIG.DISPLACEMENT_BODY &&
      volumeRatio >= CONFIG.DISPLACEMENT_VOLUME;

    const isSwing =
      swingLows &&
      swingLows.some(
        (s) => Math.abs(s.index - i) <= 2
      );

    if (isRejection || isDisplacement || isSwing) {
      const strength =
        (upperWickRatio + lowerWickRatio) * volumeRatio +
        (isDisplacement ? 2 : 0) +
        (isSwing ? 1.5 : 0);

      belowZones.push({
        index: i,
        high,
        low: cLow(candle),
        mid: (high + cLow(candle)) / 2,
        strength,
        isRejection,
        isDisplacement,
        isSwing,
        volumeRatio,
        range,
        bodyRatio,
        distance: currentPrice - high
      });
    }
  }

  if (belowZones.length === 0) {
    return null;
  }

  belowZones.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return b.strength - a.strength;
  });

  return belowZones[0];
}

export function findNearestImportantNodeAbove(candles, currentPrice, swingHighs, atrValue, maxLookback = CONFIG.SL_MARKET_STRUCTURE_LOOKBACK) {
  if (!candles || candles.length < 10) {
    return null;
  }

  const lookback = Math.min(
    candles.length - 1,
    maxLookback
  );

  const start = Math.max(0, candles.length - lookback);

  const aboveZones = [];

  for (let i = start; i < candles.length - 1; i++) {
    const candle = candles[i];
    const low = cLow(candle);

    if (low <= currentPrice) continue;

    const range = cRange(candle);
    if (range <= 0) continue;

    const body = cBody(candle);
    const bodyRatio = body / range;

    const upperWick = cHigh(candle) - Math.max(cOpen(candle), cClose(candle));
    const lowerWick = Math.min(cOpen(candle), cClose(candle)) - low;
    const upperWickRatio = upperWick / range;
    const lowerWickRatio = lowerWick / range;

    const avgVol = averageVolume(candles, i);
    const volumeRatio = avgVol > 0 ? cVol(candle) / avgVol : 1;

    const isRejection =
      (upperWickRatio >= 0.4 || lowerWickRatio >= 0.4) &&
      bodyRatio >= 0.2;

    const isDisplacement =
      range >= atrValue * CONFIG.DISPLACEMENT_ATR &&
      bodyRatio >= CONFIG.DISPLACEMENT_BODY &&
      volumeRatio >= CONFIG.DISPLACEMENT_VOLUME;

    const isSwing =
      swingHighs &&
      swingHighs.some(
        (s) => Math.abs(s.index - i) <= 2
      );

    if (isRejection || isDisplacement || isSwing) {
      const strength =
        (upperWickRatio + lowerWickRatio) * volumeRatio +
        (isDisplacement ? 2 : 0) +
        (isSwing ? 1.5 : 0);

      aboveZones.push({
        index: i,
        high: cHigh(candle),
        low,
        mid: (cHigh(candle) + low) / 2,
        strength,
        isRejection,
        isDisplacement,
        isSwing,
        volumeRatio,
        range,
        bodyRatio,
        distance: low - currentPrice
      });
    }
  }

  if (aboveZones.length === 0) {
    return null;
  }

  aboveZones.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return b.strength - a.strength;
  });

  return aboveZones[0];
}

export function applyStructureBuffer(level, direction, atrValue, currentPrice) {
  if (
    !Number.isFinite(level) ||
    !Number.isFinite(atrValue) ||
    atrValue <= 0 ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0
  ) {
    return level;
  }

  const atrBuffer = atrValue * CONFIG.TP_BUFFER_ATR_MULT;
  const pctBuffer = currentPrice * CONFIG.TP_BUFFER_MIN_PCT;
  const minBuffer = Math.max(atrBuffer, pctBuffer);
  const maxBuffer = currentPrice * CONFIG.TP_BUFFER_MAX_PCT;
  const buffer = Math.min(minBuffer, maxBuffer);

  return direction === "bearish"
    ? level + buffer
    : level - buffer;
}

export function applyPipBuffer(level, direction, currentPrice) {
  if (
    !Number.isFinite(level) ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0
  ) {
    return level;
  }

  const pipBuffer = currentPrice * CONFIG.TP_PIP_BUFFER_PCT;

  if (direction === "bearish") {
    return level + pipBuffer;
  }

  return level - pipBuffer;
}

export function detectCounterMomentum(candles, direction, currentIndex, currentPrice, timeframe) {
  if (!candles || candles.length < 20 || !Number.isFinite(currentIndex)) {
    return { warning: false, reason: null, severe: false };
  }

  const currentCandle = candles[currentIndex];

  if (!currentCandle) {
    return { warning: false, reason: null, severe: false };
  }

  const range = cRange(currentCandle);
  const body = cBody(currentCandle);

  if (!Number.isFinite(range) || range <= 0) {
    return { warning: false, reason: null, severe: false };
  }

  const bodyRatio = body / range;
  const rsiValue = rsiCalc(candles);
  const emaTrend = emaTrendCalc(candles);

  const reasons = [];
  let warningLevel = 0;

  if (direction === "bearish") {
    if (
      isBull(currentCandle) &&
      bodyRatio >= CONFIG.MOMENTUM_WARNING_BODY_RATIO
    ) {
      reasons.push("کندل جاری صعودی قوی");
      warningLevel += 1;
    }

    if (
      Number.isFinite(rsiValue) &&
      rsiValue >= CONFIG.MOMENTUM_RSI_OVERBOUGHT
    ) {
      reasons.push("RSI در ناحیه اشباع خرید");
      warningLevel += 1;
    }

    if (
      emaTrend &&
      emaTrend.trend === "bullish" &&
      emaTrend.price_side === "bullish"
    ) {
      reasons.push("EMA و قیمت هم‌جهت صعودی");
      warningLevel += 1;
    }
  } else if (direction === "bullish") {
    if (
      isBear(currentCandle) &&
      bodyRatio >= CONFIG.MOMENTUM_WARNING_BODY_RATIO
    ) {
      reasons.push("کندل جاری نزولی قوی");
      warningLevel += 1;
    }

    if (
      Number.isFinite(rsiValue) &&
      rsiValue <= CONFIG.MOMENTUM_RSI_OVERSOLD
    ) {
      reasons.push("RSI در ناحیه اشباع فروش");
      warningLevel += 1;
    }

    if (
      emaTrend &&
      emaTrend.trend === "bearish" &&
      emaTrend.price_side === "bearish"
    ) {
      reasons.push("EMA و قیمت هم‌جهت نزولی");
      warningLevel += 1;
    }
  }

  if (reasons.length === 0) {
    return { warning: false, reason: null, severe: false };
  }

  const profile = TIMEFRAME_PROFILES[timeframe] || TIMEFRAME_PROFILES["1h"];
  const severe = warningLevel >= 3 && profile.strictHTF;

  return {
    warning: true,
    reason: reasons.join(" + "),
    severe: severe,
    warningLevel: warningLevel
  };
}

export function collectImportantLevelsForTP(candles, direction, entry, atrValue, maxLevels = 6) {
  if (!candles || candles.length < 20 || entry <= 0) {
    return [];
  }

  const currentIndex = candles.length - 1;
  const lookbackBars = Math.min(
    candles.length - 2,
    CONFIG.TP_STRUCTURE_LOOKBACK_BARS
  );

  const start = Math.max(2, candles.length - lookbackBars);
  const minGap = Math.max(1, CONFIG.TP_MIN_STRUCTURE_GAP_BARS);

  const swings = detectSwings(candles);

  const levels = [];
  const seen = new Set();

  const addLevel = (price, source, index, priority) => {
    if (!Number.isFinite(price) || price <= 0) return;

    if (direction === "bullish" && price <= entry) return;
    if (direction === "bearish" && price >= entry) return;

    const key = Math.round(price * 1e12) / 1e12;
    if (seen.has(key)) return;
    seen.add(key);

    levels.push({
      price,
      source,
      index: Number.isFinite(index) ? index : null,
      priority
    });
  };

  if (direction === "bullish") {
    for (const swing of swings.highs || []) {
      if (!isSwingConfirmed(swing, currentIndex)) continue;
      if (swing.index < start) continue;
      if (swing.price <= entry) continue;

      addLevel(swing.price, "swing_high", swing.index, 1);
    }

    for (let i = start; i <= currentIndex; i++) {
      const h = cHigh(candles[i]);
      if (!Number.isFinite(h)) continue;
      if (h <= entry) continue;

      let isLocalHigh = true;
      for (let j = Math.max(0, i - minGap); j <= Math.min(currentIndex, i + minGap); j++) {
        if (j === i) continue;
        if (cHigh(candles[j]) >= h) {
          isLocalHigh = false;
          break;
        }
      }

      if (isLocalHigh) {
        addLevel(h, "local_high", i, 2);
      }
    }
  } else {
    for (const swing of swings.lows || []) {
      if (!isSwingConfirmed(swing, currentIndex)) continue;
      if (swing.index < start) continue;
      if (swing.price >= entry) continue;

      addLevel(swing.price, "swing_low", swing.index, 1);
    }

    for (let i = start; i <= currentIndex; i++) {
      const l = cLow(candles[i]);
      if (!Number.isFinite(l)) continue;
      if (l >= entry) continue;

      let isLocalLow = true;
      for (let j = Math.max(0, i - minGap); j <= Math.min(currentIndex, i + minGap); j++) {
        if (j === i) continue;
        if (cLow(candles[j]) <= l) {
          isLocalLow = false;
          break;
        }
      }

      if (isLocalLow) {
        addLevel(l, "local_low", i, 2);
      }
    }
  }

  levels.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;

    if (direction === "bullish") {
      return a.price - b.price;
    }

    return b.price - a.price;
  });

  const result = [];
  const spacing = atrValue > 0
    ? Math.max(atrValue * CONFIG.MIN_TP_DISTANCE_ATR, entry * CONFIG.MIN_TP_DISTANCE)
    : entry * CONFIG.MIN_TP_DISTANCE;

  for (const level of levels) {
    let tooClose = false;

    for (const existing of result) {
      if (Math.abs(existing.price - level.price) < spacing) {
        tooClose = true;
        break;
      }
    }

    if (tooClose) continue;

    result.push(level);

    if (result.length >= maxLevels) break;
  }

  return result;
}

export function computeUnifiedTargets(candles, direction, entry, stop, atrValue, currentPrice, minRR) {
  const emptyResult = {
    targets: [],
    tp1: null,
    tp2: null,
    tp3: null,
    tp4: null,
    rr1: 0,
    rr2: 0,
    rr3: 0,
    rr4: 0,
    tp1Source: null,
    tp2Source: null,
    tp3Source: null,
    tp4Source: null,
    tpCount: 0
  };

  if (
    !candles ||
    !Number.isFinite(entry) ||
    !Number.isFinite(stop) ||
    entry <= 0 ||
    stop <= 0
  ) {
    return emptyResult;
  }

  const risk = Math.abs(entry - stop);
  if (!Number.isFinite(risk) || risk <= 0) {
    return emptyResult;
  }

  const riskDirection = direction === "bullish" ? entry - stop : stop - entry;
  if (!Number.isFinite(riskDirection) || riskDirection <= 0) {
    return emptyResult;
  }

  const maxLevels = Math.max(
    CONFIG.MIN_VALID_TP_COUNT,
    Math.min(CONFIG.MAX_VALID_TP_COUNT + 2, 8)
  );

  const levels = collectImportantLevelsForTP(
    candles,
    direction,
    entry,
    atrValue,
    maxLevels
  );

  if (!levels.length) {
    return emptyResult;
  }

  const effectiveMinRR = Number.isFinite(minRR) ? minRR : (Number.isFinite(CONFIG.MIN_RR) ? CONFIG.MIN_RR : 1.6);
  const maxRR = Number.isFinite(CONFIG.MAX_TP_RR) ? CONFIG.MAX_TP_RR : 3;
  const maxDistanceFromAtr = atrValue * 4.5;

  const spacing = atrValue > 0
    ? Math.max(atrValue * CONFIG.MIN_TP_DISTANCE_ATR, currentPrice * CONFIG.MIN_TP_DISTANCE)
    : currentPrice * CONFIG.MIN_TP_DISTANCE;

  const candidates = [];

  const tp1MinRR = Number.isFinite(CONFIG.TP1_MIN_RR) ? CONFIG.TP1_MIN_RR : 0.5;

  for (const level of levels) {
    const adjusted = applyPipBuffer(level.price, direction, currentPrice);

    if (!Number.isFinite(adjusted)) continue;

    if (direction === "bullish" && adjusted <= entry) continue;
    if (direction === "bearish" && adjusted >= entry) continue;

    if (direction === "bullish" && adjusted <= currentPrice) continue;
    if (direction === "bearish" && adjusted >= currentPrice) continue;

    const distance = Math.abs(adjusted - entry);
    if (distance <= 0) continue;

    const rr = distance / risk;

    const isFirstCandidate = candidates.length === 0;
    const requiredRR = isFirstCandidate ? tp1MinRR : effectiveMinRR;

    if (!Number.isFinite(rr) || rr < requiredRR) continue;
    if (rr > maxRR) continue;
    if (distance > maxDistanceFromAtr) continue;

    candidates.push({
      price: adjusted,
      rawPrice: level.price,
      source: level.source,
      rr,
      distance,
      priority: level.priority
    });
  }

  if (!candidates.length) {
    return emptyResult;
  }

  candidates.sort((a, b) => {
    return a.distance - b.distance;
  });

  const selected = [];

  for (const candidate of candidates) {
    let tooClose = false;

    for (const existing of selected) {
      if (Math.abs(existing.price - candidate.price) < spacing) {
        tooClose = true;
        break;
      }
    }

    if (tooClose) continue;

    selected.push(candidate);

    if (selected.length >= CONFIG.MAX_VALID_TP_COUNT) break;
  }

  if (selected.length < CONFIG.MIN_VALID_TP_COUNT) {
    return emptyResult;
  }

  selected.sort((a, b) => {
    if (direction === "bullish") return a.price - b.price;
    return b.price - a.price;
  });

  const result = {
    targets: selected,
    tp1: selected[0] ? selected[0].price : null,
    tp2: selected[1] ? selected[1].price : null,
    tp3: selected[2] ? selected[2].price : null,
    tp4: selected[3] ? selected[3].price : null,
    rr1: selected[0] ? selected[0].rr : 0,
    rr2: selected[1] ? selected[1].rr : 0,
    rr3: selected[2] ? selected[2].rr : 0,
    rr4: selected[3] ? selected[3].rr : 0,
    tp1Source: selected[0] ? selected[0].source : null,
    tp2Source: selected[1] ? selected[1].source : null,
    tp3Source: selected[2] ? selected[2].source : null,
    tp4Source: selected[3] ? selected[3].source : null,
    tpCount: selected.length
  };

  return result;
}

export function computeUnifiedStop(candles, direction, entryZone, atrValue, swingLows, swingHighs, currentPrice) {
  if (
    !candles ||
    !entryZone ||
    !Number.isFinite(entryZone.low) ||
    !Number.isFinite(entryZone.high)
  ) {
    return null;
  }

  const slAtrBuffer = Number.isFinite(CONFIG.SL_ATR_BUFFER)
    ? Math.max(0, CONFIG.SL_ATR_BUFFER)
    : 0.2;

  const minNodeDistanceATR =
    Number.isFinite(CONFIG.SL_MIN_NODE_DISTANCE_ATR) &&
    CONFIG.SL_MIN_NODE_DISTANCE_ATR > 0
      ? Math.max(0.3, CONFIG.SL_MIN_NODE_DISTANCE_ATR)
      : 0.5;

  if (direction === "bullish") {
    const node = findNearestImportantNodeBelow(
      candles,
      entryZone.low,
      swingLows,
      atrValue
    );

    if (
      node &&
      Number.isFinite(node.high) &&
      node.high < entryZone.low
    ) {
      const distance = entryZone.low - node.high;
      const minDistance = atrValue * minNodeDistanceATR;

      if (distance >= minDistance) {
        const buffer = currentPrice > 0
          ? currentPrice * CONFIG.SL_PIP_BUFFER_PCT
          : 0;

        return node.high - buffer;
      }
    }

    return entryZone.low - atrValue * slAtrBuffer;
  }

  const node = findNearestImportantNodeAbove(
    candles,
    entryZone.high,
    swingHighs,
    atrValue
  );

  if (
    node &&
    Number.isFinite(node.low) &&
    node.low > entryZone.high
  ) {
    const distance = node.low - entryZone.high;
    const minDistance = atrValue * minNodeDistanceATR;

    if (distance >= minDistance) {
      const buffer = currentPrice > 0
        ? currentPrice * CONFIG.SL_PIP_BUFFER_PCT
        : 0;

      return node.low + buffer;
    }
  }

  return entryZone.high + atrValue * slAtrBuffer;
}

export function detectRangeTradeSetups(
  candles,
  currentPrice,
  atrValue,
  bullishBreakout,
  bearishBreakdown,
  swings = null,
  timeframe = "1h"
) {
  const emptyResult = {
    bullish: [],
    bearish: [],
    active: null,
    breakout: {
      bullish: false,
      bearish: false,
      direction: null,
      level: null,
      index: null,
      confirmed: false
    }
  };

  const profile =
    TIMEFRAME_PROFILES[timeframe] ||
    TIMEFRAME_PROFILES["1h"];

  if (
    !Array.isArray(candles) ||
    candles.length < 50 ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    !Number.isFinite(atrValue) ||
    atrValue <= 0 ||
    !Number.isFinite(bullishBreakout) ||
    !Number.isFinite(bearishBreakdown) ||
    bullishBreakout <= bearishBreakdown
  ) {
    return emptyResult;
  }

  const currentIndex = candles.length - 1;
  const previousIndex = currentIndex - 1;

  const currentCandle = candles[currentIndex];
  const previousCandle = candles[previousIndex];

  if (!currentCandle || !previousCandle) {
    return emptyResult;
  }

  const currentClose = cClose(currentCandle);
  const previousClose = cClose(previousCandle);
  const currentHigh = cHigh(currentCandle);
  const currentLow = cLow(currentCandle);

  if (
    !Number.isFinite(currentClose) ||
    !Number.isFinite(previousClose) ||
    !Number.isFinite(currentHigh) ||
    !Number.isFinite(currentLow) ||
    currentHigh < currentLow
  ) {
    return emptyResult;
  }

  const displacementAtr =
    Number.isFinite(CONFIG.DISPLACEMENT_ATR) &&
    CONFIG.DISPLACEMENT_ATR > 0
      ? CONFIG.DISPLACEMENT_ATR
      : 1;

  const displacementBody =
    Number.isFinite(CONFIG.DISPLACEMENT_BODY) &&
    CONFIG.DISPLACEMENT_BODY > 0
      ? CONFIG.DISPLACEMENT_BODY
      : 0.55;

  const displacementVolume =
    Number.isFinite(CONFIG.DISPLACEMENT_VOLUME) &&
    CONFIG.DISPLACEMENT_VOLUME > 0
      ? CONFIG.DISPLACEMENT_VOLUME
      : 1.05;

  const slAtrBuffer =
    Number.isFinite(CONFIG.SL_ATR_BUFFER) &&
    CONFIG.SL_ATR_BUFFER >= 0
      ? CONFIG.SL_ATR_BUFFER
      : 0.2;

  const sweepRejection =
    Number.isFinite(CONFIG.SWEEP_MIN_REJECTION) &&
    CONFIG.SWEEP_MIN_REJECTION > 0
      ? CONFIG.SWEEP_MIN_REJECTION
      : 0.25;

  const sweepZoneDistanceAtr =
    Number.isFinite(CONFIG.SWEEP_ZONE_DISTANCE_ATR) &&
    CONFIG.SWEEP_ZONE_DISTANCE_ATR > 0
      ? CONFIG.SWEEP_ZONE_DISTANCE_ATR
      : 1.25;

  const sweepMaxDistanceAtr =
    Number.isFinite(CONFIG.SWEEP_MAX_EVENT_DISTANCE_ATR) &&
    CONFIG.SWEEP_MAX_EVENT_DISTANCE_ATR > 0
      ? CONFIG.SWEEP_MAX_EVENT_DISTANCE_ATR
      : 1.5;

  const scenarioSwingLookback =
    Number.isFinite(CONFIG.SCENARIO_SWING_LOOKBACK) &&
    CONFIG.SCENARIO_SWING_LOOKBACK > 0
      ? Math.trunc(CONFIG.SCENARIO_SWING_LOOKBACK)
      : 30;

  const sweepLookbackConfig =
    Number.isFinite(CONFIG.SWEEP_LOOKBACK) &&
    CONFIG.SWEEP_LOOKBACK > 0
      ? Math.trunc(CONFIG.SWEEP_LOOKBACK)
      : 20;

  const minSetupScore =
    Number.isFinite(CONFIG.MIN_RANGE_SETUP_SCORE)
      ? CONFIG.MIN_RANGE_SETUP_SCORE
      : 8;

  const minRR =
    Number.isFinite(profile.minRR) &&
    profile.minRR > 0
      ? profile.minRR
      : Number.isFinite(CONFIG.MIN_RR) &&
          CONFIG.MIN_RR > 0
        ? CONFIG.MIN_RR
        : 1.6;

  const maxTPRR =
    Number.isFinite(CONFIG.MAX_TP_RR) &&
    CONFIG.MAX_TP_RR > 0
      ? CONFIG.MAX_TP_RR
      : 3;

  const minTPDistanceATR =
    Number.isFinite(CONFIG.MIN_TP_DISTANCE_ATR) &&
    CONFIG.MIN_TP_DISTANCE_ATR > 0
      ? CONFIG.MIN_TP_DISTANCE_ATR
      : 0.45;

  const minTPDistancePct =
    Number.isFinite(CONFIG.MIN_TP_DISTANCE) &&
    CONFIG.MIN_TP_DISTANCE > 0
      ? CONFIG.MIN_TP_DISTANCE
      : 0.005;

  const minValidTPCount =
    Number.isFinite(CONFIG.MIN_VALID_TP_COUNT)
      ? Math.max(
          1,
          Math.min(
            5,
            Math.trunc(CONFIG.MIN_VALID_TP_COUNT)
          )
        )
      : 1;

  const maxValidTPCount =
    Number.isFinite(CONFIG.MAX_VALID_TP_COUNT)
      ? Math.max(
          minValidTPCount,
          Math.min(
            5,
            Math.trunc(CONFIG.MAX_VALID_TP_COUNT)
          )
        )
      : 5;

  const obsDisplayCount =
    Number.isFinite(CONFIG.OBS_DISPLAY_COUNT) &&
    CONFIG.OBS_DISPLAY_COUNT > 0
      ? Math.trunc(CONFIG.OBS_DISPLAY_COUNT)
      : 2;

  const maxSetupAge = 100;

  const externalFreshness =
    Number.isFinite(CONFIG.RANGE_EXTERNAL_FRESHNESS)
      ? Math.max(10, Math.trunc(CONFIG.RANGE_EXTERNAL_FRESHNESS))
      : Math.max(maxSetupAge * 3, 100);

  const lifecycleToleranceAtr =
    Number.isFinite(CONFIG.RANGE_LIFECYCLE_TOLERANCE_ATR)
      ? Math.max(0.05, CONFIG.RANGE_LIFECYCLE_TOLERANCE_ATR)
      : 0.15;

  const lifecycleMinRemainingR =
    Number.isFinite(CONFIG.RANGE_LIFECYCLE_MIN_REMAINING_R)
      ? Math.max(0.1, CONFIG.RANGE_LIFECYCLE_MIN_REMAINING_R)
      : 0.5;

  const maxStopPct =
    Number.isFinite(CONFIG.MAX_SL_PCT) &&
    CONFIG.MAX_SL_PCT > 0
      ? CONFIG.MAX_SL_PCT
      : Infinity;

  const rangeHigh = bullishBreakout;
  const rangeLow = bearishBreakdown;
  const rangeSize = rangeHigh - rangeLow;

  if (
    !Number.isFinite(rangeSize) ||
    rangeSize <= 0
  ) {
    return emptyResult;
  }

  const rangePosition =
    ((currentPrice - rangeLow) / rangeSize) * 100;

  const closeBuffer = Math.max(
    atrValue * 0.02,
    currentPrice * 0.0001
  );

  const bullishBreakConfirmed =
    previousClose <= rangeHigh &&
    currentClose > rangeHigh + closeBuffer;

  const bearishBreakConfirmed =
    previousClose >= rangeLow &&
    currentClose < rangeLow - closeBuffer;

  const bullishBreakDetected =
    bullishBreakConfirmed ||
    (
      previousClose <= rangeHigh &&
      currentHigh > rangeHigh &&
      currentClose >= rangeHigh
    );

  const bearishBreakDetected =
    bearishBreakConfirmed ||
    (
      previousClose >= rangeLow &&
      currentLow < rangeLow &&
      currentClose <= rangeLow
    );

  if (
    bullishBreakDetected ||
    bearishBreakDetected
  ) {
    return {
      bullish: [],
      bearish: [],
      active: null,
      breakout: {
        bullish: bullishBreakDetected,
        bearish: bearishBreakDetected,
        direction:
          bullishBreakDetected && !bearishBreakDetected
            ? "bullish"
            : bearishBreakDetected && !bullishBreakDetected
              ? "bearish"
              : "both",
        level:
          bullishBreakDetected && !bearishBreakDetected
            ? rangeHigh
            : bearishBreakDetected && !bullishBreakDetected
              ? rangeLow
              : null,
        index: currentIndex,
        confirmed:
          bullishBreakConfirmed || bearishBreakConfirmed,
        previousClose,
        currentClose
      }
    };
  }

  if (
    currentPrice >= rangeHigh ||
    currentPrice <= rangeLow
  ) {
    return emptyResult;
  }

  const bullishZones = [];
  const bearishZones = [];

  const nearbyOBs =
    collectNearbyOrderBlocks(
      candles,
      swings,
      currentPrice,
      atrValue,
      Math.max(obsDisplayCount, 4)
    ) || {};

  const bullishOBs =
    Array.isArray(nearbyOBs.bullish)
      ? nearbyOBs.bullish
      : [];

  const bearishOBs =
    Array.isArray(nearbyOBs.bearish)
      ? nearbyOBs.bearish
      : [];

  const scenarioLookback = Math.max(
    5,
    Math.min(candles.length - 5, scenarioSwingLookback)
  );

  const recentStart = Math.max(
    2,
    candles.length - scenarioLookback
  );

  const sweepLookback = Math.max(
    5,
    Math.min(candles.length - 2, sweepLookbackConfig)
  );

  const displacementWindow = 5;

  function distanceToAtr(price) {
    return Number.isFinite(price)
      ? Math.abs(currentPrice - price) / atrValue
      : Infinity;
  }

  function isInsideRange(price) {
    return (
      Number.isFinite(price) &&
      price > rangeLow &&
      price < rangeHigh
    );
  }

  function getSwingIndex(item) {
    if (!item || !Number.isFinite(item.index)) {
      return null;
    }

    const index = Math.trunc(item.index);

    return index >= 0 && index < candles.length
      ? index
      : null;
  }

  function getSwingPrice(item, direction) {
    if (!item) {
      return null;
    }

    const candidates =
      direction === "bullish"
        ? [item.low, item.price, item.value]
        : [item.high, item.price, item.value];

    for (const value of candidates) {
      if (Number.isFinite(value)) {
        return value;
      }
    }

    const index = getSwingIndex(item);

    if (index === null) {
      return null;
    }

    return direction === "bullish"
      ? cLow(candles[index])
      : cHigh(candles[index]);
  }

  function getSwingType(item) {
    return String(
      item?.type ||
      item?.kind ||
      item?.direction ||
      item?.swingType ||
      ""
    ).toLowerCase();
  }

  function isSwingLow(item) {
    const type = getSwingType(item);

    if (
      type.includes("low") ||
      type === "l" ||
      type.includes("support")
    ) {
      return true;
    }

    if (
      type.includes("high") ||
      type === "h" ||
      type.includes("resistance")
    ) {
      return false;
    }

    return (
      Number.isFinite(item?.low) &&
      !Number.isFinite(item?.high)
    );
  }

  function isSwingHigh(item) {
    const type = getSwingType(item);

    if (
      type.includes("high") ||
      type === "h" ||
      type.includes("resistance")
    ) {
      return true;
    }

    if (
      type.includes("low") ||
      type === "l" ||
      type.includes("support")
    ) {
      return false;
    }

    return (
      Number.isFinite(item?.high) &&
      !Number.isFinite(item?.low)
    );
  }

  function getNormalizedSwings(direction) {
    const result = [];

    if (!swings || typeof swings !== "object") {
      return result;
    }

    const list =
      direction === "bullish"
        ? swings.lows
        : swings.highs;

    if (!Array.isArray(list)) {
      return result;
    }

    for (const swing of list) {
      const index = getSwingIndex(swing);

      if (index === null) {
        continue;
      }

      if (
        direction === "bullish" && !isSwingLow(swing)
      ) {
        continue;
      }

      if (
        direction === "bearish" && !isSwingHigh(swing)
      ) {
        continue;
      }

      const price = getSwingPrice(swing, direction);

      if (
        !Number.isFinite(price) ||
        index < recentStart ||
        index >= currentIndex
      ) {
        continue;
      }

      result.push({ index, price });
    }

    result.sort((a, b) => a.index - b.index);

    return result;
  }

  function detectLocalSwingLevels(direction) {
    const result = [];
    const left = 2;
    const right = 2;

    const start = Math.max(recentStart, left);
    const end = Math.min(
      candles.length - right - 1,
      currentIndex - 1
    );

    for (let i = start; i <= end; i++) {
      const value =
        direction === "bullish"
          ? cLow(candles[i])
          : cHigh(candles[i]);

      if (!Number.isFinite(value)) {
        continue;
      }

      let valid = true;

      for (let j = 1; j <= left; j++) {
        const neighbor =
          direction === "bullish"
            ? cLow(candles[i - j])
            : cHigh(candles[i - j]);

        if (
          !Number.isFinite(neighbor) ||
          (
            direction === "bullish"
              ? neighbor <= value
              : neighbor >= value
          )
        ) {
          valid = false;
          break;
        }
      }

      if (!valid) {
        continue;
      }

      for (let j = 1; j <= right; j++) {
        const neighbor =
          direction === "bullish"
            ? cLow(candles[i + j])
            : cHigh(candles[i + j]);

        if (
          !Number.isFinite(neighbor) ||
          (
            direction === "bullish"
              ? neighbor <= value
              : neighbor >= value
          )
        ) {
          valid = false;
          break;
        }
      }

      if (valid) {
        result.push({
          index: i,
          price: value
        });
      }
    }

    return result;
  }

  function getStructureLevels(direction) {
    const explicit = getNormalizedSwings(direction);

    return explicit.length
      ? explicit
      : detectLocalSwingLevels(direction);
  }

  const swingLows = getStructureLevels("bullish");
  const swingHighs = getStructureLevels("bearish");

  function getNearestSupport() {
    let result = null;

    function consider(price, index, source) {
      if (
        !isInsideRange(price) ||
        price >= currentPrice
      ) {
        return;
      }

      if (!result || price > result.price) {
        result = { price, index, source };
      }
    }

    for (let i = recentStart; i < currentIndex; i++) {
      consider(cLow(candles[i]), i, "support");
    }

    for (const swing of swingLows) {
      consider(
        swing.price,
        swing.index,
        "swing_support"
      );
    }

    return result;
  }

  function getNearestResistance() {
    let result = null;

    function consider(price, index, source) {
      if (
        !isInsideRange(price) ||
        price <= currentPrice
      ) {
        return;
      }

      if (!result || price < result.price) {
        result = { price, index, source };
      }
    }

    for (let i = recentStart; i < currentIndex; i++) {
      consider(cHigh(candles[i]), i, "resistance");
    }

    for (const swing of swingHighs) {
      consider(
        swing.price,
        swing.index,
        "swing_resistance"
      );
    }

    return result;
  }

  function findMatchingSwing(list, zonePrice, index) {
    let best = null;
    let bestDistance = Infinity;

    for (let i = list.length - 1; i >= 0; i--) {
      const swing = list[i];

      if (swing.index > index) {
        continue;
      }

      const distance = Math.abs(swing.price - zonePrice);

      if (distance > atrValue * sweepZoneDistanceAtr) {
        continue;
      }

      if (distance < bestDistance) {
        best = swing;
        bestDistance = distance;
      }
    }

    return best;
  }

  function detectBullishSweep(zonePrice) {
    if (!Number.isFinite(zonePrice)) {
      return null;
    }

    const start = Math.max(2, currentIndex - sweepLookback);
    let best = null;

    for (let i = start; i < currentIndex - 1; i++) {
      const candle = candles[i];
      const low = cLow(candle);

      if (!Number.isFinite(low) || low >= zonePrice) {
        continue;
      }

      const next = candles[i + 1];
      const nextOpen = cOpen(next);
      const nextClose = cClose(next);

      if (
        !Number.isFinite(nextOpen) ||
        !Number.isFinite(nextClose) ||
        nextClose <= zonePrice ||
        nextClose <= nextOpen
      ) {
        continue;
      }

      const matchingSwing = findMatchingSwing(
        swingLows,
        zonePrice,
        i
      );

      const referencePrice = matchingSwing
        ? matchingSwing.price
        : zonePrice;

      if (
        !Number.isFinite(referencePrice) ||
        low >= referencePrice
      ) {
        continue;
      }

      const candleRange = cRange(candle);

      if (
        !Number.isFinite(candleRange) ||
        candleRange <= 0
      ) {
        continue;
      }

      const rejection = nextClose - low;

      if (rejection / candleRange < sweepRejection) {
        continue;
      }

      const distance =
        Math.abs(referencePrice - zonePrice) / atrValue;

      if (distance > sweepMaxDistanceAtr) {
        continue;
      }

      const candidate = {
        index: i,
        confirmationIndex: i + 1,
        price: low,
        referencePrice,
        swingIndex: matchingSwing
          ? matchingSwing.index
          : null,
        distance_atr: distance
      };

      if (!best || candidate.index > best.index) {
        best = candidate;
      }
    }

    return best;
  }

  function detectBearishSweep(zonePrice) {
    if (!Number.isFinite(zonePrice)) {
      return null;
    }

    const start = Math.max(2, currentIndex - sweepLookback);
    let best = null;

    for (let i = start; i < currentIndex - 1; i++) {
      const candle = candles[i];
      const high = cHigh(candle);

      if (!Number.isFinite(high) || high <= zonePrice) {
        continue;
      }

      const next = candles[i + 1];
      const nextOpen = cOpen(next);
      const nextClose = cClose(next);

      if (
        !Number.isFinite(nextOpen) ||
        !Number.isFinite(nextClose) ||
        nextClose >= zonePrice ||
        nextClose >= nextOpen
      ) {
        continue;
      }

      const matchingSwing = findMatchingSwing(
        swingHighs,
        zonePrice,
        i
      );

      const referencePrice = matchingSwing
        ? matchingSwing.price
        : zonePrice;

      if (
        !Number.isFinite(referencePrice) ||
        high <= referencePrice
      ) {
        continue;
      }

      const candleRange = cRange(candle);

      if (
        !Number.isFinite(candleRange) ||
        candleRange <= 0
      ) {
        continue;
      }

      const rejection = high - nextClose;

      if (rejection / candleRange < sweepRejection) {
        continue;
      }

      const distance =
        Math.abs(referencePrice - zonePrice) / atrValue;

      if (distance > sweepMaxDistanceAtr) {
        continue;
      }

      const candidate = {
        index: i,
        confirmationIndex: i + 1,
        price: high,
        referencePrice,
        swingIndex: matchingSwing
          ? matchingSwing.index
          : null,
        distance_atr: distance
      };

      if (!best || candidate.index > best.index) {
        best = candidate;
      }
    }

    return best;
  }

  function detectBullishReaction(index) {
    if (
      !Number.isFinite(index) ||
      index < 0 ||
      index >= currentIndex
    ) {
      return false;
    }

    const candle = candles[index];
    const range = cRange(candle);

    if (!Number.isFinite(range) || range <= 0) {
      return false;
    }

    const open = cOpen(candle);
    const close = cClose(candle);
    const low = cLow(candle);

    if (
      !Number.isFinite(open) ||
      !Number.isFinite(close) ||
      !Number.isFinite(low)
    ) {
      return false;
    }

    const lowerWick = Math.min(open, close) - low;
    const closePosition = (close - low) / range;
    const bodyRatio = cBody(candle) / range;
    const lowerWickRatio = lowerWick / range;

    return (
      (
        isBull(candle) &&
        bodyRatio >= 0.45 &&
        closePosition >= 0.65
      ) ||
      (
        lowerWickRatio >= 0.35 &&
        closePosition >= 0.55
      )
    );
  }

  function detectBearishReaction(index) {
    if (
      !Number.isFinite(index) ||
      index < 0 ||
      index >= currentIndex
    ) {
      return false;
    }

    const candle = candles[index];
    const range = cRange(candle);

    if (!Number.isFinite(range) || range <= 0) {
      return false;
    }

    const open = cOpen(candle);
    const close = cClose(candle);
    const high = cHigh(candle);

    if (
      !Number.isFinite(open) ||
      !Number.isFinite(close) ||
      !Number.isFinite(high)
    ) {
      return false;
    }

    const upperWick = high - Math.max(open, close);
    const closePosition = (high - close) / range;
    const bodyRatio = cBody(candle) / range;
    const upperWickRatio = upperWick / range;

    return (
      (
        isBear(candle) &&
        bodyRatio >= 0.45 &&
        closePosition >= 0.65
      ) ||
      (
        upperWickRatio >= 0.35 &&
        closePosition >= 0.55
      )
    );
  }

  function isValidDisplacement(candle, direction, index) {
    if (
      !candle ||
      !Number.isFinite(index) ||
      index < 0 ||
      index >= currentIndex
    ) {
      return null;
    }

    const range = cRange(candle);

    if (!Number.isFinite(range) || range <= 0) {
      return null;
    }

    if (
      direction === "bullish" && !isBull(candle)
    ) {
      return null;
    }

    if (
      direction === "bearish" && !isBear(candle)
    ) {
      return null;
    }

    const bodyRatio = cBody(candle) / range;
    const avgVol = averageVolume(candles, index);
    const volume = cVol(candle);

    const volumeRatio =
      Number.isFinite(avgVol) &&
      avgVol > 0 &&
      Number.isFinite(volume)
        ? volume / avgVol
        : 1;

    if (
      range < atrValue * displacementAtr ||
      bodyRatio < displacementBody ||
      volumeRatio < displacementVolume
    ) {
      return null;
    }

    return {
      index,
      volumeRatio,
      bodyRatio,
      range
    };
  }

  function detectDisplacement(startIndex, direction) {
    if (!Number.isFinite(startIndex)) {
      return null;
    }

    const start = Math.max(0, Math.trunc(startIndex));
    const end = Math.min(
      currentIndex - 1,
      start + displacementWindow - 1
    );

    for (let i = start; i <= end; i++) {
      const result = isValidDisplacement(
        candles[i],
        direction,
        i
      );

      if (result) {
        return result;
      }
    }

    return null;
  }

  function calculatePrecisionEntry(
    direction,
    zone,
    matchingOB,
    sweep,
    displacement,
    reaction
  ) {
    if (!zone || !Number.isFinite(zone.price)) {
      return null;
    }

    const candidates = [];
    const zonePrice = zone.price;

    function addEntryCandidate(price, type, priority) {
      if (
        !Number.isFinite(price) ||
        !isInsideRange(price)
      ) {
        return;
      }

      const distance = Math.abs(price - zonePrice) / atrValue;

      if (distance > 0.85) {
        return;
      }

      if (
        candidates.some(
          item =>
            Math.abs(item.price - price) / atrValue < 0.05
        )
      ) {
        return;
      }

      candidates.push({ price, type, priority });
    }

    if (matchingOB) {
      const obLow = Number.isFinite(matchingOB.low)
        ? matchingOB.low
        : matchingOB.mid;

      const obHigh = Number.isFinite(matchingOB.high)
        ? matchingOB.high
        : matchingOB.mid;

      if (
        Number.isFinite(obLow) &&
        Number.isFinite(obHigh) &&
        obHigh > obLow
      ) {
        const obMid = Number.isFinite(matchingOB.mid)
          ? matchingOB.mid
          : (obLow + obHigh) / 2;

        addEntryCandidate(
          obMid,
          direction === "bullish"
            ? "bullish_ob_retest"
            : "bearish_ob_retest",
          1
        );

        addEntryCandidate(
          direction === "bullish" ? obHigh : obLow,
          direction === "bullish"
            ? "bullish_ob_proximal"
            : "bearish_ob_proximal",
          2
        );
      } else {
        addEntryCandidate(
          matchingOB.mid,
          direction === "bullish"
            ? "bullish_ob_retest"
            : "bearish_ob_retest",
          1
        );
      }
    }

    if (sweep) {
      const confirmation = candles[sweep.confirmationIndex];

      if (confirmation) {
        const confirmationClose = cClose(confirmation);
        const referencePrice = Number.isFinite(sweep.referencePrice)
          ? sweep.referencePrice
          : zonePrice;

        if (Number.isFinite(confirmationClose)) {
          const reclaimEntry =
            direction === "bullish"
              ? Math.max(
                  referencePrice,
                  Math.min(
                    confirmationClose,
                    referencePrice + atrValue * 0.35
                  )
                )
              : Math.min(
                  referencePrice,
                  Math.max(
                    confirmationClose,
                    referencePrice - atrValue * 0.35
                  )
                );

          addEntryCandidate(
            reclaimEntry,
            direction === "bullish"
              ? "bullish_sweep_reclaim"
              : "bearish_sweep_reclaim",
            0
          );
        }
      }
    }

    if (displacement) {
      const candle = candles[displacement.index];

      if (candle) {
        const high = cHigh(candle);
        const low = cLow(candle);
        const range = high - low;

        if (Number.isFinite(range) && range > 0) {
          addEntryCandidate(
            direction === "bullish"
              ? high - range * 0.5
              : low + range * 0.5,
            direction === "bullish"
              ? "bullish_displacement_retest"
              : "bearish_displacement_retest",
            3
          );

          addEntryCandidate(
            direction === "bullish"
              ? high - range * 0.618
              : low + range * 0.618,
            direction === "bullish"
              ? "bullish_displacement_618"
              : "bearish_displacement_618",
            4
          );
        }
      }
    }

    addEntryCandidate(
      zonePrice,
      direction === "bullish" ? "bullish_zone" : "bearish_zone",
      5
    );

    if (!candidates.length) {
      return null;
    }

    candidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      return (
        Math.abs(a.price - zonePrice) -
        Math.abs(b.price - zonePrice)
      );
    });

    let selected = candidates[0];

    if (reaction && displacement) {
      const candle = candles[displacement.index];

      if (candle) {
        const high = cHigh(candle);
        const low = cLow(candle);
        const range = high - low;

        if (Number.isFinite(range) && range > 0) {
          const reactionEntry =
            direction === "bullish"
              ? high - range * 0.5
              : low + range * 0.5;

          const reactionCandidate = candidates.find(
            candidate =>
              Math.abs(candidate.price - reactionEntry) / atrValue < 0.3
          );

          if (reactionCandidate) {
            selected = reactionCandidate;
          }
        }
      }
    }

    const entry = selected.price;

    if (!isInsideRange(entry)) {
      return null;
    }

    const zoneBuffer = atrValue * 0.25;

    const zoneLow = Math.max(
      rangeLow,
      Math.min(
        zonePrice - zoneBuffer,
        entry - atrValue * 0.15
      )
    );

    const zoneHigh = Math.min(
      rangeHigh,
      Math.max(
        zonePrice + zoneBuffer,
        entry + atrValue * 0.15
      )
    );

    if (
      !Number.isFinite(zoneLow) ||
      !Number.isFinite(zoneHigh) ||
      zoneLow >= zoneHigh
    ) {
      return null;
    }

    return {
      entry,
      type: selected.type,
      zoneLow,
      zoneHigh,
      precision:
        selected.priority <= 1
          ? "high"
          : selected.priority <= 3
            ? "medium"
            : "normal"
    };
  }

  function isTargetValid(direction, entry, price, allowOutsideRange = false) {
    if (
      !Number.isFinite(price) ||
      !Number.isFinite(entry)
    ) {
      return false;
    }

    if (direction === "bullish") {
      return (
        price > entry &&
        (allowOutsideRange || price <= rangeHigh)
      );
    }

    return (
      price < entry &&
      (allowOutsideRange || price >= rangeLow)
    );
  }

  function isTargetAlive(direction, price, remainingR) {
    if (
      !Number.isFinite(price) ||
      !Number.isFinite(remainingR) ||
      remainingR < lifecycleMinRemainingR
    ) {
      return false;
    }

    return direction === "bullish"
      ? price > currentPrice
      : price < currentPrice;
  }

  function addTarget(
    targets,
    direction,
    entry,
    price,
    source,
    priority,
    phase = "internal",
    eventIndex = null
  ) {
    if (
      !isTargetValid(
        direction,
        entry,
        price,
        phase === "external"
      )
    ) {
      return;
    }

    const distance = Math.abs(price - entry);

    if (!Number.isFinite(distance) || distance <= 0) {
      return;
    }

    targets.push({
      price,
      source,
      priority,
      distance,
      phase,
      eventIndex
    });
  }

  function collectExternalStructureTargets(direction, entry, targets) {
    const minEventIndex = currentIndex - externalFreshness;

    if (direction === "bullish") {
      for (const swing of swingHighs) {
        if (
          swing.price <= rangeHigh ||
          swing.price <= entry ||
          swing.index < minEventIndex
        ) {
          continue;
        }

        addTarget(
          targets,
          direction,
          entry,
          swing.price,
          "external_swing_resistance",
          1,
          "external",
          swing.index
        );
      }

      for (
        let i = Math.max(recentStart, minEventIndex);
        i < currentIndex;
        i++
      ) {
        const high = cHigh(candles[i]);

        if (
          !Number.isFinite(high) ||
          high <= rangeHigh ||
          high <= entry
        ) {
          continue;
        }

        addTarget(
          targets,
          direction,
          entry,
          high,
          "external_resistance",
          2,
          "external",
          i
        );
      }

      for (const ob of bearishOBs) {
        const price = Number.isFinite(ob.mid) ? ob.mid : ob.high;

        if (
          !Number.isFinite(price) ||
          price <= rangeHigh ||
          price <= entry ||
          (
            Number.isFinite(ob.index) &&
            ob.index < minEventIndex
          )
        ) {
          continue;
        }

        addTarget(
          targets,
          direction,
          entry,
          price,
          "external_bearish_ob",
          2,
          "external",
          Number.isFinite(ob.index) ? ob.index : null
        );
      }

      addTarget(
        targets,
        direction,
        entry,
        rangeHigh,
        "range_high",
        0
      );
    } else {
      for (const swing of swingLows) {
        if (
          swing.price >= rangeLow ||
          swing.price >= entry ||
          swing.index < minEventIndex
        ) {
          continue;
        }

        addTarget(
          targets,
          direction,
          entry,
          swing.price,
          "external_swing_support",
          1,
          "external",
          swing.index
        );
      }

      for (
        let i = Math.max(recentStart, minEventIndex);
        i < currentIndex;
        i++
      ) {
        const low = cLow(candles[i]);

        if (
          !Number.isFinite(low) ||
          low >= rangeLow ||
          low >= entry
        ) {
          continue;
        }

        addTarget(
          targets,
          direction,
          entry,
          low,
          "external_support",
          2,
          "external",
          i
        );
      }

      for (const ob of bullishOBs) {
        const price = Number.isFinite(ob.mid) ? ob.mid : ob.low;

        if (
          !Number.isFinite(price) ||
          price >= rangeLow ||
          price >= entry ||
          (
            Number.isFinite(ob.index) &&
            ob.index < minEventIndex
          )
        ) {
          continue;
        }

        addTarget(
          targets,
          direction,
          entry,
          price,
          "external_bullish_ob",
          2,
          "external",
          Number.isFinite(ob.index) ? ob.index : null
        );
      }

      addTarget(
        targets,
        direction,
        entry,
        rangeLow,
        "range_low",
        0
      );
    }
  }

  function collectPotentialTargets(direction, entry, stop) {
    const targets = [];

    const risk =
      direction === "bullish"
        ? entry - stop
        : stop - entry;

    if (!Number.isFinite(risk) || risk <= 0) {
      return targets;
    }

    if (direction === "bullish") {
      for (const swing of swingHighs) {
        if (
          swing.price > entry &&
          swing.price < rangeHigh
        ) {
          addTarget(
            targets,
            direction,
            entry,
            swing.price,
            "swing_resistance",
            1,
            "internal",
            swing.index
          );
        }
      }

      for (const ob of bearishOBs) {
        const price = Number.isFinite(ob.mid) ? ob.mid : ob.high;

        if (
          Number.isFinite(price) &&
          price > entry &&
          price < rangeHigh
        ) {
          addTarget(
            targets,
            direction,
            entry,
            price,
            "bearish_ob",
            2,
            "internal",
            Number.isFinite(ob.index) ? ob.index : null
          );
        }
      }

      const resistance = getNearestResistance();

      if (resistance && resistance.price > entry) {
        addTarget(
          targets,
          direction,
          entry,
          resistance.price,
          resistance.source,
          1,
          "internal",
          resistance.index
        );
      }
    } else {
      for (const swing of swingLows) {
        if (
          swing.price < entry &&
          swing.price > rangeLow
        ) {
          addTarget(
            targets,
            direction,
            entry,
            swing.price,
            "swing_support",
            1,
            "internal",
            swing.index
          );
        }
      }

      for (const ob of bullishOBs) {
        const price = Number.isFinite(ob.mid) ? ob.mid : ob.low;

        if (
          Number.isFinite(price) &&
          price < entry &&
          price > rangeLow
        ) {
          addTarget(
            targets,
            direction,
            entry,
            price,
            "bullish_ob",
            2,
            "internal",
            Number.isFinite(ob.index) ? ob.index : null
          );
        }
      }

      const support = getNearestSupport();

      if (support && support.price < entry) {
        addTarget(
          targets,
          direction,
          entry,
          support.price,
          support.source,
          1,
          "internal",
          support.index
        );
      }
    }

    collectExternalStructureTargets(
      direction,
      entry,
      targets
    );

    targets.sort((a, b) => a.distance - b.distance);

    const unique = [];

    const duplicateDistance = Math.max(
      atrValue * 0.25,
      Math.min(atrValue * 0.4, atrValue * 0.4 * atrValue / rangeSize)
    );

    for (const target of targets) {
      const duplicate = unique.some(
        item =>
          Math.abs(item.price - target.price) < duplicateDistance
      );

      if (!duplicate) {
        unique.push(target);
      }
    }

    return unique;
  }

  function selectTargets(direction, entry, stop) {
    const risk =
      direction === "bullish"
        ? entry - stop
        : stop - entry;

    const emptyTargets = {
      tp1: null,
      tp2: null,
      tp3: null,
      tp4: null,
      tp5: null,
      rr1: 0,
      rr2: 0,
      rr3: 0,
      rr4: 0,
      rr5: 0,
      tp1Source: null,
      tp2Source: null,
      tp3Source: null,
      tp4Source: null,
      tp5Source: null,
      tpCount: 0
    };

    if (!Number.isFinite(risk) || risk <= 0) {
      return emptyTargets;
    }

    const rawTargets = collectPotentialTargets(
      direction,
      entry,
      stop
    );

    if (!rawTargets.length) {
      return emptyTargets;
    }

    const buffered = [];

    for (const target of rawTargets) {
      let bufferedPrice = applyPipBuffer(
        target.price,
        direction,
        currentPrice
      );

      if (!Number.isFinite(bufferedPrice)) {
        continue;
      }

      if (
        target.phase === "internal" &&
        (
          bufferedPrice <= rangeLow ||
          bufferedPrice >= rangeHigh
        )
      ) {
        bufferedPrice =
          direction === "bullish"
            ? Math.min(bufferedPrice, rangeHigh)
            : Math.max(bufferedPrice, rangeLow);
      }

      if (
        !isTargetValid(
          direction,
          entry,
          bufferedPrice,
          target.phase === "external"
        )
      ) {
        continue;
      }

      const distance = Math.abs(bufferedPrice - entry);
      const rr = distance / risk;

      const isFirstTarget = selected.length === 0;
      const tp1MinRR = Number.isFinite(CONFIG.TP1_MIN_RR) ? CONFIG.TP1_MIN_RR : 0.5;
      const requiredRR = isFirstTarget ? tp1MinRR : minRR;

      if (
        !Number.isFinite(rr) ||
        rr < requiredRR ||
        rr > maxTPRR
      ) {
        continue;
      }

      if (distance > atrValue * 4.5) {
        continue;
      }

      const remainingR =
        direction === "bullish"
          ? (bufferedPrice - currentPrice) / risk
          : (currentPrice - bufferedPrice) / risk;

      if (
        !isTargetAlive(
          direction,
          bufferedPrice,
          remainingR
        )
      ) {
        continue;
      }

      buffered.push({
        price: bufferedPrice,
        rawPrice: target.price,
        source: target.source,
        priority: target.priority,
        phase: target.phase,
        eventIndex: target.eventIndex,
        distance,
        rr,
        remainingR
      });
    }

    if (!buffered.length) {
      return emptyTargets;
    }

    buffered.sort((a, b) => {
      return a.distance - b.distance;
    });

    const selected = [];

    const effectiveSpacing = Math.max(
      atrValue * minTPDistanceATR,
      currentPrice * minTPDistancePct
    );

    for (const target of buffered) {
      if (selected.length >= maxValidTPCount) {
        break;
      }

      if (
        selected.some(
          item =>
            Math.abs(item.price - target.price) <
            effectiveSpacing
        )
      ) {
        continue;
      }

      selected.push(target);
    }

    if (selected.length < minValidTPCount) {
      return emptyTargets;
    }

    selected.sort((a, b) =>
      direction === "bullish"
        ? a.price - b.price
        : b.price - a.price
    );

    const result = { ...emptyTargets };

    result.tpCount = Math.min(selected.length, 5);

    for (let i = 0; i < result.tpCount; i++) {
      const target = selected[i];
      const index = i + 1;

      result[`tp${index}`] = target.price;
      result[`rr${index}`] = target.rr;
      result[`tp${index}Source`] = target.source || null;
    }

    return result;
  }

  function findMatchingOB(direction, price) {
    const list = direction === "bullish"
      ? bullishOBs
      : bearishOBs;

    let best = null;
    let bestDistance = Infinity;

    for (const ob of list) {
      const obPrice = Number.isFinite(ob.mid)
        ? ob.mid
        : direction === "bullish"
          ? ob.high
          : ob.low;

      if (!Number.isFinite(obPrice)) {
        continue;
      }

      const distance = Math.abs(obPrice - price) / atrValue;

      if (distance <= 0.75 && distance < bestDistance) {
        best = ob;
        bestDistance = distance;
      }
    }

    return best;
  }

  function buildStopFromStructure(direction, zoneLow, zoneHigh) {
    const entryZone = {
      low: zoneLow,
      high: zoneHigh
    };

    const stop = computeUnifiedStop(
      candles,
      direction,
      entryZone,
      atrValue,
      swingLows,
      swingHighs,
      currentPrice
    );

    if (Number.isFinite(stop)) {
      return stop;
    }

    return direction === "bullish"
      ? zoneLow - atrValue * slAtrBuffer
      : zoneHigh + atrValue * slAtrBuffer;
  }

  function isCandidateFresh(candidate) {
    if (!candidate) {
      return false;
    }

    const eventIndexes = [
      candidate.displacement_index,
      candidate.sweep_index
    ].filter(Number.isFinite);

    if (!eventIndexes.length) {
      return false;
    }

    const latestEvent = Math.max(...eventIndexes);

    return (
      latestEvent <= currentIndex - 1 &&
      currentIndex - latestEvent <= maxSetupAge
    );
  }

  function isCandidateLifecycleValid(candidate) {
  if (!candidate) {
    return false;
  }

  const { entry, stop, tp1, direction } = candidate;

  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(stop) ||
    !Number.isFinite(tp1) ||
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(atrValue) ||
    !Number.isFinite(lifecycleToleranceAtr) ||
    !Number.isFinite(lifecycleMinRemainingR) ||
    entry <= 0 ||
    stop <= 0 ||
    tp1 <= 0 ||
    atrValue <= 0 ||
    lifecycleToleranceAtr < 0 ||
    lifecycleMinRemainingR < 0
  ) {
    return false;
  }

  if (direction !== "bullish" && direction !== "bearish") {
    return false;
  }

  const risk =
    direction === "bullish"
      ? entry - stop
      : stop - entry;

  if (!Number.isFinite(risk) || risk <= 0) {
    return false;
  }

  const tolerance = atrValue * lifecycleToleranceAtr;

  if (!Number.isFinite(tolerance)) {
    return false;
  }

  if (direction === "bullish") {
    if (stop >= entry || tp1 <= entry || currentPrice >= tp1) {
      return false;
    }

    if (currentPrice > entry + tolerance) {
      const remainingR = (tp1 - currentPrice) / risk;

      if (
        !Number.isFinite(remainingR) ||
        remainingR < lifecycleMinRemainingR
      ) {
        return false;
      }
    }

    return true;
  }

  if (stop <= entry || tp1 >= entry || currentPrice <= tp1) {
    return false;
  }

  if (currentPrice < entry - tolerance) {
    const remainingR = (currentPrice - tp1) / risk;

    if (
      !Number.isFinite(remainingR) ||
      remainingR < lifecycleMinRemainingR
    ) {
      return false;
    }
  }

  return true;
}

  function finalizeCandidate(candidate) {
    if (
      !candidate ||
      !isCandidateFresh(candidate) ||
      !isCandidateLifecycleValid(candidate)
    ) {
      return null;
    }

    return candidate;
  }

  function buildBullishCandidate(zone, source) {
    if (!zone || !isInsideRange(zone.price)) {
      return null;
    }

    const distance_atr = distanceToAtr(zone.price);

    if (!Number.isFinite(distance_atr) || distance_atr > 3.5) {
      return null;
    }

    const matchingOB = findMatchingOB("bullish", zone.price);
    const sweep = detectBullishSweep(zone.price);

    let reactionIndex = null;

    if (sweep) {
      reactionIndex = sweep.confirmationIndex;
    } else if (matchingOB && Number.isFinite(matchingOB.index)) {
      reactionIndex = Math.min(
        currentIndex - 1,
        Number.isFinite(matchingOB.displacement_index)
          ? Math.trunc(matchingOB.displacement_index)
          : Math.trunc(matchingOB.index + 1)
      );
    } else if (Number.isFinite(zone.index)) {
      reactionIndex = Math.min(
        currentIndex - 1,
        Math.trunc(zone.index + 1)
      );
    }

    const displacement = reactionIndex !== null
      ? detectDisplacement(reactionIndex, "bullish")
      : null;

    if (!displacement) {
      return null;
    }

    if (
      matchingOB &&
      Number.isFinite(matchingOB.index) &&
      displacement.index <= matchingOB.index
    ) {
      return null;
    }

    if (
      sweep &&
      (
        displacement.index < sweep.confirmationIndex ||
        displacement.index - sweep.confirmationIndex > displacementWindow
      )
    ) {
      return null;
    }

    const displacementCandle = candles[displacement.index];

    if (
      !displacementCandle ||
      cClose(displacementCandle) <= zone.price
    ) {
      return null;
    }

    const reaction = detectBullishReaction(
      sweep ? sweep.confirmationIndex : displacement.index
    );

    let score = 0;
    const confirmations = [];

    if (source === "support" || source === "swing_support") {
      score += 2;
      confirmations.push("support");
    }

    if (matchingOB) {
      score += 3;
      confirmations.push("bullish_ob");
    }

    if (sweep) {
      score += 3;
      confirmations.push("liquidity_sweep");
    }

    if (reaction) {
      score += 1;
      confirmations.push("bullish_reaction");
    }

    score += 4;
    confirmations.push("bullish_displacement");

    if (rangePosition <= 45) {
      score += 1;
      confirmations.push("lower_range");
    }

    const momentumCheck = detectCounterMomentum(
      candles,
      "bullish",
      currentIndex,
      currentPrice,
      timeframe
    );

    if (momentumCheck.warning) {
      const penalty =
        Number.isFinite(profile.momentumPenalty)
          ? profile.momentumPenalty
          : Number.isFinite(CONFIG.MOMENTUM_WARNING_PENALTY)
            ? CONFIG.MOMENTUM_WARNING_PENALTY
            : 0;

      score = Math.max(0, score - penalty);
      confirmations.push("counter_momentum_warning");
    }

    const zoneLow =
      matchingOB && Number.isFinite(matchingOB.low)
        ? matchingOB.low
        : sweep
          ? Math.min(zone.price, sweep.price)
          : zone.price;

    const precisionEntry = calculatePrecisionEntry(
      "bullish",
      zone,
      matchingOB,
      sweep,
      displacement,
      reaction
    );

    if (!precisionEntry) {
      return null;
    }

    const entry = precisionEntry.entry;

    if (!Number.isFinite(entry) || !isInsideRange(entry)) {
      return null;
    }

    const stop = buildStopFromStructure(
      "bullish",
      Math.min(zoneLow, precisionEntry.zoneLow),
      Math.min(zone.price, precisionEntry.zoneHigh)
    );

    const risk = entry - stop;

    if (
      !Number.isFinite(stop) ||
      !Number.isFinite(risk) ||
      risk <= 0 ||
      stop >= entry ||
      risk / entry * 100 > maxStopPct
    ) {
      return null;
    }

    const targets = computeUnifiedTargets(
      candles,
      "bullish",
      entry,
      stop,
      atrValue,
      currentPrice,
      minRR
    );

    if (
      !targets ||
      !Number.isFinite(targets.tp1) ||
      targets.tp1 <= entry ||
      targets.rr1 < minRR ||
      targets.rr1 > maxTPRR ||
      targets.tpCount < minValidTPCount
    ) {
      return null;
    }

    const candidate = {
      direction: "bullish",
      type: "range_long",
      zone_low: precisionEntry.zoneLow,
      zone_high: precisionEntry.zoneHigh,
      entry,
      entry_type: precisionEntry.type,
      entry_precision: precisionEntry.precision,
      entry_zone_low: precisionEntry.zoneLow,
      entry_zone_high: precisionEntry.zoneHigh,
      risk,
      stop,
      tp1: targets.tp1,
      tp2: targets.tp2,
      tp3: targets.tp3,
      tp4: targets.tp4,
      tp5: targets.tp5,
      rr1: targets.rr1,
      rr2: targets.rr2,
      rr3: targets.rr3,
      rr4: targets.rr4,
      rr5: targets.rr5,
      tp1_source: targets.tp1Source,
      tp2_source: targets.tp2Source,
      tp3_source: targets.tp3Source,
      tp4_source: targets.tp4Source,
      tp5_source: targets.tp5Source,
      tp_count: targets.tpCount,
      score,
      confirmations,
      source,
      distance_atr,
      momentum_warning: momentumCheck.warning,
      momentum_reason: momentumCheck.reason,
      displacement_index: displacement.index,
      sweep_index: sweep ? sweep.index : null,
      order_block: matchingOB || null
    };

    return finalizeCandidate(candidate);
  }

  function buildBearishCandidate(zone, source) {
    if (!zone || !isInsideRange(zone.price)) {
      return null;
    }

    const distance_atr = distanceToAtr(zone.price);

    if (!Number.isFinite(distance_atr) || distance_atr > 3.5) {
      return null;
    }

    const matchingOB = findMatchingOB("bearish", zone.price);
    const sweep = detectBearishSweep(zone.price);

    let reactionIndex = null;

    if (sweep) {
      reactionIndex = sweep.confirmationIndex;
    } else if (matchingOB && Number.isFinite(matchingOB.index)) {
      reactionIndex = Math.min(
        currentIndex - 1,
        Number.isFinite(matchingOB.displacement_index)
          ? Math.trunc(matchingOB.displacement_index)
          : Math.trunc(matchingOB.index + 1)
      );
    } else if (Number.isFinite(zone.index)) {
      reactionIndex = Math.min(
        currentIndex - 1,
        Math.trunc(zone.index + 1)
      );
    }

    const displacement = reactionIndex !== null
      ? detectDisplacement(reactionIndex, "bearish")
      : null;

    if (!displacement) {
      return null;
    }

    if (
      matchingOB &&
      Number.isFinite(matchingOB.index) &&
      displacement.index <= matchingOB.index
    ) {
      return null;
    }

    if (
      sweep &&
      (
        displacement.index < sweep.confirmationIndex ||
        displacement.index - sweep.confirmationIndex > displacementWindow
      )
    ) {
      return null;
    }

    const displacementCandle = candles[displacement.index];

    if (
      !displacementCandle ||
      cClose(displacementCandle) >= zone.price
    ) {
      return null;
    }

    const reaction = detectBearishReaction(
      sweep ? sweep.confirmationIndex : displacement.index
    );

    let score = 0;
    const confirmations = [];

    if (source === "resistance" || source === "swing_resistance") {
      score += 2;
      confirmations.push("resistance");
    }

    if (matchingOB) {
      score += 3;
      confirmations.push("bearish_ob");
    }

    if (sweep) {
      score += 3;
      confirmations.push("liquidity_sweep");
    }

    if (reaction) {
      score += 1;
      confirmations.push("bearish_reaction");
    }

    score += 4;
    confirmations.push("bearish_displacement");

    if (rangePosition >= 55) {
      score += 1;
      confirmations.push("upper_range");
    }

    const momentumCheck = detectCounterMomentum(
      candles,
      "bearish",
      currentIndex,
      currentPrice,
      timeframe
    );

    if (momentumCheck.warning) {
      const penalty =
        Number.isFinite(profile.momentumPenalty)
          ? profile.momentumPenalty
          : Number.isFinite(CONFIG.MOMENTUM_WARNING_PENALTY)
            ? CONFIG.MOMENTUM_WARNING_PENALTY
            : 0;

      score = Math.max(0, score - penalty);
      confirmations.push("counter_momentum_warning");
    }

    const zoneHigh =
      matchingOB && Number.isFinite(matchingOB.high)
        ? matchingOB.high
        : sweep
          ? Math.max(zone.price, sweep.price)
          : zone.price;

    const precisionEntry = calculatePrecisionEntry(
      "bearish",
      zone,
      matchingOB,
      sweep,
      displacement,
      reaction
    );

    if (!precisionEntry) {
      return null;
    }

    const entry = precisionEntry.entry;

    if (!Number.isFinite(entry) || !isInsideRange(entry)) {
      return null;
    }

    const stop = buildStopFromStructure(
      "bearish",
      Math.max(zone.price, precisionEntry.zoneLow),
      Math.max(zoneHigh, precisionEntry.zoneHigh)
    );

    const risk = stop - entry;

    if (
      !Number.isFinite(stop) ||
      !Number.isFinite(risk) ||
      risk <= 0 ||
      stop <= entry ||
      risk / entry * 100 > maxStopPct
    ) {
      return null;
    }

    const targets = computeUnifiedTargets(
      candles,
      "bearish",
      entry,
      stop,
      atrValue,
      currentPrice,
      minRR
    );

    if (
      !targets ||
      !Number.isFinite(targets.tp1) ||
      targets.tp1 >= entry ||
      targets.rr1 < minRR ||
      targets.rr1 > maxTPRR ||
      targets.tpCount < minValidTPCount
    ) {
      return null;
    }

    const candidate = {
      direction: "bearish",
      type: "range_short",
      zone_low: precisionEntry.zoneLow,
      zone_high: precisionEntry.zoneHigh,
      entry,
      entry_type: precisionEntry.type,
      entry_precision: precisionEntry.precision,
      entry_zone_low: precisionEntry.zoneLow,
      entry_zone_high: precisionEntry.zoneHigh,
      risk,
      stop,
      tp1: targets.tp1,
      tp2: targets.tp2,
      tp3: targets.tp3,
      tp4: targets.tp4,
      tp5: targets.tp5,
      rr1: targets.rr1,
      rr2: targets.rr2,
      rr3: targets.rr3,
      rr4: targets.rr4,
      rr5: targets.rr5,
      tp1_source: targets.tp1Source,
      tp2_source: targets.tp2Source,
      tp3_source: targets.tp3Source,
      tp4_source: targets.tp4Source,
      tp5_source: targets.tp5Source,
      tp_count: targets.tpCount,
      score,
      confirmations,
      source,
      distance_atr,
      momentum_warning: momentumCheck.warning,
      momentum_reason: momentumCheck.reason,
      displacement_index: displacement.index,
      sweep_index: sweep ? sweep.index : null,
      order_block: matchingOB || null
    };

    return finalizeCandidate(candidate);
  }

  const support = getNearestSupport();
  const resistance = getNearestResistance();

  if (support) {
    const candidate = buildBullishCandidate(
      support,
      support.source
    );

    if (candidate) {
      bullishZones.push(candidate);
    }
  }

  for (const ob of bullishOBs) {
    const obPrice = Number.isFinite(ob.mid)
      ? ob.mid
      : Number.isFinite(ob.low) && Number.isFinite(ob.high)
        ? (ob.low + ob.high) / 2
        : NaN;

    if (!isInsideRange(obPrice)) {
      continue;
    }

    const candidate = buildBullishCandidate(
      { price: obPrice, index: ob.index },
      "bullish_ob"
    );

    if (candidate) {
      bullishZones.push(candidate);
    }
  }

  if (resistance) {
    const candidate = buildBearishCandidate(
      resistance,
      resistance.source
    );

    if (candidate) {
      bearishZones.push(candidate);
    }
  }

  for (const ob of bearishOBs) {
    const obPrice = Number.isFinite(ob.mid)
      ? ob.mid
      : Number.isFinite(ob.low) && Number.isFinite(ob.high)
        ? (ob.low + ob.high) / 2
        : NaN;

    if (!isInsideRange(obPrice)) {
      continue;
    }

    const candidate = buildBearishCandidate(
      { price: obPrice, index: ob.index },
      "bearish_ob"
    );

    if (candidate) {
      bearishZones.push(candidate);
    }
  }

  function dedupeCandidates(items) {
    const result = [];
    const duplicateDistance = atrValue * 0.5;

    for (const item of items) {
      if (!item) {
        continue;
      }

      const duplicateIndex = result.findIndex(
        existing =>
          Math.abs(existing.entry - item.entry) < duplicateDistance
      );

      if (duplicateIndex === -1) {
        result.push(item);
        continue;
      }

      const existing = result[duplicateIndex];

      const itemRank =
        item.score * 100 +
        item.rr1 * 5 -
        item.distance_atr;

      const existingRank =
        existing.score * 100 +
        existing.rr1 * 5 -
        existing.distance_atr;

      if (itemRank > existingRank) {
        result[duplicateIndex] = item;
      }
    }

    return result;
  }

  const uniqueBullish = dedupeCandidates(bullishZones);
  const uniqueBearish = dedupeCandidates(bearishZones);

  function sortCandidates(items) {
    items.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      if (a.rr1 !== b.rr1) {
        return b.rr1 - a.rr1;
      }

      if (a.distance_atr !== b.distance_atr) {
        return a.distance_atr - b.distance_atr;
      }

      const precisionRank = {
        high: 3,
        medium: 2,
        normal: 1
      };

      return (
        (precisionRank[b.entry_precision] || 0) -
        (precisionRank[a.entry_precision] || 0)
      );
    });
  }

  sortCandidates(uniqueBullish);
  sortCandidates(uniqueBearish);

  const eligibleBullish = uniqueBullish.filter(
    candidate =>
      candidate.score >= minSetupScore &&
      isCandidateFresh(candidate) &&
      isCandidateLifecycleValid(candidate)
  );

  const eligibleBearish = uniqueBearish.filter(
    candidate =>
      candidate.score >= minSetupScore &&
      isCandidateFresh(candidate) &&
      isCandidateLifecycleValid(candidate)
  );

  const bestBullish = eligibleBullish[0] || null;
  const bestBearish = eligibleBearish[0] || null;

  let active = null;

  if (bestBullish && bestBearish) {
    if (bestBullish.score !== bestBearish.score) {
      active =
        bestBullish.score > bestBearish.score
          ? bestBullish
          : bestBearish;
    } else if (bestBullish.rr1 !== bestBearish.rr1) {
      active =
        bestBullish.rr1 > bestBearish.rr1
          ? bestBullish
          : bestBearish;
    } else {
      active =
        bestBullish.distance_atr <= bestBearish.distance_atr
          ? bestBullish
          : bestBearish;
    }
  } else {
    active = bestBullish || bestBearish || null;
  }

  return {
    bullish: uniqueBullish.slice(0, 3),
    bearish: uniqueBearish.slice(0, 3),
    active,
    breakout: {
      bullish: false,
      bearish: false,
      direction: null,
      level: null,
      index: null,
      confirmed: false
    }
  };
}

export function collectNearbyLevels(candles, swings, currentPrice, atrValue, count) {
  if (!candles || candles.length < 10 || !atrValue || atrValue <= 0) {
    return { bullish: [], bearish: [] };
  }

  if (!swings) {
    swings = detectSwings(candles);
  }

  const obs = collectNearbyOrderBlocks(
    candles,
    swings,
    currentPrice,
    atrValue,
    count
  );

  const frvp = volumeNodesToLevels(
    candles,
    currentPrice,
    atrValue,
    count,
    CONFIG.FRVP_LOOKBACK_BARS
  );

  const maxLevelDistance = atrValue * 5;

  const obBearish = (obs.bearish || [])
    .filter((z) => z.low - currentPrice <= maxLevelDistance)
    .map((z) => ({
      direction: "bearish",
      low: z.low,
      high: z.high,
      mid: z.mid,
      source: "ob",
      distance: z.low - currentPrice
    }));

  const obBullish = (obs.bullish || [])
    .filter((z) => currentPrice - z.high <= maxLevelDistance)
    .map((z) => ({
      direction: "bullish",
      low: z.low,
      high: z.high,
      mid: z.mid,
      source: "ob",
      distance: currentPrice - z.high
    }));

  const frvpBearish = (frvp.bearish || [])
    .filter((z) => z.low - currentPrice <= maxLevelDistance)
    .map((z) => ({
      direction: "bearish",
      low: z.low,
      high: z.high,
      mid: z.mid,
      source: z.source || "frvp",
      distance: z.low - currentPrice,
      volume: z.volume,
      ratio: z.ratio,
      isPoc: z.isPoc || false
    }));

  const frvpBullish = (frvp.bullish || [])
    .filter((z) => currentPrice - z.high <= maxLevelDistance)
    .map((z) => ({
      direction: "bullish",
      low: z.low,
      high: z.high,
      mid: z.mid,
      source: z.source || "frvp",
      distance: currentPrice - z.high,
      volume: z.volume,
      ratio: z.ratio,
      isPoc: z.isPoc || false
    }));

  const bearish = mergeLevelsWithFrvp(
    obBearish,
    frvpBearish,
    atrValue,
    currentPrice,
    "bearish"
  );

  const bullish = mergeLevelsWithFrvp(
    obBullish,
    frvpBullish,
    atrValue,
    currentPrice,
    "bullish"
  );

  const isDuplicate = (list, item) => {
    for (const existing of list) {
      if (
        Math.abs(existing.mid - item.mid) / Math.max(atrValue, 1e-12) < 0.5
      ) {
        return true;
      }
    }
    return false;
  };

  if (bearish.length < count) {
    const confirmed = getConfirmedSwings(swings, candles.length - 1);

    const swingHighs = (confirmed.highs || [])
      .filter((h) => candles.length - 1 - h.index <= 100)
      .filter(
        (h) =>
          h.price > currentPrice &&
          h.price - currentPrice <= maxLevelDistance
      )
      .sort((a, b) => a.price - b.price);

    for (const h of swingHighs) {
      if (bearish.length >= count) break;

      const item = {
        direction: "bearish",
        low: h.price,
        high: h.price,
        mid: h.price,
        source: "swing",
        distance: h.price - currentPrice
      };

      if (isDuplicate(bearish, item)) continue;

      bearish.push(item);
    }
  }

  if (bullish.length < count) {
    const confirmed = getConfirmedSwings(swings, candles.length - 1);

    const swingLows = (confirmed.lows || [])
      .filter((l) => candles.length - 1 - l.index <= 100)
      .filter(
        (l) =>
          l.price < currentPrice &&
          currentPrice - l.price <= maxLevelDistance
      )
      .sort((a, b) => b.price - a.price);

    for (const l of swingLows) {
      if (bullish.length >= count) break;

      const item = {
        direction: "bullish",
        low: l.price,
        high: l.price,
        mid: l.price,
        source: "swing",
        distance: currentPrice - l.price
      };

      if (isDuplicate(bullish, item)) continue;

      bullish.push(item);
    }
  }

  bearish.sort((a, b) => a.distance - b.distance);
  bullish.sort((a, b) => a.distance - b.distance);

  return {
    bearish: bearish.slice(0, count),
    bullish: bullish.slice(0, count),
    frvp: {
      poc: frvp.poc,
      valueArea: frvp.valueArea
    }
  };
}

function mergeLevelsWithFrvp(obLevels, frvpLevels, atrValue, currentPrice, direction) {
  const merged = [...obLevels];

  for (const frvp of frvpLevels) {
    let matched = false;

    for (const ob of merged) {
      if (Math.abs(ob.mid - frvp.mid) / atrValue < 1.0) {
        ob.mid = (ob.mid + frvp.mid) / 2;
        ob.low = Math.min(ob.low, frvp.low);
        ob.high = Math.max(ob.high, frvp.high);
        ob.distance =
          direction === "bearish"
            ? ob.low - currentPrice
            : currentPrice - ob.high;
        ob.confluence = true;
        ob.source = ob.source + "+frvp";
        ob.volume = frvp.volume;
        ob.ratio = frvp.ratio;
        if (frvp.isPoc) ob.isPoc = true;
        matched = true;
        break;
      }
    }

    if (!matched) {
      merged.push({
        direction,
        low: frvp.low,
        high: frvp.high,
        mid: frvp.mid,
        source: frvp.source,
        distance: frvp.distance,
        volume: frvp.volume,
        ratio: frvp.ratio,
        isPoc: frvp.isPoc || false,
        confluence: false
      });
    }
  }

  merged.sort((a, b) => {
    const aConfluence = a.confluence ? 1 : 0;
    const bConfluence = b.confluence ? 1 : 0;
    if (aConfluence !== bConfluence) return bConfluence - aConfluence;
    return Math.abs(a.mid - currentPrice) - Math.abs(b.mid - currentPrice);
  });

  return merged;
}

export function zoneDistance(aLow, aHigh, bLow, bHigh) {
  if (aHigh < bLow) return bLow - aHigh;
  if (bHigh < aLow) return aLow - bHigh;
  return 0;
}

export function selectBestZone(orderBlocks, fvgs, direction, atrValue) {
  const obs = orderBlocks.filter((o) => o.direction === direction);
  const gaps = fvgs.filter((f) => f.direction === direction);

  if (obs.length === 0 || gaps.length === 0) {
    return null;
  }

  const candidates = [];

  for (const ob of obs) {
    for (const fvg of gaps) {
      const distance = zoneDistance(ob.low, ob.high, fvg.low, fvg.high);
      const maxDistance = atrValue > 0
        ? atrValue * CONFIG.OB_FVG_MAX_DIST_ATR
        : 0;

      if (distance > maxDistance) continue;

      const overlapLow = Math.max(ob.low, fvg.low);
      const overlapHigh = Math.min(ob.high, fvg.high);

      let lo, hi, overlap;

      if (overlapLow < overlapHigh) {
        lo = overlapLow;
        hi = overlapHigh;
        overlap = true;
      } else {
        lo = Math.min(ob.low, fvg.low);
        hi = Math.max(ob.high, fvg.high);
        overlap = false;
      }

      let score = (ob.quality || 0) + (fvg.quality || 0);

      if (overlap) score += 6;
      else if (atrValue > 0 && distance <= atrValue * 0.10) score += 3;
      else score += 1;

      if (fvg.fresh) score += 2;
      if (fvg.displacement_match) score += 2;
      if (fvg.event_match) score += 1;
      if (ob.displacement_index === fvg.index) score += 2;

      candidates.push({
        direction,
        low: lo,
        high: hi,
        mid: (lo + hi) / 2,
        order_block: ob,
        fvg,
        distance,
        overlap,
        score
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.overlap !== b.overlap) {
      return (b.overlap ? 1 : 0) - (a.overlap ? 1 : 0);
    }
    const aF = a.fvg.fresh ? 1 : 0;
    const bF = b.fvg.fresh ? 1 : 0;
    if (aF !== bF) return bF - aF;
    if (a.distance !== b.distance) return a.distance - b.distance;
    return b.fvg.index - a.fvg.index;
  });

  return candidates[0];
}

export function buildEntryZone(orderBlock, fvg, atrValue = 0) {
  if (!orderBlock || !fvg) {
    return null;
  }

  let lo = Math.max(orderBlock.low, fvg.low);
  let hi = Math.min(orderBlock.high, fvg.high);

  if (lo >= hi) {
    const distance = zoneDistance(
      orderBlock.low,
      orderBlock.high,
      fvg.low,
      fvg.high
    );

    if (
      atrValue <= 0 ||
      distance > atrValue * CONFIG.OB_FVG_MAX_DIST_ATR
    ) {
      return null;
    }

    lo = Math.min(orderBlock.low, fvg.low);
    hi = Math.max(orderBlock.high, fvg.high);
  }

  if (lo >= hi) {
    return null;
  }

  const width = hi - lo;
  const midPrice = (lo + hi) / 2;

  if (midPrice > 0) {
    const widthPct = width / midPrice;

    if (widthPct > CONFIG.ENTRY_ZONE_MAX_WIDTH_PCT) {
      return null;
    }
  }

  return {
    low: lo,
    high: hi,
    mid: midPrice,
    direction: orderBlock.direction,
    width: width
  };
}

export function structuralTargets(candles, direction, entry, swings, atrValue, maxTargets = 4, minRR) {
  if (entry <= 0) {
    return [];
  }

  if (!candles || candles.length < 20) {
    return [];
  }

  const currentPrice = cClose(candles[candles.length - 1]);

  const risk = atrValue > 0 ? atrValue : entry * 0.01;

  const stop = direction === "bullish"
    ? entry - risk
    : entry + risk;

  const result = computeUnifiedTargets(
    candles,
    direction,
    entry,
    stop,
    atrValue,
    currentPrice,
    minRR
  );

  if (!result || !result.targets || result.targets.length === 0) {
    return [];
  }

  const levels = [];

  for (const target of result.targets) {
    if (levels.length >= maxTargets) break;
    levels.push(target.price);
  }

  return levels;
}

export function calcRR(entry, stop, target) {
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return 0;
  return Math.abs(target - entry) / risk;
}

export function fibLevelsCalc(candles, direction) {
  if (!candles || candles.length < 10) {
    return {
      low: null,
      high: null,
      levels: [],
      direction: null,
      valid: false
    };
  }

  let lastSwingLow = null;
  let lastSwingHigh = null;

  if (direction === "bullish") {
    for (let i = candles.length - 1; i >= 0; i--) {
      if (lastSwingHigh === null) {
        if (
          i > 0 &&
          i < candles.length - 1 &&
          cHigh(candles[i]) > cHigh(candles[i - 1]) &&
          cHigh(candles[i]) > cHigh(candles[i + 1])
        ) {
          lastSwingHigh = { index: i, price: cHigh(candles[i]) };
        }
      } else if (i < lastSwingHigh.index) {
        if (
          i > 0 &&
          i < candles.length - 1 &&
          cLow(candles[i]) < cLow(candles[i - 1]) &&
          cLow(candles[i]) < cLow(candles[i + 1])
        ) {
          lastSwingLow = { index: i, price: cLow(candles[i]) };
          break;
        }
      }
    }

    if (
      lastSwingLow === null ||
      lastSwingHigh === null ||
      lastSwingLow.index >= lastSwingHigh.index
    ) {
      return {
        low: null,
        high: null,
        levels: [],
        direction: null,
        valid: false
      };
    }
  } else if (direction === "bearish") {
    for (let i = candles.length - 1; i >= 0; i--) {
      if (lastSwingLow === null) {
        if (
          i > 0 &&
          i < candles.length - 1 &&
          cLow(candles[i]) < cLow(candles[i - 1]) &&
          cLow(candles[i]) < cLow(candles[i + 1])
        ) {
          lastSwingLow = { index: i, price: cLow(candles[i]) };
        }
      } else if (i < lastSwingLow.index) {
        if (
          i > 0 &&
          i < candles.length - 1 &&
          cHigh(candles[i]) > cHigh(candles[i - 1]) &&
          cHigh(candles[i]) > cHigh(candles[i + 1])
        ) {
          lastSwingHigh = { index: i, price: cHigh(candles[i]) };
          break;
        }
      }
    }

    if (
      lastSwingLow === null ||
      lastSwingHigh === null ||
      lastSwingHigh.index >= lastSwingLow.index
    ) {
      return {
        low: null,
        high: null,
        levels: [],
        direction: null,
        valid: false
      };
    }
  } else {
    return {
      low: null,
      high: null,
      levels: [],
      direction: null,
      valid: false
    };
  }

  const range = lastSwingHigh.price - lastSwingLow.price;

  if (!Number.isFinite(range) || range <= 0) {
    return {
      low: null,
      high: null,
      levels: [],
      direction: null,
      valid: false
    };
  }

  const levels = [];

  for (const ratio of CONFIG.FIB_LEVELS) {
    let price;

    if (direction === "bullish") {
      price = lastSwingHigh.price - range * ratio;
    } else {
      price = lastSwingLow.price + range * ratio;
    }

    levels.push({
      ratio,
      price,
      label:
        ratio === 0.5
          ? "50%"
          : ratio === 0.618
            ? "61.8%"
            : (ratio * 100).toFixed(1) + "%"
    });
  }

  return {
    low: lastSwingLow,
    high: lastSwingHigh,
    range,
    levels,
    direction,
    valid: true
  };
}

export function fibOverlapCheck(entryZone, fib) {
  if (!entryZone || !fib || !fib.valid || !fib.levels) {
    return { overlap: false, matched: [] };
  }

  const atrValue = fib.range;

  const tolerance = atrValue * CONFIG.FIB_TOLERANCE;

  const matched = [];

  for (const level of fib.levels) {
    const low = entryZone.low;
    const high = entryZone.high;

    const nearZone =
      level.price >= low - tolerance && level.price <= high + tolerance;

    const insideZone = level.price >= low && level.price <= high;

    if (nearZone || insideZone) {
      matched.push({
        label: level.label,
        price: level.price,
        inside: insideZone
      });
    }
  }

  return {
    overlap: matched.length > 0,
    matched
  };
}

export function scenarioCalc(candles, timeframe, swings) {
  if (!candles || candles.length < 10) {
    return null;
  }

  const currentPrice = cClose(candles[candles.length - 1]);

  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return null;
  }

  const maxAge = Math.min(CONFIG.BOS_LOOKBACK, candles.length - 3);
  const startIdx = Math.max(0, candles.length - maxAge);

  let highestHigh = -Infinity;
  let highestIdx = -1;
  let lowestLow = Infinity;
  let lowestIdx = -1;

  for (let i = startIdx; i < candles.length; i++) {
    const h = cHigh(candles[i]);
    const l = cLow(candles[i]);

    if (h > highestHigh) {
      highestHigh = h;
      highestIdx = i;
    }

    if (l < lowestLow) {
      lowestLow = l;
      lowestIdx = i;
    }
  }

  const rangeBullLevel = highestHigh > currentPrice ? highestHigh : null;
  const rangeBearLevel = lowestLow < currentPrice ? lowestLow : null;

  const nearLookback = Math.min(
    CONFIG.SCENARIO_SWING_LOOKBACK,
    candles.length - 3
  );

  const nearStart = Math.max(0, candles.length - nearLookback);

  if (!swings) {
    swings = detectSwings(candles);
  }

  const confirmedHighs = (swings.highs || []).filter((s) =>
    isSwingConfirmed(s, candles.length - 1)
  );

  const confirmedLows = (swings.lows || []).filter((s) =>
    isSwingConfirmed(s, candles.length - 1)
  );

  const MIN_SCENARIO_DISTANCE = {
    "15m": 0.015,
    "30m": 0.015,
    "1h": 0.02,
    "2h": 0.02,
    "4h": 0.025,
    "6h": 0.03,
    "12h": 0.04,
    "24h": 0.05
  };

  const minScenarioDistance =
    MIN_SCENARIO_DISTANCE[timeframe] !== undefined
      ? MIN_SCENARIO_DISTANCE[timeframe]
      : 0.02;

  let nearBullLevel = null;
  let nearBullIdx = null;

  for (const swing of confirmedHighs) {
    if (swing.index < nearStart) continue;
    if (!Number.isFinite(swing.price)) continue;
    if (swing.price <= currentPrice) continue;

    const distance = (swing.price - currentPrice) / currentPrice;

    if (distance < minScenarioDistance) continue;

    if (nearBullLevel === null || swing.price < nearBullLevel) {
      nearBullLevel = swing.price;
      nearBullIdx = swing.index;
    }
  }

  let nearBearLevel = null;
  let nearBearIdx = null;

  for (const swing of confirmedLows) {
    if (swing.index < nearStart) continue;
    if (!Number.isFinite(swing.price)) continue;
    if (swing.price >= currentPrice) continue;

    const distance = (currentPrice - swing.price) / currentPrice;

    if (distance < minScenarioDistance) continue;

    if (nearBearLevel === null || swing.price > nearBearLevel) {
      nearBearLevel = swing.price;
      nearBearIdx = swing.index;
    }
  }

  if (
    rangeBullLevel === null &&
    rangeBearLevel === null &&
    nearBullLevel === null &&
    nearBearLevel === null
  ) {
    return null;
  }

  const bullDistance = rangeBullLevel !== null
    ? Math.abs(rangeBullLevel - currentPrice) / currentPrice
    : null;

  const bearDistance = rangeBearLevel !== null
    ? Math.abs(rangeBearLevel - currentPrice) / currentPrice
    : null;

  const nearBullDistance = nearBullLevel !== null
    ? Math.abs(nearBullLevel - currentPrice) / currentPrice
    : null;

  const nearBearDistance = nearBearLevel !== null
    ? Math.abs(nearBearLevel - currentPrice) / currentPrice
    : null;

  return {
    bull_level: rangeBullLevel,
    bear_level: rangeBearLevel,
    bull_distance: bullDistance,
    bear_distance: bearDistance,
    bull_index: highestIdx >= 0 ? highestIdx : null,
    bear_index: lowestIdx >= 0 ? lowestIdx : null,
    near_bull_level: nearBullLevel,
    near_bear_level: nearBearLevel,
    near_bull_distance: nearBullDistance,
    near_bear_distance: nearBearDistance,
    near_bull_index: nearBullIdx,
    near_bear_index: nearBearIdx,
    timeframe
  };
}

export function strengthScore(
  direction,
  structure,
  htfStructure,
  event,
  sweep,
  displacement,
  zone,
  volumeValue,
  rsiValue,
  rr2,
  emaTrend,
  fibOverlap,
  rsiDivergence
) {
  let score = 0;

  if (structure.trend === direction) score += 10;

  if (event && event.direction === direction) {
    if (event.type === "BOS") score += 14;
    else if (event.type === "CHoCH") score += 12;
  }

  if (sweep && sweep.direction === direction) {
    const r = sweep.rejection || 0;

    if (r >= 0.60) score += 14;
    else if (r >= 0.45) score += 12;
    else if (r >= 0.30) score += 10;
    else if (r >= 0.20) score += 7;
    else score += 4;
  }

  if (displacement && displacement.direction === direction) {
    const ds = displacement.range_ratio || 0;

    if (ds >= 2.0) score += 14;
    else if (ds >= 1.5) score += 12;
    else score += 10;
  }

  if (zone) {
    score += 12;
    if (zone.overlap) score += 2;
    if (zone.fvg && zone.fvg.fresh) score += 1;
    if (zone.fvg && zone.fvg.displacement_match) score += 1;
    if (zone.fvg && zone.fvg.event_match) score += 1;
    if (
      zone.order_block &&
      zone.fvg &&
      zone.order_block.displacement_index === zone.fvg.index
    ) score += 1;
  }

  if (htfStructure && htfStructure.trend === direction) score += 10;

  if (
    emaTrend &&
    emaTrend.trend !== "neutral" &&
    emaTrend.trend === direction
  ) {
    score += CONFIG.EMA_TREND_SCORE;
  } else if (
    emaTrend &&
    emaTrend.trend !== "neutral" &&
    emaTrend.trend !== direction
  ) {
    score -= CONFIG.EMA_TREND_SCORE;
  }

  if (fibOverlap && fibOverlap.overlap) {
    score += CONFIG.FIB_SCORE;
  }

  if (volumeValue >= 1.15) score += 5;
  else if (volumeValue >= 1.0) score += 3;
  else if (volumeValue >= 0.85) score += 1;

  if (direction === "bullish") {
    if (rsiValue >= 45 && rsiValue <= 68) score += 3;
    else if (rsiValue >= 40 && rsiValue <= 72) score += 2;
  } else {
    if (rsiValue >= 32 && rsiValue <= 55) score += 3;
    else if (rsiValue >= 28 && rsiValue <= 60) score += 2;
  }

  if (rsiDivergence && rsiDivergence.detected) {
    const divEffect = rsiDivergenceScore(rsiDivergence, direction);
    score += divEffect.scoreDelta;
  }

  if (rr2 >= 3.0) score += 12;
  else if (rr2 >= 2.0) score += 8;
  else if (rr2 >= 1.5) score += 4;

  return Math.max(0, Math.min(100, Math.floor(score)));
}

export function determineDirection(structure, htfStructure, event, sweep, displacement) {
  const ed = event ? event.direction : null;
  const sd = sweep ? sweep.direction : null;
  const dd = displacement ? displacement.direction : null;

  if (ed && sd && ed !== sd) return null;
  if (ed && dd && ed !== dd) return null;
  if (sd && dd && sd !== dd) return null;

  if (ed === "bullish" || ed === "bearish") return ed;
  if (dd === "bullish" || dd === "bearish") return dd;

  if (structure.trend === "bullish" || structure.trend === "bearish") {
    return structure.trend;
  }

  if (
    htfStructure &&
    (htfStructure.trend === "bullish" || htfStructure.trend === "bearish")
  ) {
    return htfStructure.trend;
  }

  return null;
}

export function selectCausalSweep(sweeps, event) {
  if (!event) {
    return null;
  }

  const eventIndex = event.index;
  const eventDirection = event.direction;

  const candidates = [];

  for (const sweep of sweeps) {
    if (sweep.direction !== eventDirection) continue;
    if (sweep.index >= eventIndex) continue;

    const distance = eventIndex - sweep.index;
    if (distance > CONFIG.SWEEP_MAX_EVENT_DISTANCE) continue;

    const rejection = sweep.rejection || 0;

    if (rejection < CONFIG.SWEEP_MIN_REJECTION) continue;

    const wickSize = sweep.wick_size || 0;

    const distanceScore =
      1 - distance / Math.max(CONFIG.SWEEP_MAX_EVENT_DISTANCE, 1);

    const qualityScore = rejection * 2 + distanceScore;

    candidates.push({
      distance,
      rejection,
      wick_size: wickSize,
      quality_score: qualityScore,
      sweep
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.quality_score !== b.quality_score) {
      return b.quality_score - a.quality_score;
    }
    if (a.rejection !== b.rejection) return b.rejection - a.rejection;
    if (a.distance !== b.distance) return a.distance - b.distance;
    return b.wick_size - a.wick_size;
  });

  return candidates[0].sweep;
}

export function entryState(currentPrice, zone, atrValue, direction) {
  const low = zone.low;
  const high = zone.high;

  if (low <= currentPrice && currentPrice <= high) {
    return "IN_ZONE";
  }

  const tolerance = atrValue > 0 ? atrValue * 0.25 : 0;

  if (direction === "bullish") {
    if (currentPrice > high && currentPrice <= high + tolerance) {
      return "NEAR_ZONE";
    }
    if (currentPrice < low && currentPrice >= low - tolerance) {
      return "NEAR_ZONE";
    }
  } else {
    if (currentPrice < low && currentPrice >= low - tolerance) {
      return "NEAR_ZONE";
    }
    if (currentPrice > high && currentPrice <= high + tolerance) {
      return "NEAR_ZONE";
    }
  }

  return "FAR";
}

export function targetFilter(targets, entry, stop, direction, currentPrice) {
  const result = [];

  for (const target of targets) {
    if (direction === "bullish" && target <= currentPrice) continue;
    if (direction === "bearish" && target >= currentPrice) continue;
    if (direction === "bullish" && target <= entry) continue;
    if (direction === "bearish" && target >= entry) continue;

    const rr = calcRR(entry, stop, target);
    if (rr <= 0) continue;

    result.push({ price: target, rr });
  }

  return result;
}

export function fmtPercent(value) {
  if (value === null || value === undefined) return "-";
  const v = parseFloat(value);
  if (!Number.isFinite(v)) return "-";
  return (v * 100).toFixed(2) + "%";
}

export function detectSMCTrendFilter(
  candles,
  {
    emaPeriod = 50,
    swingLookback = 20,
    swingStrength = 2
  } = {}
) {
  const blocked = (reason) => ({
    trend: "unknown",
    allowLong: false,
    allowShort: false,
    blocked: true,
    reason
  });

  if (
    !Array.isArray(candles) ||
    candles.length < emaPeriod + swingLookback + swingStrength * 2 + 5
  ) {
    return blocked("داده کافی برای تشخیص روند وجود ندارد");
  }

  const closedCandles = candles.slice(0, -1);

  if (closedCandles.length < emaPeriod + swingLookback + swingStrength * 2) {
    return blocked("تعداد کندل‌های بسته‌شده کافی نیست");
  }

  for (const candle of closedCandles) {
    if (
      !Number.isFinite(Number(candle.open)) ||
      !Number.isFinite(Number(candle.high)) ||
      !Number.isFinite(Number(candle.low)) ||
      !Number.isFinite(Number(candle.close)) ||
      Number(candle.high) < Number(candle.low)
    ) {
      return blocked("داده کندل نامعتبر است");
    }
  }

  const closes = closedCandles.map(c => Number(c.close));

  const calculateEMA = (values, period) => {
    const multiplier = 2 / (period + 1);
    let ema = values[0];

    for (let i = 1; i < values.length; i++) {
      ema = values[i] * multiplier + ema * (1 - multiplier);
    }

    return ema;
  };

  const ema = calculateEMA(closes, emaPeriod);

  const previousCloses = closes.slice(0, -swingLookback);

  if (previousCloses.length < emaPeriod) {
    return blocked("داده کافی برای بررسی شیب EMA وجود ندارد");
  }

  const previousEMA = calculateEMA(previousCloses, emaPeriod);
  const lastClose = closes[closes.length - 1];

  const emaRising = ema > previousEMA;
  const emaFalling = ema < previousEMA;

  const swings = [];
  const start = Math.max(
    swingStrength,
    closedCandles.length - swingLookback - swingStrength
  );
  const end = closedCandles.length - swingStrength;

  for (let i = start; i < end; i++) {
    const candle = closedCandles[i];
    const high = Number(candle.high);
    const low = Number(candle.low);

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= swingStrength; j++) {
      if (
        high <= Number(closedCandles[i - j].high) ||
        high <= Number(closedCandles[i + j].high)
      ) {
        isSwingHigh = false;
      }

      if (
        low >= Number(closedCandles[i - j].low) ||
        low >= Number(closedCandles[i + j].low)
      ) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) swings.push({ type: "high", price: high, index: i });
    if (isSwingLow) swings.push({ type: "low", price: low, index: i });
  }

  const highs = swings.filter(s => s.type === "high");
  const lows = swings.filter(s => s.type === "low");

  if (highs.length < 2 || lows.length < 2) {
    return blocked("سقف و کف نوسانی کافی برای تشخیص ساختار بازار وجود ندارد");
  }

  const lastTwoHighs = highs.slice(-2);
  const lastTwoLows = lows.slice(-2);

  const higherHigh = lastTwoHighs[1].price > lastTwoHighs[0].price;
  const lowerHigh = lastTwoHighs[1].price < lastTwoHighs[0].price;
  const higherLow = lastTwoLows[1].price > lastTwoLows[0].price;
  const lowerLow = lastTwoLows[1].price < lastTwoLows[0].price;

  if (higherHigh && higherLow && lastClose > ema && emaRising) {
    return {
      trend: "bullish",
      allowLong: true,
      allowShort: false,
      blocked: false,
      reason: "ساختار صعودی تأیید شد؛ ورود SHORT مسدود است"
    };
  }

  if (lowerHigh && lowerLow && lastClose < ema && emaFalling) {
    return {
      trend: "bearish",
      allowLong: false,
      allowShort: true,
      blocked: false,
      reason: "ساختار نزولی تأیید شد؛ ورود LONG مسدود است"
    };
  }

  return {
    trend: "neutral",
    allowLong: true,
    allowShort: true,
    blocked: false,
    reason: "روند قطعی نیست؛ بررسی ستاپ SMC ادامه می‌یابد"
  };
}
