const rateLimit = require("express-rate-limit");
const config = require("../../utils/config");

const loginLimiter = rateLimit({
  windowMs: config.loginRateLimitWindowMin * 60 * 1000,
  max: config.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Please try again later.",
  skipSuccessfulRequests: true
});

module.exports = {
  loginLimiter
};

