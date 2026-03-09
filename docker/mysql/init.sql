-- Dijalankan sekali saat container MySQL pertama kali dibuat
-- (file ini TIDAK dijalankan ulang saat container restart)
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Pastikan database ada (biasanya sudah dibuat dari env var, ini sebagai fallback)
CREATE DATABASE IF NOT EXISTS `digilib_unismu` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS `digilib_unismu_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant akses ke user untuk kedua database
GRANT ALL PRIVILEGES ON `digilib_unismu`.* TO 'digilib_user'@'%';
GRANT ALL PRIVILEGES ON `digilib_unismu_test`.* TO 'digilib_user'@'%';
FLUSH PRIVILEGES;
