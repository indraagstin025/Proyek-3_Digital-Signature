import asyncHandler from "../utils/asyncHandler.js";

/**
 * Helper IP Address
 */
const getRealIpAddress = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor && typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.connection.remoteAddress;
};

export const createGroupSignatureController = (groupSignatureService, groupService) => {
  return {
    /**
     * @description User menandatangani dokumen grup (Draft -> Final)
     * Proses:
     * 1. Ambil userId dari middleware authentication
     * 2. Ambil documentId dari URL parameter
     * 3. Validasi signature data (image, position, page number)
     * 4. Save tanda tangan ke database
     * 5. Cek apakah semua penandatangan sudah selesai
     * 6. Return status completion dan remaining signers
     * @route POST /api/group-signatures/:documentId/sign
     * @access Private - Require cookie authentication
     * @security cookieAuth: []
     * @param {string} documentId - ID dokumen (path parameter)
     * @param {string} signatureImageUrl - Base64 atau URL gambar tanda tangan (required)
     * @param {number} positionX - Posisi X pada halaman
     * @param {number} positionY - Posisi Y pada halaman
     * @param {integer} pageNumber - Nomor halaman tanda tangan
     * @param {number} [width] - Lebar tanda tangan
     * @param {number} [height] - Tinggi tanda tangan
     * @param {string} [method] - Method tanda tangan (draw/upload/etc)
     * @returns {200} Tanda tangan berhasil disimpan
     * @error {400} Data tanda tangan tidak valid
     * @error {401} User tidak authenticated
     * @error {403} User tidak authorized
     * @error {500} Server error
     */
    signDocument: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const documentId = req.params.documentId || req.body.documentId;

      console.log(`➡️ [Controller] signDocument hit. DocID: ${documentId}, User: ${userId}`);

      const { id, signatureImageUrl, positionX, positionY, pageNumber, width, height, method } = req.body;

      if (!documentId) return res.status(400).json({ status: "fail", message: "documentId wajib diisi." });
      if (!signatureImageUrl) return res.status(400).json({ status: "fail", message: "Data gambar tanda tangan wajib diisi." });

      const auditData = {
        ipAddress: getRealIpAddress(req),
        userAgent: req.headers["user-agent"],
      };

      const signatureData = {
        id,
        signatureImageUrl,
        positionX,
        positionY,
        pageNumber,
        width,
        height,
        method,
      };

      try {
        const result = await groupSignatureService.signDocument(userId, documentId, signatureData, auditData, req);
        console.log(`✅ [Controller] signDocument Success.`);

        return res.status(200).json({
          status: "success",
          message: result.message,
          data: {
            isComplete: result.isComplete,
            remainingSigners: result.remainingSigners,
            readyToFinalize: result.readyToFinalize,
          },
        });
      } catch (error) {
        console.error(`❌ [Controller] Error signDocument:`, error.message);
        throw error;
      }
    }),

    /**
     * @description Simpan draft tanda tangan (drop awal sebelum finalisasi)
     * Proses:
     * 1. Ambil userId dari middleware authentication
     * 2. Ambil documentId dari URL parameter
     * 3. Validasi signature data
     * 4. Simpan draft tanda tangan ke database
     * 5. Capture audit data (IP address, user agent)
     * 6. Return draft signature dengan ID
     * @route POST /api/group-signatures/draft/:documentId
     * @access Private - Require cookie authentication
     * @security cookieAuth: []
     * @param {string} documentId - ID dokumen (path parameter)
     * @param {string} signatureImageUrl - Base64 atau URL gambar tanda tangan (required)
     * @param {integer} pageNumber - Nomor halaman
     * @param {number} positionX - Posisi X
     * @param {number} positionY - Posisi Y
     * @param {number} [width] - Lebar tanda tangan
     * @param {number} [height] - Tinggi tanda tangan
     * @param {string} [method] - Method tanda tangan
     * @returns {201} Draft tanda tangan berhasil disimpan
     * @error {400} Document ID tidak valid atau data tidak lengkap
     * @error {401} User tidak authenticated
     * @error {500} Server error
     */
    saveDraft: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const { documentId } = req.params;

      console.log(`➡️ [Controller] saveDraft hit. URL: ${req.originalUrl}`);
      console.log(`   params.documentId: ${documentId}`);
      console.log(`   body.id (Signature UUID): ${req.body.id}`);

      const { id, signatureImageUrl, pageNumber, positionX, positionY, width, height, method } = req.body;

      if (!documentId) {
        console.warn(`⚠️ [Controller] DocumentID missing in params`);
        return res.status(400).json({ status: "fail", message: "Document ID wajib ada." });
      }

      const signatureData = {
        id,
        signatureImageUrl,
        pageNumber,
        positionX,
        positionY,
        width,
        height,
        method,
        ipAddress: getRealIpAddress(req),
        userAgent: req.headers["user-agent"],
      };

      try {
        // Panggil Service
        const result = await groupSignatureService.saveDraft(userId, documentId, signatureData);
        console.log(`✅ [Controller] saveDraft Success for ID: ${result.id}`);

        return res.status(201).json({
          status: "success",
          message: "Draft tanda tangan tersimpan.",
          data: result,
        });
      } catch (error) {
        console.error(`❌ [Controller] Error saveDraft:`, error);
        // Jika error ini muncul di console, berarti request Masuk tapi Logic Service Gagal
        // Jika tidak muncul sama sekali, berarti Route di app.js belum terpasang
        throw error;
      }
    }),

    /**
     * @description Update posisi draft tanda tangan saat di-drag atau di-resize
     * Proses:
     * 1. Ambil signatureId dari URL parameter
     * 2. Validasi parameter (posisi, ukuran, page)
     * 3. Update draft tanda tangan di database
     * 4. Return updated draft dengan data baru
     * @route PATCH /api/group-signatures/:signatureId/position
     * @access Private - Require cookie authentication
     * @security cookieAuth: []
     * @param {string} signatureId - ID signature draft (path parameter)
     * @param {number} positionX - Posisi X baru
     * @param {number} positionY - Posisi Y baru
     * @param {number} [width] - Lebar baru (optional)
     * @param {number} [height] - Tinggi baru (optional)
     * @param {integer} [pageNumber] - Nomor halaman baru (optional)
     * @returns {200} Posisi tanda tangan berhasil diupdate
     * @error {400} Signature ID tidak valid
     * @error {401} User tidak authenticated
     * @error {500} Server error
     */
    updateDraftPosition: asyncHandler(async (req, res, next) => {
      const { signatureId } = req.params;
      console.log(`➡️ [Controller] updateDraftPosition hit. SigID: ${signatureId}`);

      const { positionX, positionY, width, height, pageNumber } = req.body;

      if (!signatureId) return res.status(400).json({ status: "fail", message: "Signature ID wajib ada." });

      const safeWidth = width && width > 0 ? width : undefined;
      const safeHeight = height && height > 0 ? height : undefined;

      try {
        const result = await groupSignatureService.updateDraftPosition(signatureId, {
          positionX,
          positionY,
          width: safeWidth,
          height: safeHeight,
          pageNumber,
        });

        if (!result) {
          console.warn(`⚠️ [Controller] updateDraftPosition: Item not found (Silent 200)`);
          return res.status(200).json({ status: "success", message: "Posisi diupdate (atau data tidak ditemukan)." });
        }

        console.log(`✅ [Controller] updateDraftPosition Success.`);
        return res.status(200).json({
          status: "success",
          message: "Posisi tanda tangan diperbarui.",
          data: result,
        });
      } catch (error) {
        console.error(`❌ [Controller] Error updateDraftPosition:`, error.message);
        throw error;
      }
    }),

    /**
     * @description Hapus draft tanda tangan
     * Proses:
     * 1. Ambil signatureId dari URL parameter
     * 2. Validasi signature exists dan ownership
     * 3. Delete draft dari database
     * 4. Return success message
     * @route DELETE /api/group-signatures/:signatureId
     * @access Private - Require cookie authentication
     * @security cookieAuth: []
     * @param {string} signatureId - ID signature draft yang akan dihapus (path parameter)
     * @returns {200} Draft tanda tangan berhasil dihapus
     * @error {400} Signature ID tidak valid
     * @error {401} User tidak authenticated
     * @error {500} Server error
     */
    deleteDraft: asyncHandler(async (req, res, next) => {
      const { signatureId } = req.params;
      console.log(`➡️ [Controller] deleteDraft hit. SigID: ${signatureId}`);

      if (!signatureId) return res.status(400).json({ status: "fail", message: "Signature ID wajib ada." });

      try {
        await groupSignatureService.deleteDraft(signatureId);
        console.log(`✅ [Controller] deleteDraft Success.`);

        return res.status(200).json({
          status: "success",
          message: "Draft tanda tangan dihapus.",
        });
      } catch (error) {
        console.error(`❌ [Controller] Error deleteDraft:`, error.message);
        throw error;
      }
    }),

    /**
     * @description Finalisasi dokumen grup setelah semua tanda tangan selesai
     * Proses:
     * 1. Ambil adminId dari middleware authentication
     * 2. Ambil groupId dan documentId dari request body
     * 3. Validasi admin adalah owner/admin grup
     * 4. Cek semua tanda tangan sudah complete
     * 5. Finalize dokumen dan generate signed PDF
     * 6. Generate access code (PIN) untuk keamanan
     * 7. Return URL dokumen dan access code
     * @route POST /api/group-signatures/finalize
     * @access Private - Require cookie authentication (Admin/Owner)
     * @security cookieAuth: []
     * @param {string} groupId - ID grup yang memiliki dokumen (required)
     * @param {string} documentId - ID dokumen yang akan difinalisasi (required)
     * @returns {200} Dokumen grup berhasil difinalisasi dengan URL dan access code
     * @error {400} Group ID atau Document ID tidak valid
     * @error {401} User tidak authenticated
     * @error {403} User tidak authorized (bukan admin)
     * @error {500} Server error
     */
    finalizeGroupDocument: asyncHandler(async (req, res, next) => {
      const adminId = req.user?.id;
      // Pastikan Frontend mengirim body: { groupId, documentId }
      const { groupId, documentId } = req.body;

      console.log(`➡️ [Controller] finalizeGroupDocument hit. Admin: ${adminId}`);

      if (!groupId || !documentId) {
        return res.status(400).json({ status: "fail", message: "Group ID dan Document ID wajib ada." });
      }

      try {
        // Service ini sudah kita update sebelumnya untuk me-return { message, url, accessCode }
        const result = await groupService.finalizeGroupDocument(groupId, documentId, adminId);

        console.log(`✅ [Controller] finalizeGroupDocument Success.`);

        // [UPDATE PENTING] Kirim accessCode ke Frontend
        return res.status(200).json({
          status: "success",
          message: result.message,
          data: {
            url: result.url,
            accessCode: result.accessCode, // <--- PIN Keamanan
          },
        });
      } catch (error) {
        console.error(`❌ [Controller] Error finalizeGroupDocument:`, error.message);
        throw error;
      }
    }),
  };
};
