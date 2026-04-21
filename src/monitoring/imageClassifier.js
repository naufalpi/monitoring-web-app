const Jimp = require("jimp");
const nsfw = require("nsfwjs");
const tf = require("@tensorflow/tfjs");
const config = require("../utils/config");
const logger = require("../utils/logger");

let modelPromise = null;

async function loadModel() {
  if (!config.enableImageClassifier) return null;
  if (modelPromise) return modelPromise;

  const modelOrUrl = config.imageClassifierModel;
  modelPromise = nsfw.load(modelOrUrl, { size: config.imageClassifierInputSize });
  return modelPromise;
}

function summarize(predictions) {
  const byClass = new Map();
  for (const item of predictions || []) {
    byClass.set(item.className, item.probability);
  }

  const threshold = Math.max(0.1, Math.min(0.99, config.imageClassifierMinConfidence));
  const weights = [
    { name: "Porn", weight: 1.0, label: "NSFW: Porn" },
    { name: "Hentai", weight: 0.9, label: "NSFW: Hentai" },
    { name: "Sexy", weight: 0.7, label: "NSFW: Sexy" }
  ];

  let score = 0;
  const reasons = [];
  let top = null;

  for (const entry of weights) {
    const prob = byClass.get(entry.name) || 0;
    if (prob >= threshold) {
      const weighted = Math.round(prob * 100 * entry.weight);
      if (weighted > score) {
        score = weighted;
        top = { label: entry.label, prob };
      }
    }
  }

  if (top) {
    reasons.push(`${top.label} (${(top.prob * 100).toFixed(1)}%)`);
  }

  return {
    score,
    reasons,
    probabilities: Object.fromEntries(byClass)
  };
}

function buildTensorFromImage(image) {
  const size = Math.max(96, config.imageClassifierInputSize);
  const resized = image.clone().resize(size, size);
  const { width, height, data } = resized.bitmap;
  const values = new Uint8Array(width * height * 3);

  let offset = 0;
  for (let i = 0; i < data.length; i += 4) {
    values[offset++] = data[i];
    values[offset++] = data[i + 1];
    values[offset++] = data[i + 2];
  }

  return tf.tensor3d(values, [height, width, 3], "int32");
}

async function classifyImage(imageInput) {
  if (!config.enableImageClassifier) {
    return { score: 0, reasons: [], probabilities: {}, method: "disabled" };
  }

  try {
    const model = await loadModel();
    if (!model) {
      return { score: 0, reasons: [], probabilities: {}, method: "unavailable" };
    }

    const image = imageInput instanceof Jimp ? imageInput : await Jimp.read(imageInput);
    const tensor = buildTensorFromImage(image);
    const predictions = await model.classify(tensor);
    tensor.dispose();

    const summary = summarize(predictions);
    return { ...summary, method: "nsfwjs" };
  } catch (error) {
    logger.warn(error, "Image classifier failed");
    return { score: 0, reasons: [], probabilities: {}, method: "error" };
  }
}

module.exports = {
  classifyImage
};
