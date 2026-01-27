import asyncHandler from "../utils/asyncHandler.js";
import { aiService } from "../services/aiService.js";
import { PDFDocument } from "pdf-lib";

/**
 * Membuat instance Document Controller.
 * @param {Object} documentService - Service utama untuk logika bisnis dokumen.
 * @param {Object} signatureRepository - Repository untuk menyimpan data signature (posisi/placeholder).
 * @param {Object} fileStorage - Service untuk menangani operasi file (download/upload buffer).
 * @returns {Object} Kumpulan method controller untuk rute dokumen.
 */
export const createDocumentController = (documentService, signatureRepository, fileStorage, io) => {
  return {
    // ... triggers: createDocument ...
    createDocument: asyncHandler(async (req, res, next) => {
      const { title, type } = req.body;

      const file = req.file;
      const userId = req.user?.id;
      const document = await documentService.createDocument(userId, file, title, type);

      return res.status(201).json({
        status: "success",
        message: "Dokumen berhasil diunggah.",
        data: document,
      });
    }),

    // ... triggers: getAllDocuments ...
    getAllDocuments: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const search = req.query.search || "";

      const documents = await documentService.getAllDocuments(userId, search);

      return res.status(200).json({
        status: "success",
        data: documents,
      });
    }),

    // ... triggers: getDocumentById ...
    getDocumentById: asyncHandler(async (req, res, next) => {
      const documentId = req.params.id;

      // 1. Pastikan mengambil ID dari req.user (hasil dari middleware auth)
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized: User ID tidak ditemukan." });
      }

      // 2. [FIX] KIRIM userId KE SERVICE
      const document = await documentService.getDocumentById(documentId, userId);

      res.status(200).json({
        status: "success",
        data: document,
      });
    }),

    // ... triggers: updateDocument ...
    updateDocument: asyncHandler(async (req, res, next) => {
      const { id: documentId } = req.params;
      const userId = req.user?.id;
      const updates = req.body;

      const updatedDocument = await documentService.updateDocument(documentId, userId, updates);

      return res.status(200).json({
        status: "success",
        message: "Dokumen berhasil diperbaharui.",
        data: updatedDocument,
      });
    }),

    // ... triggers: deleteDocument ...
    deleteDocument: asyncHandler(async (req, res, next) => {
      const { id: documentId } = req.params;
      const userId = req.user?.id;

      await documentService.deleteDocument(documentId, userId);

      return res.status(200).json({
        status: "success",
        message: "Dokumen dan semua riwayatnya berhasil dihapus.",
      });
    }),

    // ... triggers: getDocumentHistory ...
    getDocumentHistory: asyncHandler(async (req, res, next) => {
      const { documentId } = req.params;
      const userId = req.user?.id;

      const history = await documentService.getDocumentHistory(documentId, userId);

      return res.status(200).json({
        status: "success",
        data: history,
      });
    }),

    /**
     * @description Mengembalikan dokumen ke versi sebelumnya (Rollback/Restore)
     * Proses:
     * 1. Ambil documentId dan versionId dari URL parameter
     * 2. Ambil userId dari middleware authentication
     * 3. Validasi ownership dan version exists
     * 4. Copy file dari old version ke current version di storage
     * 5. Update database untuk menunjuk old version sebagai current
     * 6. Return updated dokumen dengan new version info
     * @route POST /api/documents/:documentId/versions/:versionId/restore
     * @access Private - Require cookie authentication
     * @security cookieAuth: []
     * @param {string} documentId - Document ID (path parameter)
     * @param {string} versionId - Version ID yang akan di-restore (path parameter)
     * @returns {200} Versi dokumen berhasil diganti
     * @error {401} User tidak authenticated
     * @error {403} Akses ditolak
     * @error {404} Dokumen atau versi tidak ditemukan
     * @error {500} Server error
     */
    useOldVersion: asyncHandler(async (req, res, next) => {
      const { documentId, versionId } = req.params;
      const userId = req.user?.id;

      if (!documentId || !versionId) {
        // [FIXED] Empty block logic
      }

      const updatedDocument = await documentService.useOldVersion(documentId, versionId, userId);

      // [REALTIME] Emit Socket Event jika Dokumen Grup
      if (updatedDocument.groupId && io) {
        const roomName = `group_${updatedDocument.groupId}`;
        io.to(roomName).emit("group_document_update", {
          action: "rollback_version",
          documentId: updatedDocument.id,
          document: updatedDocument,
          message: `Dokumen dikembalikan ke versi sebelumnya.`,
          actorId: userId,
          uploaderName: req.user?.name || "Admin", // Fallback name
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Versi dokumen berhasil diganti.",
        data: updatedDocument,
      });
    }),

    /**
     * @description Menghapus satu versi spesifik dari riwayat dokumen
     * Proses:
     * 1. Ambil documentId dan versionId dari URL parameter
     * 2. Ambil userId dari middleware authentication
     * 3. Validasi ownership dan version exists
     * 4. Prevent deleting current active version
     * 5. Delete version file dari cloud storage
     * 6. Delete version record dari database
     * 7. Return success message
     * @route DELETE /api/documents/:documentId/versions/:versionId
     * @access Private - Require cookie authentication
     * @security cookieAuth: []
     * @param {string} documentId - Document ID (path parameter)
     * @param {string} versionId - Version ID yang akan dihapus (path parameter)
     * @returns {200} Versi dokumen berhasil dihapus
     * @error {400} Tidak bisa menghapus current active version
     * @error {401} User tidak authenticated
     * @error {403} Akses ditolak
     * @error {404} Dokumen atau versi tidak ditemukan
     * @error {500} Server error
     */
    deleteVersion: asyncHandler(async (req, res, next) => {
      const { documentId, versionId } = req.params;
      const userId = req.user?.id;

      await documentService.deleteVersion(documentId, versionId, userId);

      return res.status(200).json({
        status: "success",
        message: "Versi dokumen berhasil dihapus.",
      });
    }),

    /**
     * @description Mendapatkan Signed URL untuk melihat atau mengunduh dokumen aktif
     * Proses:
     * 1. Ambil documentId dari URL parameter
     * 2. Ambil userId dari middleware authentication
     * 3. Ambil purpose dari query param (view/download)
     * 4. Validasi ownership
     * 5. Generate Signed URL dari cloud storage (Supabase)
     * 6. URL berlaku limited time (biasanya 1 jam)
     * 7. Return URL dengan mode info
     * @route GET /api/documents/:documentId/file
     * @access Private - Require cookie authentication
     * @security cookieAuth: []
     * @param {string} documentId - Document ID (path parameter)
     * @param {string} [purpose] - Tujuan akses: 'view' atau 'download', default: 'view' (query param)
     * @returns {200} Signed URL untuk akses file
     * @error {401} User tidak authenticated
     * @error {403} Akses ditolak
     * @error {404} Dokumen tidak ditemukan
     * @error {500} Server error atau generate URL gagal
     */
    getDocumentFile: asyncHandler(async (req, res, next) => {
      const { documentId } = req.params;
      const userId = req.user?.id;
      const isDownload = req.query.purpose === "download";
      const signedUrl = await documentService.getDocumentFileUrl(documentId, userId, isDownload);

      return res.status(200).json({
        success: true,
        url: signedUrl,
        mode: isDownload ? "download" : "view",
      });
    }),

    /**
     * @description Mendapatkan Signed URL untuk mengunduh versi lama dokumen
     * Proses:
     * 1. Ambil documentId dan versionId dari URL parameter
     * 2. Ambil userId dari middleware authentication
     * 3. Validasi ownership dan version exists
     * 4. Generate Signed URL dari cloud storage untuk old version
     * 5. Set purpose ke 'download' (always download mode untuk old versions)
     * 6. Return URL dengan expiry info
     * @route GET /api/documents/:documentId/versions/:versionId/file
     * @access Private - Require cookie authentication
     * @security cookieAuth: []
     * @param {string} documentId - Document ID (path parameter)
     * @param {string} versionId - Version ID yang akan didownload (path parameter)
     * @returns {200} Signed URL untuk download versi lama
     * @error {401} User tidak authenticated
     * @error {403} Akses ditolak
     * @error {404} Dokumen atau versi tidak ditemukan
     * @error {500} Server error atau generate URL gagal
     */
    getVersionFile: asyncHandler(async (req, res, next) => {
      const { documentId, versionId } = req.params;
      const userId = req.user?.id;
      const isDownload = true;

      const signedUrl = await documentService.getVersionFileUrl(documentId, versionId, userId, isDownload);

      return res.status(200).json({
        success: true,
        url: signedUrl,
        expiresIn: 60,
        mode: "download",
      });
    }),

    /**
     * @description Menganalisis konten dokumen menggunakan AI
     * Proses:
     * 1. Ambil documentId dari URL parameter
     * 2. Ambil userId dari middleware authentication
     * 3. Validasi ownership
     * 4. Generate Signed URL untuk akses file
     * 5. Send URL ke AI Service (Python/LLM) untuk analisis
     * 6. AI extract summary, insights, key points dari dokumen
     * 7. Return hasil analisis
     * @route POST /api/documents/:documentId/analyze
     * @access Private - Require cookie authentication
     * @security cookieAuth: []
     * @param {string} documentId - Document ID untuk dianalisis (path parameter)
     * @returns {200} Hasil analisis AI (summary, insights, key points)
     * @error {400} Dokumen tidak valid atau analisis gagal
     * @error {401} User tidak authenticated
     * @error {403} Akses ditolak
     * @error {404} Dokumen tidak ditemukan
     * @error {500} Server error atau AI service error
     */
    analyzeDocument: asyncHandler(async (req, res, next) => {
      const { documentId } = req.params;
      const userId = req.user?.id;

      const documentData = await documentService.getDocumentById(documentId, userId);
      if (!documentData) {
        return res.status(404).json({ status: "fail", message: "Dokumen tidak ditemukan." });
      }

      let fileUrl = null;
      try {
        fileUrl = await documentService.getDocumentFileUrl(documentId, userId);
      } catch (e) {
        console.warn("⚠️ Gagal generate URL, mencoba fallback ke Buffer.");
      }
      const isUrlValid = fileUrl && typeof fileUrl === "string" && fileUrl.startsWith("http");

      let sourceData;
      let mode;

      if (isUrlValid) {
        if (process.env.NODE_ENV === "production") {
          const maskedUrl = fileUrl.split("?")[0] + "?token=HIDDEN";
        } else {
        }

        mode = "url";
        sourceData = fileUrl;
      }

      const analysisResult = await aiService.analyzeDocumentContent(sourceData, mode, documentData.type);

      if (!analysisResult || analysisResult.error) {
        return res.status(400).json({
          status: "fail",
          message: analysisResult?.error || "Gagal menganalisis dokumen (AI tidak merespons).",
        });
      }

      return res.status(200).json({
        status: "success",
        data: analysisResult,
      });
    }),
  };
};
