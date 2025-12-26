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
export const createDocumentController = (documentService, signatureRepository, fileStorage) => {
  return {
    /**
     * @description Mengunggah dokumen baru ke sistem.
     * * **Proses Kode:**
     * 1. Menerima data `title` dari body dan file fisik dari `req.file` (Multer).
     * 2. Mengambil `userId` dari token autentikasi.
     * 3. Memanggil `documentService.createDocument` untuk mengunggah file ke storage dan menyimpan metadata ke database.
     * 4. Mengembalikan response HTTP 201 dengan data dokumen yang baru dibuat.
     * * @route   POST /api/documents
     * @param {import("express").Request} req - Body: title, File: req.file.
     * @param {import("express").Response} res - Response object.
     */
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


    /**
     * @description Mengambil daftar semua dokumen milik pengguna yang sedang login.
     * * **Proses Kode:**
     * 1. Mengidentifikasi user berdasarkan `userId`.
     * 2. Memanggil `documentService.getAllDocuments` untuk query database.
     * 3. Mengembalikan array dokumen dalam format JSON.
     * * @route   GET /api/documents
     * @param {import("express").Request} req - User ID dari token.
     * @param {import("express").Response} res - Response object.
     */
    getAllDocuments: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const search = req.query.search || "";

      const documents = await documentService.getAllDocuments(userId, search);

      return res.status(200).json({
        status: "success",
        data: documents,
      });
    }),

    /**
     * @description Mendapatkan detail lengkap satu dokumen berdasarkan ID.
     * * **Proses Kode:**
     * 1. Mengambil `documentId` dari URL parameter.
     * 2. Memastikan dokumen tersebut milik `userId` yang sedang login (validasi kepemilikan di service).
     * 3. Mengembalikan objek detail dokumen.
     * * @route   GET /api/documents/:id
     * @param {import("express").Request} req - Params: id.
     * @param {import("express").Response} res - Response object.
     */
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

    /**
     * @description Memperbarui metadata dokumen (misal: judul).
     * * **Proses Kode:**
     * 1. Menerima data perubahan dari `req.body`.
     * 2. Memanggil `documentService.updateDocument` untuk melakukan update di database.
     * 3. Mengembalikan data dokumen yang telah diperbarui.
     * * @route   PUT /api/documents/:id
     * @param {import("express").Request} req - Params: id, Body: updates.
     * @param {import("express").Response} res - Response object.
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
     * @description Menghapus dokumen beserta file fisik dan riwayatnya.
     * * **Proses Kode:**
     * 1. Memanggil `documentService.deleteDocument` dengan ID dokumen.
     * 2. Service akan menghapus record database dan file di object storage.
     * 3. Mengembalikan pesan sukses.
     * * @route   DELETE /api/documents/:id
     * @param {import("express").Request} req - Params: id.
     * @param {import("express").Response} res - Response object.
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
     * @description Melihat riwayat versi (version control) dari sebuah dokumen.
     * * @route   GET /api/documents/:documentId/history
     * @param {import("express").Request} req - Params: documentId.
     * @param {import("express").Response} res - Response object.
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
     * @description Mengembalikan dokumen ke versi sebelumnya (Rollback).
     * * **Proses Kode:**
     * 1. Menerima `versionId` target yang ingin digunakan kembali.
     * 2. Service akan menyalin file dari versi lama menjadi `currentVersion` baru.
     * 3. Database diperbarui untuk menunjuk versi baru tersebut sebagai versi aktif.
     * * @route   POST /api/documents/:documentId/versions/:versionId/restore
     * @param {import("express").Request} req - Params: documentId, versionId.
     * @param {import("express").Response} res - Response object.
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
     * @description Menghapus satu versi spesifik dari riwayat dokumen.
     * * @route   DELETE /api/documents/:documentId/versions/:versionId
     * @param {import("express").Request} req - Params: documentId, versionId.
     * @param {import("express").Response} res - Response object.
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
     * @description Mendapatkan Signed URL untuk melihat atau mengunduh dokumen aktif.
     * * **Proses Kode:**
     * 1. Mengecek query param `purpose` (apakah 'download' atau 'view').
     * 2. Meminta `documentService` membuat Signed URL sementara dari storage provider (misal: Supabase/S3).
     * 3. Mengembalikan URL tersebut beserta waktu kedaluwarsa (expiresIn).
     * * @route   GET /api/documents/:documentId/file
     * @param {import("express").Request} req - Params: documentId, Query: purpose.
     * @param {import("express").Response} res - Response object.
     */
    getDocumentFile: asyncHandler(async (req, res, next) => {
      const { documentId } = req.params;
      const userId = req.user?.id;
      const isDownload = req.query.purpose === "download";

      const filePath = await documentService.getDocumentFilePath(documentId, userId);

      if (!filePath) {
        return res.status(404).json({ status: "fail", message: "File tidak ditemukan." });
      }

      const signedUrl = await fileStorage.getSignedUrl(filePath, 60);
      if (!signedUrl) {
        throw new Error("Gagal generate URL dari Storage Service.");
      }

      return res.status(200).json({
        success: true,
        url: signedUrl,
        mode: isDownload ? "download" : "view",
      });
    }),

    /**
     * @description Mendapatkan Signed URL untuk mengunduh versi lama dokumen.
     * * @route   GET /api/documents/:documentId/versions/:versionId/file
     * @param {import("express").Request} req - Params: documentId, versionId.
     * @param {import("express").Response} res - Response object.
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
     * @description Menganalisis konten dokumen menggunakan AI (Ringkasan/Insight).
     * * **Proses Kode:**
     * 1. Mendapatkan path file dokumen.
     * 2. Mengunduh file sebagai Buffer.
     * 3. Mengirim Buffer ke `aiService.analyzeDocumentContent` (misal: menggunakan LLM/OpenAI).
     * 4. Mengembalikan hasil analisis (teks ringkasan, sentimen, dll) ke frontend.
     * * @route   POST /api/documents/:documentId/analyze
     * @param {import("express").Request} req - Params: documentId.
     * @param {import("express").Response} res - Response object.
     */
    /**
     * @description Menganalisis konten dokumen menggunakan AI (Ringkasan/Insight).
     * [PERBAIKAN] Mengirim URL File ke Python, bukan Buffer.
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
      const isUrlValid = fileUrl && typeof fileUrl === 'string' && fileUrl.startsWith("http");

      let sourceData;
      let mode;

      if (isUrlValid) {
        if (process.env.NODE_ENV === 'production') {
          const maskedUrl = fileUrl.split('?')[0] + '?token=HIDDEN';
        } else {

        }

        mode = 'url';
        sourceData = fileUrl;
      }

      const analysisResult = await aiService.analyzeDocumentContent(
          sourceData,
          mode,
          documentData.type
      );

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
