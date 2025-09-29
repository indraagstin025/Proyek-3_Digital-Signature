import asyncHandler from '../utils/asyncHandler.js';

/**
 * @description Factory function yang membuat dan mengembalikan objek document controller.
 * @param {import('../services/documentService.js').DocumentService} documentService - Instance dari DocumentService yang diinjeksi.
 * @returns {object} Objek yang berisi semua fungsi handler untuk rute dokumen.
 */
export const createDocumentController = (documentService) => {
    return {
        /**
         * @description Menangani pembuatan dokumen baru dari file yang diunggah.
         * @route POST /api/documents
         * @param {import('express').Request} req - Objek request Express, mengandung req.user.id, req.body.title, dan req.file.
         * @param {import('express').Response} res - Objek response Express.
         * @param {import('express').NextFunction} next - Fungsi middleware next Express.
         */
        createDocument: asyncHandler(async (req, res, next) => {
            const { title } = req.body;
            const file = req.file;
            const userId = req.user?.id;

            const document = await documentService.createDocument(userId, file, title);
            res.status(201).json({ status: "success", message: "Dokumen berhasil diunggah.", data: document });
        }),

        /**
         * @description Mengambil semua dokumen milik pengguna yang sedang login.
         * @route GET /api/documents
         * @param {import('express').Request} req - Objek request Express, mengandung req.user.id.
         * @param {import('express').Response} res - Objek response Express.
         * @param {import('express').NextFunction} next - Fungsi middleware next Express.
         */
        getAllDocuments: asyncHandler(async (req, res, next) => {
            const userId = req.user?.id;
            const documents = await documentService.getAllDocuments(userId);
            res.status(200).json({ status: "success", data: documents });
        }),

        /**
         * @description Mengambil satu dokumen spesifik berdasarkan ID-nya.
         * @route GET /api/documents/:id
         * @param {import('express').Request} req - Objek request Express, mengandung req.user.id dan req.params.id.
         * @param {import('express').Response} res - Objek response Express.
         * @param {import('express').NextFunction} next - Fungsi middleware next Express.
         */
        getDocumentById: asyncHandler(async (req, res, next) => {
            const { id: documentId } = req.params;
            const userId = req.user?.id;
            const document = await documentService.getDocumentById(documentId, userId);
            res.status(200).json({ status: "success", message: "Dokumen berhasil diambil.", data: document });
        }),

        /**
         * @description Memperbarui detail sebuah dokumen.
         * @route PATCH /api/documents/:id
         * @param {import('express').Request} req - Objek request Express, mengandung req.user.id, req.params.id, dan req.body untuk data update.
         * @param {import('express').Response} res - Objek response Express.
         * @param {import('express').NextFunction} next - Fungsi middleware next Express.
         */
        updateDocument: asyncHandler(async (req, res, next) => {
            const { id: documentId } = req.params;
            const userId = req.user?.id;
            const updates = req.body;
            const newFile = req.file; // File opsional untuk update

            const updatedDocument = await documentService.updateDocument(documentId, userId, updates, newFile);
            res.status(200).json({ status: "success", message: "Dokumen berhasil diperbaharui.", data: updatedDocument });
        }),

        /**
         * @description Menghapus sebuah dokumen dan semua versinya secara permanen.
         * @route DELETE /api/documents/:id
         * @param {import('express').Request} req - Objek request Express, mengandung req.user.id dan req.params.id.
         * @param {import('express').Response} res - Objek response Express.
         * @param {import('express').NextFunction} next - Fungsi middleware next Express.
         */
        deleteDocument: asyncHandler(async (req, res, next) => {
            const { id: documentId } = req.params;
            const userId = req.user?.id;
            await documentService.deleteDocument(documentId, userId);
            res.status(200).json({ status: "success", message: "Dokumen dan semua riwayatnya berhasil dihapus." });
        }),

        /**
         * @description Mengambil riwayat versi dari sebuah dokumen.
         * @route GET /api/documents/:documentId/versions
         * @param {import('express').Request} req - Objek request Express, mengandung req.user.id dan req.params.documentId.
         * @param {import('express').Response} res - Objek response Express.
         * @param {import('express').NextFunction} next - Fungsi middleware next Express.
         */
        getDocumentHistory: asyncHandler(async (req, res, next) => {
            const { documentId } = req.params;
            const userId = req.user?.id;
            const history = await documentService.getDocumentHistory(documentId, userId);
            res.status(200).json({ status: "success", data: history });
        }),

        /**
         * @description Mengembalikan dokumen ke versi yang lebih lama (menjadikannya versi aktif).
         * @route POST /api/documents/:documentId/versions/:versionId/restore
         * @param {import('express').Request} req - Objek request Express, mengandung req.user.id dan parameter documentId & versionId.
         * @param {import('express').Response} res - Objek response Express.
         * @param {import('express').NextFunction} next - Fungsi middleware next Express.
         */
        useOldVersion: asyncHandler(async (req, res, next) => {
            const { documentId, versionId } = req.params;
            const userId = req.user?.id;
            const updatedDocument = await documentService.useOldVersion(documentId, versionId, userId);
            res.status(200).json({ status: "success", message: "Versi dokumen berhasil diganti.", data: updatedDocument });
        }),

        /**
         * @description Menghapus satu versi spesifik dari riwayat dokumen.
         * @route DELETE /api/documents/:documentId/versions/:versionId
         * @param {import('express').Request} req - Objek request Express, mengandung req.user.id dan parameter documentId & versionId.
         * @param {import('express').Response} res - Objek response Express.
         * @param {import('express').NextFunction} next - Fungsi middleware next Express.
         */
        deleteVersion: asyncHandler(async (req, res, next) => {
            const { documentId, versionId } = req.params;
            const userId = req.user?.id;
            await documentService.deleteVersion(documentId, versionId, userId);
            res.status(200).json({ status: "success", message: "Versi dokumen berhasil dihapus." });
        }),

        /**
         * @description Endpoint placeholder untuk fitur unggah dokumen yang sudah ditandatangani.
         * @route (Not Implemented)
         * @param {import('express').Request} req - Objek request Express.
         * @param {import('express').Response} res - Objek response Express.
         */
        uploadSignedDocument: (req, res) => {
            res.status(501).json({ status: "info", message: "Fitur ini belum diimplementasikan." });
        },
    };
};