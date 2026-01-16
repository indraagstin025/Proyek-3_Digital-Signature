import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import { validate } from "../middleware/validate.js";
import { adminValidation } from "../validators/adminValidator.js";

export default (adminController) => {
  const router = express.Router();

  // 1. Middleware Global: Wajib Login & Wajib Admin
  router.use(authMiddleware);
  router.use(adminMiddleware);

  // --- User Management ---
  router.get("/users", adminController.getAllUsers);

  router.post("/users", ...adminValidation.createUser, validate, adminController.createUser);

  // Note: Menggunakan PATCH sesuai kode asli Anda (Partial Update)
  router.patch("/users/:userId", ...adminValidation.updateUser, validate, adminController.updateUser);

  router.delete("/users/:userId", ...adminValidation.deleteUser, validate, adminController.deleteUser);

  // --- [BARU] Dashboard Statistics ---
  // Mengambil total user, dokumen, grup, dll
  router.get("/dashboard", adminController.getDashboardSummary);

  // --- [BARU] Audit Logs ---
  // Melihat riwayat aktivitas admin
  router.get("/audit-logs", adminController.getAuditLogs);

  router.get("/documents", adminController.getAllDocuments);

  // --- [BARU] Content Moderation ---
  // Menghapus dokumen secara paksa (Force Delete)
  router.delete(
    "/documents/:documentId",
    // Anda bisa menambahkan validator khusus di sini nanti jika perlu
    // misal: check('reason').notEmpty()
    adminController.forceDeleteDocument
  );

  // --- [BARU] Manual Cron Job Trigger ---
  // Endpoint untuk testing cron job tanpa menunggu jadwal
  router.post("/cron/premium-expiry", adminController.triggerPremiumExpiryCheck);

  // --- [BARU] User Reports (Feedback/Bug) ---
  router.get("/reports", adminController.getAllReports);
  router.patch("/reports/:reportId", adminController.updateReportStatus);

  return router;
};
