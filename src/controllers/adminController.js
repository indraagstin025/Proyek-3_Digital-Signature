import asyncHandler from "../utils/asyncHandler.js";
import { runPremiumExpiryCheck } from "../cron/premiumExpiryJob.js";

/**
 * Membuat instance AdminController dengan dependency injection.
 * @param {Object} adminService - Service logika bisnis admin.
 */
export const createAdminController = (adminService) => {
  return {
    /**
     * @description Mengambil daftar semua user.
     * @route GET /api/admin/users
     */
    getAllUsers: asyncHandler(async (req, res) => {
      const users = await adminService.getAllUsers();
      res.status(200).json({
        success: true,
        count: users.length,
        data: users,
      });
    }),

    /**
     * @description Membuat user baru (dengan Audit Log).
     * @route POST /api/admin/users
     */
    createUser: asyncHandler(async (req, res) => {
      const { email, password, name, isSuperAdmin } = req.body;

      const adminId = req.user.id;

      const newUser = await adminService.createNewUser({ email, password, name, isSuperAdmin }, adminId, req);

      res.status(201).json({
        success: true,
        message: "User berhasil dibuat oleh admin.",
        data: newUser,
      });
    }),

    /**
     * @description Update user.
     * @route PUT /api/admin/users/:userId
     */
    updateUser: asyncHandler(async (req, res) => {
      const { userId } = req.params;

      const updatedUser = await adminService.updateUser(userId, req.body);

      res.status(200).json({
        success: true,
        message: "User berhasil diperbaharui.",
        data: updatedUser,
      });
    }),

    /**
     * @description Hapus user (dengan Audit Log).
     * @route DELETE /api/admin/users/:userId
     */
    deleteUser: asyncHandler(async (req, res) => {
      const { userId } = req.params;
      const adminId = req.user.id;

      await adminService.deleteUser(userId, adminId, req);

      res.status(200).json({
        success: true,
        message: `User dengan ID ${userId} berhasil dihapus`,
      });
    }),

    /**
     * ==========================================
     * [FITUR BARU] DASHBOARD & MODERATION
     * ==========================================
     */

    /**
     * @description Mengambil statistik sistem (Total User, Dokumen, dll).
     * @route GET /api/admin/stats
     */
    getDashboardSummary: asyncHandler(async (req, res) => {
      const summary = await adminService.getDashboardStats();

      res.status(200).json({
        success: true,
        data: summary,
      });
    }),

    /**
     * @description Melihat Audit Log sistem.
     * @route GET /api/admin/audit-logs
     */
    getAuditLogs: asyncHandler(async (req, res) => {
      // Ambil page & limit dari query, default page 1 limit 10
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await adminService.getAllAuditLogs(page, limit);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.meta, // Kirim metadata pagination ke frontend
      });
    }),

    /**
     * @description Mengambil semua dokumen untuk moderasi.
     * @route GET /api/admin/documents
     */
    getAllDocuments: asyncHandler(async (req, res) => {
      const documents = await adminService.getAllDocuments();

      res.status(200).json({
        success: true,
        count: documents.length,
        data: documents,
      });
    }),

    /**
     * @description Menghapus dokumen secara paksa (Content Moderation).
     * @route DELETE /api/admin/documents/:documentId
     */
    forceDeleteDocument: asyncHandler(async (req, res) => {
      const { documentId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      await adminService.forceDeleteDocument(adminId, documentId, reason, req);

      res.status(200).json({
        success: true,
        message: "Dokumen berhasil dihapus secara paksa demi keamanan/moderasi.",
      });
    }),

    /**
     * @description Manual trigger Premium Expiry Cron Job (untuk testing).
     * @route POST /api/admin/cron/premium-expiry
     */
    triggerPremiumExpiryCheck: asyncHandler(async (req, res) => {
      console.log(`🔧 [Admin] Manual trigger Premium Expiry by Admin ID: ${req.user.id}`);

      const result = await runPremiumExpiryCheck();

      res.status(200).json({
        success: true,
        message: "Premium expiry check executed successfully.",
        data: result,
      });
    }),
  };
};
