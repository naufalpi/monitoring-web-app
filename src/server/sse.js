const { createSubscriber } = require("../services/eventBus");
const logger = require("../utils/logger");

const clients = new Map();
let clientCounter = 0;

function initSse(app, requireAuth) {
  app.get("/events", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const id = ++clientCounter;
    clients.set(id, res);
    res.write(`event: connected\ndata: ${JSON.stringify({ id })}\n\n`);

    req.on("close", () => {
      clients.delete(id);
    });
  });

  createSubscriber((event) => {
    broadcast(event);
  });

  const heartbeat = setInterval(() => {
    for (const res of clients.values()) {
      res.write(": ping\n\n");
    }
  }, 20000);
  heartbeat.unref();

  logger.info("SSE event stream initialized");
}

function broadcast(event) {
  const payload = `event: message\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of clients.values()) {
    res.write(payload);
  }
}

module.exports = { initSse };

