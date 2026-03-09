// tests/setup/globalSetup.js
// Dijalankan SEKALI sebelum seluruh test suite.
// Tugas: load .env.test dan pastikan environment bersih.

const path = require("path");

module.exports = async function globalSetup() {
  // Load .env.test — HARUS sebelum modul apapun di-import
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env.test") });

  // Pastikan mode test aktif
  process.env.NODE_ENV = "test";

  console.log("\n🧪 [Jest] globalSetup: environment test dimuat");
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? "✅ SET" : "❌ TIDAK SET"}`);
  console.log(`   NODE_ENV    : ${process.env.NODE_ENV}`);
  console.log(`   PORT        : ${process.env.PORT || 5001}`);
};
