import { analyze } from "./analysis.js";

export async function updateSignalStatus(signal) {
  try {
    const analysis = await analyze(signal.symbol, signal.timeframe);

    if (!analysis || !Number.isFinite(analysis.current_price)) {
      return { status: signal.status || "active", maxR: signal.maxR || 0, activated: signal.activated || false };
    }

    const price = analysis.current_price;
    const { direction, entry, stop, tp1, tp2, tp3 } = signal;

    if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(tp1)) {
      return { status: signal.status || "active", maxR: signal.maxR || 0, activated: signal.activated || false };
    }

    const risk = Math.abs(entry - stop);
    if (risk <= 0) {
      return { status: signal.status || "active", maxR: signal.maxR || 0, activated: signal.activated || false };
    }

    const isBull = direction === "bullish";

    let isActivated = signal.activated === true;

    if (!isActivated) {
      if (isBull) {
        isActivated = price <= entry;
      } else {
        isActivated = price >= entry;
      }
    }

    if (!isActivated) {
      return {
        status: "pending",
        maxR: 0,
        activated: false
      };
    }

    const stopHit = isBull ? price <= stop : price >= stop;
    if (stopHit) {
      return { status: "stopped", maxR: 0, final: true, activated: true };
    }

    const tp3Hit = Number.isFinite(tp3) && (isBull ? price >= tp3 : price <= tp3);
    const tp2Hit = Number.isFinite(tp2) && (isBull ? price >= tp2 : price <= tp2);
    const tp1Hit = isBull ? price >= tp1 : price <= tp1;

    const maxR = isBull ? (price - entry) / risk : (entry - price) / risk;
    const prevMaxR = Number.isFinite(signal.maxR) ? signal.maxR : 0;
    const newMaxR = Math.max(prevMaxR, maxR);

    if (tp3Hit) return { status: "tp3_hit", maxR: newMaxR, final: true, activated: true };
    if (tp2Hit) return { status: "tp2_hit", maxR: newMaxR, activated: true };
    if (tp1Hit) return { status: "tp1_hit", maxR: newMaxR, activated: true };

    return { status: "active", maxR: newMaxR, activated: true };
  } catch (e) {
    return { status: signal.status || "active", maxR: signal.maxR || 0, activated: signal.activated || false };
  }
}

export function computeStats(recentSignals) {
  const allTime = { total: 0, tp1Hit: 0, tp2Hit: 0, tp3Hit: 0, stopped: 0, active: 0, tp1Rate: 0, tp2Rate: 0, tp3Rate: 0, stopRate: 0 };
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

    allTime.total++;

    if (status === "tp1_hit") allTime.tp1Hit++;
    else if (status === "tp2_hit") { allTime.tp1Hit++; allTime.tp2Hit++; }
    else if (status === "tp3_hit") { allTime.tp1Hit++; allTime.tp2Hit++; allTime.tp3Hit++; }
    else if (status === "stopped") allTime.stopped++;
    else allTime.active++;

    if (byTimeframe[tf]) {
      byTimeframe[tf].total++;
      if (status.includes("tp")) byTimeframe[tf].tp1Hit++;
      else if (status === "stopped") byTimeframe[tf].stopped++;
    }

    if (byDirection[dir]) {
      byDirection[dir].total++;
      if (status.includes("tp")) byDirection[dir].tp1Hit++;
      else if (status === "stopped") byDirection[dir].stopped++;
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
    if (done > 0) t.tp1Rate = Math.round((t.tp1Hit / done) * 1000) / 10;
  }

  for (const dir of Object.keys(byDirection)) {
    const d = byDirection[dir];
    const done = d.tp1Hit + d.stopped;
    if (done > 0) d.tp1Rate = Math.round((d.tp1Hit / done) * 1000) / 10;
  }

  return { allTime, byTimeframe, byDirection };
}

export function computeWeeklyStats(recentSignals) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const weeklySignals = recentSignals.filter((s) => {
    if (!s || !s.sentAt) return false;
    return new Date(s.sentAt).getTime() >= weekStart.getTime();
  });

  const week = {
    week: getWeekLabel(now),
    startDate: weekStart.toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
    total: 0, tp1Hit: 0, tp2Hit: 0, tp3Hit: 0, stopped: 0, active: 0,
    bestTrade: null,
    worstTrade: null
  };

  for (const s of weeklySignals) {
    week.total++;
    const status = s.status || "active";
    if (status === "tp1_hit") week.tp1Hit++;
    else if (status === "tp2_hit") { week.tp1Hit++; week.tp2Hit++; }
    else if (status === "tp3_hit") { week.tp1Hit++; week.tp2Hit++; week.tp3Hit++; }
    else if (status === "stopped") week.stopped++;
    else week.active++;

    if (status === "tp2_hit" || status === "tp3_hit") {
      const rr = Number.isFinite(s.maxR) ? s.maxR : 0;
      if (!week.bestTrade || rr > (week.bestTrade.rr || 0)) {
        week.bestTrade = { symbol: s.symbol, timeframe: s.timeframe, rr: Math.round(rr * 100) / 100 };
      }
    }
    if (status === "stopped" && !week.worstTrade) {
      week.worstTrade = { symbol: s.symbol, timeframe: s.timeframe, loss: -1 };
    }
  }
  return week;
}

function getWeekLabel(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return d.getFullYear() + "-W" + String(weekNum).padStart(2, "0");
}
