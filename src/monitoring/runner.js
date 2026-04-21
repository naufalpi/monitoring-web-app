const { prisma } = require("../db/prisma");
const config = require("../utils/config");
const logger = require("../utils/logger");
const { lightCheck } = require("./checkers/lightCheck");
const { deepCheck } = require("./checkers/deepCheck");
const { scoreContent, mergeDetections } = require("./detector");
const { sha256, computeDHash, hammingDistance } = require("./hash");
const { runOcrIfEnabled } = require("./ocr");
const { detectImageContent } = require("./imageDetector");
const { handleIncident } = require("./incident");
const { maybeNotify } = require("./notifier");
const { maybePruneTargetHistory } = require("./retention");
const {
  isSuspiciousRedirect,
  shouldDeepCheck,
  evaluateStatus,
  hasContentChanged
} = require("./status");
const { publishEvent } = require("../services/eventBus");

const deepSemaphore = createSemaphore(config.deepCheckConcurrency);
const domainLastCheck = new Map();

async function runCheck(targetId, publisher) {
  const target = await prisma.target.findUnique({ where: { id: targetId } });
  if (!target || !target.isEnabled) {
    return;
  }

  await enforceDomainDelay(target.url);

  const startedAt = new Date();
  const previousPromise = prisma.checkResult.findFirst({
    where: { targetId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      startedAt: true,
      htmlHash: true,
      textHash: true,
      screenshotPhash: true,
      extractedText: true
    }
  });
  const light = await lightCheck(target.url);
  const previous = await previousPromise;

  const redirectSuspicious = isSuspiciousRedirect(target.url, light.finalUrl);
  const detectorLight = scoreContent(light.text || "");
  const lightTextLength = (light.text || "").length;
  const previousTextLength = previous && previous.extractedText ? previous.extractedText.length : 0;
  const forceDeepCheck =
    (config.deepCheckOnFirstRun && !previous) ||
    (previous && previousTextLength >= config.minTextLengthForLight && lightTextLength < config.minTextLengthForLight);

  let deep = null;
  if (shouldDeepCheck({ light, previous, detector: detectorLight, redirectSuspicious, forceDeepCheck })) {
    try {
      deep = await deepSemaphore.run(() => deepCheck(target.url));
    } catch (error) {
      logger.warn(error, "Deep check failed");
      deep = null;
    }
  }

  const finalText = deep && deep.ok ? deep.text : light.text || "";
  const finalHtml = deep && deep.ok ? deep.sanitizedHtml : light.sanitizedHtml;
  const finalUrl = deep && deep.ok ? deep.finalUrl : light.finalUrl;
  const httpStatus = deep && deep.ok ? deep.httpStatus : light.httpStatus;
  const title = deep && deep.ok ? deep.title : light.title;

  let ocrText = "";
  let imageSignal = null;
  let screenshotPhash = null;
  const screenshotBuffer = deep && deep.ok ? deep.screenshotBuffer : null;
  if (screenshotBuffer) {
    const [ocrResult, imageResult, phashResult] = await Promise.all([
      runOcrIfEnabled(screenshotBuffer),
      detectImageContent(screenshotBuffer),
      computeDHash(screenshotBuffer).catch((error) => {
        logger.warn(error, "Failed to compute screenshot hash");
        return null;
      })
    ]);
    ocrText = ocrResult || "";
    imageSignal = imageResult || null;
    screenshotPhash = phashResult || null;
  }

  const combinedText = [title, finalText, ocrText].filter(Boolean).join(" ");
  const detector = mergeDetections(scoreContent(combinedText), imageSignal);

  const htmlHash = finalHtml ? sha256(finalHtml) : null;
  const textHash = combinedText ? sha256(combinedText) : null;

  const phashDelta =
    previous && previous.screenshotPhash && screenshotPhash
      ? hammingDistance(previous.screenshotPhash, screenshotPhash)
      : null;

  const status = evaluateStatus({
    light,
    deep,
    previous,
    detector,
    redirectSuspicious,
    phashDelta,
    currentHashes: { htmlHash, textHash }
  });

  const textChanged = hasContentChanged(previous, { htmlHash, textHash });
  const persistDetailedContent = shouldPersistDetailedContent(status, detector, redirectSuspicious);

  const finishedAt = new Date();
  const checkResult = await prisma.checkResult.create({
    data: {
      targetId: target.id,
      startedAt,
      finishedAt,
      status,
      httpStatus: httpStatus || null,
      finalUrl: finalUrl || null,
      responseTimeMs: light.responseTimeMs || null,
      htmlHash,
      textHash,
      screenshotPath: null,
      screenshotPhash,
      title: title || null,
      extractedText: persistDetailedContent ? combinedText.slice(0, config.detailedExtractedTextMaxChars) : null,
      detectorScore: detector.score,
      detectorReasonsJson: persistDetailedContent ? detector.reasons : null,
      htmlSnapshotPath: null
    }
  });

  const reasons = collectReasons({
    status,
    httpStatus,
    finalUrl,
    redirectSuspicious,
    textChanged,
    phashDelta,
    detector
  });

  const incidentResult = await handleIncident({
    target,
    checkResult,
    detector,
    redirectSuspicious,
    textChanged,
    phashDelta,
    reasons,
    screenshotBuffer
  });

  await maybePruneTargetHistory(target.id);

  const openIncidentId =
    incidentResult.incident && ["OPEN", "ACK"].includes(incidentResult.incident.status)
      ? incidentResult.incident.id
      : null;
  const incidentPayload = buildIncidentPayload(incidentResult.incident, target);

  if (incidentResult.incident) {
    try {
      await maybeNotify({
        incident: incidentResult.incident,
        target,
        reasons,
        confidence: detector.score,
        action: incidentResult.action,
        severityChanged: incidentResult.severityChanged
      });
    } catch (error) {
      logger.warn(error, "Failed to send notification");
    }
  }

  if (publisher) {
    try {
      await publishEvent(publisher, {
        type: "check.completed",
        targetId: target.id,
        targetName: target.name,
        targetUrl: target.url,
        status,
        responseTimeMs: light.responseTimeMs || null,
        lastCheck: startedAt.toISOString(),
        lastIncidentId: openIncidentId,
        incidentId: incidentResult.incident ? incidentResult.incident.id : null,
        at: finishedAt.toISOString()
      });

      if (incidentResult.action === "created") {
        await publishEvent(publisher, {
          type: "incident.opened",
          ...incidentPayload,
          at: finishedAt.toISOString()
        });
      } else if (incidentResult.action === "updated") {
        await publishEvent(publisher, {
          type: "incident.updated",
          ...incidentPayload,
          at: finishedAt.toISOString()
        });
      } else if (incidentResult.action === "closed") {
        await publishEvent(publisher, {
          type: "incident.closed",
          ...incidentPayload,
          at: finishedAt.toISOString()
        });
      }
    } catch (error) {
      logger.warn(error, "Failed to publish SSE event");
    }
  }
}

async function enforceDomainDelay(targetUrl) {
  try {
    const hostname = new URL(targetUrl).hostname;
    const last = domainLastCheck.get(hostname) || 0;
    const now = Date.now();
    const wait = config.perDomainDelayMs - (now - last);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    domainLastCheck.set(hostname, Date.now());
  } catch (error) {
    // Ignore invalid URLs here; validation happens in checkers.
  }
}

function collectReasons({ status, httpStatus, finalUrl, redirectSuspicious, textChanged, phashDelta, detector }) {
  const reasons = new Set(detector.reasons || []);

  if (status === "DOWN") {
    reasons.add(`HTTP status: ${httpStatus || "timeout"}`);
  }

  if (redirectSuspicious && finalUrl) {
    reasons.add(`Redirected to: ${finalUrl}`);
  }

  if (textChanged) {
    reasons.add("Content hash changed");
  }

  if (phashDelta !== null) {
    reasons.add(`Layout change (pHash delta ${phashDelta})`);
  }

  return Array.from(reasons).slice(0, 12);
}

function createSemaphore(limit) {
  let active = 0;
  const queue = [];

  const acquire = () => {
    if (active < limit) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => queue.push(resolve)).then(() => {
      active += 1;
    });
  };

  const release = () => {
    active = Math.max(0, active - 1);
    const next = queue.shift();
    if (next) next();
  };

  return {
    async run(task) {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    }
  };
}

function shouldPersistDetailedContent(status, detector, redirectSuspicious) {
  if (status === "SUSPECTED_DEFACEMENT" || status === "DOWN" || status === "REDIRECT") {
    return true;
  }
  if (redirectSuspicious) {
    return true;
  }
  return Boolean(detector && (detector.defaced || detector.score >= config.negativeScoreThreshold));
}

function buildIncidentPayload(incident, target) {
  if (!incident) return null;
  return {
    incidentId: incident.id,
    targetId: target.id,
    targetName: target.name,
    targetUrl: target.url,
    status: incident.status,
    severity: incident.severity,
    openedAt: incident.openedAt,
    lastSeenAt: incident.lastSeenAt
  };
}

module.exports = {
  runCheck
};

