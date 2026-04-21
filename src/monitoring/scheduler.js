const { prisma } = require("../db/prisma");
const config = require("../utils/config");
const logger = require("../utils/logger");

const inFlightTargets = new Map();
let hydrated = false;

async function hydrateInFlight(queue) {
  try {
    const jobs = await queue.getJobs(["wait", "active"], 0, -1);
    for (const job of jobs) {
      if (job && job.data && job.data.targetId) {
        inFlightTargets.set(job.data.targetId, {
          jobId: job.id,
          enqueuedAt: job.timestamp || Date.now()
        });
      }
    }
  } catch (error) {
    logger.warn(error, "Failed to hydrate in-flight jobs");
  }
}

async function isJobActive(queue, entry) {
  if (!entry || !entry.jobId) return false;
  try {
    const job = await queue.getJob(entry.jobId);
    if (!job) return false;
    const state = await job.getState();
    return ["waiting", "active", "delayed", "paused"].includes(state);
  } catch (error) {
    logger.warn(error, "Failed to inspect in-flight job");
    return false;
  }
}

async function scheduleDueTargets(queue) {
  const targets = await prisma.target.findMany({
    where: { isEnabled: true },
    select: {
      id: true,
      intervalSec: true,
      checkResults: {
        take: 1,
        orderBy: { startedAt: "desc" },
        select: { startedAt: true }
      }
    }
  });

  const now = Date.now();
  for (const target of targets) {
    const lastCheck = target.checkResults[0];
    const lastTime = lastCheck ? new Date(lastCheck.startedAt).getTime() : 0;
    const intervalMs = target.intervalSec * 1000;

    if (now - lastTime < intervalMs) {
      continue;
    }

    const inFlightEntry = inFlightTargets.get(target.id);
    if (inFlightEntry) {
      const stillActive = await isJobActive(queue, inFlightEntry);
      if (stillActive) {
        continue;
      }
      inFlightTargets.delete(target.id);
    }

    const bucket = Math.floor(now / intervalMs);
    const jobId = `target:${target.id}:${bucket}`;

    try {
      await queue.add(
        "check",
        { targetId: target.id },
        {
          jobId,
          removeOnComplete: 1000,
          removeOnFail: 1000
        }
      );
      inFlightTargets.set(target.id, { jobId, enqueuedAt: now });
    } catch (error) {
      logger.warn(error, "Failed to enqueue check");
    }
  }
}

function startScheduler(queue) {
  const interval = 5000;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      if (!hydrated) {
        await hydrateInFlight(queue);
        hydrated = true;
      }
      await scheduleDueTargets(queue);
    } catch (error) {
      logger.error(error, "Scheduler error");
    } finally {
      running = false;
    }
  };

  run();
  setInterval(run, interval);
  logger.info("Scheduler started");
}

function releaseTarget(targetId) {
  if (!targetId) return;
  inFlightTargets.delete(targetId);
}

module.exports = {
  startScheduler,
  releaseTarget
};

