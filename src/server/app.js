const express = require("express");
const session = require("express-session");
const path = require("path");
const helmet = require("helmet");
const csurf = require("csurf");
const pinoHttp = require("pino-http");
const { createClient } = require("redis");
const RedisStore = require("connect-redis").default;

const config = require("../utils/config");
const logger = require("../utils/logger");
const { loadUser, requireAuth } = require("./middleware/auth");

async function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "./views"));

  app.use(pinoHttp({ logger }));
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "../../frontend/dist")));

  const redisClient = createClient({ url: config.redisUrl });
  redisClient.on("error", (err) => logger.error(err, "Redis error"));
  await redisClient.connect();

  app.use(
    session({
      name: config.sessionName,
      secret: config.sessionSecret,
      store: new RedisStore({ client: redisClient, prefix: "sess:" }),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.env === "production",
        maxAge: 1000 * 60 * 60 * 8
      }
    })
  );

  app.use((req, res, next) => {
    res.locals.appBaseUrl = config.appBaseUrl;
    res.locals.env = config.env;
    res.locals.currentPath = req.path;
    res.locals.currentUser = null;
    res.locals.pageScript = null;
    res.locals.bodyClass = "";
    next();
  });

  app.use(loadUser);

  app.use((req, res, next) => {
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
    next();
  });

  app.use(csurf());

  app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
  });

  app.use(require("./routes/ack"));
  app.use("/api", require("./routes/api"));
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
  app.use("/evidence", requireAuth, require("./routes/evidence"));

  const { initSse } = require("./sse");
  initSse(app, requireAuth);

  const indexPath = path.join(__dirname, "../../frontend/dist/index.html");
  app.get("*", (req, res) => {
    return res.sendFile(indexPath);
  });

  app.use((err, req, res, next) => {
    if (err.code === "EBADCSRFTOKEN") {
      if (req.path.startsWith("/api")) {
        return res.status(403).json({ error: "Invalid CSRF token." });
      }
      return res.status(403).render("error", {
        title: "Invalid CSRF token",
        message: "Your session expired. Please retry."
      });
    }

    logger.error(err, "Unhandled server error");
    if (req.path.startsWith("/api")) {
      return res.status(500).json({ error: "Server error." });
    }
    return res.status(500).render("error", {
      title: "Server error",
      message: "Something went wrong."
    });
  });

  return app;
}

module.exports = createApp;

