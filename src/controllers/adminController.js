import asyncHandler from "../utils/asyncHandler.js";
import { runPremiumExpiryCheck } from "../cron/premiumExpiryJob.js";

/**
 * Membuat instance AdminController dengan dependency injection.
 * @param {Object} adminService - Service logika bisnis admin.
 */
export const createAdminController = (adminService) => {
  return {
    /**
     * @description Mengambil daftar semua user di sistem
     * Proses:
     * 1. Query semua user dari database
     * 2. Return list dengan count total
     * 3. Tidak ada filter/search (basic list)
     * @route GET /api/admin/users
     * @access Admin only
     * @security cookieAuth: []
     * @returns {200} Daftar semua user dengan count
     * @error {401} User tidak authenticated
     * @error {403} User bukan admin
     * @error {500} Server error
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
     * @description Admin membuat user baru dengan Audit Log
     * Proses:
     * 1. Validasi input (email, password, name)
     * 2. Check apakah email sudah terdaftar
     * 3. Encrypt password
     * 4. Simpan user baru ke database
     * 5. Create Audit Log untuk aktivitas ini
     * 6. Return user data yang dibuat
     * @route POST /api/admin/users
     * @access Admin only
     * @security cookieAuth: []
     * @param {string} email - Email user baru (unique)
     * @param {string} password - Password minimal 8 karakter
     * @param {string} name - Nama lengkap
     * @param {boolean} [isSuperAdmin] - Set true untuk super admin, default: false
     * @returns {201} User baru berhasil dibuat
     * @error {400} Validasi gagal atau email sudah terdaftar
     * @error {401} User tidak authenticated
     * @error {403} User bukan admin
     * @error {500} Server error
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
     * @description Admin mengupdate data user
     * Proses:
     * 1. Validasi userId parameter
     * 2. Fetch user yang akan diupdate
     * 3. Update field yang dikirim (email, name, isSuperAdmin, dll)
     * 4. Validate data baru
     * 5. Simpan perubahan ke database
     * 6. Return user data yang sudah diupdate
     * @route PUT /api/admin/users/:userId
     * @access Admin only
     * @security cookieAuth: []
     * @param {string} userId - ID user yang akan diupdate (path param)
     * @param {object} body - Fields yang akan diupdate (email, name, isSuperAdmin, etc)
     * @returns {200} User berhasil diupdate
     * @error {400} Validasi gagal
     * @error {401} User tidak authenticated
     * @error {403} User bukan admin
     * @error {404} User tidak ditemukan
     * @error {500} Server error
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
     * @description Admin menghapus user dengan Audit Log
     * Proses:
     * 1. Validasi userId parameter
     * 2. Fetch user yang akan dihapus
     * 3. Soft delete atau hard delete dari database
     * 4. Create Audit Log untuk aktivitas ini (who deleted, when, why)
     * 5. Return success message dengan user ID
     * @route DELETE /api/admin/users/:userId
     * @access Admin only
     * @security cookieAuth: []
     * @param {string} userId - ID user yang akan dihapus (path param)
     * @returns {200} User berhasil dihapus
     * @error {401} User tidak authenticated
     * @error {403} User bukan admin
     * @error {404} User tidak ditemukan
     * @error {500} Server error
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
     * @description Mengambil statistik sistem untuk admin dashboard
     * Proses:
     * 1. Query statistik dari database:
     *    - Total jumlah user
     *    - Total dokumen
     *    - Total signature requests/completions
     *    - Active subscriptions
     * 2. Aggregate data dari multiple tables
     * 3. Return summary statistics
     * @route GET /api/admin/stats
     * @access Admin only
     * @security cookieAuth: []
     * @returns {200} Statistik sistem (totalUsers, totalDocuments, totalSignatures, activeSubscriptions)
     * @error {401} User tidak authenticated
     * @error {403} User bukan admin
     * @error {500} Server error
     */
    getDashboardSummary: asyncHandler(async (req, res) => {
      const summary = await adminService.getDashboardStats();

      res.status(200).json({
        success: true,
        data: summary,
      });
    }),

    /**
     * @description Mengambil audit logs sistem dengan pagination
     * Proses:
     * 1. Parse page dan limit dari query parameters
     * 2. Validate pagination values (page >= 1, limit > 0)
     * 3. Query audit logs dengan pagination dari database
     * 4. Fetch logs sorted by timestamp descending (most recent first)
     * 5. Return logs array dan pagination metadata (page, limit, total)
     * @route GET /api/admin/audit-logs
     * @access Admin only
     * @security cookieAuth: []
     * @param {number} [page] - Halaman untuk pagination, default: 1
     * @param {number} [limit] - Records per halaman, default: 10
     * @returns {200} Audit logs dengan pagination metadata
     * @error {401} User tidak authenticated
     * @error {403} User bukan admin
     * @error {400} Pagination parameters invalid
     * @error {500} Server error
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
     * @description Mengambil semua dokumen di sistem untuk moderasi
     * Proses:
     * 1. Query semua dokumen dari database (dengan owner info)
     * 2. Return list dokumen dengan metadata
     * 3. Tidak ada filter, fetch semua untuk moderation review
     * @route GET /api/admin/documents
     * @access Admin only
     * @security cookieAuth: []
     * @returns {200} Daftar semua dokumen dengan count
     * @error {401} User tidak authenticated
     * @error {403} User bukan admin
     * @error {500} Server error
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
     * @description Admin menghapus dokumen secara paksa untuk content moderation
     * Proses:
     * 1. Validasi documentId parameter
     * 2. Fetch dokumen yang akan dihapus
     * 3. Validasi reason (alasan penghapusan) dari body
     * 4. Delete dokumen dari database dan storage
     * 5. Create Audit Log dengan admin ID, reason, timestamp
     * 6. Notify document owner tentang force delete
     * 7. Return success message
     * @route DELETE /api/admin/documents/:documentId
     * @access Admin only
     * @security cookieAuth: []
     * @param {string} documentId - ID dokumen yang akan dihapus (path param)
     * @param {string} reason - Alasan penghapusan (body param)
     * @returns {200} Dokumen berhasil dihapus paksa
     * @error {400} Reason tidak disediakan atau validasi gagal
     * @error {401} User tidak authenticated
     * @error {403} User bukan admin
     * @error {404} Dokumen tidak ditemukan
     * @error {500} Server error
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
     * @description Admin manually trigger premium expiry cron job (untuk testing/emergency)
     * Proses:
     * 1. Validate user adalah admin
     * 2. Log admin ID yang trigger cron job
     * 3. Run premium expiry check:
     *    - Query semua premium subscriptions
     *    - Check mana yang sudah expired
     *    - Downgrade dari premium ke free tier
     *    - Send notification email ke affected users
     * 4. Return hasil execution (berapa users yang di-downgrade, etc)
     * @route POST /api/admin/cron/premium-expiry
     * @access Admin only
     * @security cookieAuth: []
     * @returns {200} Premium expiry check executed berhasil dengan summary hasil
     * @error {401} User tidak authenticated
     * @error {403} User bukan admin
     * @error {500} Server error atau cron job gagal
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

    /**
     * @description Mengambil semua laporan user.
     * @route GET /api/admin/reports
     */
    getAllReports: asyncHandler(async (req, res) => {
      const reports = await adminService.getAllReports();
      res.status(200).json({
        success: true,
        data: reports,
      });
    }),

    /**
     * @description Mengupdate status laporan user.
     * @route PATCH /api/admin/reports/:reportId
     */
    updateReportStatus: asyncHandler(async (req, res) => {
      const { reportId } = req.params;
      const { status } = req.body;
      const adminId = req.user.id;

      const updatedReport = await adminService.updateReportStatus(adminId, reportId, status, req);

      res.status(200).json({
        success: true,
        message: "Status laporan berhasil diperbarui.",
        data: updatedReport,
      });
    }),
  };
};
