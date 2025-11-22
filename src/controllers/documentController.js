/**
 * @file Controller untuk menangani semua request yang berhubungan dengan dokumen.
 */

import asyncHandler from "../utils/asyncHandler.js";


export const createDocumentController = (documentService) => {


    return {
        /**
         * Mengunggah dokumen baru.
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
         * Mengambil semua dokumen milik user.
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
         * Menghapus dokumen.
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
         * Mengganti versi aktif.
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
         * Menghapus versi spesifik.
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

        // =================================================================
        // BAGIAN PENTING: PERBAIKAN LOGIKA FILE URL (View vs Download)
        // =================================================================

        /**
         * Menghasilkan signed URL untuk versi DOKUMEN AKTIF.
         * Mendukung mode View (clean URL) dan Download (attachment).
         * * @route GET /documents/:documentId/file?purpose=download
         */
        getDocumentFile: asyncHandler(async (req, res, next) => {
            const { documentId } = req.params;
            const userId = req.user?.id;

            // 1. Cek Query Param dari Frontend
            // Jika frontend kirim ?purpose=download, maka isDownload = true
            const isDownload = req.query.purpose === 'download';

            // 2. Panggil Service dengan parameter isDownload
            // Tidak perlu logika versi/nama file disini, Service yang urus.
            const signedUrl = await documentService.getDocumentFileUrl(documentId, userId, isDownload);

            // 3. Response
            return res.status(200).json({
                success: true,
                url: signedUrl,
                expiresIn: 60,
                mode: isDownload ? 'download' : 'view'
            });
        }),

        /**
         * Menghasilkan signed URL untuk DOKUMEN VERSI SPESIFIK.
         * * @route GET /documents/:documentId/versions/:versionId/file?purpose=download
         */
        getVersionFile: asyncHandler(async (req, res, next) => {
            const { documentId, versionId } = req.params;
            const userId = req.user?.id;

            // 1. Cek Query Param
            const isDownload = req.query.purpose === 'download';

            // 2. Panggil Service
            const signedUrl = await documentService.getVersionFileUrl(documentId, versionId, userId, isDownload);

            return res.status(200).json({
                success: true,
                url: signedUrl,
                expiresIn: 60,
                mode: isDownload ? 'download' : 'view'
            });
        }),

    };
};