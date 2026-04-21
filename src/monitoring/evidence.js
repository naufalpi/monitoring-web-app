const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const Jimp = require("jimp");
const config = require("../utils/config");

function formatDateFolder(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function ensureEvidenceDir(targetId, startedAt) {
  const baseDir = path.join(config.storagePath, "targets", targetId, formatDateFolder(startedAt));
  await fs.mkdir(baseDir, { recursive: true });
  return baseDir;
}

function uniqueName(prefix, ext) {
  const rand = crypto.randomBytes(6).toString("hex");
  const timestamp = Date.now();
  return `${prefix}-${timestamp}-${rand}.${ext}`;
}

function toRelative(fullPath) {
  return path
    .relative(config.storagePath, fullPath)
    .split(path.sep)
    .join("/");
}

async function persistIncidentScreenshot(sourceImage, targetId, startedAt) {
  const dir = await ensureEvidenceDir(targetId, startedAt);
  const name = uniqueName("incident", "jpg");
  const fullPath = path.join(dir, name);
  const image = sourceImage instanceof Jimp ? sourceImage.clone() : await Jimp.read(sourceImage);

  if (config.evidenceMaxWidth > 0 && image.bitmap.width > config.evidenceMaxWidth) {
    image.resize(config.evidenceMaxWidth, Jimp.AUTO);
  }

  image.quality(config.evidenceJpegQuality);
  await image.writeAsync(fullPath);

  return toRelative(fullPath);
}

async function deleteStoredEvidence(relPath) {
  if (!relPath) return;
  const basePath = path.resolve(config.storagePath);
  const fullPath = path.resolve(basePath, relPath);
  if (!fullPath.startsWith(basePath)) {
    return;
  }

  try {
    await fs.unlink(fullPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function cleanupLegacyTempStorage() {
  try {
    await fs.rm(path.join(config.storagePath, "_tmp"), { recursive: true, force: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

module.exports = {
  cleanupLegacyTempStorage,
  deleteStoredEvidence,
  persistIncidentScreenshot
};

