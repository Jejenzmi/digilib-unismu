// src/middleware/validate.middleware.js
const { validationResult } = require("express-validator");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success:   false,
      message:   "Data yang dikirim tidak valid.",
      requestId: res.locals.requestId,
      errors:    errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = validate;
