// src/routes/documentRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { uploadDocument } from "../middleware/uploadMiddleware.js";

/**
 * @description Factory function yang membuat dan mengonfigurasi router Express untuk endpoint dokumen.
 * @param {object} documentController - Instance dari documentController yang berisi semua handler.
 * @returns {express.Router} Router Express yang sudah dikonfigurasi
 */
export default (documentController) => {
  const router = express.Router();

  /**
   * @route   POST /api/documents
   * @desc    Membuat dokumen baru dengan mengunggah file.
   * @access  Private
   */
  router.post("/", authMiddleware, uploadDocument.single("documentFile"), documentController.createDocument);

  /**
   * @route   GET /api/documents
   * @desc    Mengambil daftar semua dokumen milik pengguna.
   * @access  Private
   */
  router.get("/", authMiddleware, documentController.getAllDocuments);

  /**
   * @route   GET /api/documents/:id
   * @desc    Mengambil detail satu dokumen spesifik berdasarkan ID.
   * @access  Private
   */
  router.get("/:id", authMiddleware, documentController.getDocumentById);

  /**
   * @route   PUT /api/documents/:id
   * @desc    Memperbarui metadata dokumen (misalnya, judul). Tidak untuk upload file.
   * @access  Private
   */
  router.put("/:id", authMiddleware, documentController.updateDocument);

  /**
   * @route   DELETE /api/documents/:id
   * @desc    Menghapus dokumen dan semua versinya.
   * @access  Private
   */
  router.delete("/:id", authMiddleware, documentController.deleteDocument);

  // --- Document Version Routes ---

  /**
   * @route   GET /api/documents/:documentId/versions
   * @desc    Mengambil semua riwayat versi dari sebuah dokumen.
   * @access  Private
   */
  router.get("/:documentId/versions", authMiddleware, documentController.getDocumentHistory);

  /**
   * @route   POST /api/documents/:documentId/versions/:versionId/use
   * @desc    Menjadikan versi lama sebagai versi aktif (current version).
   * @access  Private
   */
  router.put("/:documentId/versions/:versionId/use", authMiddleware, documentController.useOldVersion);

  /**
   * @route   GET /api/documents/:documentId/file
   * @desc    Menghasilkan signed URL untuk mengakses file dokumen private.
   * @access  Private
   */
  router.get("/:documentId/file", authMiddleware, documentController.getDocumentFile);

  /**
   * @route   DELETE /api/documents/:documentId/versions/:versionId
   * @desc    Menghapus satu versi spesifik dari riwayat dokumen.
   * @access  Private
   */
  router.delete("/:documentId/versions/:versionId", authMiddleware, documentController.deleteVersion);

  /**
   * @route   GET /api/documents/:documentId/versions/:versionId/file
   * @desc    Menghasilkan signed URL untuk file dari versi SPESIFIK.
   * @access  Private
   */
  router.get("/:documentId/versions/:versionId/file", authMiddleware, documentController.getVersionFile);

  /**
   * @route POST /api/documents/:documentId/auto-tag
   * @desc  Mendeteksi posisi tanda tangan otomatis menggunakan AI Service.
   * @acces Private
   */
  router.post("/:documentId/auto-tag", authMiddleware, documentController.autoTagDocument);

  /**
   * @route   POST /api/documents/:documentId/analyze
   * @desc    Menganalisis isi dokumen (Ringkasan, Risiko, Pihak).
   * @access  Private
   */
  router.post("/:documentId/analyze", authMiddleware, documentController.analyzeDocument);

  return router;
};
