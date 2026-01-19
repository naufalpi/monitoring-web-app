const { negativeScoreThreshold, phashDeltaThreshold } = require("./rules");

function isSuspiciousRedirect(originalUrl, finalUrl) {
  if (!originalUrl || !finalUrl) return false;
  try {
    const orig = new URL(originalUrl);
    const final = new URL(finalUrl);
    if (orig.hostname !== final.hostname) return true;
    if (orig.pathname !== final.pathname) return true;
  } catch (error) {
    return false;
  }
  return false;
}

function hasContentChanged(previous, current) {
  if (!previous || !current) return false;
  if (previous.htmlHash && current.htmlHash && previous.htmlHash !== current.htmlHash) return true;
  if (previous.textHash && current.textHash && previous.textHash !== current.textHash) return true;
  return false;
}

function shouldDeepCheck({ light, previous, detector, redirectSuspicious, forceDeepCheck = false }) {
  if (forceDeepCheck) return true;
  if (!light.ok) return true;
  if (light.httpStatus && light.httpStatus >= 400) return true;
  if (redirectSuspicious) return true;
  if (detector.score >= negativeScoreThreshold) return true;
  if (hasContentChanged(previous, light)) return true;
  return false;
}

function evaluateStatus({ light, deep, previous, detector, redirectSuspicious, phashDelta, currentHashes }) {
  const httpStatus = deep && deep.httpStatus ? deep.httpStatus : light.httpStatus;

  if (!light.ok || (httpStatus && httpStatus >= 400)) {
    return "DOWN";
  }

  if (detector.score >= negativeScoreThreshold || detector.defaced) {
    return "SUSPECTED_DEFACEMENT";
  }

  if (redirectSuspicious) {
    return "REDIRECT";
  }

  const hashSource = currentHashes || light || deep;
  const changeDetected = hasContentChanged(previous, hashSource) || (phashDelta !== null && phashDelta >= phashDeltaThreshold);

  if (changeDetected) {
    return "CHANGED";
  }

  return "HEALTHY";
}

module.exports = {
  isSuspiciousRedirect,
  hasContentChanged,
  shouldDeepCheck,
  evaluateStatus
};

