// tests/setup/jest.setup.js
// Dijalankan setelah framework di-load tapi sebelum setiap test file.

const path = require("path");

// Pastikan .env.test terbaca di setiap worker Jest
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.test") });
process.env.NODE_ENV = "test";

// Naikkan timeout default — DB calls bisa lambat di CI
jest.setTimeout(15000);
