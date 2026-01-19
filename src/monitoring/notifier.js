const config = require("../utils/config");
const { prisma } = require("../db/prisma");
const { sendTelegramMessage } = require("../services/telegram");
const { createAckToken } = require("../services/ackTokens");

async function maybeNotify({ incident, target, reasons, confidence, action, severityChanged }) {
  if (!incident || !target) return;
  if (action !== "created" && !severityChanged) return;

  const cooldownMs = config.notifyCooldownMin * 60 * 1000;
  const last = await prisma.notificationLog.findFirst({
    where: { targetId: target.id, channel: "telegram" },
    orderBy: { sentAt: "desc" }
  });

  if (last && Date.now() - last.sentAt.getTime() < cooldownMs && !severityChanged) {
    return;
  }

  let ackLink = null;
  if (config.enableAckLinks) {
    const token = await createAckToken(incident.id);
    ackLink = `${config.appBaseUrl}/ack/${token}`;
  }

  const incidentLink = `${config.appBaseUrl}/incidents/${incident.id}`;
  const timestamp = formatJakartaTime(new Date());
  const topReasons = (reasons || []).slice(0, 3).join(", ") || "No reasons";

  const message = [
    `?? Incident: ${incident.severity}`,
    `Target: ${target.name}`,
    `URL: ${target.url}`,
    `Status: ${incident.status}`,
    `Confidence: ${confidence || 0}%`,
    `Reasons: ${topReasons}`,
    `Time: ${timestamp}`,
    `Detail: ${incidentLink}`,
    ackLink ? `ACK: ${ackLink}` : null
  ]
    .filter(Boolean)
    .join("\n");

  await sendTelegramMessage(message);

  await prisma.notificationLog.create({
    data: {
      targetId: target.id,
      incidentId: incident.id,
      channel: "telegram",
      payloadJson: {
        message
      }
    }
  });
}

function formatJakartaTime(date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: config.timezone,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

module.exports = {
  maybeNotify
};

