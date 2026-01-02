/**
 * Cron Jobs Index
 * Import dan inisialisasi semua cron jobs di sini
 */

import { initPremiumExpiryJob } from "./premiumExpiryJob.js";

export const initAllCronJobs = () => {
  console.log("🕐 [Cron] Initializing all cron jobs...");

  // 1. Premium Expiry Check - Setiap hari jam 00:05
  initPremiumExpiryJob();

  // Tambahkan cron job lain di sini nanti
  // initCleanupJob();
  // initReminderJob();

  console.log("✅ [Cron] All cron jobs initialized.");
};

export default initAllCronJobs;
