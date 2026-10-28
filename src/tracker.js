import { analyze } from "./analysis.js";

const EMPTY_RESULT = (signal) => ({
  status: signal.status || "active",
  maxR: Number.isFinite(signal.maxR) ? signal.maxR : 0,
  activated: signal.activated === true,
  events: [],
  tp1Reached: signal.tp1Reached === true,
  tp2Reached: signal.tp2Reached === true,
  tp3Reached: signal.tp3Reached === true
});

export async function updateSignalStatus(signal) {
  try {
    const analysis = await analyze(signal.symbol, signal.timeframe);

    if (!analysis || !Number.isFinite(analysis.current_price)) {
      return EMPTY_RESULT(signal);
    }

    const price = analysis.current_price;
    const { direction, entry, stop, tp1, tp2, tp3 } = signal;

    if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(tp1)) {
      return EMPTY_RESULT(signal);
    }

    const risk = Math.abs(entry - stop);
    if (risk <= 0) {
      return EMPTY_RESULT(signal);
    }

    const isBull = direction === "bullish";

    let isActivated = signal.activated === true;

    if (!isActivated) {
      isActivated = isBull ? price <= entry : price >= entry;
    }

    if (!isActivated) {
      return {
        status: "pending",
        maxR: 0,
        activated: false,
        events: [],
        tp1Reached: signal.tp1Reached === true,
        tp2Reached: signal.tp2Reached === true,
        tp3Reached: signal.tp3Reached === true
      };
    }

    const sentTime = signal.sentAt ? new Date(signal.sentAt).getTime() : 0;

    const allCandles = Array.isArray(analysis._candles)
      ? analysis._candles
      : (analysis._lastCandle ? [analysis._lastCandle] : []);

    const signalCandles = allCandles.filter((c) => {
      if (!c) return false;
      const ref = Number.isFinite(c.close_time) && c.close_time > 0
        ? c.close_time
        : c.time;
      return Number.isFinite(ref) && ref >= sentTime;
    });

    if (signalCandles.length === 0 && analysis._lastCandle) {
      signalCandles.push(analysis._lastCandle);
    }

    let stopHit = false;
    let tp1Hit = false;
    let tp2Hit = false;
    let tp3Hit = false;
    let stopIndex = -1;
    let tp1Index = -1;
    let tp2Index = -1;
    let tp3Index = -1;

    for (let i = 0; i < signalCandles.length; i++) {
      const candle = signalCandles[i];
      if (!candle) continue;

      if (isBull) {
        if (Number.isFinite(candle.low) && candle.low <= stop && stopIndex === -1) {
          stopHit = true;
          stopIndex = i;
        }
        if (Number.isFinite(tp3) && Number.isFinite(candle.high) && candle.high >= tp3 && tp3Index === -1) {
          tp3Hit = true;
          tp3Index = i;
        }
        if (Number.isFinite(tp2) && Number.isFinite(candle.high) && candle.high >= tp2 && tp2Index === -1) {
          tp2Hit = true;
          tp2Index = i;
        }
        if (Number.isFinite(candle.high) && candle.high >= tp1 && tp1Index === -1) {
          tp1Hit = true;
          tp1Index = i;
        }
      } else {
        if (Number.isFinite(candle.high) && candle.high >= stop && stopIndex === -1) {
          stopHit = true;
          stopIndex = i;
        }
        if (Number.isFinite(tp3) && Number.isFinite(candle.low) && candle.low <= tp3 && tp3Index === -1) {
          tp3Hit = true;
          tp3Index = i;
        }
        if (Number.isFinite(tp2) && Number.isFinite(candle.low) && candle.low <= tp2 && tp2Index === -1) {
          tp2Hit = true;
          tp2Index = i;
        }
        if (Number.isFinite(candle.low) && candle.low <= tp1 && tp1Index === -1) {
          tp1Hit = true;
          tp1Index = i;
        }
      }
    }

    if (isBull) {
      if (price <= stop && stopIndex === -1) {
        stopHit = true;
        stopIndex = signalCandles.length;
      }
      if (Number.isFinite(tp3) && price >= tp3 && tp3Index === -1) {
        tp3Hit = true;
        tp3Index = signalCandles.length;
      } else if (Number.isFinite(tp2) && price >= tp2 && tp2Index === -1) {
        tp2Hit = true;
        tp2Index = signalCandles.length;
      } else if (price >= tp1 && tp1Index === -1) {
        tp1Hit = true;
        tp1Index = signalCandles.length;
      }
    } else {
      if (price >= stop && stopIndex === -1) {
        stopHit = true;
        stopIndex = signalCandles.length;
      }
      if (Number.isFinite(tp3) && price <= tp3 && tp3Index === -1) {
        tp3Hit = true;
        tp3Index = signalCandles.length;
      } else if (Number.isFinite(tp2) && price <= tp2 && tp2Index === -1) {
        tp2Hit = true;
        tp2Index = signalCandles.length;
      } else if (price <= tp1 && tp1Index === -1) {
        tp1Hit = true;
        tp1Index = signalCandles.length;
      }
    }

    const events = [];
    if (tp1Hit) events.push({ type: "tp1_hit", index: tp1Index });
    if (tp2Hit) events.push({ type: "tp2_hit", index: tp2Index });
    if (tp3Hit) events.push({ type: "tp3_hit", index: tp3Index });
    if (stopHit) events.push({ type: "stopped", index: stopIndex });

    events.sort((a, b) => a.index - b.index);

    let finalStatus = signal.status || "active";
    if (events.length > 0) {
      finalStatus = events[events.length - 1].type;
    }

    const liveMaxR = isBull ? (price - entry) / risk : (entry - price) / risk;
    const prevMaxR = Number.isFinite(signal.maxR) ? signal.maxR : 0;

    let newMaxR = Math.max(prevMaxR, liveMaxR);

    if (tp3Hit && Number.isFinite(signal.rr3)) {
      newMaxR = Math.max(newMaxR, signal.rr3);
    } else if (tp2Hit && Number.isFinite(signal.rr2)) {
      newMaxR = Math.max(newMaxR, signal.rr2);
    } else if (tp1Hit && Number.isFinite(signal.rr1)) {
      newMaxR = Math.max(newMaxR, signal.rr1);
    }

    const tp1Reached = signal.tp1Reached === true || tp1Hit;
    const tp2Reached = signal.tp2Reached === true || tp2Hit;
    const tp3Reached = signal.tp3Reached === true || tp3Hit;

    return {
      status: finalStatus,
      maxR: newMaxR,
      activated: true,
      events,
      tp1Reached,
      tp2Reached,
      tp3Reached
    };
  } catch (e) {
    return EMPTY_RESULT(signal);
  }
}

export function computeStats(recentSignals) {
  const allTime = {
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
  };

  const byTimeframe = {
    "15m": { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 },
    "30m": { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 },
    "1h":  { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 },
    "2h":  { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 }
  };

  const byDirection = {
    bullish: { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 },
    bearish: { total: 0, tp1Hit: 0, stopped: 0, tp1Rate: 0 }
  };

  for (const s of recentSignals) {
    if (!s) continue;

    const status = s.status || "active";
    const tf = s.timeframe;
    const dir = s.direction;

    const isTp1 = status === "tp1_hit";
    const isTp2 = status === "tp2_hit";
    const isTp3 = status === "tp3_hit";
    const isTpHit = isTp1 || isTp2 || isTp3;
    const isStopped = status === "stopped";

    allTime.total++;

    if (isTp1) {
      allTime.tp1Hit++;
    } else if (isTp2) {
      allTime.tp1Hit++;
      allTime.tp2Hit++;
    } else if (isTp3) {
      allTime.tp1Hit++;
      allTime.tp2Hit++;
      allTime.tp3Hit++;
    } else if (isStopped) {
      allTime.stopped++;
    } else {
      allTime.active++;
    }

    if (byTimeframe[tf]) {
      byTimeframe[tf].total++;
      if (isTpHit) byTimeframe[tf].tp1Hit++;
      else if (isStopped) byTimeframe[tf].stopped++;
    }

    if (byDirection[dir]) {
      byDirection[dir].total++;
      if (isTpHit) byDirection[dir].tp1Hit++;
      else if (isStopped) byDirection[dir].stopped++;
    }
  }

  const finished = allTime.total - allTime.active;

  if (finished > 0) {
    allTime.tp1Rate = Math.round((allTime.tp1Hit / finished) * 1000) / 10;
    allTime.tp2Rate = Math.round((allTime.tp2Hit / finished) * 1000) / 10;
    allTime.tp3Rate = Math.round((allTime.tp3Hit / finished) * 1000) / 10;
    allTime.stopRate = Math.round((allTime.stopped / finished) * 1000) / 10;
  }

  for (const tf of Object.keys(byTimeframe)) {
    const t = byTimeframe[tf];
    const done = t.tp1Hit + t.stopped;
    if (done > 0) {
      t.tp1Rate = Math.round((t.tp1Hit / done) * 1000) / 10;
    }
  }

  for (const dir of Object.keys(byDirection)) {
    const d = byDirection[dir];
    const done = d.tp1Hit + d.stopped;
    if (done > 0) {
      d.tp1Rate = Math.round((d.tp1Hit / done) * 1000) / 10;
    }
  }

  return { allTime, byTimeframe, byDirection };
}
