const config = require("../../utils/config");

function wantsJson(req) {
  const accept = req.headers.accept || "";
  return req.path.startsWith("/api") || accept.includes("application/json");
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      if (wantsJson(req)) {
        return res.status(401).json({ error: "unauthorized" });
      }
      return res.redirect("/login");
    }
    if (roles.includes(req.user.role)) {
      return next();
    }
    if (wantsJson(req)) {
      return res.status(403).json({ error: "forbidden" });
    }
    return res.status(403).render("error", {
      title: "Access denied",
      message: "You do not have permission to access this page."
    });
  };
}

function canManageTargets(user) {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role === "OPERATOR" && config.allowOperatorManageTargets) return true;
  return false;
}

function requireManageTargets(req, res, next) {
  if (canManageTargets(req.user)) {
    return next();
  }
  if (wantsJson(req)) {
    return res.status(403).json({ error: "forbidden" });
  }
  return res.status(403).render("error", {
    title: "Access denied",
    message: "You do not have permission to manage targets."
  });
}

module.exports = {
  requireRole,
  canManageTargets,
  requireManageTargets
};

