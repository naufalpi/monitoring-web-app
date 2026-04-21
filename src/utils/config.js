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
  evidenceJpegQuality: Math.min(Math.max(toInt(process.env.EVIDENCE_JPEG_QUALITY, 65), 30), 90),
  evidenceMaxWidth: Math.max(toInt(process.env.EVIDENCE_MAX_WIDTH, 1280), 320),
  incidentEvidenceRetentionCount: Math.max(toInt(process.env.INCIDENT_EVIDENCE_RETENTION_COUNT, 2), 1),
  checkResultRetentionCount: Math.max(toInt(process.env.CHECK_RESULT_RETENTION_COUNT, 60), 10),
  checkResultPruneIntervalMin: Math.max(toInt(process.env.CHECK_RESULT_PRUNE_INTERVAL_MIN, 10), 1),
  detailedExtractedTextMaxChars: Math.max(toInt(process.env.DETAILED_EXTRACTED_TEXT_MAX_CHARS, 3000), 500),
  closedIncidentRetentionDays: Math.max(toInt(process.env.CLOSED_INCIDENT_RETENTION_DAYS, 7), 1),
  retentionMaintenanceIntervalMin: Math.max(toInt(process.env.RETENTION_MAINTENANCE_INTERVAL_MIN, 60), 5),
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

function ensureProductionConfig() {
  if (config.env !== "production") return;
  const issues = [];
  const defaultSecret = "change-me-please";
  if (!config.sessionSecret || config.sessionSecret === defaultSecret || config.sessionSecret.length < 20) {
    issues.push("SESSION_SECRET must be set to a strong value");
  }
  if (!config.appBaseUrl || config.appBaseUrl.includes("localhost")) {
    issues.push("APP_BASE_URL must be set to the public URL");
  }
  if (!config.databaseUrl) {
    issues.push("DATABASE_URL is required");
  }
  if (!config.redisUrl) {
    issues.push("REDIS_URL is required");
  }

  if (issues.length) {
    const error = new Error(`Invalid production configuration:\n- ${issues.join("\n- ")}`);
    error.code = "INVALID_CONFIG";
    throw error;
  }
}

config.ensureProductionConfig = ensureProductionConfig;
module.exports = config;

