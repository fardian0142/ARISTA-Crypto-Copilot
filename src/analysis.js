import { CONFIG, TIMEFRAME_PROFILES } from "./config.js";
import { getMarketSnapshot } from "./exchanges.js";
import {
  atrCalc,
  rsiCalc,
  rsiSeriesCalc,
  rsiZoneCalc,
  rsiDivergenceCalc,
  rsiDivergenceScore,
  volumeRatioCalc,
  emaTrendCalc,
  detectSwings,
  getConfirmedSwings,
  marketStructure,
  detectBosChoch,
  detectLiquiditySweeps,
  detectDisplacement,
  findEventDisplacement,
  detectFvgs,
  detectOrderBlocks,
  selectBestZone,
  buildEntryZone,
  computeUnifiedStop,
  computeUnifiedTargets,
  structuralTargets,
  targetFilter,
  fibLevelsCalc,
  fibOverlapCheck,
  scenarioCalc,
  strengthScore,
  determineDirection,
  selectCausalSweep,
  entryState,
  collectNearbyLevels,
  detectRangeTradeSetups,
  detectSMCTrendFilter
} from "./indicators.js";

function isValidSymbol(symbol) {
  return (
    typeof symbol === "string" &&
    /^[A-Z0-9]{2,20}USDT$/.test(symbol)
  );
}

function isValidTimeframe(timeframe) {
  return Object.prototype.hasOwnProperty.call(
    CONFIG.TIMEFRAMES,
    timeframe
  );
}

export async function analyze(symbol, timeframe) {
  const result = {
    symbol,
    timeframe,
    status: "NO_TRADE",
    direction: null,
    current_price: null,
    entry_zone: null,
    entry: null,
    stop_loss: null,
    targets: [],
    rr1: 0,
    rr2: 0,
    rr3: 0,
    strength: 0,
    risk: "HIGH",
    rsi: null,
    rsi_zone: null,
    rsi_label: null,
    rsi_bias: null,
    rsi_icon: null,
    rsi_description: null,
    rsi_position: null,
    rsi_divergence: null,
    rsi_divergence_effect: null,
    volume_ratio: 0,
    structure: "neutral",
    htf_structure: "neutral",
    htf2_structure: "neutral",
    bos_choch: null,
    sweep: null,
    displacement: null,
    ema: null,
    ema_trend: "neutral",
    ema_fast: null,
    ema_slow: null,
    ema_price_side: "neutral",
    ema_cross: "none",
    ema_distance_atr: 0,
    fib: null,
    fib_overlap: null,
    fib_labels: "",
    scenario: null,
    nearby_obs: null,
    frvp: null,
    htf2: null,
    range_setups: null,
    setup_active: true,
    reasons: [],
    _noTradeReason: null,
    _profile: null
  };

  const profile = TIMEFRAME_PROFILES[timeframe] || TIMEFRAME_PROFILES["1h"];
  result._profile = profile;

  const minCandles =
    Number.isFinite(CONFIG.MIN_CANDLES) &&
    CONFIG.MIN_CANDLES > 0
      ? Math.trunc(CONFIG.MIN_CANDLES)
      : 180;

  const obsDisplayCount =
    Number.isFinite(CONFIG.OBS_DISPLAY_COUNT) &&
    CONFIG.OBS_DISPLAY_COUNT > 0
      ? Math.trunc(CONFIG.OBS_DISPLAY_COUNT)
      : 2;

  const slAtrBuffer =
    Number.isFinite(CONFIG.SL_ATR_BUFFER) &&
    CONFIG.SL_ATR_BUFFER >= 0
      ? CONFIG.SL_ATR_BUFFER
      : 0.2;

  const minTp1Rr =
    Number.isFinite(CONFIG.MIN_TP1_RR) &&
    CONFIG.MIN_TP1_RR >= 0
      ? CONFIG.MIN_TP1_RR
      : 1;

  const minRr =
    Number.isFinite(profile.minRR) && profile.minRR >= 0
      ? profile.minRR
      : (Number.isFinite(CONFIG.MIN_RR) && CONFIG.MIN_RR >= 0 ? CONFIG.MIN_RR : 1.6);

  const minStrength =
    Number.isFinite(profile.minStrength)
      ? Math.max(0, Math.min(100, profile.minStrength))
      : (Number.isFinite(CONFIG.MIN_STRENGTH)
          ? Math.max(0, Math.min(100, CONFIG.MIN_STRENGTH))
          : 65);

  const htfShortPenalty =
    Number.isFinite(CONFIG.HTF_SHORT_PENALTY_SCORE)
      ? Math.max(0, CONFIG.HTF_SHORT_PENALTY_SCORE)
      : 0;

  const emaFastLabel =
    Number.isFinite(CONFIG.EMA_FAST)
      ? CONFIG.EMA_FAST
      : 20;

  const emaSlowLabel =
    Number.isFinite(CONFIG.EMA_SLOW)
      ? CONFIG.EMA_SLOW
      : 50;

  const fail = (reason, detail = reason) => {
    result.setup_active = false;
    result.strength = 0;
    result.risk = "HIGH";
    result._noTradeReason = reason;

    if (detail) {
      result.reasons.push(detail);
    }

    return result;
  };

  if (
    !isValidSymbol(symbol) ||
    !isValidTimeframe(timeframe)
  ) {
    result.reasons.push(
      "پارامتر تحلیل نامعتبر است."
    );
    result._noTradeReason =
      "پارامتر تحلیل نامعتبر است";
    return result;
  }

  let snapshot;

  try {
    snapshot =
      await getMarketSnapshot(
        symbol,
        timeframe
      );
  } catch (e) {
    const msg =
      "خطا در دریافت داده: " +
      ((e && e.message) || "unknown");

    result.reasons.push(msg);
    result._noTradeReason = msg;
    result.setup_active = false;
    return result;
  }

  if (
    !snapshot ||
    typeof snapshot !== "object"
  ) {
    return fail(
      "Snapshot بازار معتبر دریافت نشد",
      "Snapshot بازار معتبر دریافت نشد."
    );
  }

  const candles =
    Array.isArray(snapshot.current)
      ? snapshot.current
      : [];

  if (candles.length < minCandles) {
    return fail(
      "تعداد کندل برای تحلیل کافی نیست",
      "تعداد کندل برای تحلیل کافی نیست."
    );
  }

  const lastCandle =
    candles[candles.length - 1];

  if (
    !lastCandle ||
    !Number.isFinite(lastCandle.close) ||
    lastCandle.close <= 0
  ) {
    return fail(
      "قیمت فعلی معتبر نیست",
      "قیمت فعلی معتبر نیست."
    );
  }

  const currentPrice =
    lastCandle.close;

  result.current_price =
  currentPrice;

  result._lastCandle =
  lastCandle;

  result._candles =
  candles;

  const currentAtr =
  atrCalc(candles);

  if (
    !Number.isFinite(currentAtr) ||
    currentAtr <= 0
  ) {
    return fail(
      "ATR معتبر نیست",
      "ATR معتبر نیست."
    );
  }

  const hasRealHtf =
    !!(
      snapshot.htf &&
      snapshot.htf !== timeframe &&
      Array.isArray(snapshot.higher) &&
      snapshot.higher.length >=
        minCandles
    );

  const htfCandles =
    hasRealHtf
      ? snapshot.higher
      : [];

  const hasRealHtf2 =
    !!(
      CONFIG.HTF_SECOND_LEVEL &&
      snapshot.htf2 &&
      snapshot.htf2 !== timeframe &&
      snapshot.htf2 !== snapshot.htf &&
      Array.isArray(snapshot.higher2) &&
      snapshot.higher2.length >=
        minCandles
    );

  const htf2Candles =
    hasRealHtf2
      ? snapshot.higher2
      : [];

  let currentRsi =
    rsiCalc(candles);

  if (
    !Number.isFinite(currentRsi)
  ) {
    currentRsi = 50;
  }

  currentRsi = Math.max(
    0,
    Math.min(100, currentRsi)
  );

  const rsiZone =
    rsiZoneCalc(currentRsi);

  if (rsiZone) {
    result.rsi =
      Math.round(
        currentRsi * 100
      ) / 100;

    result.rsi_zone =
      rsiZone.zone ?? null;

    result.rsi_label =
      rsiZone.label ?? null;

    result.rsi_bias =
      rsiZone.bias ?? null;

    result.rsi_icon =
      rsiZone.icon ?? null;

    result.rsi_description =
      rsiZone.description ?? null;

    result.rsi_position =
      rsiZone.position ?? null;
  } else {
    result.rsi =
      Math.round(
        currentRsi * 100
      ) / 100;
  }

  const rsiValues =
    rsiSeriesCalc(candles);

  let currentVolumeRatio =
    volumeRatioCalc(candles);

  if (
    !Number.isFinite(
      currentVolumeRatio
    ) ||
    currentVolumeRatio < 0
  ) {
    currentVolumeRatio = 0;
  }

  const emaTrend =
    emaTrendCalc(candles);

  if (emaTrend) {
    result.ema =
      emaTrend;

    result.ema_trend =
      emaTrend.trend ??
      "neutral";

    result.ema_fast =
      Number.isFinite(
        emaTrend.fast
      )
        ? emaTrend.fast
        : null;

    result.ema_slow =
      Number.isFinite(
        emaTrend.slow
      )
        ? emaTrend.slow
        : null;

    result.ema_price_side =
      emaTrend.price_side ??
      "neutral";

    result.ema_cross =
      emaTrend.cross ??
      "none";

    result.ema_distance_atr =
      Number.isFinite(
        emaTrend.distance_atr
      )
        ? emaTrend.distance_atr
        : 0;
  }

  const swings =
    detectSwings(candles);

  const structure =
    marketStructure(
      candles,
      swings
    ) || {
      trend: "neutral",
      highs: [],
      lows: [],
      last_high: null,
      last_low: null
    };

  const rsiDivergence =
    rsiDivergenceCalc(
      candles,
      rsiValues,
      swings
    );

  result.rsi_divergence =
    rsiDivergence;

  const nearbyLevels =
    collectNearbyLevels(
      candles,
      swings,
      currentPrice,
      currentAtr,
      obsDisplayCount
    );

  result.nearby_obs =
    nearbyLevels || null;

  result.frvp =
    nearbyLevels &&
    nearbyLevels.frvp
      ? nearbyLevels.frvp
      : null;

  let htfStructure = {
    trend: "neutral",
    highs: [],
    lows: [],
    last_high: null,
    last_low: null
  };

  if (hasRealHtf) {
    const htfSwings =
      detectSwings(htfCandles);

    htfStructure =
      marketStructure(
        htfCandles,
        htfSwings
      ) || htfStructure;
  }

  let htf2Structure = {
    trend: "neutral",
    highs: [],
    lows: [],
    last_high: null,
    last_low: null
  };

  if (hasRealHtf2) {
    const htf2Swings =
      detectSwings(htf2Candles);

    htf2Structure =
      marketStructure(
        htf2Candles,
        htf2Swings
      ) || htf2Structure;
  }

  result.structure =
    structure.trend ||
    "neutral";

  result.htf_structure =
    htfStructure.trend ||
    "neutral";

  result.htf2_structure =
    hasRealHtf2
      ? htf2Structure.trend ||
        "neutral"
      : "neutral";

  result.htf2 =
    hasRealHtf2
      ? snapshot.htf2
      : null;

  result.volume_ratio =
    Math.round(
      currentVolumeRatio * 100
    ) / 100;

  const event =
    detectBosChoch(
      candles,
      swings,
      structure
    );

  result.bos_choch =
    event || null;

  const scenario =
    scenarioCalc(
      candles,
      timeframe,
      swings
    );

  result.scenario =
    scenario || null;

  const scenarioBullFinite =
    !!(
      scenario &&
      Number.isFinite(
        scenario.bull_level
      ) &&
      scenario.bull_level > 0
    );

  const scenarioBearFinite =
    !!(
      scenario &&
      Number.isFinite(
        scenario.bear_level
      ) &&
      scenario.bear_level > 0
    );

  if (
    scenarioBullFinite &&
    scenarioBearFinite
  ) {
    try {
      result.range_setups =
        detectRangeTradeSetups(
          candles,
          currentPrice,
          currentAtr,
          scenario.bull_level,
          scenario.bear_level,
          swings,
          timeframe
        );
    } catch (e) {
      console.error(
        "detectRangeTradeSetups error:",
        e
      );

      result.range_setups =
        null;
    }
  } else {
    result.range_setups =
      null;
  }

  if (
    result.range_setups &&
    result.range_setups.active
  ) {
    const smcFilterCurrentTF = detectSMCTrendFilter(candles);
    let isRangeAllowed = true;

    if (
      result.range_setups.active.direction === "bearish" &&
      !smcFilterCurrentTF.allowShort
    ) {
      isRangeAllowed = false;
      result.reasons.push("⚠️ ستاپ Range Short به دلیل روند صعودی در تایم‌فریم جاری مسدود شد.");
    }

    if (
      result.range_setups.active.direction === "bullish" &&
      !smcFilterCurrentTF.allowLong
    ) {
      isRangeAllowed = false;
      result.reasons.push("⚠️ ستاپ Range Long به دلیل روند نزولی در تایم‌فریم جاری مسدود شد.");
    }

    if (isRangeAllowed && hasRealHtf) {
      const smcFilterHTF = detectSMCTrendFilter(htfCandles);

      if (
        result.range_setups.active.direction === "bearish" &&
        !smcFilterHTF.allowShort
      ) {
        isRangeAllowed = false;
        result.reasons.push("⚠️ ستاپ Range Short به دلیل روند صعودی در تایم‌فریم بالاتر (HTF) مسدود شد.");
      }

      if (
        result.range_setups.active.direction === "bullish" &&
        !smcFilterHTF.allowLong
      ) {
        isRangeAllowed = false;
        result.reasons.push("⚠️ ستاپ Range Long به دلیل روند نزولی در تایم‌فریم بالاتر (HTF) مسدود شد.");
      }
    }

    if (!isRangeAllowed) {
      result.range_setups.active = null;
    }
  }

  if (
    !event ||
    !Number.isFinite(event.index) ||
    !Number.isFinite(event.direction)
  ) {
    result.setup_active = false;
    result.strength = 0;
    result.risk = "HIGH";
    result._noTradeReason =
      "BOS یا CHoCH معتبر در محدوده اخیر مشاهده نشد";
    result.reasons.push(
      "BOS یا CHoCH معتبر در محدوده اخیر مشاهده نشد."
    );
    return result;
  }

  const sweeps =
    detectLiquiditySweeps(
      candles,
      swings
    );

  const sweep =
    selectCausalSweep(
      sweeps,
      event
    );

  result.sweep =
    sweep || null;

  if (
    !sweep ||
    !Number.isFinite(sweep.index)
  ) {
    return fail(
      "Liquidity Sweep معتبر قبل از شکست ساختاری شکل نگرفت",
      "Liquidity Sweep هم‌جهت و معتبر قبل از شکست ساختاری پیدا نشد."
    );
  }

  const displacement =
    findEventDisplacement(
      candles,
      currentAtr,
      event,
      sweep
    );

  result.displacement =
    displacement || null;

  if (
    !displacement ||
    !Number.isFinite(
      displacement.index
    )
  ) {
    return fail(
      "Displacement معتبر و مرتبط با Event شکل نگرفت",
      "Displacement معتبر و مرتبط با Event مشاهده نشد."
    );
  }

  const direction =
    determineDirection(
      structure,
      htfStructure,
      event,
      sweep,
      displacement
    );

  if (
    direction !== "bullish" &&
    direction !== "bearish"
  ) {
    return fail(
      "جهت Event، Sweep و Displacement هماهنگ نیست",
      "جهت Event، Sweep و Displacement با یکدیگر هماهنگ نیست."
    );
  }

  result.direction =
    direction;

  const smcTrendCandles = hasRealHtf ? htfCandles : candles;
  const smcTrendFilter = detectSMCTrendFilter(smcTrendCandles);

  if (smcTrendFilter.blocked) {
    return fail(
      "فیلتر روند: " + smcTrendFilter.reason,
      "فیلتر روند: " + smcTrendFilter.reason
    );
  }

  if (direction === "bullish" && !smcTrendFilter.allowLong) {
    return fail(
      "فیلتر روند: ورود Long در روند نزولی مسدود است",
      "فیلتر روند: " + smcTrendFilter.reason
    );
  }

  if (direction === "bearish" && !smcTrendFilter.allowShort) {
    return fail(
      "فیلتر روند: ورود Short در روند صعودی مسدود است",
      "فیلتر روند: " + smcTrendFilter.reason
    );
  }

  const rsiDivergenceEffect =
    rsiDivergenceScore(
      rsiDivergence,
      direction
    );

  result.rsi_divergence_effect =
    rsiDivergenceEffect || null;

  if (
    rsiDivergenceEffect &&
    rsiDivergenceEffect.reason
  ) {
    if (
      rsiDivergenceEffect.aligned
    ) {
      result.reasons.push(
        "✅ " +
          rsiDivergenceEffect.reason
      );
    } else if (
      rsiDivergenceEffect.opposed
    ) {
      result.reasons.push(
        "⚠️ " +
          rsiDivergenceEffect.reason
      );
    }
  }

  if (
    event.direction !==
    direction
  ) {
    return fail(
      "جهت شکست ساختاری معتبر نیست",
      "جهت شکست ساختاری معتبر نیست."
    );
  }

  if (
    sweep.direction !==
    direction
  ) {
    return fail(
      "Liquidity Sweep با جهت ستاپ هماهنگ نیست",
      "Liquidity Sweep با جهت ستاپ هماهنگ نیست."
    );
  }

  if (
    displacement.direction !==
    direction
  ) {
    return fail(
      "Displacement با جهت ستاپ هماهنگ نیست",
      "Displacement با جهت ستاپ هماهنگ نیست."
    );
  }

  if (
    sweep.index >=
    event.index
  ) {
    return fail(
      "Sweep باید قبل از شکست ساختاری اتفاق افتاده باشد",
      "Sweep باید قبل از شکست ساختاری اتفاق افتاده باشد."
    );
  }

  if (
    displacement.index <
    event.index
  ) {
    return fail(
      "Displacement باید در Event یا بعد از آن شکل گرفته باشد",
      "Displacement باید در Event یا بعد از آن شکل گرفته باشد."
    );
  }

  if (
    displacement.index <
    sweep.index
  ) {
    return fail(
      "Displacement باید بعد از Liquidity Sweep شکل گرفته باشد",
      "Displacement باید بعد از Liquidity Sweep شکل گرفته باشد."
    );
  }

  const htfTrend =
    htfStructure.trend ||
    "neutral";

  const htf2Trend =
    htf2Structure.trend ||
    "neutral";

  let htfPenalty = 0;

  if (profile.strictHTF) {
    if (
      (htfTrend === "bullish" || htfTrend === "bearish") &&
      htfTrend !== direction
    ) {
      return fail(
        "ساختار تایم‌فریم بالاتر با جهت ستاپ مخالف است",
        "ساختار تایم‌فریم بالاتر با جهت ستاپ مخالف است."
      );
    }

    if (
      hasRealHtf2 &&
      (htf2Trend === "bullish" || htf2Trend === "bearish") &&
      htf2Trend !== direction
    ) {
      return fail(
        "ساختار تایم‌فریم بالاتر دوم با جهت ستاپ مخالف است",
        "ساختار تایم‌فریم بالاتر دوم با جهت ستاپ مخالف است."
      );
    }
  } else {
    if (
      (htfTrend === "bullish" || htfTrend === "bearish") &&
      htfTrend !== direction
    ) {
      htfPenalty += profile.htfPenalty;
      result.reasons.push(
        "⚠️ HTF مخالف — جریمه " + profile.htfPenalty + " امتیاز"
      );
    }

    if (
      hasRealHtf2 &&
      (htf2Trend === "bullish" || htf2Trend === "bearish") &&
      htf2Trend !== direction
    ) {
      htfPenalty += profile.htfPenalty;
      result.reasons.push(
        "⚠️ HTF2 مخالف — جریمه " + profile.htfPenalty + " امتیاز"
      );
    }
  }

  const emaDirection =
    emaTrend &&
    (emaTrend.trend === "bullish" ||
      emaTrend.trend === "bearish")
      ? emaTrend.trend
      : "neutral";

  if (
    emaDirection !== "neutral" &&
    emaDirection !== direction
  ) {
    if (profile.strictHTF) {
      return fail(
        "EMA " +
          emaFastLabel +
          "/" +
          emaSlowLabel +
          " خلاف جهت ستاپ است",
        "EMA " +
          emaFastLabel +
          "/" +
          emaSlowLabel +
          " خلاف جهت ستاپ است."
      );
    } else {
      htfPenalty += profile.htfPenalty;
      result.reasons.push(
        "⚠️ EMA خلاف جهت ستاپ — جریمه " + profile.htfPenalty + " امتیاز"
      );
    }
  }

  const fvgs =
    detectFvgs(
      candles,
      currentAtr,
      event,
      sweep,
      displacement
    );

  const obs =
    detectOrderBlocks(
      candles,
      currentAtr,
      event,
      displacement,
      sweep
    );

  const zone =
    selectBestZone(
      obs,
      fvgs,
      direction,
      currentAtr
    );

  if (!zone) {
    return fail(
      "ناحیه معتبر Order Block + FVG شکل نگرفت",
      "ناحیه معتبر Order Block + FVG مرتبط با حرکت ساختاری پیدا نشد."
    );
  }

  const entryZone =
    buildEntryZone(
      zone.order_block,
      zone.fvg,
      currentAtr
    );

  if (
    !entryZone ||
    !Number.isFinite(entryZone.low) ||
    !Number.isFinite(entryZone.high) ||
    !Number.isFinite(entryZone.mid) ||
    entryZone.low >=
      entryZone.high ||
    entryZone.mid <= 0
  ) {
    return fail(
      "هم‌پوشانی معتبر OB و FVG تشکیل نشد",
      "هم‌پوشانی معتبر OB و FVG تشکیل نشد."
    );
  }

  const entry =
    entryZone.mid;

  if (
    !Number.isFinite(entry) ||
    entry <= 0
  ) {
    return fail(
      "قیمت ورود معتبر نیست",
      "قیمت ورود معتبر نیست."
    );
  }

  const confirmedSwings =
    getConfirmedSwings(
      swings,
      candles.length - 1
    ) || {
      lows: [],
      highs: []
    };

  const swingLowsStructure =
    Array.isArray(
      confirmedSwings.lows
    )
      ? confirmedSwings.lows
      : [];

  const swingHighsStructure =
    Array.isArray(
      confirmedSwings.highs
    )
      ? confirmedSwings.highs
      : [];

  let stop =
    computeUnifiedStop(
      candles,
      direction,
      entryZone,
      currentAtr,
      swingLowsStructure,
      swingHighsStructure,
      currentPrice
    );

  if (
    !Number.isFinite(stop) ||
    stop <= 0
  ) {
    if (direction === "bullish") {
      stop =
        entryZone.low -
        currentAtr * slAtrBuffer;
    } else {
      stop =
        entryZone.high +
        currentAtr * slAtrBuffer;
    }
  }

  if (
    !Number.isFinite(stop) ||
    stop <= 0
  ) {
    return fail(
      "Stop Loss معتبر نیست",
      "Stop Loss معتبر نیست."
    );
  }

  if (
    direction === "bullish" &&
    stop >= entry
  ) {
    return fail(
      "Stop Loss برای Long معتبر نیست",
      "Stop Loss برای Long معتبر نیست."
    );
  }

  if (
    direction === "bearish" &&
    stop <= entry
  ) {
    return fail(
      "Stop Loss برای Short معتبر نیست",
      "Stop Loss برای Short معتبر نیست."
    );
  }

  const riskDistance =
    Math.abs(
      entry - stop
    );

  if (
    !Number.isFinite(
      riskDistance
    ) ||
    riskDistance <= 0
  ) {
    return fail(
      "فاصله ریسک معتبر نیست",
      "فاصله ریسک معتبر نیست."
    );
  }

  const unifiedTargets =
    computeUnifiedTargets(
      candles,
      direction,
      entry,
      stop,
      currentAtr,
      currentPrice,
      minRr
    );

  let targets = [];

  if (
    unifiedTargets &&
    Array.isArray(unifiedTargets.targets) &&
    unifiedTargets.targets.length >= CONFIG.MIN_VALID_TP_COUNT
  ) {
    targets = unifiedTargets.targets
      .filter(
        (t) =>
          t &&
          Number.isFinite(t.price) &&
          Number.isFinite(t.rr) &&
          t.price > 0 &&
          t.rr >= minTp1Rr
      )
      .map((t) => ({
        price: t.price,
        rr: t.rr,
        source: t.source || null
      }));
  }

  if (targets.length < 2) {
    const rawTargets =
      structuralTargets(
        candles,
        direction,
        entry,
        swings,
        currentAtr,
        4,
        minRr
      );

    const filteredTargets =
      Array.isArray(rawTargets)
        ? targetFilter(
            rawTargets,
            entry,
            stop,
            direction,
            currentPrice
          )
        : [];

    targets =
      filteredTargets.filter(
        (t) =>
          t &&
          Number.isFinite(t.price) &&
          Number.isFinite(t.rr) &&
          t.price > 0 &&
          t.rr >= minTp1Rr
      );
  }

  if (
    targets.length < 2
  ) {
    return fail(
      "حداقل دو هدف با R/R معتبر وجود ندارد",
      "حداقل دو هدف با R/R معتبر (>= " +
        minTp1Rr.toFixed(2) +
        ") وجود ندارد."
    );
  }

  const rr1 =
    Number.isFinite(
      targets[0].rr
    )
      ? targets[0].rr
      : 0;

  const rr2 =
    Number.isFinite(
      targets[1].rr
    )
      ? targets[1].rr
      : 0;

  const rr3 =
    targets.length >= 3 &&
    Number.isFinite(
      targets[2].rr
    )
      ? targets[2].rr
      : 0;

  if (
    rr2 < minRr
  ) {
    return fail(
      "R/R هدف دوم کمتر از حداقل است",
      "R/R هدف دوم کمتر از " +
        minRr.toFixed(2) +
        " است."
    );
  }

  const fib =
    fibLevelsCalc(
      candles,
      direction
    );

  result.fib =
    fib || null;

  const fibOverlap =
    fibOverlapCheck(
      entryZone,
      fib
    );

  result.fib_overlap =
    fibOverlap || null;

  result.fib_labels =
    fibOverlap &&
    fibOverlap.overlap &&
    Array.isArray(
      fibOverlap.matched
    )
      ? fibOverlap.matched
          .filter(
            (m) =>
              m &&
              typeof m.label ===
                "string"
          )
          .map(
            (m) =>
              m.label
          )
          .join(" + ")
      : "";

  let strength =
    strengthScore(
      direction,
      structure,
      htfStructure,
      event,
      sweep,
      displacement,
      zone,
      currentVolumeRatio,
      currentRsi,
      rr2,
      emaTrend,
      fibOverlap,
      rsiDivergence
    );

  if (
    !Number.isFinite(strength)
  ) {
    strength = 0;
  }

  strength = Math.max(
    0,
    Math.min(
      100,
      Math.round(strength)
    )
  );

  if (htfPenalty > 0) {
    strength = Math.max(0, strength - htfPenalty);
  }

  const htfConflictShort =
    direction === "bearish" &&
    (
      htfTrend === "bullish" ||
      (
        hasRealHtf2 &&
        htf2Trend === "bullish"
      )
    );

  if (
    htfConflictShort &&
    htfShortPenalty > 0 &&
    profile.strictHTF
  ) {
    strength = Math.max(
      0,
      Math.round(
        strength -
          htfShortPenalty
      )
    );
  }

  strength = Math.max(
    0,
    Math.min(100, strength)
  );

  result.strength =
    strength;

  if (
    strength >= 85
  ) {
    result.risk =
      "LOW";
  } else if (
    strength >= 75
  ) {
    result.risk =
      "MEDIUM";
  } else {
    result.risk =
      "HIGH";
  }

  result.entry_zone =
    entryZone;

  result.entry =
    entry;

  result.stop_loss =
    stop;

  result.targets =
    targets;

  result.rr1 =
    rr1;

  result.rr2 =
    rr2;

  result.rr3 =
    rr3;

  if (
    strength < minStrength
  ) {
    result._noTradeReason =
      "قدرت ستاپ " +
      strength +
      "/100 است و به حداقل " +
      minStrength +
      " نرسیده";

    result.reasons.push(
      "قدرت ستاپ " +
        strength +
        "/100 است و به حداقل " +
        minStrength +
        " نرسیده."
    );

    return result;
  }

  const state =
    entryState(
      currentPrice,
      entryZone,
      currentAtr,
      direction
    );

  if (
    state === "IN_ZONE"
  ) {
    result.status =
      direction === "bullish"
        ? "LONG"
        : "SHORT";

    result.reasons.push(
      "قیمت داخل ناحیه ورود معتبر قرار دارد."
    );
  } else if (
    state === "NEAR_ZONE"
  ) {
    result.status =
      "WAIT";

    result.reasons.push(
      "قیمت نزدیک ناحیه ورود است؛ برای ورود بهتر باید به زون برسد."
    );
  } else {
    result.status =
      "NO_TRADE";

    result.reasons.push(
      "قیمت از ناحیه ورود فاصله دارد؛ ورود در قیمت فعلی انجام نمی‌شود."
    );
  }

  if (
    result.status ===
      "NO_TRADE" &&
    result._noTradeReason ===
      null
  ) {
    const sc =
      result.scenario;

    if (sc) {
      const hasAnyScenario =
        Number.isFinite(
          sc.bull_level
        ) ||
        Number.isFinite(
          sc.bear_level
        ) ||
        Number.isFinite(
          sc.near_bull_level
        ) ||
        Number.isFinite(
          sc.near_bear_level
        );

      if (
        !hasAnyScenario
      ) {
        result._noTradeReason =
          "سطوح شکست نزدیک‌تر از حد مجاز این تایم‌فریم هستن";
      } else {
        result._noTradeReason =
          "قیمت از ناحیه ورود فاصله دارد";
      }
    } else {
      result._noTradeReason =
        "قیمت از ناحیه ورود فاصله دارد";
    }
  }

  if (
    htfTrend ===
    direction
  ) {
    result.reasons.push(
      "ساختار تایم‌فریم بالاتر هم‌جهت است."
    );
  }

  if (
    hasRealHtf2 &&
    htf2Trend ===
      direction
  ) {
    result.reasons.push(
      "ساختار تایم‌فریم بالاتر دوم هم‌جهت است."
    );
  }

  if (
    emaDirection ===
    direction
  ) {
    if (
      emaTrend &&
      emaTrend.cross ===
        "golden" &&
      direction ===
        "bullish"
    ) {
      result.reasons.push(
        "کراس صعودی EMA " +
          emaFastLabel +
          "/" +
          emaSlowLabel +
          " تأیید شد."
      );
    } else if (
      emaTrend &&
      emaTrend.cross ===
        "death" &&
      direction ===
        "bearish"
    ) {
      result.reasons.push(
        "کراس نزولی EMA " +
          emaFastLabel +
          "/" +
          emaSlowLabel +
          " تأیید شد."
      );
    } else {
      result.reasons.push(
        "EMA " +
          emaFastLabel +
          "/" +
          emaSlowLabel +
          " هم‌جهت با ستاپ است."
      );
    }

    if (
      emaTrend &&
      emaTrend.price_side ===
        direction
    ) {
      result.reasons.push(
        "قیمت در سمت هم‌جهت با EMA قرار دارد."
      );
    }
  }

  if (
    fibOverlap &&
    fibOverlap.overlap &&
    Array.isArray(
      fibOverlap.matched
    )
  ) {
    const labels =
      fibOverlap.matched
        .filter(
          (m) =>
            m &&
            typeof m.label ===
              "string"
        )
        .map(
          (m) =>
            m.label
        )
        .join(" + ");

    if (labels) {
      result.reasons.push(
        "ناحیه ورود با فیبو " +
          labels +
          " هم‌پوشانی دارد."
      );
    }
  }

  if (
    event.type ===
    "BOS"
  ) {
    result.reasons.push(
      "BOS معتبر در زنجیره ساختاری ثبت شده است."
    );
  } else if (
    event.type ===
    "CHoCH"
  ) {
    result.reasons.push(
      "CHoCH معتبر و تغییر ساختار مشاهده شده است."
    );
  }

  result.reasons.push(
    "Liquidity Sweep هم‌جهت قبل از شکست ساختاری انتخاب شد."
  );

  result.reasons.push(
    "Displacement هم‌جهت و مرتبط با Event تأیید شد."
  );

  result.reasons.push(
    "Order Block و FVG مرتبط با همان حرکت ساختاری انتخاب شدند."
  );

  return result;
}
