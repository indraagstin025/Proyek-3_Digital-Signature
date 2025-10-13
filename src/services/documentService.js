import crypto from "crypto";
import DocumentError from "../errors/DocumentError.js";

/**
 * @class DocumentService
 * @description Service untuk mengelola dokumen, termasuk membuat, memperbarui, menghapus,
 * mengelola versi dokumen, serta integrasi dengan tanda tangan digital.
 */
export class DocumentService {
  /**
   * @constructor
   * @param {import('../repositories/documentRepository.js').DocumentRepository} documentRepository - Repository untuk operasi dokumen utama.
   * @param {import('../repositories/versionRepository.js').VersionRepository} versionRepository - Repository untuk mengelola versi dokumen.
   * @param {import('../repositories/signatureRepository.js').SignatureRepository} signatureRepository - Repository untuk tanda tangan dokumen.
   * @param {object} fileStorage - Service untuk penyimpanan file (upload & delete).
   * @param {object} pdfService - Service tambahan untuk manipulasi PDF.
   * @throws {Error} Jika salah satu dependency tidak diberikan.
   */
  constructor(documentRepository, versionRepository, signatureRepository, fileStorage, pdfService) {
    if (!documentRepository || !versionRepository || !signatureRepository || !fileStorage || !pdfService) {
      throw new Error("Semua repository dan service harus disediakan.");
    }
    this.documentRepository = documentRepository;
    this.versionRepository = versionRepository;
    this.signatureRepository = signatureRepository;
    this.fileStorage = fileStorage;
    this.pdfService = pdfService;
  }

  /**
   * @function createDocument
   * @description Membuat dokumen baru beserta versi pertamanya.
   * @param {string} userId - ID pengguna yang mengunggah dokumen.
   * @param {object} file - File dokumen yang diunggah (buffer, mimetype, dll).
   * @param {string} title - Judul dokumen.
   * @throws {DocumentError.AlreadyExists} Jika dokumen dengan hash file yang sama sudah pernah diunggah.
   * @returns {Promise<object>} Dokumen baru yang berhasil dibuat.
   */
  async createDocument(userId, file, title) {
    if (!file) {
      throw new Error("File dokumen wajib diunggah.");
    }

    const fileBuffer = file.buffer;
    const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    const existingVersion = await this.versionRepository.findByUserAndHash(userId, hash);
    if (existingVersion) {
      throw DocumentError.AlreadyExists();
    }

    const filePath = await this.fileStorage.uploadDocument(file, userId);
    return this.documentRepository.createWithFirstVersion(userId, title, filePath, hash);
  }

  /**
   * @function getAllDocuments
   * @description Mengambil semua dokumen milik user.
   * @param {string} userId - ID pengguna.
   * @throws {Error} Jika userId tidak diberikan.
   * @returns {Promise<object[]>} Daftar dokumen milik user.
   */
  async getAllDocuments(userId) {
    if (!userId) throw new Error("ID user tidak ditemukan.");
    return this.documentRepository.findAllByUserId(userId);
  }

  /**
   * @function getDocumentById
   * @description Mengambil dokumen berdasarkan ID (dengan validasi kepemilikan).
   * @param {string} documentId - ID dokumen.
   * @param {string} userId - ID pengguna pemilik dokumen.
   * @throws {DocumentError.NotFound} Jika dokumen tidak ditemukan.
   * @throws {DocumentError.UnauthorizedAccess} Jika dokumen bukan milik user.
   * @returns {Promise<object>} Dokumen yang ditemukan.
   */
  async getDocumentById(documentId, userId) {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw DocumentError.NotFound(documentId);
    }
    if (document.userId !== userId) {
      throw DocumentError.UnauthorizedAccess();
    }
    return document;
  }

  /**
   * @function updateDocument
   * @description Memperbarui data dokumen (misalnya judul).
   * @param {string} documentId - ID dokumen.
   * @param {string} userId - ID pengguna.
   * @param {object} updates - Data update (contoh: { title }).
   * @returns {Promise<object>} Dokumen yang sudah diperbarui.
   */
  async updateDocument(documentId, userId, updates) {
    await this.getDocumentById(documentId, userId);

    const dataToUpdate = {};
    if (updates && updates.title) {
      dataToUpdate.title = updates.title;
    }
    if (Object.keys(dataToUpdate).length === 0) {
      return this.getDocumentById(documentId, userId);
    }
    return this.documentRepository.update(documentId, dataToUpdate);
  }

  /**
   * @function deleteDocument
   * @description Menghapus dokumen beserta semua versinya dari database dan storage.
   * @param {string} documentId - ID dokumen.
   * @param {string} userId - ID pengguna.
   * @returns {Promise<{message: string}>} Pesan konfirmasi penghapusan.
   */
  async deleteDocument(documentId, userId) {
    const document = await this.getDocumentById(documentId, userId);

    const allVersions = await this.versionRepository.findAllByDocumentId(document.id);
    for (const version of allVersions) {
      await this.fileStorage.deleteFile(version.url);
    }
    await this.documentRepository.deleteById(document.id);
    return { message: "Dokumen dan semua riwayatnya berhasil dihapus." };
  }

  /**
   * @function getDocumentHistory
   * @description Mengambil semua riwayat versi dari sebuah dokumen.
   * @param {string} documentId - ID dokumen.
   * @param {string} userId - ID pengguna.
   * @returns {Promise<object[]>} Daftar versi dokumen.
   */
  async getDocumentHistory(documentId, userId) {
    await this.getDocumentById(documentId, userId);
    return this.versionRepository.findAllByDocumentId(documentId);
  }

  /**
   * @function useOldVersion
   * @description Menggunakan versi lama dari dokumen sebagai versi aktif.
   * @param {string} documentId - ID dokumen.
   * @param {string} versionId - ID versi lama yang akan digunakan.
   * @param {string} userId - ID pengguna.
   * @throws {DocumentError.InvalidVersion} Jika versi tidak valid untuk dokumen tersebut.
   * @returns {Promise<object>} Dokumen dengan versi yang diperbarui.
   */
  async useOldVersion(documentId, versionId, userId) {
    await this.getDocumentById(documentId, userId);

    const version = await this.versionRepository.findById(versionId, {
      include: { signaturesPersonal: true },
    });

    if (!version || version.documentId !== documentId) {
      throw DocumentError.InvalidVersion(versionId, documentId);
    }

    const isTargetVersionSigned = version.signaturesPersonal && version.signaturesPersonal.length > 0;
    const newStatus = isTargetVersionSigned ? "completed" : "draft";

    return this.documentRepository.update(documentId, {
      currentVersionId: versionId,
      status: newStatus,
      signedFileUrl: isTargetVersionSigned ? version.url : null,
    });
  }

  /**
   * @function deleteVersion
   * @description Menghapus salah satu versi dokumen (selain versi aktif).
   * @param {string} documentId - ID dokumen.
   * @param {string} versionId - ID versi dokumen yang akan dihapus.
   * @param {string} userId - ID pengguna.
   * @throws {DocumentError.DeleteActiveVersionFailed} Jika mencoba menghapus versi yang sedang aktif.
   * @throws {DocumentError.InvalidVersion} Jika versi tidak sesuai dengan dokumen.
   * @returns {Promise<{message: string}>} Pesan konfirmasi penghapusan versi.
   */
  async deleteVersion(documentId, versionId, userId) {
    const document = await this.getDocumentById(documentId, userId);

    if (document.currentVersion.id === versionId) {
      throw DocumentError.DeleteActiveVersionFailed();
    }

    const versionToDelete = await this.versionRepository.findById(versionId);
    if (!versionToDelete || versionToDelete.documentId !== documentId) {
      throw DocumentError.InvalidVersion(versionId, documentId);
    }

    await this.fileStorage.deleteFile(versionToDelete.url);
    await this.versionRepository.deleteById(versionId);
    return { message: "Versi dokumen berhasil dihapus." };
  }
// Di dalam file: src/services/documentService.js (Backend)
// Tambahkan fungsi ini di dalam class DocumentService Anda

    /**
     * @function getVersionFileUrl
     * @description Mendapatkan signed URL untuk sebuah versi dokumen spesifik setelah validasi.
     * @param {string} documentId - ID dokumen.
     * @param {string} versionId - ID versi.
     * @param {string} userId - ID pengguna untuk validasi kepemilikan.
     * @returns {Promise<string>} Signed URL yang valid untuk diakses.
     * @throws {DocumentError} Jika dokumen/versi tidak ditemukan atau akses ditolak.
     */
    // Di dalam file: src/services/documentService.js

    async getVersionFileUrl(documentId, versionId, userId) {
        // --- DEBUGGING LOG #3 ---
        console.log("✅ SERVICE: Masuk ke getVersionFileUrl.");

        console.log("    - Memvalidasi kepemilikan dokumen...");
        await this.getDocumentById(documentId, userId);
        console.log("    - Validasi kepemilikan berhasil.");

        console.log("    - Mencari versi berdasarkan versionId...");
        const version = await this.versionRepository.findById(versionId);
        console.log("    - Hasil pencarian versi:", version ? `Ditemukan versi dengan URL: ${version.url}` : "Versi TIDAK ditemukan.");

        if (!version || version.documentId !== documentId) {
            console.error("❌ SERVICE: Validasi gagal! Versi tidak ditemukan atau tidak cocok dengan dokumen.");
            throw DocumentError.InvalidVersion(versionId, documentId);
        }

        console.log("    - Memanggil fileStorage.getSignedUrl dengan path:", version.url);
        return this.fileStorage.getSignedUrl(version.url, 60);
    }
}
