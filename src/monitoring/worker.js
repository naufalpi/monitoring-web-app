const config = require("../utils/config");
const logger = require("../utils/logger");
const { createConnection, createQueue, createWorker } = require("./queue");
const { startScheduler, releaseTarget } = require("./scheduler");
const { runCheck } = require("./runner");
const { createPublisher } = require("../services/eventBus");

async function start() {
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
    releaseTarget(job.data && job.data.targetId);
    logger.info({ jobId: job.id }, "Check completed");
  });

  worker.on("failed", (job, err) => {
    releaseTarget(job && job.data && job.data.targetId);
    logger.error({ jobId: job.id, err }, "Check failed");
  });

  logger.info("Worker started");
}

start().catch((error) => {
  logger.error(error, "Worker failed to start");
  process.exit(1);
});

