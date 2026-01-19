const crypto = require("crypto");
const { prisma } = require("../db/prisma");
const config = require("../utils/config");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createAckToken(incidentId) {
  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.ackTokenTtlMin * 60 * 1000);

  await prisma.ackToken.create({
    data: {
      incidentId,
      tokenHash,
      expiresAt
    }
  });

  return token;
}

async function consumeAckToken(token) {
  const tokenHash = hashToken(token);
  const record = await prisma.ackToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() }
    }
  });

  if (!record) return null;

  await prisma.ackToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  return record.incidentId;
}

module.exports = {
  createAckToken,
  consumeAckToken
};

