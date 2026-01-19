const Jimp = require("jimp");
const config = require("../utils/config");
const logger = require("../utils/logger");
const { classifyImage } = require("./imageClassifier");

function isSkinTone(r, g, b) {
  const cb = 128 - 0.168736 * r - 0.331364 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

function buildScore(skinPercent) {
  if (skinPercent < config.imageSkinToneThreshold) {
    return 0;
  }
  const excess = skinPercent - config.imageSkinToneThreshold;
  const base = 20;
  const scaled = Math.round(base + excess * 4);
  return Math.min(config.imageSkinToneMaxScore, scaled);
}

async function detectImageContent(imagePath) {
  if (!config.enableImageDetection) {
    return { score: 0, severity: "LOW", reasons: [], skinPercent: 0, method: "disabled" };
  }

  try {
    const image = await Jimp.read(imagePath);
    const size = Math.max(32, config.imageSampleSize);
    const stride = Math.max(1, config.imageSampleStride);
    const sample = image.clone().resize(size, size);

    const { width, height, data } = sample.bitmap;
    let skin = 0;
    let total = 0;

    for (let y = 0; y < height; y += stride) {
      for (let x = 0; x < width; x += stride) {
        const idx = (width * y + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        total += 1;
        if (isSkinTone(r, g, b)) {
          skin += 1;
        }
      }
    }

    const skinPercent = total > 0 ? (skin / total) * 100 : 0;
    const score = buildScore(skinPercent);
    const reasons = [];

    if (score > 0) {
      reasons.push(`Image skin exposure ${skinPercent.toFixed(1)}%`);
    }

    const classifier = await classifyImage(imagePath, image);
    const combinedScore = Math.min(100, score + (classifier.score || 0));
    const combinedReasons = [...reasons, ...(classifier.reasons || [])];
    const method = classifier.method && classifier.method !== "disabled" ? classifier.method : "heuristic";

    const severity = combinedScore >= 80 ? "HIGH" : combinedScore >= 60 ? "MEDIUM" : "LOW";
    return {
      score: combinedScore,
      severity,
      reasons: combinedReasons,
      skinPercent,
      method,
      classifier
    };
  } catch (error) {
    logger.warn(error, "Image detection failed");
    return { score: 0, severity: "LOW", reasons: [], skinPercent: 0, method: "error" };
  }
}

module.exports = {
  detectImageContent
};
