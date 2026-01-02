import cron from "node-cron";
import prisma from "../config/prismaClient.js";
import { sendWhatsappNotification } from "../utils/whatsappSender.js";

/**
 * Cron Job untuk mengecek dan mengupdate status Premium yang sudah expired.
 * Dijalankan setiap hari jam 00:05 (5 menit setelah tengah malam).
 *
 * STRATEGI: "Soft Lock"
 * - Status diubah ke FREE
 * - Data lama TETAP ADA dan bisa diakses
 * - User TIDAK BISA menambah data baru yang melebihi limit FREE
 */

/**
 * Kirim notifikasi WhatsApp ke user yang expired
 * @param {Object} user - User object dengan phoneNumber dan name
 */
const notifyExpiredUser = async (user) => {
  if (!user.phoneNumber) {
    console.log(`   ⚠️ [WhatsApp] User ${user.email} tidak punya nomor HP, skip notifikasi.`);
    return;
  }

  const message = `Halo ${user.name || "Pengguna DigiSign"} 👋

Langganan *Premium* Anda telah berakhir pada ${user.premiumUntil?.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.

Akun Anda sekarang menggunakan paket *FREE* dengan batasan:
• Maks. 10 MB per file
• Maks. 5 versi per dokumen
• Maks. 1 grup
• Maks. 5 anggota per grup
• Maks. 10 dokumen per grup

📌 Data Anda yang sudah ada *tetap aman* dan bisa diakses.

Untuk kembali menikmati fitur Premium tanpa batas, silakan perpanjang langganan Anda di aplikasi DigiSign.

Terima kasih telah menggunakan DigiSign! 🙏`;

  try {
    await sendWhatsappNotification(user.phoneNumber, message);
    console.log(`   ✅ [WhatsApp] Notifikasi terkirim ke ${user.phoneNumber}`);
  } catch (error) {
    console.error(`   ❌ [WhatsApp] Gagal kirim ke ${user.phoneNumber}:`, error.message);
  }
};

export const initPremiumExpiryJob = () => {
  // Jadwal: Setiap hari jam 00:05
  // Format cron: "menit jam tanggal bulan hari"
  cron.schedule("5 0 * * *", async () => {
    console.log("🔄 [Cron] Memulai pengecekan Premium Expiry...");

    const now = new Date();

    try {
      // 1. Cari semua user yang premiumUntil sudah lewat DAN masih berstatus PREMIUM
      const expiredUsers = await prisma.user.findMany({
        where: {
          userStatus: "PREMIUM",
          premiumUntil: {
            lt: now, // Less than (sudah lewat)
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          phoneNumber: true,
          premiumUntil: true,
        },
      });

      if (expiredUsers.length === 0) {
        console.log("✅ [Cron] Tidak ada user dengan Premium expired.");
        return;
      }

      console.log(`⚠️ [Cron] Ditemukan ${expiredUsers.length} user dengan Premium expired.`);

      // 2. Update status ke FREE
      const userIds = expiredUsers.map((u) => u.id);

      const updateResult = await prisma.user.updateMany({
        where: {
          id: { in: userIds },
        },
        data: {
          userStatus: "FREE",
          // premiumUntil tetap disimpan untuk referensi historis
        },
      });

      console.log(`✅ [Cron] Berhasil mengupdate ${updateResult.count} user ke FREE tier.`);

      // 3. Catat ke Audit Log (Opsional tapi recommended)
      const auditLogs = expiredUsers.map((user) => ({
        action: "PREMIUM_EXPIRED",
        actorId: user.id, // Self-triggered
        targetId: user.id,
        description: `Premium subscription expired. User downgraded to FREE tier. Previous expiry: ${user.premiumUntil?.toISOString()}`,
        ipAddress: "SYSTEM_CRON",
        userAgent: "CronJob/PremiumExpiry",
      }));

      // Catatan: Jika enum AuditAction belum ada PREMIUM_EXPIRED,
      // bisa skip bagian ini atau tambahkan enum dulu
      // await prisma.auditLog.createMany({ data: auditLogs });

      // 4. Log detail untuk monitoring
      expiredUsers.forEach((user) => {
        console.log(`   📧 ${user.email} (${user.name}) - Expired: ${user.premiumUntil}`);
      });

      // 5. Kirim notifikasi WhatsApp ke user yang expired
      console.log("📱 [Cron] Mengirim notifikasi WhatsApp...");
      for (const user of expiredUsers) {
        await notifyExpiredUser(user);
      }
    } catch (error) {
      console.error("❌ [Cron] Error saat proses Premium Expiry:", error.message);
    }
  });

  console.log("✅ [Cron] Premium Expiry Job scheduled (setiap hari jam 00:05)");
};

/**
 * Manual trigger untuk testing (tanpa menunggu cron)
 */
export const runPremiumExpiryCheck = async () => {
  console.log("🔄 [Manual] Menjalankan pengecekan Premium Expiry...");

  const now = new Date();

  try {
    const expiredUsers = await prisma.user.findMany({
      where: {
        userStatus: "PREMIUM",
        premiumUntil: {
          lt: now,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        premiumUntil: true,
      },
    });

    if (expiredUsers.length === 0) {
      return { success: true, message: "Tidak ada user dengan Premium expired.", count: 0 };
    }

    const userIds = expiredUsers.map((u) => u.id);

    const updateResult = await prisma.user.updateMany({
      where: {
        id: { in: userIds },
      },
      data: {
        userStatus: "FREE",
      },
    });

    // Kirim notifikasi WhatsApp
    console.log("📱 [Manual] Mengirim notifikasi WhatsApp...");
    for (const user of expiredUsers) {
      await notifyExpiredUser(user);
    }

    return {
      success: true,
      message: `Berhasil mengupdate ${updateResult.count} user ke FREE tier.`,
      count: updateResult.count,
      users: expiredUsers.map((u) => ({ email: u.email, expiredAt: u.premiumUntil })),
    };
  } catch (error) {
    console.error("❌ [Manual] Error:", error.message);
    return { success: false, message: error.message };
  }
};

export default initPremiumExpiryJob;
