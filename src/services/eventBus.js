const IORedis = require("ioredis");
const config = require("../utils/config");

const CHANNEL = "monitoring.events";

function createPublisher() {
  return new IORedis(config.redisUrl);
}

function createSubscriber(onEvent) {
  const subscriber = new IORedis(config.redisUrl);
  subscriber.subscribe(CHANNEL, (err) => {
    if (err) {
      console.error("Failed to subscribe to events", err);
    }
  });
  subscriber.on("message", (channel, message) => {
    if (channel !== CHANNEL) return;
    try {
      const event = JSON.parse(message);
      onEvent(event);
    } catch (error) {
      console.error("Failed to parse event", error);
    }
  });
  return subscriber;
}

async function publishEvent(publisher, event) {
  const payload = JSON.stringify(event);
  await publisher.publish(CHANNEL, payload);
}

module.exports = {
  CHANNEL,
  createPublisher,
  createSubscriber,
  publishEvent
};

