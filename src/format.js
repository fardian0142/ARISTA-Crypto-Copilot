import { TIMEFRAME_PROFILES } from "./config.js";
import {
  fmtPrice,
  fmtRR,
  fmtPercent,
  statusIcon,
  statusText,
  calcLeverageLevels,
  formatScoreBar
} from "./indicators.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

    if (
      rs.entry !== null &&
      rs.entry !== undefined &&
      Number.isFinite(rs.entry) &&
      rs.entry > 0 &&
      r.current_price !== null &&
      r.current_price !== undefined &&
      Number.isFinite(r.current_price) &&
      r.current_price > 0
    ) {
      const gapPct = (Math.abs(r.current_price - rs.entry) / r.current_price) * 100;

      if (gapPct >= 0.5) {
        const isAbove = r.current_price > rs.entry;
        const dirIcon = isAbove ? "⬇️" : "⬆️";
        const dirText = isAbove
          ? "بالاتر از ناحیه ورود"
          : "پایین‌تر از ناحیه ورود";

        const distanceLabel =
          gapPct >= 5
            ? " (منتظر پولبک)"
            : gapPct >= 2
              ? " (نزدیک به ورود)"
              : " (آماده ورود)";

        lines.push(
          "📏 فاصله از ورود: <b>" +
          gapPct.toFixed(2) +
          "%</b> " +
          dirIcon +
          " " +
          dirText +
          distanceLabel
        );

        if (gapPct >= 10) {
          lines.push(
            "   ⚠️ قیمت خیلی دور از ورود است — صبر کن تا پولبک بزنه."
          );
        }
      } else {
        lines.push("📏 فاصله از ورود: <b>در ناحیه ورود ✅</b>");
      }
    }

    if (rs.stop !== null && rs.stop !== undefined && Number.isFinite(rs.stop)) {
      const stopPct =
        Number.isFinite(rs.entry) && rs.entry > 0
          ? (Math.abs(rs.entry - rs.stop) / rs.entry) * 100
          : null;

      lines.push(
        "🛑 حد ضرر: <b>" +
        fmtPrice(rs.stop) +
        "</b>" +
        (stopPct !== null ? " (ریسک " + stopPct.toFixed(2) + "%)" : "")
      );
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

    if (
      r.entry !== null &&
      r.entry !== undefined &&
      Number.isFinite(r.entry) &&
      r.entry > 0 &&
      r.current_price !== null &&
      r.current_price !== undefined &&
      Number.isFinite(r.current_price) &&
      r.current_price > 0
    ) {
      const gapPct = (Math.abs(r.current_price - r.entry) / r.current_price) * 100;

      if (gapPct >= 0.5) {
        const isAbove = r.current_price > r.entry;
        const dirIcon = isAbove ? "⬇️" : "⬆️";
        const dirText = isAbove
          ? "بالاتر از ناحیه ورود"
          : "پایین‌تر از ناحیه ورود";

        const distanceLabel =
          gapPct >= 5
            ? " (منتظر پولبک)"
            : gapPct >= 2
              ? " (نزدیک به ورود)"
              : " (آماده ورود)";

        lines.push(
          "📏 فاصله از ورود: <b>" +
          gapPct.toFixed(2) +
          "%</b> " +
          dirIcon +
          " " +
          dirText +
          distanceLabel
        );

        if (gapPct >= 10) {
          lines.push(
            "   ⚠️ قیمت خیلی دور از ورود است — صبر کن تا پولبک بزنه."
          );
        }
      } else {
        lines.push("📏 فاصله از ورود: <b>در ناحیه ورود ✅</b>");
      }
    }

    if (r.stop_loss !== null && r.stop_loss !== undefined) {
      const stopPct =
        Number.isFinite(r.stop_loss) &&
        Number.isFinite(r.entry) &&
        r.entry > 0
          ? (Math.abs(r.entry - r.stop_loss) / r.entry) * 100
          : null;

      lines.push(
        "🛑 حد ضرر: <b>" +
        fmtPrice(r.stop_loss) +
        "</b>" +
        (stopPct !== null ? " (ریسک " + stopPct.toFixed(2) + "%)" : "")
      );
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

    const profile =
      r._profile ||
      TIMEFRAME_PROFILES[r.timeframe] ||
      TIMEFRAME_PROFILES["1h"];

    const minStrength =
      Number.isFinite(profile.minStrength)
        ? profile.minStrength
        : 65;

    const strength =
      Number.isFinite(r.strength)
        ? r.strength
        : 0;

    if (
      strength > 0 &&
      strength < minStrength &&
      minStrength - strength <= 10
    ) {
      const gap = minStrength - strength;

      lines.push("");
      lines.push(
        "📊 <b>نزدیک به آستانه:</b> " +
        strength +
        "/" +
        minStrength +
        " (فقط " +
        gap +
        " امتیاز کم)"
      );
      lines.push(
        "   ⚠️ اگر تهاجمی هستی، این ستاپ را با احتیاط و حجم کم بررسی کن."
      );
    }
  }

  lines.push("");
  lines.push("⚠️ این خروجی تحلیل الگوریتمی است و تضمین سود نیست.");

  return lines.join("\n");
}
