export const SCAN_TIMEFRAME = "2h";

export const CACHE_FILE = "cache/signals.json";

export const CACHE_TTL_HOURS = 24;

export const TIMEFRAME_PROFILES = {
  "15m": {
    strictHTF: false,
    htfPenalty: 5,
    momentumPenalty: 2,
    minStrength: 55,
    minRR: 1.3,
    allowCounterMomentum: true
  },
  "30m": {
    strictHTF: false,
    htfPenalty: 7,
    momentumPenalty: 3,
    minStrength: 60,
    minRR: 1.4,
    allowCounterMomentum: true
  },
  "1h": {
    strictHTF: false,
    htfPenalty: 10,
    momentumPenalty: 5,
    minStrength: 65,
    minRR: 1.6,
    allowCounterMomentum: false
  },
  "2h": {
    strictHTF: true,
    htfPenalty: 12,
    momentumPenalty: 6,
    minStrength: 68,
    minRR: 1.7,
    allowCounterMomentum: false
  },
  "4h": {
    strictHTF: true,
    htfPenalty: 18,
    momentumPenalty: 10,
    minStrength: 72,
    minRR: 1.8,
    allowCounterMomentum: false
  },
  "6h": {
    strictHTF: true,
    htfPenalty: 20,
    momentumPenalty: 12,
    minStrength: 75,
    minRR: 2.0,
    allowCounterMomentum: false
  },
  "12h": {
    strictHTF: true,
    htfPenalty: 25,
    momentumPenalty: 15,
    minStrength: 78,
    minRR: 2.2,
    allowCounterMomentum: false
  },
  "24h": {
    strictHTF: true,
    htfPenalty: 30,
    momentumPenalty: 18,
    minStrength: 80,
    minRR: 2.5,
    allowCounterMomentum: false
  }
};

export const CONFIG = {
  OKX_BASE_URL: "https://www.okx.com",
  BYBIT_BASE_URL: "https://api.bybit.com",
  TOOBIT_BASE_URL: "https://api.toobit.com",
  SWEEP_ZONE_DISTANCE_ATR: 1.25,
  SWEEP_MAX_EVENT_DISTANCE_ATR: 1.5,
  RANGE_SETUP_MAX_AGE: 30,
  RANGE_EXTERNAL_FRESHNESS: 100,
  RANGE_LIFECYCLE_TOLERANCE_ATR: 0.15,
  RANGE_LIFECYCLE_MIN_REMAINING_R: 0.5,
  KLINE_LIMIT: 300,
  MIN_RANGE_SETUP_SCORE: 8,
  MIN_CANDLES: 100,
  MARKET_TIMEOUT: 15000,
  ATR_PERIOD: 14,
  EMA_FAST: 20,
  EMA_SLOW: 50,
  RSI_PERIOD: 14,
  SWING_LEFT: 2,
  SWING_RIGHT: 2,
  DISPLACEMENT_ATR: 1.0,
  DISPLACEMENT_BODY: 0.55,
  DISPLACEMENT_VOLUME: 1.05,
  VOLUME_LOOKBACK: 20,
  OB_LOOKBACK: 50,
  FVG_LOOKBACK: 80,
  SL_ATR_BUFFER: 0.4,
  SL_MIN_NODE_DISTANCE_ATR: 0.5,
  MIN_RR: 1.6,
  MIN_STRENGTH: 65,
  MIN_TP1_RR: 1.0,
  OB_FVG_MAX_DIST_ATR: 0.4,
  ENTRY_ZONE_MAX_WIDTH_PCT: 0.02,
  HTF_SECOND_LEVEL: true,
  OBS_DISPLAY_COUNT: 2,
  OBS_DISPLAY_LOOKBACK: 200,
  BOS_LOOKBACK: 150,
  SWEEP_LOOKBACK: 60,
  SWEEP_MAX_EVENT_DISTANCE: 30,
  SWEEP_MIN_REJECTION: 0.25,
  MIN_TP_DISTANCE: 0.005,
  MIN_TP_DISTANCE_ATR: 0.4,
  STRUCTURE_SWINGS: 3,
  SYMBOL_CACHE_SECONDS: 3600,
  KLINE_CACHE_SECONDS: 15,
  MARKET_MAX_SYMBOLS: 1000,
  MARKET_PAGE_SIZE: 20,
  MARKET_TOP_LIMIT: 1000,
  MIN_QUOTE_VOLUME_24H: 10,
  EMA_TREND_SCORE: 6,
  EMA_TREND_NEUTRAL_MIN: 0.0015,
  FIB_LEVELS: [0.5, 0.618],
  FIB_SCORE: 8,
  FIB_TOLERANCE: 0.15,
  SCENARIO_SWING_LOOKBACK: 30,
  FRVP_BIN_COUNT: 60,
  FRVP_LOOKBACK_BARS: 100,
  FRVP_HVN_THRESHOLD: 0.6,
  FRVP_LVN_THRESHOLD: 0.3,
  FRVP_MAX_DISTANCE_ATR: 8,
  FRVP_MIN_DISTANCE_ATR: 0.3,
  FRVP_VALUE_AREA: 0.7,
  RSI_DIV_LOOKBACK: 60,
  RSI_DIV_MIN_PRICE_DIFF: 0.0015,
  RSI_DIV_MIN_RSI_DIFF: 2.5,
  RSI_DIV_MIN_DISTANCE: 5,
  RSI_DIV_MAX_DISTANCE: 60,
  RSI_DIV_STRONG_THRESHOLD: 8,
  RSI_DIV_MEDIUM_THRESHOLD: 5,
  RSI_DIV_SCORE_STRONG: 8,
  RSI_DIV_SCORE_MEDIUM: 5,
  RSI_DIV_SCORE_WEAK: 3,
  RSI_DIV_PENALTY_STRONG: 10,
  RSI_DIV_PENALTY_MEDIUM: 6,
  RSI_DIV_PENALTY_WEAK: 3,
  RSI_DIV_HIDDEN_ENABLED: true,
  RSI_DIV_MAX_PEAK_GAP: 60,
  RSI_DIV_MIN_MIDDROP: 0.008,
  RSI_DIV_MAX_STRENGTH: 15,
  RSI_DIV_BEARISH_MIN_RSI_A: 60,
  RSI_DIV_BEARISH_MIN_RSI_B: 45,
  RSI_DIV_BULLISH_MAX_RSI_A: 40,
  RSI_DIV_BULLISH_MAX_RSI_B: 55,
  RSI_DIV_HIDDEN_BEARISH_MIN_RSI_A: 55,
  RSI_DIV_HIDDEN_BEARISH_MIN_RSI_B: 50,
  RSI_DIV_HIDDEN_BULLISH_MAX_RSI_A: 45,
  RSI_DIV_HIDDEN_BULLISH_MAX_RSI_B: 50,
  MAX_TP_RR: 6.0,
  MIN_VALID_TP_COUNT: 2,
  MAX_VALID_TP_COUNT: 4,
  TP_BUFFER_ATR_MULT: 0.15,
  TP_BUFFER_MIN_PCT: 0.002,
  TP_BUFFER_MAX_PCT: 0.005,
  TP_STRUCTURE_LOOKBACK_BARS: 100,
  TP_PIP_BUFFER_PCT: 0.0002,
  TP_MIN_STRUCTURE_GAP_BARS: 2,
  SL_MARKET_STRUCTURE_LOOKBACK: 100,
  SL_PIP_BUFFER_PCT: 0.0002,
  MOMENTUM_WARNING_BODY_RATIO: 0.6,
  MOMENTUM_WARNING_PENALTY: 2,
  MOMENTUM_RSI_OVERBOUGHT: 68,
  MOMENTUM_RSI_OVERSOLD: 32,
  EXCHANGES: {
    okx: {
      priority: 1,
      enabled: true,
      maxCandles: 300,
      marketType: "swap"
    },
    bybit: {
      priority: 2,
      enabled: true,
      maxCandles: 300,
      marketType: "linear"
    },
    toobit: {
      priority: 3,
      enabled: true,
      maxCandles: 300,
      marketType: "spot"
    }
  },
  SYMBOL_ALIASES: {
    "SHIBUSDT": ["1000SHIBUSDT", "SHIB1000USDT"],
    "PEPEUSDT": ["1000PEPEUSDT", "PEPE1000USDT"],
    "FLOKIUSDT": ["1000FLOKIUSDT", "FLOKI1000USDT"],
    "BONKUSDT": ["1000BONKUSDT", "BONK1000USDT"],
    "LUNCUSDT": ["1000LUNCUSDT", "LUNC1000USDT"],
    "XECUSDT": ["1000XECUSDT", "XEC1000USDT"],
    "SATSUSDT": ["1000SATSUSDT", "SATS1000USDT"],
    "RATSUSDT": ["1000RATSUSDT", "RATS1000USDT"],
    "MOGUSDT": ["1000MOGUSDT", "MOG1000USDT"],
    "CATUSDT": ["1000CATUSDT", "CAT1000USDT"]
  },
  HTF_MAP: {
    "15m": "1h",
    "30m": "2h",
    "1h": "4h",
    "2h": "4h",
    "4h": "12h",
    "6h": "12h",
    "12h": "24h",
    "24h": null
  },
  TIMEFRAMES: {
    "15m": "15 دقیقه",
    "30m": "30 دقیقه",
    "1h": "1 ساعت",
    "2h": "2 ساعت",
    "4h": "4 ساعت",
    "6h": "6 ساعت",
    "12h": "12 ساعت",
    "24h": "24 ساعت"
  },
  OKX_INTERVAL_MAP: {
    "15m": "15m",
    "30m": "30m",
    "1h": "1H",
    "2h": "2H",
    "4h": "4H",
    "6h": "6H",
    "12h": "12H",
    "24h": "1D"
  },
  BYBIT_INTERVAL_MAP: {
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "12h": "720",
    "24h": "D"
  },
  TOOBIT_INTERVAL_MAP: {
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "6h": "6h",
    "12h": "12h",
    "24h": "1d"
  },
  EXCLUDED_BASE_ASSETS: [
    "USDT", "USDC", "FDUSD", "TUSD", "BUSD", "DAI",
    "USDE", "USDS", "EUR", "TRY", "BRL", "GBP",
    "AUD", "JPY", "RUB", "UAH", "PLN", "ARS",
    "MXN", "ZAR"
  ],
  POPULAR_SYMBOLS: [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT",
    "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT",
    "LINKUSDT", "DOTUSDT"
  ],
  HTF_SHORT_PENALTY_SCORE: 10
};

export const CACHE_TTL = {
  SYMBOLS: CONFIG.SYMBOL_CACHE_SECONDS,
  TICKERS: 300,
  KLINES: CONFIG.KLINE_CACHE_SECONDS,
  SNAPSHOT: 60
};

export const INTERVAL_MS = {
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000
};

export function isValidSymbol(symbol) {
  return (
    typeof symbol === "string" &&
    /^[A-Z0-9]{2,20}USDT$/.test(symbol)
  );
}

export function isValidTimeframe(timeframe) {
  return Object.prototype.hasOwnProperty.call(
    CONFIG.TIMEFRAMES,
    timeframe
  );
}
