// src/controllers/peminjaman.controller.js
const { prisma } = require("../utils/prisma");
const { ok, fail, paginate, catchError } = require("../utils/response");
const { generateBukuToken, parseBukuToken } = require("../utils/token");
const { addLog } = require("../middleware/log.middleware");

const inc   = { user: { include: { fakultas:true, prodi:true } }, book: true };
const safeP = (p) => ({
  ...p,
  user: p.user ? (() => { const { password, refreshTokens, ...u } = p.user; return u; })() : undefined,
});
const clamp = (v, min, max) => Math.min(max, Math.max(min, +v));

exports.getAll = async (req, res) => {
  try {
    const { page=1, limit=20, status, userId, bookId } = req.query;
    const isAdmin = ["kepala","pustakawan"].includes(req.user.role);
    const where   = {
      ...(status && { status }),
      ...(bookId && { bookId: +bookId }),
      ...(!isAdmin && { userId: req.user.id }),
      ...(isAdmin && userId && { userId: +userId }),
    };
    const [data, total] = await Promise.all([
      prisma.peminjaman.findMany({ where, skip: (clamp(page,1,1000)-1)*clamp(limit,1,100), take: clamp(limit,1,100), include: inc, orderBy: { createdAt: "desc" } }),
      prisma.peminjaman.count({ where }),
    ]);
    return paginate(res, data.map(safeP), total, page, limit);
  } catch (err) { return catchError(res, err, "peminjaman.getAll"); }
};

exports.getOne = async (req, res) => {
  try {
    const p = await prisma.peminjaman.findUnique({ where: { id: +req.params.id }, include: inc });
    if (!p) return fail(res, "Data peminjaman tidak ditemukan.", 404);
    const isAdmin = ["kepala","pustakawan"].includes(req.user.role);
    if (!isAdmin && p.userId !== req.user.id) return fail(res, "Akses ditolak.", 403);
    return ok(res, safeP(p));
  } catch (err) { return catchError(res, err, "peminjaman.getOne"); }
};

exports.pinjam = async (req, res) => {
  try {
    const { bookId, durasi=14 } = req.body;

    // ── Semua validasi + decrement stok dalam SATU interactive transaction ──
    // Mencegah race condition: dua request bersamaan tidak bisa sama-sama
    // lolos cek stok dan decrement hingga stok menjadi negatif.
    const result = await prisma.$transaction(async (tx) => {
      // Lock-read buku (re-read di dalam tx untuk mendapat nilai terkini)
      const book = await tx.book.findUnique({ where: { id: +bookId } });
      if (!book || !book.isActive)
        return { error: "Buku tidak ditemukan.", status: 400 };
      if (book.stok < 1)
        return { error: "Stok buku sedang habis.", status: 400 };

      // Cek double-pinjam
      const already = await tx.peminjaman.findFirst({
        where: { userId: req.user.id, bookId: +bookId, status: { in: ["dipinjam","terlambat"] } },
      });
      if (already)
        return { error: "Anda sudah meminjam buku ini dan belum mengembalikannya.", status: 400 };

      // Cek batas maksimum
      const settingMax = await tx.setting.findUnique({ where: { key: "max_pinjam" } });
      const maxPinjam  = parseInt(settingMax?.value || "3");
      const totalAktif = await tx.peminjaman.count({
        where: { userId: req.user.id, status: { in: ["dipinjam","terlambat"] } },
      });
      if (totalAktif >= maxPinjam)
        return { error: `Maks. ${maxPinjam} buku. Kembalikan dulu sebelum meminjam lagi.`, status: 400 };

      const tanggalKembali = new Date(Date.now() + +durasi * 864e5);
      const token          = generateBukuToken(req.user.id, +bookId, req.user.nim, +durasi);

      // Decrement stok + buat peminjaman secara atomic
      const [pinjam] = await Promise.all([
        tx.peminjaman.create({
          data: { userId: req.user.id, bookId: +bookId,
                  tanggalPinjam: new Date(), tanggalKembali,
                  durasi: +durasi, status: "dipinjam",
                  token, tokenExpiry: tanggalKembali },
          include: inc,
        }),
        tx.book.update({
          where: { id: +bookId },
          // updateMany dengan stok > 0 sebagai guard akhir — jika stok sudah
          // diambil concurrent request lain sejak findUnique di atas, update
          // ini tidak akan terjadi dan Prisma akan throw (caught oleh tx rollback)
          data: { stok: { decrement: 1 } },
        }),
      ]);

      return { pinjam, bookTitle: book.title };
    });

    if (result.error) return fail(res, result.error, result.status);

    await addLog(req.user.id, "Pinjam Buku", `Meminjam: ${result.bookTitle} (${+durasi} hari)`, "📚", "#10b981", req.ip);
    return ok(res, safeP(result.pinjam), "Buku berhasil dipinjam. Simpan token akses Anda.", 201);
  } catch (err) { return catchError(res, err, "peminjaman.pinjam"); }
};

exports.kembalikan = async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-read di dalam tx agar status terkini — mencegah dua request
      // bersamaan sama-sama lolos cek "dikembalikan" dan increment stok dua kali.
      const p = await tx.peminjaman.findUnique({
        where: { id: +req.params.id }, include: inc,
      });
      if (!p)                         return { error: "Data peminjaman tidak ditemukan.", status: 404 };
      if (p.status === "dikembalikan") return { error: "Buku sudah dikembalikan.",        status: 400 };

      const hariTerlambat = Math.max(0, Math.ceil(
        (Date.now() - new Date(p.tanggalKembali).getTime()) / 864e5
      ));
      const setting = await tx.setting.findUnique({ where: { key: "denda_per_hari" } });
      const denda   = hariTerlambat * parseInt(setting?.value || "1000");

      const [updated] = await Promise.all([
        tx.peminjaman.update({
          where: { id: +req.params.id }, include: inc,
          data: { status: "dikembalikan", tanggalDikembalikan: new Date(),
                  denda, token: null, tokenExpiry: null },
        }),
        tx.book.update({
          where: { id: p.bookId },
          data: { stok: { increment: 1 } },
        }),
      ]);

      return { updated, denda, hariTerlambat, bookTitle: p.book.title };
    });

    if (result.error) return fail(res, result.error, result.status);

    const { updated, denda, hariTerlambat, bookTitle } = result;
    const msg = denda > 0
      ? `Buku dikembalikan. Denda: Rp${denda.toLocaleString("id-ID")} (${hariTerlambat} hari terlambat).`
      : "Buku berhasil dikembalikan tepat waktu.";
    await addLog(req.user.id, "Kembalikan Buku",
      `${bookTitle}${denda > 0 ? ` | Denda Rp${denda.toLocaleString("id-ID")}` : ""}`,
      "↩️", "#a855f7", req.ip);
    return ok(res, safeP(updated), msg);
  } catch (err) { return catchError(res, err, "peminjaman.kembalikan"); }
};

exports.verifyToken = async (req, res) => {
  try {
    const { token, bookId } = req.body;

    // 1. Validasi format token + checksum (menggunakan NIM user yang sedang login)
    const parsed = parseBukuToken(token, req.user.nim);
    if (!parsed) return ok(res, { valid: false, reason: "invalid", message: "Format token tidak valid." });
    if (!parsed.checksumValid)
      return ok(res, { valid: false, reason: "invalid", message: "Token tidak valid atau telah dimanipulasi." });

    // 2. Cek kepemilikan
    if (parsed.userId !== req.user.id)
      return ok(res, { valid: false, reason: "invalid", message: "Token bukan milik Anda." });

    // 3. Cek buku sesuai
    if (bookId && parsed.bookId !== +bookId)
      return ok(res, { valid: false, reason: "wrong_book", message: "Token bukan untuk buku yang dipilih." });

    // 4. Cek kadaluarsa lokal (cepat, tanpa DB)
    if (parsed.isExpired)
      return ok(res, { valid: false, reason: "expired", message: "Token sudah kedaluwarsa.", expiry: parsed.expiry });

    // 5. Cross-check ke DB — pastikan token masih aktif (belum dikembalikan/hangus)
    // Token di DB menjadi NULL ketika buku dikembalikan atau token dihapus paksa.
    // Tanpa pengecekan ini, token lama yang disimpan di device tetap dianggap valid.
    const peminjaman = await prisma.peminjaman.findFirst({
      where: {
        userId:  req.user.id,
        bookId:  parsed.bookId,
        token,                        // harus persis sama dengan yang tersimpan
        status:  { in: ["dipinjam", "terlambat"] },
      },
      select: { id: true, tanggalKembali: true, tokenExpiry: true },
    });

    if (!peminjaman)
      return ok(res, { valid: false, reason: "revoked", message: "Token sudah tidak aktif. Buku mungkin sudah dikembalikan." });

    const daysLeft = Math.ceil((new Date(parsed.expiry) - new Date()) / 864e5);
    return ok(res, { valid: true, daysLeft, expiry: parsed.expiry, bookId: parsed.bookId, peminjamanId: peminjaman.id }, "Token valid.");
  } catch (err) { return catchError(res, err, "peminjaman.verifyToken"); }
};

exports.bayarDenda = async (req, res) => {
  try {
    const p = await prisma.peminjaman.findUnique({ where: { id: +req.params.id } });
    if (!p)             return fail(res, "Data peminjaman tidak ditemukan.", 404);
    if (!p.denda)       return fail(res, "Tidak ada denda pada peminjaman ini.");
    if (p.dendaDibayar) return fail(res, "Denda sudah dibayar sebelumnya.");
    const updated = await prisma.peminjaman.update({
      where: { id: +req.params.id }, data: { dendaDibayar: true }, include: inc,
    });
    await addLog(req.user.id, "Bayar Denda", `Denda Rp${p.denda.toLocaleString("id-ID")} lunas (ID:${p.id})`, "💰", "#f59e0b", req.ip);
    return ok(res, safeP(updated), `Denda Rp${p.denda.toLocaleString("id-ID")} berhasil dilunasi.`);
  } catch (err) { return catchError(res, err, "peminjaman.bayarDenda"); }
};
