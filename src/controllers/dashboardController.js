import asyncHandler from "../utils/asyncHandler.js";
import CommonError from "../errors/CommonError.js";

/**
 * Membuat instance DashboardController.
 * @param {Object} dashboardService - Service yang menangani logika bisnis dashboard.
 * @returns {Object} Kumpulan method controller untuk rute dashboard.
 */
export const createDashboardController = (dashboardService) => {
  // Jika ada helper function khusus controller ini, bisa ditaruh di sini (seperti getCookieOptions di Auth)

  return {
    /**
     * @description Mengambil ringkasan data dashboard user
     * Proses:
     * 1. Validasi user terautentikasi dari middleware
     * 2. Ambil userId dari request context
     * 3. Query dashboard service untuk mengagregat data:
     *    - Recent documents: Dokumen terbaru user
     *    - Pending signatures: Tanda tangan yang menunggu action
     *    - Statistics: Total dokumen, signature, completion rate, dll
     * 4. Return dashboard summary dalam format terstruktur
     * @route GET /api/dashboard
     * @access Private - Require cookie authentication
     * @security cookieAuth: []
     * @returns {200} Dashboard summary dengan recentDocuments, pendingSignatures, statistics
     * @error {401} User tidak terautentikasi
     * @error {500} Server error
     */
    getSummary: asyncHandler(async (req, res) => {
      // Pastikan user terautentikasi (biasanya dihandle middleware, tapi double check aman)
      const userId = req.user?.id;

      if (!userId) {
        throw CommonError.Unauthorized("User tidak terautentikasi.");
      }

      // Panggil Service
      const summary = await dashboardService.getDashboardSummary(userId);

      // Kirim Response Standar
      res.status(200).json({
        success: true, // Mengikuti pola AuthController (success: true)
        message: "Data dashboard berhasil dimuat.",
        data: summary,
      });
    }),
  };
};
