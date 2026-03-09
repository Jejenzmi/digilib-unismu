// src/controllers/laporan.controller.js
const XLSX   = require("xlsx");
const { prisma } = require("../utils/prisma");
const { ok, catchError } = require("../utils/response");
const { addLog } = require("../middleware/log.middleware");

exports.statistik = async (req, res) => {
  try {
    const [
      totalBuku, totalAnggota, totalPeminjaman, totalSkripsi, totalJurnal,
      dipinjam, terlambat, dikembalikan, topBuku, aggDenda,
    ] = await Promise.all([
      prisma.book.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.peminjaman.count(),
      prisma.skripsi.count({ where: { isApproved: true } }),
      prisma.jurnal.count({ where: { isActive: true } }),
      prisma.peminjaman.count({ where: { status: "dipinjam" } }),
      prisma.peminjaman.count({ where: { status: "terlambat" } }),
      prisma.peminjaman.count({ where: { status: "dikembalikan" } }),
      prisma.book.findMany({
        where: { isActive: true }, orderBy: { downloads: "desc" }, take: 10,
        select: { id:true, title:true, author:true, downloads:true, category:true, badge:true },
      }),
      prisma.peminjaman.aggregate({ _sum: { denda: true } }),
    ]);
    return ok(res, {
      totalBuku, totalAnggota, totalPeminjaman, totalSkripsi, totalJurnal,
      statusPeminjaman: { dipinjam, terlambat, dikembalikan },
      topBuku,
      totalDenda: aggDenda._sum.denda || 0,
    });
  } catch (err) { return catchError(res, err, "laporan.statistik"); }
};

exports.peminjamanPerBulan = async (req, res) => {
  try {
    const tahun = parseInt(req.query.tahun || new Date().getFullYear());
    const data  = await prisma.peminjaman.findMany({
      where: { tanggalPinjam: { gte: new Date(tahun, 0, 1), lte: new Date(tahun, 11, 31, 23, 59, 59) } },
      select: { tanggalPinjam: true },
    });
    const perBulan = Array(12).fill(0);
    data.forEach(p => perBulan[new Date(p.tanggalPinjam).getMonth()]++);
    return ok(res, { tahun, perBulan });
  } catch (err) { return catchError(res, err, "laporan.peminjamanPerBulan"); }
};

exports.anggotaPerFakultas = async (req, res) => {
  try {
    const grouped = await prisma.user.groupBy({
      by: ["fakultasId"], _count: { id: true },
      where: { isActive: true },
    });
    const ids  = grouped.map(g => g.fakultasId).filter(Boolean);
    const faks = await prisma.fakultas.findMany({ where: { id: { in: ids } } });
    return ok(res, grouped.map(g => ({
      fakultasId: g.fakultasId,
      jumlah:     g._count.id,
      nama:       faks.find(f => f.id === g.fakultasId)?.nama || "Tanpa Fakultas",
    })));
  } catch (err) { return catchError(res, err, "laporan.anggotaPerFakultas"); }
};

// ─── Helper: buat & kirim file Excel ─────────────────────────────────────────
function sendExcel(res, rows, sheetName, filename) {
  if (rows.length === 0) {
    return res.status(404).json({ success: false, message: "Tidak ada data untuk diekspor." });
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? "").length)) + 2,
  }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}.xlsx"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buf);
}

// Batas maksimum baris per export — mencegah OOM jika data sangat besar.
// Jika data > limit, header X-Export-Truncated dikirim sebagai peringatan.
const EXPORT_LIMIT = 10_000;

function applyExportLimit(res, data) {
  if (data.length >= EXPORT_LIMIT) {
    res.setHeader("X-Export-Truncated", "true");
    res.setHeader("X-Export-Limit",     String(EXPORT_LIMIT));
    return data.slice(0, EXPORT_LIMIT);
  }
  return data;
}

exports.exportBuku = async (req, res) => {
  try {
    const raw   = await prisma.book.findMany({ orderBy: { title: "asc" }, take: EXPORT_LIMIT + 1 });
    const books = applyExportLimit(res, raw);
    await addLog(req.user.id, "Ekspor Data", `Ekspor koleksi buku → Excel (${books.length} baris)`, "💾", "#3b82f6", req.ip);
    sendExcel(res, books.map((b, i) => ({
      "No": i+1, "Judul": b.title, "Penulis": b.author,
      "Tahun": b.year, "Kategori": b.category,
      "ISBN": b.isbn||"-", "Halaman": b.pages, "Stok": b.stok,
      "Lokasi": b.lokasi||"-", "Rating": b.rating,
      "Total Unduhan": b.downloads, "Badge": b.badge||"-",
      "Status": b.isActive ? "Aktif" : "Nonaktif",
    })), "Koleksi Buku", `Koleksi_Buku_UNISMU_${new Date().toLocaleDateString("id-ID").replace(/\//g,"-")}`);
  } catch (err) { return catchError(res, err, "laporan.exportBuku"); }
};

exports.exportPeminjaman = async (req, res) => {
  try {
    const raw  = await prisma.peminjaman.findMany({
      include: { user: true, book: true }, orderBy: { createdAt: "desc" }, take: EXPORT_LIMIT + 1,
    });
    const data = applyExportLimit(res, raw);
    await addLog(req.user.id, "Ekspor Data", `Ekspor data peminjaman → Excel (${data.length} baris)`, "💾", "#3b82f6", req.ip);
    sendExcel(res, data.map((p, i) => ({
      "No": i+1,
      "Nama Anggota": p.user.name,
      "NIM/NIP": p.user.nim,
      "Role": p.user.role,
      "Judul Buku": p.book.title,
      "Tgl Pinjam": new Date(p.tanggalPinjam).toLocaleDateString("id-ID"),
      "Tgl Harus Kembali": new Date(p.tanggalKembali).toLocaleDateString("id-ID"),
      "Tgl Dikembalikan": p.tanggalDikembalikan ? new Date(p.tanggalDikembalikan).toLocaleDateString("id-ID") : "-",
      "Status": p.status,
      "Denda (Rp)": p.denda,
      "Denda Lunas": p.dendaDibayar ? "Ya" : "Tidak",
    })), "Peminjaman", `Data_Peminjaman_UNISMU_${new Date().toLocaleDateString("id-ID").replace(/\//g,"-")}`);
  } catch (err) { return catchError(res, err, "laporan.exportPeminjaman"); }
};

exports.exportAnggota = async (req, res) => {
  try {
    const raw   = await prisma.user.findMany({
      include: { fakultas: true, prodi: true }, orderBy: { joinedAt: "desc" }, take: EXPORT_LIMIT + 1,
    });
    const users = applyExportLimit(res, raw);
    await addLog(req.user.id, "Ekspor Data", `Ekspor data anggota → Excel (${users.length} baris)`, "💾", "#3b82f6", req.ip);
    sendExcel(res, users.map((u, i) => ({
      "No": i+1, "Nama": u.name, "NIM/NIP": u.nim,
      "Role": u.role, "Tipe": u.tipe||"-",
      "Email": u.email||"-", "No. HP": u.phone||"-",
      "Fakultas": u.fakultas?.nama||"-",
      "Program Studi": u.prodi?.nama||"-",
      "Angkatan": u.angkatan||"-",
      "Status": u.isActive ? "Aktif" : "Nonaktif",
      "Terverifikasi": u.isVerified ? "Ya" : "Tidak",
      "Bergabung": new Date(u.joinedAt).toLocaleDateString("id-ID"),
    })), "Anggota", `Data_Anggota_UNISMU_${new Date().toLocaleDateString("id-ID").replace(/\//g,"-")}`);
  } catch (err) { return catchError(res, err, "laporan.exportAnggota"); }
};
