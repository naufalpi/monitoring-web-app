const createApp = require("./app");
const config = require("../utils/config");
const logger = require("../utils/logger");

async function start() {
  try {
    config.ensureProductionConfig();
    const app = await createApp();
    app.listen(config.port, () => {
      logger.info(`Web server listening on ${config.port}`);
    });
  } catch (error) {
    logger.error(error, "Failed to start server");
    process.exit(1);
  }
}

start();

