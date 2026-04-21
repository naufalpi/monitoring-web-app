const { prisma } = require("../db/prisma");
const config = require("../utils/config");
const logger = require("../utils/logger");
const { cleanupLegacyTempStorage, deleteStoredEvidence } = require("./evidence");

const pruneState = new Map();
let maintenanceTimer = null;

async function initializeRetention() {
  try {
    await cleanupLegacyTempStorage();
  } catch (error) {
    logger.warn(error, "Failed to clean legacy temporary evidence");
  }

  await runGlobalMaintenance();
}

async function maybePruneTargetHistory(targetId) {
  const retainCount = config.checkResultRetentionCount;
  if (!targetId || retainCount <= 0) {
    return;
  }

  const now = Date.now();
  const intervalMs = Math.max(1, config.checkResultPruneIntervalMin) * 60 * 1000;
  const lastRun = pruneState.get(targetId) || 0;
  if (now - lastRun < intervalMs) {
    return;
  }
  pruneState.set(targetId, now);

  try {
    await pruneTargetHistory(targetId, retainCount);
  } catch (error) {
    logger.warn({ err: error, targetId }, "Failed to prune check history");
  }
}

function startRetentionMaintenance() {
  if (maintenanceTimer) {
    return;
  }

  const intervalMs = config.retentionMaintenanceIntervalMin * 60 * 1000;
  maintenanceTimer = setInterval(() => {
    runGlobalMaintenance().catch((error) => {
      logger.warn(error, "Retention maintenance failed");
    });
  }, intervalMs);
}

async function pruneTargetHistory(targetId, retainCount) {
  const [checks, incidents] = await Promise.all([
    prisma.checkResult.findMany({
      where: { targetId },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        screenshotPath: true,
        htmlSnapshotPath: true
      }
    }),
    prisma.incident.findMany({
      where: { targetId },
      select: {
        latestCheckResultId: true
      }
    })
  ]);

  if (checks.length <= retainCount) {
    return;
  }

  const preserveIds = new Set(
    incidents.map((incident) => incident.latestCheckResultId).filter(Boolean)
  );

  const documentedChecks = checks.filter((check) => check.screenshotPath || check.htmlSnapshotPath);
  for (const check of documentedChecks.slice(0, config.incidentEvidenceRetentionCount)) {
    preserveIds.add(check.id);
  }

  const staleChecks = checks.filter((check, index) => index >= retainCount && !preserveIds.has(check.id));
  if (staleChecks.length === 0) {
    return;
  }

  await cleanupFiles(staleChecks);
  await prisma.checkResult.deleteMany({
    where: { id: { in: staleChecks.map((check) => check.id) } }
  });
}

async function cleanupFiles(checks) {
  await Promise.all(
    checks.flatMap((check) => [
      deleteStoredEvidence(check.screenshotPath),
      deleteStoredEvidence(check.htmlSnapshotPath)
    ])
  );
}

async function runGlobalMaintenance() {
  await pruneAllTargetHistory();
  await pruneClosedIncidents();
}

async function pruneAllTargetHistory() {
  const targets = await prisma.target.findMany({
    select: { id: true }
  });

  for (const target of targets) {
    await pruneTargetHistory(target.id, config.checkResultRetentionCount);
  }
}

async function pruneClosedIncidents() {
  const cutoff = new Date(Date.now() - config.closedIncidentRetentionDays * 24 * 60 * 60 * 1000);
  const incidents = await prisma.incident.findMany({
    where: {
      status: "CLOSED",
      closedAt: { lt: cutoff }
    },
    select: {
      id: true,
      targetId: true,
      openedAt: true,
      closedAt: true
    }
  });

  if (incidents.length === 0) {
    return;
  }

  const evidenceChecks = await Promise.all(incidents.map(findIncidentEvidenceCheck));
  const evidenceById = new Map(
    evidenceChecks.filter(Boolean).map((check) => [check.id, check])
  );

  await cleanupFiles(Array.from(evidenceById.values()));

  if (evidenceById.size > 0) {
    await prisma.checkResult.updateMany({
      where: { id: { in: Array.from(evidenceById.keys()) } },
      data: {
        screenshotPath: null,
        htmlSnapshotPath: null
      }
    });
  }

  await prisma.$transaction([
    prisma.ackToken.deleteMany({ where: { incidentId: { in: incidents.map((incident) => incident.id) } } }),
    prisma.notificationLog.deleteMany({ where: { incidentId: { in: incidents.map((incident) => incident.id) } } }),
    prisma.incident.deleteMany({ where: { id: { in: incidents.map((incident) => incident.id) } } })
  ]);

  const affectedTargets = [...new Set(incidents.map((incident) => incident.targetId))];
  for (const targetId of affectedTargets) {
    await pruneTargetHistory(targetId, config.checkResultRetentionCount);
  }
}

async function findIncidentEvidenceCheck(incident) {
  if (!incident) return null;
  const startedAt = {
    gte: incident.openedAt
  };
  if (incident.closedAt) {
    startedAt.lte = incident.closedAt;
  }

  return prisma.checkResult.findFirst({
    where: {
      targetId: incident.targetId,
      startedAt,
      OR: [
        { screenshotPath: { not: null } },
        { htmlSnapshotPath: { not: null } }
      ]
    },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      screenshotPath: true,
      htmlSnapshotPath: true
    }
  });
}

module.exports = {
  initializeRetention,
  maybePruneTargetHistory,
  startRetentionMaintenance
};
