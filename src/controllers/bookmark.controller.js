// src/controllers/bookmark.controller.js
const { prisma } = require("../utils/prisma");
const { ok, fail, catchError } = require("../utils/response");

exports.getAll = async (req, res) => {
  try {
    const data = await prisma.bookmark.findMany({
      where: { userId: req.user.id },
      include: { book: true },
      orderBy: { createdAt: "desc" },
    });
    return ok(res, data.map(b => b.book));
  } catch (err) { return catchError(res, err, "bookmark.getAll"); }
};

exports.toggle = async (req, res) => {
  try {
    const bookId = +req.params.bookId;
    if (!bookId || isNaN(bookId)) return fail(res, "ID buku tidak valid.");
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book || !book.isActive) return fail(res, "Buku tidak ditemukan.", 404);
    const key = { userId_bookId: { userId: req.user.id, bookId } };
    const exists = await prisma.bookmark.findUnique({ where: key });
    if (exists) {
      await prisma.bookmark.delete({ where: key });
      return ok(res, { bookmarked: false }, "Dihapus dari bookmark.");
    }
    await prisma.bookmark.create({ data: { userId: req.user.id, bookId } });
    return ok(res, { bookmarked: true }, "Ditambahkan ke bookmark.");
  } catch (err) { return catchError(res, err, "bookmark.toggle"); }
};

exports.check = async (req, res) => {
  try {
    const bookId = +req.params.bookId;
    const exists = await prisma.bookmark.findUnique({
      where: { userId_bookId: { userId: req.user.id, bookId } },
    });
    return ok(res, { bookmarked: !!exists });
  } catch (err) { return catchError(res, err, "bookmark.check"); }
};
