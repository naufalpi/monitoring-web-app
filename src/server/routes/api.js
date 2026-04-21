const express = require("express");
const bcrypt = require("bcryptjs");
const { prisma } = require("../../db/prisma");
const config = require("../../utils/config");
const { sanitizeText, isValidHttpUrl, toInt } = require("../../utils/validate");
const { requireAuth } = require("../middleware/auth");
const { requireRole, requireManageTargets, canManageTargets } = require("../middleware/rbac");
const { loginLimiter } = require("../middleware/rateLimit");
const { logAudit } = require("../audit");
const { deleteStoredEvidence } = require("../../monitoring/evidence");

const router = express.Router();

router.get("/session", (req, res) => {
  res.set("Cache-Control", "no-store");
  const user = req.user
    ? {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        isActive: req.user.isActive
      }
    : null;

  return res.json({
    user,
    csrfToken: req.csrfToken(),
    capabilities: {
      canManageTargets: canManageTargets(req.user),
      canManageUsers: Boolean(req.user && req.user.role === "SUPER_ADMIN"),
      allowOperatorManageTargets: config.allowOperatorManageTargets
    }
  });
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }
      req.session.userId = user.id;
      return res.json({
        ok: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        }
      });
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(config.sessionName);
    res.json({ ok: true });
  });
});

router.use(requireAuth);

router.get("/summary", async (req, res, next) => {
  try {
    const targets = await prisma.target.findMany({
      select: {
        checkResults: {
          take: 1,
          orderBy: { startedAt: "desc" },
          select: {
            status: true
          }
        },
        incidents: {
          where: { status: { in: ["OPEN", "ACK"] } },
          take: 1,
          select: { id: true }
        }
      }
    });

    const summary = buildSummary(targets);
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
});

router.get("/targets", async (req, res, next) => {
  try {
    const { page, limit, skip, isAll } = getPagination(req.query);
    const group = sanitizeText(req.query.group, 100);
    const search = sanitizeText(req.query.search, 200);
    const where = {};
    if (group) {
      where.group = group;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { url: { contains: search, mode: "insensitive" } },
        { group: { contains: search, mode: "insensitive" } }
      ];
    }
    const [targets, total] = await Promise.all([
      prisma.target.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...(isAll ? {} : { skip, take: limit }),
        select: {
          id: true,
          name: true,
          url: true,
          group: true,
          intervalSec: true,
          isEnabled: true,
          checkResults: {
            take: 1,
            orderBy: { startedAt: "desc" },
            select: {
              status: true,
              startedAt: true,
              responseTimeMs: true
            }
          },
          incidents: {
            where: { status: { in: ["OPEN", "ACK"] } },
            take: 1,
            select: { id: true }
          }
        }
      }),
      isAll ? Promise.resolve(null) : prisma.target.count({ where })
    ]);

    const data = targets.map((target) => {
      const latest = target.checkResults[0];
      const incident = target.incidents[0];
      return {
        id: target.id,
        name: target.name,
        url: target.url,
        group: target.group,
        intervalSec: target.intervalSec,
        isEnabled: target.isEnabled,
        status: latest ? latest.status : "UNKNOWN",
        lastCheck: latest ? latest.startedAt : null,
        responseTimeMs: latest ? latest.responseTimeMs : null,
        lastIncidentId: incident ? incident.id : null
      };
    });

    const totalCount = isAll ? data.length : total;
    const totalPages = totalCount === 0 ? 1 : isAll ? 1 : Math.ceil(totalCount / limit);
    return res.json({
      targets: data,
      page: isAll ? 1 : page,
      pageSize: isAll ? "all" : limit,
      total: totalCount,
      totalPages
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/targets/groups", async (req, res, next) => {
  try {
    const rows = await prisma.target.findMany({
      where: { group: { not: null } },
      distinct: ["group"],
      select: { group: true },
      orderBy: { group: "asc" }
    });
    const groups = rows.map((row) => row.group).filter(Boolean);
    return res.json({ groups });
  } catch (error) {
    return next(error);
  }
});

router.get("/targets/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const target = await prisma.target.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ error: "Target not found." });
    }
    return res.json({ target });
  } catch (error) {
    return next(error);
  }
});

router.post("/targets", requireManageTargets, async (req, res, next) => {
  try {
    const name = sanitizeText(req.body.name, 100);
    const url = sanitizeText(req.body.url, 500);
    const group = sanitizeText(req.body.group, 100);
    const intervalSec = Math.max(30, toInt(req.body.intervalSec, 60));

    if (!name || !url || !isValidHttpUrl(url)) {
      return res.status(400).json({ error: "Valid name and URL are required." });
    }

    const target = await prisma.target.create({
      data: {
        name,
        url,
        group: group || null,
        intervalSec,
        isEnabled: true
      }
    });

    await logAudit({
      actorUserId: req.user.id,
      action: "CREATE_TARGET",
      entity: "Target",
      entityId: target.id
    });

    return res.status(201).json({ target });
  } catch (error) {
    return next(error);
  }
});

router.patch("/targets/:id", requireManageTargets, async (req, res, next) => {
  try {
    const { id } = req.params;
    const name = sanitizeText(req.body.name, 100);
    const url = sanitizeText(req.body.url, 500);
    const group = sanitizeText(req.body.group, 100);
    const intervalSec = Math.max(30, toInt(req.body.intervalSec, 60));
    const isEnabled = typeof req.body.isEnabled === "boolean" ? req.body.isEnabled : req.body.isEnabled === "true";

    if (!name || !url || !isValidHttpUrl(url)) {
      return res.status(400).json({ error: "Valid name and URL are required." });
    }

    const target = await prisma.target.update({
      where: { id },
      data: {
        name,
        url,
        group: group || null,
        intervalSec,
        isEnabled
      }
    });

    await logAudit({
      actorUserId: req.user.id,
      action: "UPDATE_TARGET",
      entity: "Target",
      entityId: id
    });

    return res.json({ target });
  } catch (error) {
    return next(error);
  }
});

router.post("/targets/:id/disable", requireManageTargets, async (req, res, next) => {
  try {
    const { id } = req.params;
    const target = await prisma.target.update({
      where: { id },
      data: { isEnabled: false }
    });

    await logAudit({
      actorUserId: req.user.id,
      action: "DISABLE_TARGET",
      entity: "Target",
      entityId: id
    });

    return res.json({ target });
  } catch (error) {
    return next(error);
  }
});

router.delete("/targets/:id", requireManageTargets, async (req, res, next) => {
  try {
    const { id } = req.params;
    const target = await prisma.target.findUnique({ where: { id }, select: { id: true } });
    if (!target) {
      return res.status(404).json({ error: "Target not found." });
    }

    const incidentIds = await prisma.incident.findMany({
      where: { targetId: id },
      select: { id: true }
    });
    const ids = incidentIds.map((incident) => incident.id);
    const checkResults = await prisma.checkResult.findMany({
      where: { targetId: id },
      select: {
        screenshotPath: true,
        htmlSnapshotPath: true
      }
    });

    const tx = [
      prisma.checkResult.deleteMany({ where: { targetId: id } })
    ];
    if (ids.length) {
      tx.unshift(
        prisma.ackToken.deleteMany({ where: { incidentId: { in: ids } } }),
        prisma.notificationLog.deleteMany({ where: { incidentId: { in: ids } } }),
        prisma.incident.deleteMany({ where: { id: { in: ids } } })
      );
    }
    tx.push(prisma.target.delete({ where: { id } }));

    await prisma.$transaction(tx);
    await cleanupCheckResultFiles(checkResults);

    await logAudit({
      actorUserId: req.user.id,
      action: "DELETE_TARGET",
      entity: "Target",
      entityId: id,
      meta: { deletedIncidents: ids.length }
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/incidents", async (req, res, next) => {
  try {
    const status = normalizeEnum(req.query.status, ["OPEN", "ACK", "CLOSED"]);
    const severity = normalizeEnum(req.query.severity, ["LOW", "MEDIUM", "HIGH"]);
    const { page, limit, skip, isAll } = getPagination(req.query);

    const where = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        orderBy: { openedAt: "desc" },
        ...(isAll ? {} : { skip, take: limit }),
        select: {
          id: true,
          status: true,
          severity: true,
          openedAt: true,
          lastSeenAt: true,
          target: {
            select: {
              id: true,
              name: true,
              url: true,
              group: true
            }
          }
        }
      }),
      isAll ? Promise.resolve(null) : prisma.incident.count({ where })
    ]);

    const totalCount = isAll ? incidents.length : total;
    const totalPages = totalCount === 0 ? 1 : isAll ? 1 : Math.ceil(totalCount / limit);
    return res.json({
      incidents,
      page: isAll ? 1 : page,
      pageSize: isAll ? "all" : limit,
      total: totalCount,
      totalPages
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/incidents", requireRole(["SUPER_ADMIN"]), async (req, res, next) => {
  try {
    const status = normalizeEnum(req.query.status, ["OPEN", "ACK", "CLOSED"]);
    const severity = normalizeEnum(req.query.severity, ["LOW", "MEDIUM", "HIGH"]);
    const targetId = sanitizeText(req.query.targetId, 100);

    const where = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (targetId) where.targetId = targetId;

    const incidents = await prisma.incident.findMany({
      where,
      select: {
        id: true,
        targetId: true,
        openedAt: true,
        closedAt: true
      }
    });

    if (incidents.length === 0) {
      return res.json({ ok: true, deleted: 0 });
    }

    const ids = incidents.map((incident) => incident.id);
    const evidenceChecks = await Promise.all(incidents.map(findIncidentEvidenceCheck));
    await prisma.$transaction([
      prisma.ackToken.deleteMany({ where: { incidentId: { in: ids } } }),
      prisma.notificationLog.deleteMany({ where: { incidentId: { in: ids } } }),
      prisma.incident.deleteMany({ where: { id: { in: ids } } })
    ]);
    await cleanupCheckResultDocumentation(evidenceChecks.filter(Boolean));

    await logAudit({
      actorUserId: req.user.id,
      action: "RESET_INCIDENTS",
      entity: "Incident",
      meta: {
        deleted: ids.length,
        filters: { status, severity, targetId: targetId || null }
      }
    });

    return res.json({ ok: true, deleted: ids.length });
  } catch (error) {
    return next(error);
  }
});

router.delete("/incidents/:id", requireRole(["SUPER_ADMIN"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: {
        id: true,
        targetId: true,
        openedAt: true,
        closedAt: true
      }
    });
    if (!incident) {
      return res.status(404).json({ error: "Incident not found." });
    }
    const evidenceCheck = await findIncidentEvidenceCheck(incident);

    await prisma.$transaction([
      prisma.ackToken.deleteMany({ where: { incidentId: id } }),
      prisma.notificationLog.deleteMany({ where: { incidentId: id } }),
      prisma.incident.delete({ where: { id } })
    ]);
    await cleanupCheckResultDocumentation([evidenceCheck].filter(Boolean));

    await logAudit({
      actorUserId: req.user.id,
      action: "DELETE_INCIDENT",
      entity: "Incident",
      entityId: id
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/incidents/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        target: true,
        latestCheckResult: true,
        acknowledgedBy: true,
        closedBy: true
      }
    });

    if (!incident) {
      return res.status(404).json({ error: "Incident not found." });
    }

    const evidenceCheck = await findIncidentEvidenceCheck(incident);

    return res.json({ incident, evidenceCheck });
  } catch (error) {
    return next(error);
  }
});

router.post("/incidents/:id/ack", requireRole(["SUPER_ADMIN", "OPERATOR"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const incident = await prisma.incident.update({
      where: { id },
      data: {
        status: "ACK",
        acknowledgedAt: new Date(),
        acknowledgedById: req.user.id
      }
    });

    await logAudit({
      actorUserId: req.user.id,
      action: "ACK_INCIDENT",
      entity: "Incident",
      entityId: id
    });

    return res.json({ incident });
  } catch (error) {
    return next(error);
  }
});

router.post("/incidents/:id/close", requireRole(["SUPER_ADMIN", "OPERATOR"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const incident = await prisma.incident.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: req.user.id
      }
    });

    await logAudit({
      actorUserId: req.user.id,
      action: "CLOSE_INCIDENT",
      entity: "Incident",
      entityId: id
    });

    return res.json({ incident });
  } catch (error) {
    return next(error);
  }
});

router.post("/incidents/:id/comment", requireRole(["SUPER_ADMIN", "OPERATOR"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const notes = String(req.body.notes || "").trim().slice(0, 1000);
    const incident = await prisma.incident.update({
      where: { id },
      data: { notes }
    });

    await logAudit({
      actorUserId: req.user.id,
      action: "COMMENT_INCIDENT",
      entity: "Incident",
      entityId: id
    });

    return res.json({ incident });
  } catch (error) {
    return next(error);
  }
});

router.get("/users", requireRole(["SUPER_ADMIN"]), async (req, res, next) => {
  try {
    const { page, limit, skip, isAll } = getPagination(req.query);
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        ...(isAll ? {} : { skip, take: limit })
      }),
      isAll ? Promise.resolve(null) : prisma.user.count()
    ]);

    const data = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    }));

    const totalCount = isAll ? data.length : total;
    const totalPages = totalCount === 0 ? 1 : isAll ? 1 : Math.ceil(totalCount / limit);
    return res.json({
      users: data,
      page: isAll ? 1 : page,
      pageSize: isAll ? "all" : limit,
      total: totalCount,
      totalPages
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/users", requireRole(["SUPER_ADMIN"]), async (req, res, next) => {
  try {
    const name = sanitizeText(req.body.name, 100);
    const email = sanitizeText(req.body.email, 150).toLowerCase();
    const role = String(req.body.role || "VIEWER").toUpperCase();
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    if (!["SUPER_ADMIN", "OPERATOR", "VIEWER"].includes(role)) {
      return res.status(400).json({ error: "Invalid role selected." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        isActive: true
      }
    });

    await logAudit({
      actorUserId: req.user.id,
      action: "CREATE_USER",
      entity: "User",
      entityId: user.id
    });

    return res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists." });
    }
    return next(error);
  }
});

router.patch("/users/:id", requireRole(["SUPER_ADMIN"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const role = String(req.body.role || "VIEWER").toUpperCase();
    const isActive = typeof req.body.isActive === "boolean" ? req.body.isActive : req.body.isActive === "true";
    const password = String(req.body.password || "");

    if (!["SUPER_ADMIN", "OPERATOR", "VIEWER"].includes(role)) {
      return res.status(400).json({ error: "Invalid role selected." });
    }

    const data = {
      role,
      isActive
    };

    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data
    });

    await logAudit({
      actorUserId: req.user.id,
      action: "UPDATE_USER",
      entity: "User",
      entityId: id
    });

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    return next(error);
  }
});

function buildSummary(targets) {
  const summary = {
    total: targets.length,
    healthy: 0,
    down: 0,
    redirect: 0,
    suspected: 0,
    changed: 0,
    unknown: 0,
    openIncidents: 0
  };

  for (const target of targets) {
    const latest = target.checkResults[0];
    const status = latest ? latest.status : "UNKNOWN";
    if (status === "HEALTHY") summary.healthy += 1;
    else if (status === "DOWN") summary.down += 1;
    else if (status === "REDIRECT") summary.redirect += 1;
    else if (status === "SUSPECTED_DEFACEMENT") summary.suspected += 1;
    else if (status === "CHANGED") summary.changed += 1;
    else summary.unknown += 1;

    if (target.incidents.length > 0) {
      summary.openIncidents += 1;
    }
  }

  return summary;
}

function normalizeEnum(value, allowed) {
  if (!value) return null;
  const upper = String(value).toUpperCase();
  return allowed.includes(upper) ? upper : null;
}

function getPagination(query, defaults = {}) {
  const pageDefault = defaults.page || 1;
  const limitDefault = defaults.limit ?? "all";
  const limitMax = defaults.max || 100;
  const rawLimit = Array.isArray(query.limit) ? query.limit[0] : query.limit;
  const limitValue = rawLimit ?? limitDefault;
  const wantsAll =
    String(limitValue).toLowerCase() === "all" || String(limitValue).toLowerCase() === "0";
  if (wantsAll) {
    return { page: 1, limit: null, skip: 0, isAll: true };
  }
  const page = Math.max(1, toInt(query.page, pageDefault));
  const limit = Math.min(Math.max(toInt(limitValue, 20), 1), limitMax);
  const skip = (page - 1) * limit;
  return { page, limit, skip, isAll: false };
}

async function findIncidentEvidenceCheck(incident) {
  if (!incident) return null;
  const startedAt = { gte: incident.openedAt };
  if (incident.closedAt) {
    startedAt.lte = incident.closedAt;
  }

  return prisma.checkResult.findFirst({
    where: {
      targetId: incident.targetId,
      startedAt,
      OR: [
        { screenshotPath: { not: null } },
        { htmlSnapshotPath: { not: null } }
      ]
    },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      screenshotPath: true,
      htmlSnapshotPath: true
    }
  });
}

async function cleanupCheckResultDocumentation(checkResults) {
  if (!checkResults || checkResults.length === 0) return;

  await cleanupCheckResultFiles(checkResults);
  await prisma.$transaction(
    checkResults.map((checkResult) =>
      prisma.checkResult.update({
        where: { id: checkResult.id },
        data: {
          screenshotPath: null,
          htmlSnapshotPath: null
        }
      })
    )
  );
}

async function cleanupCheckResultFiles(checkResults) {
  await Promise.all(
    (checkResults || []).flatMap((checkResult) => [
      deleteStoredEvidence(checkResult.screenshotPath),
      deleteStoredEvidence(checkResult.htmlSnapshotPath)
    ])
  );
}

module.exports = router;

