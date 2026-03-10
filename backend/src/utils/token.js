// src/utils/token.js
const jwt  = require("jsonwebtoken");
const { env } = require("../config/env");

const signAccess   = (payload) => jwt.sign(payload, env.jwtSecret,        { expiresIn: env.jwtExpiresIn });
const signRefresh  = (payload) => jwt.sign(payload, env.jwtRefreshSecret,  { expiresIn: env.jwtRefreshExpiresIn });
const verifyAccess  = (token)  => jwt.verify(token, env.jwtSecret);
const verifyRefresh = (token)  => jwt.verify(token, env.jwtRefreshSecret);

// ─── Token baca buku digital ─────────────────────────────────────────────────
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0); // unsigned 32-bit
}

function generateBukuToken(userId, bookId, nim, durasiHari = 14) {
  const exp  = new Date(Date.now() + durasiHari * 864e5).getTime();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  const raw  = `${userId}-${bookId}-${exp}-${rand}`;
  const cs   = hashStr(raw + nim).toString(16).toUpperCase().slice(0, 4).padStart(4, "0");
  return `UNISMU-${raw}-${cs}`;
}

function parseBukuToken(token, nim = null) {
  try {
    if (!token?.startsWith("UNISMU-")) return null;
    const parts = token.slice(7).split("-"); // buang prefix "UNISMU-"
    if (parts.length < 5) return null;
    const [userId, bookId, expTs, rand, cs] = parts;
    const expiry = new Date(parseInt(expTs));
    if (isNaN(expiry.getTime())) return null;

    // Validasi checksum jika nim tersedia.
    // Saat verify oleh user yang login, nim bisa diambil dari req.user.nim.
    // Tanpa nim (format check saja), checksum tidak divalidasi.
    let checksumValid = true;
    if (nim !== null) {
      const raw      = `${userId}-${bookId}-${expTs}-${rand}`;
      const expected = hashStr(raw + nim).toString(16).toUpperCase().slice(0, 4).padStart(4, "0");
      checksumValid  = cs === expected;
    }

    return {
      userId:        parseInt(userId),
      bookId:        parseInt(bookId),
      expiry,
      isExpired:     new Date() > expiry,
      checksum:      cs,
      checksumValid,
    };
  } catch { return null; }
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh, generateBukuToken, parseBukuToken };
