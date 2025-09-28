/**
 * @description Factory function untuk membuat controller tanda tangan.
 * @param {import('../services/documentService.js').DocumentService} documentService - Instance dari DocumentService.
 * @param {import('../services/signatureService.js').SignatureService} signatureService - Instance dari SignatureService.
 * @returns {object} - Objek berisi semua handler controller.
 */
export const createSignatureController = (documentService, signatureService) => {
  return {
    /**
     * @description Menangani permintaan untuk menambahkan tanda tangan mandiri ke sebuah versi dokumen.
     * @route POST /api/signatures/personal
     */
    addPersonalSignature: async (req, res, next) => {
      try {
        const userId = req.user?.id;

        const { documentVersionId, method, signatureImageUrl, positionX, positionY, pageNumber, width, height, displayQrCode = true } = req.body;

        if (!documentVersionId || !signatureImageUrl || positionX == null || positionY == null || !pageNumber || !width || !height) {
          return res.status(400).json({
            status: "error",
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

        const options = {
          displayQrCode: displayQrCode,
        };

        const updatedDocument = await signatureService.addPersonalSignature(userId, documentVersionId, signatureData, auditData, options);

        return res.status(200).json({
          status: "success",
          message: "Dokumen berhasil ditandatangani.",
          data: updatedDocument,
        });
      } catch (error) {
          next(error);
      }
    },

    /**
     * @description Menangani verifikasi tanda tangan dari ID uniknya (misal dari QR Code).
     * @route GET /api/signatures/verify/:signatureId
     */
    getSignatureVerification: async (req, res) => {
      try {
        const { signatureId } = req.params;

        const verificationDetails = await signatureService.getVerificationDetails(signatureId);

        return res.status(200).json({ status: "success", data: verificationDetails });
      } catch (error) {
        console.error("Controller Error - getSignatureVerification:", error);
        if (error.message.includes("tidak ditemukan")) {
          return res.status(404).json({ status: "error", message: error.message });
        }
        return res.status(500).json({ status: "error", message: "Terjadi kesalahan pada server." });
      }
    },
  };
};
