// src/config/logger.js
const winston  = require("winston");
const DailyRot = require("winston-daily-rotate-file");
const path     = require("path");
const fs       = require("fs");
const { env }  = require("./env");

// Silent logger untuk test — tidak ada output sama sekali
if (env.isTest || env.logLevel === "silent") {
  const silent = winston.createLogger({ transports: [new winston.transports.Console({ silent: true })] });
  silent.stream = { write: () => {} };
  module.exports = silent;
  return;
}

if (!fs.existsSync(env.logDir)) fs.mkdirSync(env.logDir, { recursive: true });

const fmt = winston.format;

const consoleFormat = fmt.combine(
  fmt.colorize(),
  fmt.timestamp({ format: "HH:mm:ss" }),
  fmt.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const rid   = requestId ? ` [${requestId}]` : "";
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${level}]${rid}: ${message}${extra}`;
  })
);

const fileFormat = fmt.combine(
  fmt.timestamp(),
  fmt.errors({ stack: true }),
  fmt.json()
);

const logger = winston.createLogger({
  level: env.logLevel,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      silent: env.isProd,
    }),
    new DailyRot({
      filename:    path.join(env.logDir, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles:    "30d",
      format:      fileFormat,
    }),
    new DailyRot({
      level:       "error",
      filename:    path.join(env.logDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles:    "90d",
      format:      fileFormat,
    }),
  ],
});

logger.stream = { write: (msg) => logger.http(msg.trim()) };

module.exports = logger;
