const { prisma } = require("../db/prisma");
const { negativeScoreThreshold, phashDeltaThreshold, cleanChecksToClose } = require("./rules");

const severityRank = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
};

function maxSeverity(a, b) {
  if (severityRank[b] > severityRank[a]) return b;
  return a;
}

function shouldOpenIncident({ checkStatus, detector, redirectSuspicious, textChanged, phashDelta }) {
  if (checkStatus === "DOWN") return true;
  if (detector.defaced || detector.score >= negativeScoreThreshold) return true;
  if (redirectSuspicious && textChanged) return true;
  if (phashDelta !== null && phashDelta >= phashDeltaThreshold && detector.defaced) return true;
  return false;
}

function severityForIncident(checkStatus, detector) {
  if (checkStatus === "SUSPECTED_DEFACEMENT" || detector.defaced) return "HIGH";
  if (checkStatus === "DOWN" || checkStatus === "REDIRECT") return "MEDIUM";
  if (checkStatus === "CHANGED") return "LOW";
  return detector.severity || "LOW";
}

async function handleIncident({
  target,
  checkResult,
  detector,
  redirectSuspicious,
  textChanged,
  phashDelta,
  reasons
}) {
  const now = new Date();
  const shouldOpen = shouldOpenIncident({
    checkStatus: checkResult.status,
    detector,
    redirectSuspicious,
    textChanged,
    phashDelta
  });

  const openIncident = await prisma.incident.findFirst({
    where: {
      targetId: target.id,
      status: { in: ["OPEN", "ACK"] }
    },
    orderBy: { openedAt: "desc" }
  });

  if (shouldOpen) {
    const severity = severityForIncident(checkResult.status, detector);
    const confidence = detector.score || 0;

    if (openIncident) {
      const updated = await prisma.incident.update({
        where: { id: openIncident.id },
        data: {
          lastSeenAt: now,
          latestCheckResultId: checkResult.id,
          confidence,
          reasonsJson: reasons,
          severity: maxSeverity(openIncident.severity, severity),
          cleanStreak: 0
        }
      });

      return {
        incident: updated,
        action: "updated",
        severityChanged: severityRank[updated.severity] > severityRank[openIncident.severity]
      };
    }

    const created = await prisma.incident.create({
      data: {
        targetId: target.id,
        openedAt: now,
        lastSeenAt: now,
        status: "OPEN",
        severity,
        confidence,
        reasonsJson: reasons,
        latestCheckResultId: checkResult.id,
        cleanStreak: 0
      }
    });

    return { incident: created, action: "created", severityChanged: false };
  }

  if (openIncident) {
    const cleanStreak = openIncident.cleanStreak + 1;
    if (cleanStreak >= cleanChecksToClose) {
      const closed = await prisma.incident.update({
        where: { id: openIncident.id },
        data: {
          status: "CLOSED",
          closedAt: now,
          cleanStreak
        }
      });
      return { incident: closed, action: "closed", severityChanged: false };
    }

    await prisma.incident.update({
      where: { id: openIncident.id },
      data: { cleanStreak }
    });
    return { incident: openIncident, action: "clean", severityChanged: false };
  }

  return { incident: null, action: "none", severityChanged: false };
}

module.exports = {
  handleIncident
};

