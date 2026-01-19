const dotenv = require("dotenv");

dotenv.config();

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback) {
  if (value === undefined) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

const config = {
  env: process.env.NODE_ENV || "development",
  port: toInt(process.env.PORT, 3000),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  sessionSecret: process.env.SESSION_SECRET || "change-me",
  sessionName: process.env.SESSION_NAME || "monitoring.sid",
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  storagePath: process.env.STORAGE_PATH || "/storage",
  fetchTimeoutMs: toInt(process.env.FETCH_TIMEOUT_MS, 8000),
  playwrightTimeoutMs: toInt(process.env.PLAYWRIGHT_TIMEOUT_MS, 15000),
  maxBodyBytes: toInt(process.env.MAX_BODY_BYTES, 1000000),
  maxHtmlChars: toInt(process.env.MAX_HTML_CHARS, 500000),
  maxRedirects: toInt(process.env.MAX_REDIRECTS, 5),
  checkConcurrency: toInt(process.env.CHECK_CONCURRENCY, 5),
  deepCheckConcurrency: toInt(process.env.DEEP_CHECK_CONCURRENCY, 3),
  perDomainDelayMs: toInt(process.env.PER_DOMAIN_DELAY_MS, 1000),
  minTextLengthForLight: toInt(process.env.MIN_TEXT_LENGTH_FOR_LIGHT, 120),
  deepCheckOnFirstRun: toBool(process.env.DEEP_CHECK_ON_FIRST_RUN, true),
  negativeScoreThreshold: toInt(process.env.NEGATIVE_SCORE_THRESHOLD, 60),
  phashDeltaThreshold: toInt(process.env.PHASH_DELTA_THRESHOLD, 12),
  cleanChecksToClose: toInt(process.env.CLEAN_CHECKS_TO_CLOSE, 3),
  notifyCooldownMin: toInt(process.env.NOTIFY_COOLDOWN_MIN, 10),
  allowOperatorManageTargets: toBool(process.env.ALLOW_OPERATOR_MANAGE_TARGETS, false),
  enableAckLinks: toBool(process.env.ENABLE_ACK_LINKS, true),
  ackTokenTtlMin: toInt(process.env.ACK_TOKEN_TTL_MIN, 60),
  enableOcr: toBool(process.env.ENABLE_OCR, false),
  tesseractLang: process.env.TESSERACT_LANG || "eng",
  enableImageDetection: toBool(process.env.ENABLE_IMAGE_DETECTION, true),
  imageSkinToneThreshold: toInt(process.env.IMAGE_SKIN_TONE_THRESHOLD, 12),
  imageSkinToneMaxScore: toInt(process.env.IMAGE_SKIN_TONE_MAX_SCORE, 60),
  imageSampleSize: toInt(process.env.IMAGE_SAMPLE_SIZE, 120),
  imageSampleStride: toInt(process.env.IMAGE_SAMPLE_STRIDE, 2),
  enableImageClassifier: toBool(process.env.ENABLE_IMAGE_CLASSIFIER, true),
  imageClassifierModel: process.env.IMAGE_CLASSIFIER_MODEL || "MobileNetV2",
  imageClassifierMinConfidence: toFloat(process.env.IMAGE_CLASSIFIER_MIN_CONFIDENCE, 0.7),
  imageClassifierInputSize: toInt(process.env.IMAGE_CLASSIFIER_INPUT_SIZE, 224),
  loginRateLimitWindowMin: toInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MIN, 15),
  loginRateLimitMax: toInt(process.env.LOGIN_RATE_LIMIT_MAX, 5),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  logLevel: process.env.LOG_LEVEL || "info",
  timezone: process.env.TIMEZONE || "Asia/Jakarta"
};

module.exports = config;

