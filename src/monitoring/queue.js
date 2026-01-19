const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const config = require("../utils/config");

const QUEUE_NAME = "monitoring";

function createConnection() {
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null
  });
}

function createQueue(connection) {
  return new Queue(QUEUE_NAME, { connection });
}


function createWorker(processor, connection, concurrency) {
  return new Worker(QUEUE_NAME, processor, { connection, concurrency });
}

module.exports = {
  QUEUE_NAME,
  createConnection,
  createQueue,
  createWorker
};

