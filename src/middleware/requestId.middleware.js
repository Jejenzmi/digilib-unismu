// src/middleware/requestId.middleware.js
// Setiap request mendapat ID unik → mudah di-trace di log
const { v4: uuidv4 } = require("uuid");

const requestId = (req, res, next) => {
  const id = req.headers["x-request-id"] || uuidv4().split("-")[0]; // 8 karakter cukup
  res.locals.requestId = id;
  res.setHeader("X-Request-Id", id); // kembalikan ke client
  next();
};

module.exports = requestId;
