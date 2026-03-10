// src/middleware/log.middleware.js
const { prisma } = require("../utils/prisma");
const logger     = require("../config/logger");

const addLog = async (userId, aksi, detail, icon = "📌", color = "#6366f1", ipAddress = null) => {
  try {
    await prisma.activityLog.create({
      data: { userId: userId || null, aksi, detail, icon, color, ipAddress },
    });
  } catch (err) {
    logger.warn(`addLog failed: ${err.message}`);
  }
};

module.exports = { addLog };
