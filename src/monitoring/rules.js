const config = require("../utils/config");

module.exports = {
  negativeScoreThreshold: config.negativeScoreThreshold,
  phashDeltaThreshold: config.phashDeltaThreshold,
  cleanChecksToClose: config.cleanChecksToClose,
  notifyCooldownMin: config.notifyCooldownMin
};

