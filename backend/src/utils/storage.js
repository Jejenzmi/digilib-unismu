// src/utils/storage.js
// ─────────────────────────────────────────────────────────────────────────────
// Storage abstraction layer — mendukung dua driver:
//   "local"  — simpan file di disk lokal (default, kompatibel ke belakang)
//   "minio"  — simpan file di MinIO/S3 (rekomendasi production)
//
// Semua controller menggunakan modul ini, bukan fs langsung.
// Ganti STORAGE_DRIVER=minio di .env untuk switch ke MinIO.
// ─────────────────────────────────────────────────────────────────────────────
const fs     = require("fs");
const path   = require("path");
const { env }   = require("../config/env");
const logger    = require("../config/logger");

// ── MinIO client (lazy init) ──────────────────────────────────────────────
let _minioClient = null;

function getMinioClient() {
  if (_minioClient) return _minioClient;
  try {
    const Minio = require("minio");
    _minioClient = new Minio.Client({
      endPoint:  env.minioEndpoint,
      port:      env.minioPort,
      useSSL:    env.minioUseSSL,
      accessKey: env.minioAccessKey,
      secretKey: env.minioSecretKey,
    });
    return _minioClient;
  } catch {
    logger.error("minio package tidak tersedia. Install: npm install minio");
    return null;
  }
}

// ── Pastikan bucket ada ────────────────────────────────────────────────────
async function ensureBucket() {
  const client = getMinioClient();
  if (!client) return;
  const exists = await client.bucketExists(env.minioBucket);
  if (!exists) {
    await client.makeBucket(env.minioBucket, "us-east-1");
    // Policy publik untuk cover image dan avatar
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action:    ["s3:GetObject"],
        Resource:  [`arn:aws:s3:::${env.minioBucket}/covers/*`,
                    `arn:aws:s3:::${env.minioBucket}/avatar/*`],
      }],
    });
    await client.setBucketPolicy(env.minioBucket, policy);
    logger.info(`MinIO bucket '${env.minioBucket}' dibuat`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const localPath = (relPath) => path.join(process.cwd(), relPath);

/**
 * Upload file ke storage yang dikonfigurasi.
 * @param {string} filePath - Path file sumber di disk
 * @param {string} objectName - Nama objek di bucket (e.g. "books/123.pdf")
 * @param {string} contentType - MIME type
 * @returns {string} URL publik atau path relatif
 */
exports.uploadFile = async (filePath, objectName, contentType = "application/octet-stream") => {
  if (env.storageDriver === "minio") {
    const client = getMinioClient();
    if (!client) throw new Error("MinIO client tidak tersedia");
    await ensureBucket();
    await client.fPutObject(env.minioBucket, objectName, filePath, { "Content-Type": contentType });
    // Hapus file temp dari disk setelah upload ke MinIO
    try { fs.unlinkSync(filePath); } catch {}
    return `${env.minioPublicUrl}/${env.minioBucket}/${objectName}`;
  }
  // Local: file sudah ada di disk, kembalikan path relatif
  return `/uploads/${objectName}`;
};

/**
 * Hapus file dari storage.
 * @param {string} fileUrlOrPath - URL (MinIO) atau path relatif (local)
 */
exports.deleteFile = async (fileUrlOrPath) => {
  if (!fileUrlOrPath) return;
  try {
    if (env.storageDriver === "minio") {
      const client = getMinioClient();
      if (!client) return;
      // Ekstrak object name dari URL: http://minio:9000/bucket/objectname
      const url = new URL(fileUrlOrPath);
      const objectName = url.pathname.replace(`/${env.minioBucket}/`, "");
      await client.removeObject(env.minioBucket, objectName);
    } else {
      const abs = localPath(fileUrlOrPath);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
  } catch (err) {
    logger.warn(`Gagal hapus file '${fileUrlOrPath}': ${err.message}`);
  }
};

/**
 * Stream file ke response (untuk PDF viewer).
 * @param {string} fileUrlOrPath - URL (MinIO) atau path relatif (local)
 * @param {object} res - Express response
 * @param {string} filename - Nama file untuk header
 */
exports.streamFile = async (fileUrlOrPath, res, filename) => {
  if (env.storageDriver === "minio") {
    const client = getMinioClient();
    if (!client) { res.status(500).json({ success: false, message: "Storage tidak tersedia" }); return; }
    const url        = new URL(fileUrlOrPath);
    const objectName = url.pathname.replace(`/${env.minioBucket}/`, "");
    const stat       = await client.statObject(env.minioBucket, objectName);
    res.setHeader("Content-Type",        "application/pdf");
    res.setHeader("Content-Length",      stat.size);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}.pdf"`);
    const stream = await client.getObject(env.minioBucket, objectName);
    stream.pipe(res);
  } else {
    const abs = localPath(fileUrlOrPath);
    if (!fs.existsSync(abs)) { res.status(404).json({ success: false, message: "File tidak ditemukan" }); return; }
    res.setHeader("Content-Type",        "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}.pdf"`);
    fs.createReadStream(abs).pipe(res);
  }
};

/**
 * Dapatkan URL publik dari path/URL.
 * Local path sudah merupakan URL relatif yang valid.
 */
exports.getPublicUrl = (fileUrlOrPath) => {
  if (!fileUrlOrPath) return null;
  if (fileUrlOrPath.startsWith("http")) return fileUrlOrPath;
  return fileUrlOrPath; // local: path relatif seperti /uploads/...
};

exports.isMinioEnabled = () => env.storageDriver === "minio";
