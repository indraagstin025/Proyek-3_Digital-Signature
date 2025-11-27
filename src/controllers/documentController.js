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
      const documents = await documentService.getAllDocuments(userId);

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

      const signedUrl = await documentService.getDocumentFileUrl(documentId, userId, isDownload);

      return res.status(200).json({
        success: true,
        url: signedUrl,
        expiresIn: 60,
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
     * @description Menggunakan AI untuk mendeteksi posisi tanda tangan dan membuat placeholder otomatis.
     * * **Proses Kode:**
     * 1. Mengambil data dokumen dan jalur file (file path) dari service.
     * 2. Mengunduh file PDF asli menjadi Buffer menggunakan `fileStorage`.
     * 3. Mengirim Buffer ke `aiService.detectSignatureLocations` untuk analisis visual/teks.
     * 4. Jika lokasi ditemukan, memuat PDF menggunakan library `pdf-lib` untuk mendapatkan ukuran halaman.
     * 5. Melakukan loop pada setiap lokasi yang ditemukan:
     * - Mengonversi koordinat absolut (pixel) menjadi persentase (%) agar responsif.
     * - Menyimpan posisi tersebut sebagai `placeholder` signature baru di database via `signatureRepository`.
     * 6. Mengembalikan daftar signature placeholder yang berhasil dibuat.
     * * @route   POST /api/documents/:documentId/auto-tag
     * @param {import("express").Request} req - Params: documentId.
     * @param {import("express").Response} res - Response object.
     */
    autoTagDocument: asyncHandler(async (req, res, next) => {
      const { documentId } = req.params;
      const userId = req.user?.id;

      
      const documentData = await documentService.getDocumentById(documentId, userId);
      if (!documentData) {
        return res.status(404).json({ status: "fail", message: "Dokumen tidak ditemukan" });
      }

      
      const filePath = await documentService.getDocumentFilePath(documentId, userId);
      const pdfBuffer = await fileStorage.downloadFileAsBuffer(filePath);

      console.log(`AI: Menganalisis dokumen ${documentId}...`);

      
      const aiLocations = await aiService.detectSignatureLocations(pdfBuffer);

      if (aiLocations.length === 0) {
        return res.status(200).json({
          status: "success",
          message: "AI selesai bekerja, namun tidak menemukan kata kunci tanda tangan.",
          data: [],
        });
      }

      
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const savedSignatures = [];

      for (const loc of aiLocations) {
        const pageIndex = loc.pageNumber - 1;
        if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;

        const page = pdfDoc.getPage(pageIndex);
        const { width: pageWidth, height: pageHeight } = page.getSize();

        
        const positionX_Percent = loc.x / pageWidth;
        const positionY_Percent = loc.y / pageHeight;
        const width_Percent = loc.width / pageWidth;
        const height_Percent = loc.height / pageHeight;

        
        const newSig = await signatureRepository.createSignature({
          documentVersionId: documentData.currentVersion.id,
          userId: userId,
          pageNumber: loc.pageNumber,
          positionX: positionX_Percent,
          positionY: positionY_Percent,
          width: width_Percent,
          height: height_Percent,
          signatureImageUrl: null,
          type: "placeholder", 
        });

        savedSignatures.push(newSig);
      }

      console.log(`✅ AI: Berhasil menempatkan ${savedSignatures.length} tanda tangan.`);

      return res.status(200).json({
        status: "success",
        message: `Berhasil menempatkan ${savedSignatures.length} tanda tangan otomatis!`,
        data: savedSignatures,
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
    analyzeDocument: asyncHandler(async (req, res, next) => {
      const { documentId } = req.params;
      const userId = req.user?.id;

      const filePath = await documentService.getDocumentFilePath(documentId, userId);
      const pdfBuffer = await fileStorage.downloadFileAsBuffer(filePath);

      console.log(`🤖 AI: Menganalisis konten dokumen ${documentId}...`);

      const analysisResult = await aiService.analyzeDocumentContent(pdfBuffer);

      if (!analysisResult || analysisResult.error) {
        return res.status(500).json({
          status: "fail",
          message: "Gagal menganalisis dokumen.",
        });
      }

      return res.status(200).json({
        status: "success",
        data: analysisResult,
      });
    }),
  };
};
