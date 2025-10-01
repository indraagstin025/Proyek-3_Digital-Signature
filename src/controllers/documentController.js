/**
 * @file Controller untuk menangani semua request yang berhubungan dengan dokumen.
 * Controller ini bertugas sebagai penghubung antara request (client)
 * dan service (logika utama yang mengatur data).
 */

import asyncHandler from "../utils/asyncHandler.js";

/**
 * Membuat objek controller untuk dokumen.
 * Controller ini menyediakan berbagai handler (fungsi) untuk:
 * - Mengunggah dokumen baru
 * - Mengambil daftar dokumen
 * - Mengambil detail dokumen
 * - Memperbarui dokumen
 * - Menghapus dokumen
 * - Mengelola versi dokumen
 *
 * @param {import('../services/documentService.js').DocumentService} documentService - Instance dari DocumentService yang berisi logika utama.
 * @returns {object} - Kumpulan fungsi handler yang siap digunakan pada routing.
 */
export const createDocumentController = (documentService) => {
  return {
    /**
     * Mengunggah dokumen baru.
     *
     * - File wajib diunggah
     * - Judul wajib diisi
     * - User ID diambil dari `req.user`
     *
     * @route POST /documents
     * @param {import("express").Request} req - Request dari client (berisi body, file, dan user).
     * @param {import("express").Response} res - Response ke client.
     * @param {Function} next - Middleware berikutnya (untuk error handling).
     * @returns {Promise<object>} Response JSON berisi detail dokumen baru.
     */
    createDocument: asyncHandler(async (req, res, next) => {
      const { title } = req.body;
      const file = req.file;
      const userId = req.user?.id;

      if (!file) {
        return res.status(400).json({
          status: "fail",
          code: "FILE_REQUIRED",
          message: "File dokumen wajib diunggah",
        });
      }

      if (!title) {
        return res.status(400).json({
          status: "fail",
          code: "TITLE_REQUIRED",
          message: "Judul file wajib diisi.",
        });
      }

      const document = await documentService.createDocument(userId, file, title);

      return res.status(201).json({
        status: "success",
        message: "Dokumen berhasil diunggah.",
        data: document,
      });
    }),

    /**
     * Mengambil semua dokumen milik user yang sedang login.
     *
     * @route GET /documents
     * @param {import("express").Request} req
     * @param {import("express").Response} res
     * @param {Function} next
     * @returns {Promise<object>} Response JSON berisi daftar dokumen.
     */
    getAllDocuments: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const documents = await documentService.getAllDocuments(userId);

      return res.status(200).json({
        status: "success",
        data: documents,
      });
    }),

    /**
     * Mengambil detail dokumen berdasarkan ID.
     *
     * @route GET /documents/:id
     * @param {import("express").Request} req
     * @param {import("express").Response} res
     * @param {Function} next
     * @returns {Promise<object>} Response JSON berisi detail dokumen.
     */
    getDocumentById: asyncHandler(async (req, res, next) => {
      const { id: documentId } = req.params;
      const userId = req.user?.id;

      const document = await documentService.getDocumentById(documentId, userId);

      return res.status(200).json({
        status: "success",
        message: "Dokumen berhasil diambil.",
        data: document,
      });
    }),

    /**
     * Memperbarui detail dokumen.
     *
     * @route PUT /documents/:id
     * @param {import("express").Request} req
     * @param {import("express").Response} res
     * @param {Function} next
     * @returns {Promise<object>} Response JSON berisi dokumen yang sudah diperbarui.
     */
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

    /**
     * Menghapus dokumen beserta semua versi/riwayatnya.
     *
     * @route DELETE /documents/:id
     * @param {import("express").Request} req
     * @param {import("express").Response} res
     * @param {Function} next
     * @returns {Promise<object>} Response JSON konfirmasi penghapusan.
     */
    deleteDocument: asyncHandler(async (req, res, next) => {
      const { id: documentId } = req.params;
      const userId = req.user?.id;

      await documentService.deleteDocument(documentId, userId);

      return res.status(200).json({
        status: "success",
        message: "Dokumen dan semua riwayatnya berhasil dihapus.",
      });
    }),

    /**
     * Mengambil riwayat versi dokumen.
     *
     * @route GET /documents/:documentId/history
     * @param {import("express").Request} req
     * @param {import("express").Response} res
     * @param {Function} next
     * @returns {Promise<object>} Response JSON berisi daftar riwayat versi dokumen.
     */
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
     * Mengganti dokumen ke versi lama tertentu.
     *
     * @route PUT /documents/:documentId/use-version/:versionId
     * @param {import("express").Request} req
     * @param {import("express").Response} res
     * @param {Function} next
     * @returns {Promise<object>} Response JSON berisi dokumen setelah diganti ke versi lama.
     */
    useOldVersion: asyncHandler(async (req, res, next) => {
      const { documentId, versionId } = req.params;
      const userId = req.user?.id;

      const updatedDocument = await documentService.useOldVersion(documentId, versionId, userId);

      return res.status(200).json({
        status: "success",
        message: "Versi dokumen berhasil diganti.",
        data: updatedDocument,
      });
    }),

    /**
     * Menghapus salah satu versi dokumen.
     *
     * @route DELETE /documents/:documentId/versions/:versionId
     * @param {import("express").Request} req
     * @param {import("express").Response} res
     * @param {Function} next
     * @returns {Promise<object>} Response JSON konfirmasi penghapusan versi.
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
  };
};
