const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
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

async function writeHtmlSnapshot(targetId, startedAt, html) {
  const dir = await ensureEvidenceDir(targetId, startedAt);
  const name = uniqueName("snapshot", "html");
  const fullPath = path.join(dir, name);
  await fs.writeFile(fullPath, html, "utf8");
  return toRelative(fullPath);
}

async function prepareScreenshotPath(targetId, startedAt) {
  const dir = await ensureEvidenceDir(targetId, startedAt);
  const name = uniqueName("screenshot", "png");
  const fullPath = path.join(dir, name);
  return {
    fullPath,
    relativePath: toRelative(fullPath)
  };
}

module.exports = {
  writeHtmlSnapshot,
  prepareScreenshotPath
};

