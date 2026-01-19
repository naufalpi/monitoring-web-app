const { prisma } = require("../../db/prisma");

function wantsJson(req) {
  const accept = req.headers.accept || "";
  return req.path.startsWith("/api") || req.path === "/events" || accept.includes("application/json");
}

async function loadUser(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId }
    });

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return next();
    }

    req.user = user;
    res.locals.currentUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (req.user) {
    return next();
  }
  if (wantsJson(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return res.redirect("/login");
}

module.exports = {
  loadUser,
  requireAuth
};

