// src/controllers/setting.controller.js
const { prisma } = require("../utils/prisma");
const { ok, fail, catchError } = require("../utils/response");
const { addLog } = require("../middleware/log.middleware");

exports.getAll = async (req, res) => {
  try {
    const settings = await prisma.setting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
    return ok(res, Object.fromEntries(settings.map(s => [s.key, s.value])));
  } catch (err) { return catchError(res, err, "setting.getAll"); }
};

exports.getOne = async (req, res) => {
  try {
    const s = await prisma.setting.findUnique({ where: { key: req.params.key } });
    if (!s) return fail(res, "Setting tidak ditemukan.", 404);
    return ok(res, s);
  } catch (err) { return catchError(res, err, "setting.getOne"); }
};

// PUT /api/settings  — update banyak sekaligus: { key: value, ... }
exports.updateMany = async (req, res) => {
  try {
    const updates = req.body;
    if (typeof updates !== "object" || Array.isArray(updates)) return fail(res, "Body harus berupa objek {key: value}.");
    const entries = Object.entries(updates);
    if (entries.length === 0)   return fail(res, "Tidak ada data yang dikirim.");
    if (entries.length > 50)    return fail(res, "Maksimal 50 setting per request.");
    // Validasi — value harus bisa dikonversi ke string
    for (const [k, v] of entries) {
      if (typeof k !== "string" || k.length > 100) return fail(res, `Key '${k}' tidak valid.`);
    }
    await Promise.all(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where:  { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );
    await addLog(req.user.id, "Ubah Pengaturan", `Memperbarui ${entries.length} pengaturan`, "⚙️", "#6366f1", req.ip);
    return ok(res, {}, `${entries.length} pengaturan berhasil disimpan.`);
  } catch (err) { return catchError(res, err, "setting.updateMany"); }
};

exports.updateOne = async (req, res) => {
  try {
    if (req.body.value === undefined) return fail(res, "Nilai (value) wajib diisi.");
    const s = await prisma.setting.upsert({
      where:  { key: req.params.key },
      update: { value: String(req.body.value) },
      create: { key: req.params.key, value: String(req.body.value) },
    });
    await addLog(req.user.id, "Ubah Pengaturan", `Mengubah: ${req.params.key}`, "⚙️", "#6366f1", req.ip);
    return ok(res, s, "Setting berhasil diperbarui.");
  } catch (err) { return catchError(res, err, "setting.updateOne"); }
};
