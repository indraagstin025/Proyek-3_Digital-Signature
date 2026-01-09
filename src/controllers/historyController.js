import asyncHandler from "../utils/asyncHandler.js";

/**
 * Membuat instance HistoryController dengan dependency injection.
 * @param {import('../services/historyService.js').HistoryService} historyService
 */
export const createHistoryController = (historyService) => {
  if (!historyService) {
    throw new Error("createHistoryController: 'historyService' tidak disediakan.");
  }

  return {
    /**
     * @description Mengambil riwayat aktivitas tanda tangan user
     * Proses:
     * 1. Ambil userId dari middleware authentication
     * 2. Query database untuk semua aktivitas tanda tangan:
     *    - Personal signing (single document)
     *    - Group signing (group documents)
     *    - Package signing (package documents)
     * 3. Aggregate data dari multiple sources
     * 4. Sort berdasarkan timestamp (terbaru first)
     * 5. Return history array dengan activity details
     * @route GET /api/history
     * @access Private - Require cookie authentication
     * @security cookieAuth: []
     * @returns {200} Riwayat aktivitas tanda tangan user
     * @error {401} User tidak authenticated
     * @error {500} Server error
     */
    getMyHistory: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;

      const historyData = await historyService.getUserSigningHistory(userId);

      return res.status(200).json({
        status: "success",
        data: historyData,
      });
    }),
  };
};
