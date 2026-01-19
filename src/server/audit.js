const { prisma } = require("../db/prisma");

async function logAudit({ actorUserId, action, entity, entityId, meta }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId || null,
        action,
        entity,
        entityId: entityId || null,
        metaJson: meta || null
      }
    });
  } catch (error) {
    // Avoid blocking primary flow on audit failures.
  }
}

module.exports = { logAudit };

