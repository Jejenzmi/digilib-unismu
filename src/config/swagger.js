// src/config/swagger.js
const swaggerJsdoc = require("swagger-jsdoc");
const { env }      = require("./env");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title:       "📚 Digilib UNISMU API",
      version:     "3.0.0",
      description: "REST API Perpustakaan Digital Universitas Islam Dr. Khez Muttaqien.\n\n**Cara pakai:** Login dulu di `POST /api/auth/login`, copy `accessToken`, lalu klik **Authorize** di pojok kanan atas dan paste token-nya.",
      contact:     { name: "Perpustakaan UNISMU", email: "perpus@unismu.ac.id" },
    },
    servers: [
      { url: `http://localhost:${env.port}`, description: "Development" },
      { url: "https://api-digilib.unismu.ac.id", description: "Production" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type:         "http",
          scheme:       "bearer",
          bearerFormat: "JWT",
          description:  "Masukkan access token: **Bearer &lt;token&gt;**",
        },
      },
      schemas: {
        // ── Request schemas ────────────────────────────────────────────────
        LoginRequest: {
          type: "object",
          required: ["nim", "password"],
          properties: {
            nim:      { type: "string", example: "KP001",           description: "NIM atau ID pengguna" },
            password: { type: "string", example: "Admin@UNISMU2024", description: "Password (min 8 karakter)" },
          },
        },
        ChangePasswordRequest: {
          type: "object",
          required: ["oldPassword", "newPassword"],
          properties: {
            oldPassword: { type: "string", example: "OldPass@123" },
            newPassword: { type: "string", example: "NewPass@456", description: "Min 8 karakter, harus ada huruf besar, kecil, angka" },
          },
        },
        CreateUserRequest: {
          type: "object",
          required: ["name", "nim", "password"],
          properties: {
            name:       { type: "string",  example: "Budi Santoso" },
            nim:        { type: "string",  example: "2024001001" },
            password:   { type: "string",  example: "Budi@2024" },
            role:       { type: "string",  enum: ["kepala","pustakawan","mahasiswa","umum"], example: "mahasiswa" },
            email:      { type: "string",  format: "email", example: "budi@student.unismu.ac.id" },
            phone:      { type: "string",  example: "081234567890" },
            angkatan:   { type: "string",  example: "2024" },
            tipe:       { type: "string",  enum: ["Dosen","Tenaga_Kependidikan","Masyarakat"] },
            fakultasId: { type: "integer", example: 1 },
            prodiId:    { type: "integer", example: 1 },
            alamat:     { type: "string",  example: "Jl. Contoh No. 1, Purwakarta" },
          },
        },
        CreateBookRequest: {
          type: "object",
          required: ["title", "author", "year", "category"],
          properties: {
            title:       { type: "string",  example: "Rekayasa Perangkat Lunak" },
            author:      { type: "string",  example: "Ir. Budi Santoso, M.T." },
            year:        { type: "integer", example: 2024 },
            category:    { type: "string",  example: "Sains & Teknologi" },
            isbn:        { type: "string",  example: "978-602-123-001" },
            pages:       { type: "integer", example: 450 },
            stok:        { type: "integer", example: 5 },
            lokasi:      { type: "string",  example: "Rak A1-01" },
            abstract:    { type: "string",  example: "Buku tentang rekayasa perangkat lunak modern." },
            badge:       { type: "string",  example: "Baru" },
            coverColor1: { type: "string",  example: "#6366f1" },
            coverColor2: { type: "string",  example: "#8b5cf6" },
            file:        { type: "string",  format: "binary", description: "File PDF buku (opsional)" },
          },
        },
        PinjamRequest: {
          type: "object",
          required: ["bookId"],
          properties: {
            bookId: { type: "integer", example: 1, description: "ID buku yang akan dipinjam" },
            durasi: { type: "integer", example: 14, description: "Durasi pinjam dalam hari (1-60, default 14)" },
          },
        },
        VerifyTokenRequest: {
          type: "object",
          required: ["token"],
          properties: {
            token:  { type: "string", example: "UNISMU-1-1-1711930000000-ABC12-1A2B" },
            bookId: { type: "integer", example: 1 },
          },
        },
        // ── Response schemas ───────────────────────────────────────────────
        ApiResponse: {
          type: "object",
          properties: {
            success:   { type: "boolean", example: true },
            message:   { type: "string",  example: "Berhasil" },
            requestId: { type: "string",  example: "a1b2c3d4" },
            data:      { type: "object" },
          },
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            success:    { type: "boolean" },
            message:    { type: "string" },
            requestId:  { type: "string" },
            data:       { type: "array", items: {} },
            pagination: {
              type: "object",
              properties: {
                total:      { type: "integer", example: 100 },
                page:       { type: "integer", example: 1 },
                limit:      { type: "integer", example: 20 },
                totalPages: { type: "integer", example: 5 },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success:   { type: "boolean", example: false },
            message:   { type: "string",  example: "Terjadi kesalahan" },
            requestId: { type: "string",  example: "a1b2c3d4" },
            errors:    { type: "array",   items: { type: "object", properties: { field: { type: "string" }, message: { type: "string" } } } },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            accessToken:  { type: "string", description: "JWT access token (15 menit)" },
            refreshToken: { type: "string", description: "Refresh token (30 hari), simpan aman" },
            user:         { type: "object", description: "Data user tanpa password" },
          },
        },
        Book: {
          type: "object",
          properties: {
            id:          { type: "integer" },
            title:       { type: "string" },
            author:      { type: "string" },
            year:        { type: "integer" },
            category:    { type: "string" },
            isbn:        { type: "string" },
            pages:       { type: "integer" },
            stok:        { type: "integer" },
            lokasi:      { type: "string" },
            rating:      { type: "number" },
            downloads:   { type: "integer" },
            badge:       { type: "string" },
            abstract:    { type: "string" },
            coverColor1: { type: "string" },
            coverColor2: { type: "string" },
            filePath:    { type: "string" },
            isActive:    { type: "boolean" },
            createdAt:   { type: "string", format: "date-time" },
          },
        },
        Peminjaman: {
          type: "object",
          properties: {
            id:                  { type: "integer" },
            tanggalPinjam:       { type: "string", format: "date-time" },
            tanggalKembali:      { type: "string", format: "date-time" },
            tanggalDikembalikan: { type: "string", format: "date-time" },
            status:              { type: "string", enum: ["dipinjam","dikembalikan","terlambat","hilang"] },
            denda:               { type: "integer" },
            dendaDibayar:        { type: "boolean" },
            token:               { type: "string" },
            durasi:              { type: "integer" },
            user:                { type: "object" },
            book:                { $ref: "#/components/schemas/Book" },
          },
        },
      },
      parameters: {
        PageParam:  { in: "query", name: "page",  schema: { type: "integer", default: 1 },  description: "Nomor halaman" },
        LimitParam: { in: "query", name: "limit", schema: { type: "integer", default: 20 }, description: "Jumlah item per halaman (maks 50)" },
        SearchParam:{ in: "query", name: "search",schema: { type: "string" },               description: "Kata kunci pencarian" },
        IdParam:    { in: "path",  name: "id",    required: true, schema: { type: "integer" }, description: "ID resource" },
      },
      responses: {
        Unauthorized: {
          description: "Token tidak valid atau kadaluwarsa",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        Forbidden: {
          description: "Akses ditolak — role tidak memiliki izin",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        NotFound: {
          description: "Data tidak ditemukan",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        ValidationError: {
          description: "Input tidak valid",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: "Auth",       description: "Autentikasi & manajemen sesi" },
      { name: "Users",      description: "Manajemen pengguna & anggota perpustakaan" },
      { name: "Books",      description: "Koleksi buku digital" },
      { name: "Peminjaman", description: "Peminjaman & pengembalian buku" },
      { name: "Skripsi",    description: "Repository karya ilmiah (skripsi, tesis, disertasi)" },
      { name: "Jurnal",     description: "Jurnal ilmiah UNISMU" },
      { name: "Fakultas",   description: "Manajemen fakultas & program studi" },
      { name: "Settings",   description: "Pengaturan sistem (khusus Kepala Perpustakaan)" },
      { name: "Laporan",    description: "Laporan statistik & ekspor data Excel" },
      { name: "Log",        description: "Activity log sistem (khusus Kepala Perpustakaan)" },
      { name: "Bookmark",   description: "Bookmark buku favorit pengguna" },
      { name: "System",     description: "Health check & status sistem" },
    ],
  },
  apis: ["./src/routes/*.js"],
};

module.exports = swaggerJsdoc(options);
