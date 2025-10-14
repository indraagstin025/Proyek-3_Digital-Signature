/**
 * @file Controller untuk menangani semua request yang berhubungan dengan dokumen.
 * Controller ini bertugas sebagai penghubung antara request (client)
 * dan service (logika utama yang mengatur data).
 */

import asyncHandler from "../utils/asyncHandler.js";
import DocumentError from "../errors/DocumentError.js"; // ✅ tambahkan import error

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
 * @param {import('../repository/supabase/SupabaseFileStorage.js').default} fileStorage - Instance file storage untuk generate signed URL.
 * @returns {object} - Kumpulan fungsi handler yang siap digunakan pada routing.
 */
export const createDocumentController = (documentService, fileStorage) => { // ✅ tambahkan fileStorage sebagai dependency
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

        /**
         * Menghasilkan signed URL untuk mengakses file dari versi DOKUMEN AKTIF.
         *
         * @route GET /documents/:documentId/file
         * @param {import("express").Request} req
         * @param {import("express").Response} res
         * @param {Function} next
         * @returns {Promise<object>} Response JSON berisi signed URL.
         */
        getDocumentFile: asyncHandler(async (req, res, next) => {
            const { documentId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ success: false, error: "Unauthorized" });
            }

            try {
                // Service akan memvalidasi kepemilikan dan mengambil detail dokumen
                const document = await documentService.getDocumentById(documentId, userId);

                // Validasi data integrity: pastikan versi aktif dan URL-nya ada
                if (!document.currentVersion || !document.currentVersion.url) {
                    throw new Error("Data dokumen tidak lengkap, URL file tidak dapat ditemukan.");
                }

                // Generate signed URL (berlaku 60 detik)
                const signedUrl = await fileStorage.getSignedUrl(document.currentVersion.url, 60);

                return res.status(200).json({
                    success: true,
                    url: signedUrl,
                    expiresIn: 60
                });
            } catch (error) {
                // Tangani error yang sudah kita antisipasi (misal: dokumen tidak ditemukan)
                if (
                    error.code === "DOCUMENT_NOT_FOUND" ||
                    error.code === "UNAUTHORIZED_DOCUMENT_ACCESS"
                ) {
                    return res.status(404).json({
                        success: false,
                        error: "Dokumen tidak ditemukan atau tidak diizinkan"
                    });
                }
                // Lempar error lain ke global error handler
                next(error);
            }
        }),

        /**
         * Menghasilkan signed URL untuk file dari versi DOKUMEN SPESIFIK.
         * @route GET /documents/:documentId/versions/:versionId/file
         */
        getVersionFile: asyncHandler(async (req, res, next) => {
            const { documentId, versionId } = req.params;
            const userId = req.user?.id;

            try {
                const signedUrl = await documentService.getVersionFileUrl(documentId, versionId, userId);

                return res.status(200).json({
                    success: true,
                    url: signedUrl,
                    expiresIn: 60
                });
            } catch (error) {
                if (
                    error.code === "DOCUMENT_NOT_FOUND" ||
                    error.code === "UNAUTHORIZED_DOCUMENT_ACCESS" ||
                    error.code === "INVALID_VERSION"
                ) {
                    return res.status(404).json({
                        success: false,
                        error: "Versi dokumen tidak ditemukan atau akses ditolak."
                    });
                }
                next(error);
            }
        }),
    };
};