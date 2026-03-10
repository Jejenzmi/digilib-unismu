// src/utils/email.js
// ─────────────────────────────────────────────────────────────────────────────
// Layanan pengiriman email menggunakan Nodemailer.
// Mendukung: Gmail, SMTP generic, Mailtrap (testing).
// ─────────────────────────────────────────────────────────────────────────────
const nodemailer = require("nodemailer");
const { env }    = require("../config/env");
const logger     = require("../config/logger");
const crypto     = require("crypto");

// Buat transporter satu kali (lazy)
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (!env.smtpHost || !env.smtpUser) {
    logger.warn("SMTP belum dikonfigurasi — email tidak akan dikirim.");
    return null;
  }

  _transporter = nodemailer.createTransport({
    host:   env.smtpHost,
    port:   env.smtpPort,
    secure: env.smtpSecure,          // true untuk port 465, false untuk 587
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
    tls: { rejectUnauthorized: env.isProd },
  });

  return _transporter;
}

// ── Template helper ────────────────────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Perpustakaan Digital UNISMU</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#3b3fa3,#6366f1);padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;">
              Universitas Islam Dr. Khez Muttaqien
            </p>
            <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#fff;">
              📚 Perpustakaan Digital
            </h1>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:40px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              Email ini dikirim otomatis oleh sistem. Jangan balas email ini.<br>
              © ${new Date().getFullYear()} Perpustakaan UNISMU
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── Generate token verifikasi ──────────────────────────────────────────────
exports.generateVerificationToken = () =>
  crypto.randomBytes(32).toString("hex");

// ── Kirim email verifikasi akun ────────────────────────────────────────────
exports.sendVerificationEmail = async ({ to, name, token }) => {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: "SMTP_NOT_CONFIGURED" };

  const verifyUrl = `${env.frontendUrl}/verify-email?token=${token}`;

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">
      Selamat Datang, ${name}!
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
      Akun Anda di Perpustakaan Digital UNISMU telah dibuat.
      Klik tombol di bawah untuk verifikasi email dan mengaktifkan akun Anda.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${verifyUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);
                color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;
                font-size:15px;font-weight:700;">
        ✅ Verifikasi Email Saya
      </a>
    </div>
    <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;border-left:4px solid #6366f1;">
      <p style="margin:0;font-size:13px;color:#64748b;">
        Atau salin link ini ke browser Anda:<br>
        <a href="${verifyUrl}" style="color:#6366f1;word-break:break-all;">${verifyUrl}</a>
      </p>
    </div>
    <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">
      Link ini berlaku selama <strong>24 jam</strong>.
      Jika Anda tidak merasa mendaftar, abaikan email ini.
    </p>
  `);

  try {
    await transporter.sendMail({
      from:    `"Perpustakaan UNISMU" <${env.smtpFrom || env.smtpUser}>`,
      to,
      subject: "✅ Verifikasi Email — Perpustakaan Digital UNISMU",
      html,
    });
    logger.info(`Email verifikasi terkirim ke ${to}`);
    return { sent: true };
  } catch (err) {
    logger.error("Gagal kirim email verifikasi:", { message: err.message });
    return { sent: false, reason: err.message };
  }
};

// ── Kirim email reset password ─────────────────────────────────────────────
exports.sendPasswordResetEmail = async ({ to, name, token }) => {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: "SMTP_NOT_CONFIGURED" };

  const resetUrl = `${env.frontendUrl}/reset-password?token=${token}`;

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">
      Reset Password
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
      Halo ${name}, kami menerima permintaan reset password untuk akun Anda.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);
                color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;
                font-size:15px;font-weight:700;">
        🔑 Reset Password Saya
      </a>
    </div>
    <div style="background:#fffbeb;border-radius:10px;padding:16px 20px;border-left:4px solid #f59e0b;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        ⚠️ Link berlaku <strong>1 jam</strong>.
        Jika Anda tidak meminta reset password, abaikan email ini —
        akun Anda tetap aman.
      </p>
    </div>
  `);

  try {
    await transporter.sendMail({
      from:    `"Perpustakaan UNISMU" <${env.smtpFrom || env.smtpUser}>`,
      to,
      subject: "🔑 Reset Password — Perpustakaan Digital UNISMU",
      html,
    });
    logger.info(`Email reset password terkirim ke ${to}`);
    return { sent: true };
  } catch (err) {
    logger.error("Gagal kirim email reset:", { message: err.message });
    return { sent: false, reason: err.message };
  }
};

// ── Kirim notifikasi pinjam ────────────────────────────────────────────────
exports.sendBorrowNotification = async ({ to, name, bookTitle, token, expiryDate }) => {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: "SMTP_NOT_CONFIGURED" };

  const fmt = (d) => new Date(d).toLocaleDateString("id-ID", { day:"2-digit", month:"long", year:"numeric" });

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">
      Peminjaman Berhasil 📚
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
      Halo ${name}, peminjaman buku Anda telah berhasil diproses.
    </p>
    <div style="background:#ecfdf5;border-radius:12px;padding:20px 24px;margin-bottom:20px;border:1px solid #a7f3d0;">
      <p style="margin:0 0 8px;font-size:13px;color:#065f46;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Detail Peminjaman</p>
      <p style="margin:0 0 6px;font-size:15px;color:#1e293b;"><strong>Buku:</strong> ${bookTitle}</p>
      <p style="margin:0 0 6px;font-size:15px;color:#1e293b;"><strong>Kembali sebelum:</strong> ${fmt(expiryDate)}</p>
    </div>
    <div style="background:#0f172a;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:12px;color:#86efac;font-weight:700;letter-spacing:0.05em;">TOKEN AKSES PDF</p>
      <p style="margin:0;font-size:13px;color:#a5f3fc;font-family:monospace;word-break:break-all;line-height:1.8;">${token}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Masukkan token di atas pada halaman detail buku untuk membaca PDF secara online.
      Simpan token ini — token akan dicabut otomatis setelah buku dikembalikan.
    </p>
  `);

  try {
    await transporter.sendMail({
      from:    `"Perpustakaan UNISMU" <${env.smtpFrom || env.smtpUser}>`,
      to,
      subject: `📚 Token Peminjaman: ${bookTitle}`,
      html,
    });
    return { sent: true };
  } catch (err) {
    logger.error("Gagal kirim notifikasi pinjam:", { message: err.message });
    return { sent: false, reason: err.message };
  }
};

// ── Test koneksi SMTP ──────────────────────────────────────────────────────
exports.testSmtpConnection = async () => {
  const transporter = getTransporter();
  if (!transporter) return { ok: false, reason: "SMTP_NOT_CONFIGURED" };
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};
