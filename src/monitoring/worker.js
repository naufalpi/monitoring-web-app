const config = require("../utils/config");
const logger = require("../utils/logger");
const { createConnection, createQueue, createWorker } = require("./queue");
const { startScheduler, releaseTarget } = require("./scheduler");
const { runCheck } = require("./runner");
const { initializeRetention, startRetentionMaintenance } = require("./retention");
const { createPublisher } = require("../services/eventBus");

async function start() {
  await initializeRetention();
  startRetentionMaintenance();
  const connection = createConnection();
  const queue = createQueue(connection);
  startScheduler(queue);

  const publisher = createPublisher();

  const worker = createWorker(
    async (job) => {
      await runCheck(job.data.targetId, publisher);
    },
    connection,
    config.checkConcurrency
  );

  worker.on("completed", (job) => {
    releaseTarget(extractTargetId(job));
    logger.info({ jobId: job.id }, "Check completed");
  });

  worker.on("failed", (job, err) => {
    releaseTarget(extractTargetId(job));
    logger.error({ jobId: job.id, err }, "Check failed");
  });

  logger.info("Worker started");
}

start().catch((error) => {
  logger.error(error, "Worker failed to start");
  process.exit(1);
});

function extractTargetId(job) {
  if (!job) return null;
  if (job.data && job.data.targetId) return job.data.targetId;
  const rawId = job.id ? String(job.id) : "";
  if (rawId.startsWith("target:")) {
    const parts = rawId.split(":");
    if (parts.length >= 2) return parts[1];
  }
  return null;
}

