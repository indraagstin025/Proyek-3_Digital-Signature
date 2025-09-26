/**
 * @file Controller untuk menangani semua request yang berhubungan dengan dokumen.
 */

/**
 * @description Factory function yang membuat dan mengembalikan objek controller.
 * @param {import('../services/documentService.js').DocumentService} documentService - Instance dari DocumentService.
 * @returns {object} - Objek yang berisi semua handler controller.
 */
export const createDocumentController = (documentService) => {
  return {
    createDocument: async (req, res) => {
      try {
        const { title } = req.body;
        const file = req.file;
        const userId = req.user?.id;

        if (!title || title.trim() === "") {
          return res.status(400).json({ status: "error", message: "Judul dokumen wajib diisi" });
        }
        if (!file) {
          return res.status(400).json({ status: "error", message: "File dokumen wajib diunggah" });
        }

        const document = await documentService.createDocument(userId, file, title);
        return res.status(201).json({ status: "success", message: "Dokumen berhasil diunggah.", data: document });
      } catch (error) {
        console.error("Error in createDocument Controller:", error);
        return res.status(400).json({ status: "error", message: error.message });
      }
    },

    getAllDocuments: async (req, res) => {
      try {
        const userId = req.user?.id;
        const documents = await documentService.getAllDocuments(userId);
        return res.status(200).json({ status: "success", data: documents });
      } catch (error) {
        console.error("Error in getAllDocuments Controller:", error);
        return res.status(500).json({ status: "error", message: "Gagal mengambil daftar dokumen." });
      }
    },

    getDocumentById: async (req, res) => {
      try {
        const { id: documentId } = req.params;
        const userId = req.user?.id;
        const document = await documentService.getDocumentById(documentId, userId);
        return res.status(200).json({ status: "success", message: "Dokumen berhasil diambil.", data: document });
      } catch (error) {
        return res.status(404).json({ status: "error", message: error.message });
      }
    },

    updateDocument: async (req, res) => {
      try {
        const { id: documentId } = req.params;
        const userId = req.user?.id;
        const updates = req.body;
        const newFile = req.file;

        const updatedDocument = await documentService.updateDocument(documentId, userId, updates, newFile);
        return res.status(200).json({ status: "success", message: "Dokumen berhasil diperbaharui.", data: updatedDocument });
      } catch (error) {
        console.error("Error in updateDocument Controller:", error);
        return res.status(400).json({ status: "error", message: error.message });
      }
    },

    deleteDocument: async (req, res) => {
      try {
        const { id: documentId } = req.params;
        const userId = req.user?.id;
        await documentService.deleteDocument(documentId, userId);
        return res.status(200).json({ status: "success", message: "Dokumen dan semua riwayatnya berhasil dihapus." });
      } catch (error) {
        return res.status(404).json({ status: "error", message: error.message });
      }
    },

    /**
     * Menangani request untuk mengambil riwayat versi dari sebuah dokumen.
     * @route GET /api/documents/:documentId/versions
     */
    getDocumentHistory: async (req, res) => {
      try {
        const { documentId } = req.params;
        const userId = req.user?.id;
        const history = await documentService.getDocumentHistory(documentId, userId);
        return res.status(200).json({ status: "success", data: history });
      } catch (error) {
        return res.status(404).json({ status: "error", message: error.message });
      }
    },

    /**
     * Menangani request untuk menjadikan versi lama sebagai versi aktif.
     * @route POST /api/documents/:documentId/versions/:versionId/use
     */
    useOldVersion: async (req, res) => {
      try {
        const { documentId, versionId } = req.params;
        const userId = req.user?.id;
        const updatedDocument = await documentService.useOldVersion(documentId, versionId, userId);
        return res.status(200).json({ status: "success", message: "Versi dokumen berhasil diganti.", data: updatedDocument });
      } catch (error) {
        return res.status(404).json({ status: "error", message: error.message });
      }
    },

    /**
     * Menangani request untuk menghapus satu versi spesifik dari riwayat.
     * @route DELETE /api/documents/:documentId/versions/:versionId
     */
    deleteVersion: async (req, res) => {
      try {
        const { documentId, versionId } = req.params;
        const userId = req.user?.id;
        await documentService.deleteVersion(documentId, versionId, userId);
        return res.status(200).json({ status: "success", message: "Versi dokumen berhasil dihapus." });
      } catch (error) {
        return res.status(400).json({ status: "error", message: error.message });
      }
    },

    uploadSignedDocument: async (req, res) => {
      return res.status(501).json({ status: "info", message: "Fitur ini belum diimplementasikan." });
    },
  };
};
