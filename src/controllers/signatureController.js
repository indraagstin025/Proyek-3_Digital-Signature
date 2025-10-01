import asyncHandler from "../utils/asyncHandler.js";

/**
 * Membuat objek controller untuk fitur tanda tangan dokumen.
 * Controller ini berfungsi sebagai penghubung antara request dari client
 * dengan service tanda tangan (signatureService) dan dokumen (documentService).
 *
 * @param {import('../services/documentService.js').DocumentService} documentService - Instance dari DocumentService.
 * @param {import('../services/signatureService.js').SignatureService} signatureService - Instance dari SignatureService.
 * @returns {object} - Kumpulan fungsi handler untuk tanda tangan dokumen.
 */
export const createSignatureController = (documentService, signatureService) => {
  return {
    /**
     * Menambahkan tanda tangan pribadi pada sebuah versi dokumen.
     *
     * - User login wajib
     * - Dapat menambahkan tanda tangan berupa gambar (misalnya hasil scan/tulis tangan)
     * - Posisi dan ukuran tanda tangan harus ditentukan secara eksplisit
     * - Bisa memilih apakah ingin menampilkan QR Code sebagai verifikasi
     *
     * @route POST /api/signatures/personal
     * @param {import("express").Request} req - Request dari client. Berisi:
     *   - `documentVersionId` {string} ID versi dokumen yang akan ditandatangani
     *   - `method` {string} Metode tanda tangan (contoh: "digital" atau "manual")
     *   - `signatureImageUrl` {string} URL gambar tanda tangan
     *   - `positionX` {number} Posisi horizontal tanda tangan di dokumen
     *   - `positionY` {number} Posisi vertikal tanda tangan di dokumen
     *   - `pageNumber` {number} Halaman dokumen tempat tanda tangan ditempatkan
     *   - `width` {number} Lebar tanda tangan
     *   - `height` {number} Tinggi tanda tangan
     *   - `displayQrCode` {boolean} Opsional, default `true`, apakah QR Code ditampilkan
     * @param {import("express").Response} res - Response ke client.
     * @param {Function} next - Middleware berikutnya (untuk error handling).
     * @returns {Promise<object>} Response JSON berisi dokumen yang sudah diperbarui dengan tanda tangan.
     */
    addPersonalSignature: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const { documentVersionId, method, signatureImageUrl, positionX, positionY, pageNumber, width, height, displayQrCode = true } = req.body;

      // Validasi input
      if (!documentVersionId || !signatureImageUrl || positionX == null || positionY == null || !pageNumber || !width || !height) {
        return res.status(400).json({
          status: "fail",
          code: "INVALID_INPUT",
          message: "Data tidak lengkap. Pastikan semua informasi (termasuk posisi dan ukuran) terkirim.",
        });
      }

      const signatureData = {
        method,
        signatureImageUrl,
        positionX,
        positionY,
        pageNumber,
        width,
        height,
      };
      const auditData = {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };
      const options = { displayQrCode };

      const updatedDocument = await signatureService.addPersonalSignature(userId, documentVersionId, signatureData, auditData, options);

      return res.status(200).json({
        status: "success",
        message: "Dokumen berhasil ditandatangani.",
        data: updatedDocument,
      });
    }),

    /**
     * Verifikasi tanda tangan berdasarkan ID uniknya.
     *
     * - Digunakan untuk mengecek validitas tanda tangan
     * - Biasanya ID ini berasal dari QR Code yang tertempel pada dokumen
     * - Akan mengembalikan detail informasi tanda tangan jika valid
     *
     * @route GET /api/signatures/verify/:signatureId
     * @param {import("express").Request} req - Request dari client (berisi `signatureId` di params).
     * @param {import("express").Response} res - Response ke client.
     * @param {Function} next - Middleware berikutnya.
     * @returns {Promise<object>} Response JSON berisi detail verifikasi tanda tangan.
     */
    getSignatureVerification: asyncHandler(async (req, res, next) => {
      const { signatureId } = req.params;

      const verificationDetails = await signatureService.getVerificationDetails(signatureId);

      return res.status(200).json({
        status: "success",
        data: verificationDetails,
      });
    }),
  };
};
