import { CONFIG } from "./config.js";

function fmtPrice(value) {
  if (value === null || value === undefined) {
    return "-";
  }

  const v = parseFloat(value);

  if (!Number.isFinite(v)) {
    return "-";
  }

  if (v >= 1000) {
    return v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  if (v >= 1) {
    return v.toFixed(4);
  }

  if (v >= 0.01) {
    return v.toFixed(5);
  }

  return v.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

function fmtRR(value) {
  return (parseFloat(value) || 0).toFixed(2) + "R";
}

function statusIcon(s) {
  if (s === "LONG") return "🟢";
  if (s === "SHORT") return "🔴";
  if (s === "WAIT") return "🟡";
  return "⚪";
}

function statusText(s) {
  return {
    LONG: "خرید",
    SHORT: "فروش",
    WAIT: "صبر",
    NO_TRADE: "بدون معامله"
  }[s] || s;
}

function calcLeverageLevels(stopPct) {
  if (!Number.isFinite(stopPct) || stopPct <= 0) {
    return [5, 10, 15, 20];
  }

  const MIN_LEV = 2;
  const MAX_LEV = 15;
  const factors = [5.0, 3.5, 2.5, 1.8];

  const result = factors.map((f) => {
    const value = Math.floor(100 / (stopPct * f));
    return Math.max(MIN_LEV, Math.min(MAX_LEV, value));
  });

  for (let i = 1; i < result.length; i++) {
    if (result[i] <= result[i - 1]) {
      result[i] = result[i - 1] + 1;
    }
  }

  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i] > MAX_LEV) {
      result[i] = MAX_LEV - (result.length - 1 - i);
    }
  }

  for (let i = result.length - 1; i >= 1; i--) {
    if (result[i] <= result[i - 1]) {
      result[i - 1] = Math.max(MIN_LEV, result[i] - 1);
    }
  }

  for (let i = 0; i < result.length; i++) {
    if (result[i] < MIN_LEV) {
      result[i] = MIN_LEV + i;
    }
  }

  for (let i = 1; i < result.length; i++) {
    if (result[i] <= result[i - 1]) {
      result[i] = result[i - 1] + 1;
    }
  }

  return result;
}

function formatScoreBar(score, maxScore = 14) {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return {
      percentage: 0,
      bar: "▱▱▱▱▱▱▱▱▱▱",
      icon: "🔴",
      label: "ضعیف",
      text: "🔴 0% ▱▱▱▱▱▱▱▱▱▱ (0/14)"
    };
  }

  const safeScore = Math.max(0, Math.min(maxScore, score));
  const percentage = Math.round((safeScore / maxScore) * 100);

  const filled = Math.max(0, Math.min(10, Math.round((safeScore / maxScore) * 10)));
  const empty = 10 - filled;

  const bar = "▰".repeat(filled) + "▱".repeat(empty);

  let icon;
  let label;

  if (percentage >= 90) {
    icon = "🟢";
    label = "عالی";
  } else if (percentage >= 75) {
    icon = "🟡";
    label = "قوی";
  } else if (percentage >= 60) {
    icon = "🟠";
    label = "متوسط";
  } else {
    icon = "🔴";
    label = "ضعیف";
  }

  return {
    percentage,
    bar,
    icon,
    label,
    text: `${icon} ${percentage}% ${bar} (${safeScore}/${maxScore})`
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtPercent(value) {
  if (value === null || value === undefined) return "-";
  const v = parseFloat(value);
  if (!Number.isFinite(v)) return "-";
  return (v * 100).toFixed(2) + "%";
}

export function formatAnalysis(r) {
  const lines = [];

  let displayStatus = statusText(r.status);
  let displayIcon = statusIcon(r.status);

  const rangeActive = r.range_setups && r.range_setups.active;
  const breakout = r.range_setups && r.range_setups.breakout;

  const bullishBreakout =
    breakout &&
    breakout.bullish === true &&
    breakout.direction === "bullish";

  const bearishBreakout =
    breakout &&
    breakout.bearish === true &&
    breakout.direction === "bearish";

  if (bullishBreakout) {
    displayStatus = "شکست صعودی";
    displayIcon = "🚀";
  } else if (bearishBreakout) {
    displayStatus = "شکست نزولی";
    displayIcon = "🔻";
  } else if (
    r.status !== "LONG" &&
    r.status !== "SHORT" &&
    r.status !== "WAIT" &&
    rangeActive
  ) {
    const rs = r.range_setups.active;

    const inZone =
      r.current_price !== null &&
      r.current_price !== undefined &&
      rs.zone_low <= r.current_price &&
      r.current_price <= rs.zone_high;

    if (inZone) {
      displayStatus = rs.direction === "bullish" ? "خرید" : "فروش";
      displayIcon = rs.direction === "bullish" ? "🟢" : "🔴";
    } else {
      displayStatus = rs.direction === "bullish"
        ? "🎯 ستاپ Long فعال (منتظر ورود)"
        : "🎯 ستاپ Short فعال (منتظر ورود)";
      displayIcon = "🎯";
    }
  }

  lines.push(displayIcon + " <b>" + escapeHtml(r.symbol) + "</b>");
  lines.push("⏱ تایم‌فریم: <b>" + escapeHtml(r.timeframe) + "</b>");
  lines.push("📌 وضعیت: <b>" + displayStatus + "</b>");
  lines.push("");
  lines.push("💰 قیمت فعلی: <b>" + fmtPrice(r.current_price) + "</b>");

  if (r._lastCandle) {
    const lc = r._lastCandle;
    const isBull = lc.close > lc.open;
    const icon = isBull ? "🟢" : "🔴";
    const text = isBull ? "صعودی" : "نزولی";

    lines.push("🕯 کندل جاری: " + icon + " <b>" + text + "</b>");

    if (lc.incomplete && lc.close_time) {
      const remaining = lc.close_time - Date.now();

      if (remaining > 0) {
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);

        let timeText = "";

        if (hours > 0) {
          timeText += hours + "h ";
        }

        timeText += minutes + "m";

        lines.push("⏱ تا بسته شدن: <b>" + timeText + "</b>");
      }
    }
  }

  if (bullishBreakout || bearishBreakout) {
    lines.push("");
    lines.push("🚨 <b>شکست معتبر رنج:</b>");

    lines.push(
      bullishBreakout
        ? "📈 جهت: <b>شکست صعودی</b>"
        : "📉 جهت: <b>شکست نزولی</b>"
    );

    if (
      breakout.level !== null &&
      breakout.level !== undefined &&
      Number.isFinite(breakout.level)
    ) {
      lines.push(
        "🎯 سطح شکست: <b>" +
        fmtPrice(breakout.level) +
        "</b>"
      );
    }

    if (
      breakout.previousClose !== null &&
      breakout.previousClose !== undefined &&
      Number.isFinite(breakout.previousClose)
    ) {
      lines.push(
        "◀️ بسته‌شدن قبلی: <b>" +
        fmtPrice(breakout.previousClose) +
        "</b>"
      );
    }

    if (
      breakout.currentClose !== null &&
      breakout.currentClose !== undefined &&
      Number.isFinite(breakout.currentClose)
    ) {
      lines.push(
        "▶️ بسته‌شدن فعلی: <b>" +
        fmtPrice(breakout.currentClose) +
        "</b>"
      );
    }
  }

  if (rangeActive) {
    const rs = r.range_setups.active;

    lines.push("");
    lines.push("🎯 <b>Range Setup فعال:</b>");

    lines.push(
      "📌 نوع: <b>" +
      (rs.direction === "bullish" ? "Long Zone" : "Short Zone") +
      "</b>"
    );

    lines.push(
      "📍 ناحیه ورود: <b>" +
      fmtPrice(rs.zone_low) +
      " — " +
      fmtPrice(rs.zone_high) +
      "</b>"
    );

    lines.push("🎯 ورود: <b>" + fmtPrice(rs.entry) + "</b>");
    lines.push("🛑 حد ضرر: <b>" + fmtPrice(rs.stop) + "</b>");

    const isBullish = rs.direction === "bullish";
    const currentPrice = r.current_price;
    const zoneLow = rs.zone_low;
    const zoneHigh = rs.zone_high;
    const entryPoint = rs.entry;
    const stopLoss = rs.stop;

    let isInsideZone = false;
    let isInvalidated = false;
    let isApproaching = false;

    if (Number.isFinite(currentPrice)) {
      if (currentPrice >= zoneLow && currentPrice <= zoneHigh) {
        isInsideZone = true;
      }

      if (isBullish && currentPrice <= stopLoss) {
        isInvalidated = true;
      } else if (!isBullish && currentPrice >= stopLoss) {
        isInvalidated = true;
      }

      if (isBullish && currentPrice < zoneLow) {
        isApproaching = true;
      } else if (!isBullish && currentPrice > zoneHigh) {
        isApproaching = true;
      }
    }

    if (isInvalidated) {
      lines.push("");
      lines.push("❌ <b>ستاپ باطل شده:</b> قیمت به حد ضرر رسیده یا از آن عبور کرده است.");
      lines.push("⛔️ <b>پیشنهاد:</b> از ورود به این معامله خودداری کنید.");
    } else if (isInsideZone) {
      lines.push("");

      const entryIsBetter = isBullish ? (entryPoint < currentPrice) : (entryPoint > currentPrice);

      if (entryIsBetter) {
        lines.push("🔥 <b>فرصت ورود:</b> قیمت هم‌اکنون داخل ناحیه ورود قرار دارد.");
        lines.push("💡 <b>پیشنهاد:</b> می‌توانید همین حالا (Market) وارد معامله شوید.");
      } else {
        lines.push("🔥 <b>فرصت ورود:</b> قیمت هم‌اکنون داخل ناحیه ورود قرار دارد.");
        lines.push("💡 <b>پیشنهاد:</b> می‌توانید در همین محدوده وارد شوید.");
      }
    } else if (isApproaching) {
      lines.push("");
      lines.push("⚠️ <b>هشدار:</b> قیمت هنوز به ناحیه ورود نرسیده است.");
      lines.push("🎯 <b>ورود پیشنهادی:</b> " + fmtPrice(entryPoint));
      lines.push("⏳ <b>پیشنهاد:</b> صبر کنید تا قیمت به ناحیه مشخص‌شده برسد.");
    }

    if (
      (rs.tp1 !== null && rs.tp1 !== undefined) ||
      (rs.tp2 !== null && rs.tp2 !== undefined) ||
      (rs.tp3 !== null && rs.tp3 !== undefined) ||
      (rs.tp4 !== null && rs.tp4 !== undefined)
    ) {
      lines.push("");
    }

    if (rs.tp1 !== null && rs.tp1 !== undefined) {
      lines.push(
        "🥇 TP1: <b>" +
        fmtPrice(rs.tp1) +
        "</b> (" +
        rs.rr1.toFixed(2) +
        "R)"
      );
    }

    if (rs.tp2 !== null && rs.tp2 !== undefined) {
      lines.push(
        "🥈 TP2: <b>" +
        fmtPrice(rs.tp2) +
        "</b> (" +
        rs.rr2.toFixed(2) +
        "R)"
      );
    }

    if (rs.tp3 !== null && rs.tp3 !== undefined) {
      lines.push(
        "🥉 TP3: <b>" +
        fmtPrice(rs.tp3) +
        "</b> (" +
        rs.rr3.toFixed(2) +
        "R)"
      );
    }

    if (rs.tp4 !== null && rs.tp4 !== undefined) {
      lines.push(
        "🎯 TP4: <b>" +
        fmtPrice(rs.tp4) +
        "</b> (" +
        rs.rr4.toFixed(2) +
        "R)"
      );
    }

    const scoreInfo = formatScoreBar(rs.score, 14);

    lines.push("");
    lines.push("💎 امتیاز ستاپ: <b>" + scoreInfo.percentage + "%</b>");
    lines.push(scoreInfo.icon + " " + scoreInfo.bar + " " + rs.score + "/14");

    if (
      rs.momentum_warning &&
      rs.momentum_reason
    ) {
      lines.push("");
      lines.push(
        "⚠️ <b>هشدار مومنتوم:</b> " +
          escapeHtml(rs.momentum_reason)
      );
      lines.push(
        "   ستاپ خلاف مومنتوم فعلی است — با احتیاط وارد شو."
      );
    }
  } else if (r.entry_zone) {
    lines.push("");
    lines.push(
      "🎯 <b>ناحیه ورود (" +
      (r.direction === "bullish" ? "بلوک خرید" : "بلوک فروش") +
      ")</b>"
    );

    lines.push(
      "<b>" +
      fmtPrice(r.entry_zone.low) +
      " — " +
      fmtPrice(r.entry_zone.high) +
      "</b>"
    );

    lines.push("📍 ورود: <b>" + fmtPrice(r.entry) + "</b>");

    const isBullish = r.direction === "bullish";
    const currentPrice = r.current_price;
    const zoneLow = r.entry_zone.low;
    const zoneHigh = r.entry_zone.high;
    const entryPoint = r.entry;
    const stopLoss = r.stop_loss;

    let isInsideZone = false;
    let isInvalidated = false;
    let isApproaching = false;

    if (Number.isFinite(currentPrice)) {
      if (currentPrice >= zoneLow && currentPrice <= zoneHigh) {
        isInsideZone = true;
      }

      if (Number.isFinite(stopLoss)) {
        if (isBullish && currentPrice <= stopLoss) {
          isInvalidated = true;
        } else if (!isBullish && currentPrice >= stopLoss) {
          isInvalidated = true;
        }
      }

      if (isBullish && currentPrice < zoneLow) {
        isApproaching = true;
      } else if (!isBullish && currentPrice > zoneHigh) {
        isApproaching = true;
      }
    }

    if (isInvalidated) {
      lines.push("");
      lines.push("❌ <b>ستاپ باطل شده:</b> قیمت به حد ضرر رسیده یا از آن عبور کرده است.");
      lines.push("⛔️ <b>پیشنهاد:</b> از ورود به این معامله خودداری کنید.");
    } else if (isInsideZone) {
      lines.push("");

      const entryIsBetter = isBullish ? (entryPoint < currentPrice) : (entryPoint > currentPrice);

      if (entryIsBetter) {
        lines.push("🔥 <b>فرصت ورود:</b> قیمت هم‌اکنون داخل ناحیه ورود قرار دارد.");
        lines.push("💡 <b>پیشنهاد:</b> می‌توانید همین حالا (Market) وارد معامله شوید.");
      } else {
        lines.push("🔥 <b>فرصت ورود:</b> قیمت هم‌اکنون داخل ناحیه ورود قرار دارد.");
        lines.push("💡 <b>پیشنهاد:</b> می‌توانید در همین محدوده وارد شوید.");
      }
    } else if (isApproaching) {
      lines.push("");
      lines.push("⚠️ <b>هشدار:</b> قیمت هنوز به ناحیه ورود نرسیده است.");
      lines.push("🎯 <b>ورود پیشنهادی:</b> " + fmtPrice(entryPoint));
      lines.push("⏳ <b>پیشنهاد:</b> صبر کنید تا قیمت به ناحیه مشخص‌شده برسد.");
    }

    if (r.stop_loss !== null && r.stop_loss !== undefined) {
      lines.push("🛑 حد ضرر: <b>" + fmtPrice(r.stop_loss) + "</b>");
    }

    if (r.targets && r.targets.length > 0) {
      lines.push("");

      const medals = ["🥇", "🥈", "🥉"];

      for (let i = 0; i < Math.min(r.targets.length, 3); i++) {
        lines.push(
          medals[i] +
          " TP" +
          (i + 1) +
          ": <b>" +
          fmtPrice(r.targets[i].price) +
          "</b> (" +
          fmtRR(r.targets[i].rr) +
          ")"
        );
      }
    }

    if (
      r.strength !== null &&
      r.strength !== undefined &&
      Number.isFinite(r.strength) &&
      r.strength > 0
    ) {
      lines.push("");
      lines.push("💎 قدرت ستاپ: <b>" + r.strength + "/100</b>");
    }
  } else {
    if (r.scenario) {
      const sc = r.scenario;

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

      const minDistance =
        MIN_SCENARIO_DISTANCE[r.timeframe] !== undefined
          ? MIN_SCENARIO_DISTANCE[r.timeframe]
          : 0.02;

      const nearBullValid =
        sc.near_bull_level !== null &&
        sc.near_bull_level !== undefined &&
        Number.isFinite(sc.near_bull_distance) &&
        sc.near_bull_distance >= minDistance;

      const nearBearValid =
        sc.near_bear_level !== null &&
        sc.near_bear_level !== undefined &&
        Number.isFinite(sc.near_bear_distance) &&
        sc.near_bear_distance >= minDistance;

      const rangeBullValid =
        sc.bull_level !== null &&
        sc.bull_level !== undefined &&
        sc.bull_level !== sc.near_bull_level &&
        Number.isFinite(sc.bull_distance) &&
        sc.bull_distance >= minDistance;

      const rangeBearValid =
        sc.bear_level !== null &&
        sc.bear_level !== undefined &&
        sc.bear_level !== sc.near_bear_level &&
        Number.isFinite(sc.bear_distance) &&
        sc.bear_distance >= minDistance;

      const hasAnyScenario =
        nearBullValid ||
        nearBearValid ||
        rangeBullValid ||
        rangeBearValid;

      if (hasAnyScenario) {
        lines.push("");
        lines.push("🎯 <b>منتظر این سناریوها باش:</b>");

        if (nearBullValid) {
          lines.push("");
          lines.push("📈 <b>شکست نزدیک (کوتاه‌مدت):</b>");
          lines.push(
            "   ورود بالای <b>" +
            fmtPrice(sc.near_bull_level) +
            "</b> (" +
            fmtPercent(sc.near_bull_distance) +
            ")"
          );
        }

        if (nearBearValid) {
          lines.push("");
          lines.push("📉 <b>شکست نزدیک (کوتاه‌مدت):</b>");
          lines.push(
            "   ورود زیر <b>" +
            fmtPrice(sc.near_bear_level) +
            "</b> (" +
            fmtPercent(sc.near_bear_distance) +
            ")"
          );
        }

        if (rangeBullValid) {
          lines.push("");
          lines.push("📈 <b>شکست دور (بلندمدت):</b>");
          lines.push(
            "   ورود بالای <b>" +
            fmtPrice(sc.bull_level) +
            "</b> (" +
            fmtPercent(sc.bull_distance) +
            ")"
          );
        }

        if (rangeBearValid) {
          lines.push("");
          lines.push("📉 <b>شکست دور (بلندمدت):</b>");
          lines.push(
            "   ورود زیر <b>" +
            fmtPrice(sc.bear_level) +
            "</b> (" +
            fmtPercent(sc.bear_distance) +
            ")"
          );
        }

        if (
          sc.bull_level &&
          sc.bear_level &&
          sc.bull_level > sc.bear_level &&
          r.current_price
        ) {
          const rangeSize = sc.bull_level - sc.bear_level;
          const positionPct =
            ((r.current_price - sc.bear_level) / rangeSize) * 100;
          const pct = Math.max(0, Math.min(100, positionPct));

          let posIcon = "⚪";

          if (pct > 50) {
            posIcon = "⬆️";
          } else if (pct < 50) {
            posIcon = "⬇️";
          }

          lines.push("");
          lines.push(
            "📍 موقعیت در رنج: " +
            posIcon +
            " <b>" +
            pct.toFixed(1) +
            "%</b>"
          );
        }
      }
    }
  }

  if (
    r.nearby_obs &&
    (r.nearby_obs.bullish.length > 0 ||
      r.nearby_obs.bearish.length > 0)
  ) {
    lines.push("");
    lines.push("🎯 <b>سطوح کلیدی:</b>");

    let counter = 1;

    for (const ob of r.nearby_obs.bearish) {
      let tag = "";

      if (ob.source && ob.source.indexOf("frvp") !== -1) {
        tag += " 📊";
      }

      if (ob.isPoc) {
        tag += " 🎯POC";
      }

      if (ob.confluence) {
        tag += " ⚡";
      }

      lines.push(
        "   🔴 مقاومت " +
        counter +
        ": <b>" +
        fmtPrice(ob.mid) +
        "</b>" +
        tag
      );

      counter++;
    }

    counter = 1;

    for (const ob of r.nearby_obs.bullish) {
      let tag = "";

      if (ob.source && ob.source.indexOf("frvp") !== -1) {
        tag += " 📊";
      }

      if (ob.isPoc) {
        tag += " 🎯POC";
      }

      if (ob.confluence) {
        tag += " ⚡";
      }

      lines.push(
        "   🟢 حمایت " +
        counter +
        ": <b>" +
        fmtPrice(ob.mid) +
        "</b>" +
        tag
      );

      counter++;
    }
  }

  const activeSetupForLeverage =
  (rangeActive && r.range_setups.active) ||
  null;

const setupEntry = activeSetupForLeverage
  ? activeSetupForLeverage.entry
  : r.entry;

const setupStop = activeSetupForLeverage
  ? activeSetupForLeverage.stop
  : r.stop_loss;

if (
  r.status === "LONG" ||
  r.status === "SHORT" ||
  r.status === "WAIT" ||
  rangeActive
) {
  const hasValidSetup =
    Number.isFinite(setupEntry) &&
    Number.isFinite(setupStop) &&
    setupEntry > 0 &&
    setupStop > 0 &&
    setupEntry !== setupStop;

  if (hasValidSetup) {
  const stopPct = Math.abs(setupEntry - setupStop) / setupEntry * 100;
  const levels = calcLeverageLevels(stopPct);

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(
    "🎚 اهرم پیشنهادی : <b>" +
    levels[0] + "X , " +
    levels[1] + "X , " +
    levels[2] + "X , " +
    levels[3] + "X</b>"
  );
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
}
}

  if (
    r.status === "NO_TRADE" &&
    r._noTradeReason &&
    (!r.range_setups || !r.range_setups.active)
  ) {
    lines.push("");
    lines.push("💡 <b>دلیل:</b> " + escapeHtml(r._noTradeReason));
  }

  const hasActiveTrade =
    (rangeActive && r.range_setups.active) ||
    (r.entry_zone && (r.status === "LONG" || r.status === "SHORT" || r.status === "WAIT"));

  if (hasActiveTrade) {
    lines.push("");
    lines.push("💡 <b>مدیریت ریسک و سرمایه:</b>");
    lines.push("🔸 با تاچ شدن TP1، حد ضرر (Stop) را به نقطه ورود (Breakeven) منتقل کنید.");
    lines.push("🔸 با تاچ شدن TP2، حد ضرر را به TP1 منتقل کنید.");
    lines.push("🔸 با تاچ شدن TP3، حد ضرر را به TP2 منتقل کنید.");
    lines.push("🔸 در صورت نیاز به خروج زودهنگام، به ساختار بازار در تایم‌فریم بالاتر دقت کنید.");
  }

  lines.push("");
  lines.push("⚠️ این خروجی تحلیل الگوریتمی است و تضمین سود نیست.");

  return lines.join("\n");
}

export function formatSignalResult(sig, newStatus) {
  const isBullish = sig.direction === "bullish";

  if (newStatus === "stopped") {
    return (
      "🛑 <b>حد ضرر فعال شد</b>\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "🔸 ارز: <b>" + escapeHtml(sig.symbol) + "</b>\n" +
      "⏱ تایم‌فریم: <b>" + escapeHtml(sig.timeframe) + "</b>\n" +
      "📌 جهت: " + (isBullish ? "🟢 خرید (Long)" : "🔴 فروش (Short)") + "\n\n" +
      "💡 مدیریت سرمایه را رعایت کنید. بازار همیشه فرصت‌های جدیدی دارد."
    );
  }

  let title = "";
  let hitLevel = "";

  if (newStatus === "tp1_hit") {
    title = "🥇 تارگت اول زده شد!";
    hitLevel = "TP1";
  } else if (newStatus === "tp2_hit") {
    title = "🥈 تارگت دوم زده شد!";
    hitLevel = "TP2";
  } else if (newStatus === "tp3_hit") {
    title = "🥉 تارگت سوم زده شد!";
    hitLevel = "TP3";
  }

  if (!title) {
    return "";
  }

  return (
    "✅ <b>" + title + "</b>\n" +
    "━━━━━━━━━━━━━━━━━━━━━━\n" +
    "🔸 ارز: <b>" + escapeHtml(sig.symbol) + "</b>\n" +
    "⏱ تایم‌فریم: <b>" + escapeHtml(sig.timeframe) + "</b>\n" +
    "📌 جهت: " + (isBullish ? "🟢 خرید" : "🔴 فروش") + "\n\n" +
    "🎯 تارگت زده شده: <b>" + hitLevel + "</b>\n" +
    "💰 سود تا این لحظه: <b>" + (sig.maxR || 0) + "R</b>\n\n" +
    "💡 لطفاً حد ضرر خود را مدیریت کنید (حداقل به نقطه ورود)."
  );
}

export function formatTradeClosed(sig, lastTpHit, totalR, maxR) {
  const isBullish = sig.direction === "bullish";
  const isStopped = lastTpHit === "stopped";

  let title = "🏁 <b>معامله بسته شد</b>";
  let reasonText = "";
  let resultText = "";

  if (isStopped) {
    if (!maxR || maxR <= 0) {
      title = "🛑 <b>معامله با ضرر بسته شد</b>";
      reasonText = "❌ <b>حد ضرر فعال شد (بدون تاچ تارگت)</b>";
      resultText = "💰 ضرر: <b>" + (maxR || 0) + "R</b>";
    } else {
      title = "🏁 <b>معامله بسته شد (حد ضرر)</b>";
      const lastTp = maxR >= (sig.rr3 || 0) && sig.tp3 ? "TP3" :
                     maxR >= (sig.rr2 || 0) && sig.tp2 ? "TP2" :
                     maxR >= (sig.rr1 || 0) && sig.tp1 ? "TP1" : "TP1";
      reasonText = "🛑 <b>حد ضرر فعال شد بعد از تاچ " + lastTp + "</b>";
      resultText = "💰 سود تا این لحظه: <b>" + (totalR || 0) + "R</b>";
    }
  } else {
    const tpLabels = {
      "tp1_hit": "TP1 (تارگت اول)",
      "tp2_hit": "TP2 (تارگت دوم)",
      "tp3_hit": "TP3 (تارگت سوم)"
    };
    title = "🏁 <b>معامله با موفقیت بسته شد</b>";
    reasonText = "✅ آخرین تارگت زده شده: <b>" + (tpLabels[lastTpHit] || lastTpHit) + "</b>";
    resultText = "💰 سود کل: <b>" + (totalR || 0) + "R</b>";
  }

  return (
    title + "\n" +
    "━━━━━━━━━━━━━━━━━━━━━━\n" +
    "🔸 ارز: <b>" + escapeHtml(sig.symbol) + "</b>\n" +
    "⏱ تایم‌فریم: <b>" + escapeHtml(sig.timeframe) + "</b>\n" +
    "📌 جهت: " + (isBullish ? "🟢 خرید" : "🔴 فروش") + "\n\n" +
    reasonText + "\n" +
    resultText + "\n\n" +
    "💡 مدیریت سرمایه را رعایت کنید. منتظر سیگنال بعدی باشید."
  );
}

export function formatWeeklyReport(stats) {
  const { allTime, byTimeframe, byDirection, weekly } = stats;
  const lines = [];

  lines.push("📊 <b>گزارش عملکرد هفتگی ربات</b>");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("📅 بازه: <b>" + escapeHtml(weekly.startDate) + " تا " + escapeHtml(weekly.endDate) + "</b>");
  lines.push("");
  lines.push("📈 <b>آمار هفته گذشته:</b>");
  lines.push("   📤 کل سیگنال: <b>" + weekly.total + "</b>");
  lines.push("   🥇 رسیده به TP1: <b>" + weekly.tp1Hit + "</b>");
  lines.push("   🥈 رسیده به TP2: <b>" + weekly.tp2Hit + "</b>");
  lines.push("   🥉 رسیده به TP3: <b>" + weekly.tp3Hit + "</b>");
  lines.push("   🛑 استاپ خورده: <b>" + weekly.stopped + "</b>");
  lines.push("   ⏳ در جریان: <b>" + weekly.active + "</b>");

  if (weekly.bestTrade) {
    lines.push("");
    lines.push("🏆 بهترین معامله: <b>" + escapeHtml(weekly.bestTrade.symbol) + "</b> [" + escapeHtml(weekly.bestTrade.timeframe) + "] با <b>" + weekly.bestTrade.rr + "R</b>");
  }

  const totalDone = allTime.total - allTime.active;
  if (totalDone > 0) {
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("📊 <b>آمار کل (از ابتدا):</b>");
    lines.push("   📤 کل سیگنال: <b>" + allTime.total + "</b>");
    lines.push("");
    lines.push("🎯 <b>نرخ موفقیت:</b>");
    lines.push("   🥇 TP1: <b>" + allTime.tp1Rate + "%</b> (" + allTime.tp1Hit + "/" + totalDone + ")");
    lines.push("   🥈 TP2: <b>" + allTime.tp2Rate + "%</b> (" + allTime.tp2Hit + "/" + totalDone + ")");
    lines.push("   🥉 TP3: <b>" + allTime.tp3Rate + "%</b> (" + allTime.tp3Hit + "/" + totalDone + ")");
    lines.push("   🛑 Stop: <b>" + allTime.stopRate + "%</b> (" + allTime.stopped + "/" + totalDone + ")");
  }

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("⏱ <b>عملکرد به تفکیک تایم‌فریم:</b>");
  for (const tf of ["15m", "30m", "1h", "2h"]) {
    const t = byTimeframe[tf];
    if (t && t.total > 0) {
      lines.push("   <b>" + tf + "</b> → " + t.total + " سیگنال | TP1: <b>" + t.tp1Rate + "%</b>");
    }
  }

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("📊 <b>عملکرد به تفکیک جهت:</b>");
  for (const dir of ["bullish", "bearish"]) {
    const d = byDirection[dir];
    if (d && d.total > 0) {
      const label = dir === "bullish" ? "🟢 Long" : "🔴 Short";
      lines.push("   " + label + " → " + d.total + " سیگنال | TP1: <b>" + d.tp1Rate + "%</b>");
    }
  }

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("⚠️ آمار بر اساس تحلیل الگوریتمی است و تضمین سود نیست.");

  return lines.join("\n");
}
