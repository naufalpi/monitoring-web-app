const express = require("express");
const { prisma } = require("../../db/prisma");
const { consumeAckToken } = require("../../services/ackTokens");

const router = express.Router();

router.get("/ack/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    const incidentId = await consumeAckToken(token);

    if (!incidentId) {
      return res.status(400).render("error", {
        title: "Invalid link",
        message: "This acknowledgment link is invalid or expired."
      });
    }

    await prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: "ACK",
        acknowledgedAt: new Date()
      }
    });

    return res.render("ack", {
      title: "Incident acknowledged",
      message: "Thank you. The incident has been acknowledged."
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

