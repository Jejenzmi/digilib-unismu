const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a string field does not exceed maximum length.
 * @param {*} value
 * @param {string} fieldLabel - human-readable field name for error messages
 * @param {number} max - maximum allowed length
 * @returns {string|undefined} error message, or undefined if valid
 */
function validateLength(value, fieldLabel, max) {
  if (value && String(value).length > max) {
    return `${fieldLabel} tidak boleh lebih dari ${max} karakter`;
  }
}

/**
 * Parse and validate pagination query params.
 * @param {object} query  - req.query
 * @returns {{ page: number, limit: number, offset: number }}
 */
function parsePagination(query, defaultLimit = 10) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Parse a route param as a positive integer.
 * Returns the parsed integer, or NaN if the value is not a valid positive integer.
 * @param {string} value
 * @returns {number}
 */
function parseId(value) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n <= 0 || String(n) !== String(value).trim()) return NaN;
  return n;
}

/**
 * Validate and parse an available_copies value.
 * @param {*} value
 * @param {number} fallback - value to use if the input is absent
 * @returns {{ copies: number|undefined, error: string|undefined }}
 */
function parseAvailableCopies(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return { copies: fallback };
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    return { error: 'Jumlah eksemplar harus berupa bilangan bulat non-negatif' };
  }
  return { copies: n };
}

/**
 * Validate and parse a year value.
 * @param {*} value
 * @param {number|null} fallback - value to use if the input is absent
 * @returns {{ year: number|null|undefined, error: string|undefined }}
 */
function parseYear(value, fallback) {
  if (!value) return { year: fallback };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1000 || n > 9999) {
    return { error: 'Tahun tidak valid' };
  }
  return { year: n };
}

module.exports = { EMAIL_REGEX, validateLength, parsePagination, parseId, parseAvailableCopies, parseYear };
