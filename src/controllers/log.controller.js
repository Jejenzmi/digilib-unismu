// src/controllers/log.controller.js
const { prisma } = require("../utils/prisma");
const { ok, fail, paginate, catchError } = require("../utils/response");
const clamp = (v, min, max) => Math.min(max, Math.max(min, +v));

exports.getAll = async (req, res) => {
  try {
    const { page=1, limit=50, userId, search } = req.query;
    const where = {
      ...(userId && { userId: +userId }),
      ...(search && { OR: [
        { aksi:   { contains: search } },
        { detail: { contains: search } },
      ]}),
    };
    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where, skip: (clamp(page,1,1000)-1)*clamp(limit,1,100), take: clamp(limit,1,100),
        include: { user: { select: { id:true, name:true, role:true, nim:true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.count({ where }),
    ]);
    return paginate(res, data, total, page, limit);
  } catch (err) { return catchError(res, err, "log.getAll"); }
};

exports.clear = async (req, res) => {
  try {
    const days   = Math.max(1, parseInt(req.body.days || "90"));
    const cutoff = new Date(Date.now() - days * 864e5);
    const { count } = await prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return ok(res, { deleted: count }, `${count} log aktivitas dihapus (lebih dari ${days} hari lalu).`);
  } catch (err) { return catchError(res, err, "log.clear"); }
};
