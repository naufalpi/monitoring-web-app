function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function sanitizeText(value, maxLen = 200) {
  if (!value) return "";
  const trimmed = String(value).trim();
  return trimmed.slice(0, maxLen);
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  isValidHttpUrl,
  sanitizeText,
  toInt
};

