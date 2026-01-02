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
     * @description [USER ACTION] Tanda tangan dokumen grup (Draft -> Final).
     * @route   POST /api/group-signatures/:documentId/sign
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
     * @description [DRAFT] Simpan Draft Tanda Tangan (Drop Awal).
     * @route   POST /api/group-signatures/draft/:documentId
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
     * @description [UPDATE] Update posisi tanda tangan (Drag/Resize).
     * @route   PATCH /api/group-signatures/:signatureId/position
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
     * @description [DELETE] Hapus Draft.
     * @route   DELETE /api/group-signatures/:signatureId
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
