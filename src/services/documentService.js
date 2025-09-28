import crypto from "crypto";

/**
 * @description Kelas DocumentService dengan fungsionalitas riwayat versi dan tanda tangan.
 */
export class DocumentService {
  /**
   * @param {object} documentRepository
   * @param {object} versionRepository
   * @param {object} signatureRepository
   * @param {object} fileStorage
   * @param {object} pdfService
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
   * @description Membuat dokumen baru beserta versi pertamanya.
   */
  async createDocument(userId, file, title) {
    if (!file) throw new Error("File dokumen wajib diunggah.");
    // if (!title || title.trim() === "") throw new Error("Judul dokumen wajib diisi.");

    const fileBuffer = file.buffer;
    const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    const existingVersion = await this.versionRepository.findByUserAndHash(userId, hash);
    if (existingVersion) {
      throw new Error("Dokumen dengan konten yang sama sudah pernah diunggah.");
    }

    const publicUrl = await this.fileStorage.uploadDocument(file, userId);

    return this.documentRepository.createWithFirstVersion(userId, title, publicUrl, hash);
  }

  /**
   * @description Mengambil semua dokumen milik user, beserta detail versi terkininya.
   */
  async getAllDocuments(userId) {
    if (!userId) throw new Error("ID user tidak ditemukan.");
    return this.documentRepository.findAllByUserId(userId);
  }

  /**
   * @description Mengambil detail dokumen berdasarkan ID, beserta versi terkininya.
   */
  async getDocumentById(documentId, userId) {
    const document = await this.documentRepository.findById(documentId, userId);
    if (!document) {
      throw new Error("Dokumen tidak ditemukan atau Anda tidak memiliki akses.");
    }
    return document;
  }


    /**
     * @description Memperbarui metadata dokumen (misalnya, judul).
     * Fungsi ini tidak lagi menangani unggahan file baru.
     * @param {string} documentId - ID dokumen yang akan diperbarui.
     * @param {string} userId - ID pengguna untuk verifikasi kepemilikan.
     * @param {object} updates - Objek berisi data yang akan diperbarui, misal: { title: "Judul Baru" }.
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
   * @description Menghapus dokumen beserta SEMUA versinya dan filenya di storage.
   */
  async deleteDocument(documentId, userId) {
    await this.getDocumentById(documentId, userId);

    const allVersions = await this.versionRepository.findAllByDocumentId(documentId);

    for (const version of allVersions) {
      await this.fileStorage.deleteFile(version.url);
    }

    await this.documentRepository.deleteById(documentId);
    return { message: "Dokumen dan semua riwayatnya berhasil dihapus." };
  }

  /**
   * @description Mengambil semua riwayat versi dari satu dokumen.
   */
  async getDocumentHistory(documentId, userId) {
    await this.getDocumentById(documentId, userId);
    return this.versionRepository.findAllByDocumentId(documentId);
  }

  /**
   * @description Mengganti versi aktif ke versi lama dari riwayat.
   */
  async useOldVersion(documentId, versionId, userId) {
    await this.getDocumentById(documentId, userId);

    const version = await this.versionRepository.findById(versionId, {
      include: { signaturesPersonal: true },
    });

    if (!version || version.documentId !== documentId) {
      throw new Error("Versi tidak valid untuk dokumen ini.");
    }

    const isTargetVersionSigned = version.signaturesPersonal && version.signaturesPersonal.length > 0;
    const newStatus = isTargetVersionSigned ? "completed" : "draft";

    console.log(`Mengganti ke Versi ID: ${versionId}. Versi ini ditandatangani: ${isTargetVersionSigned}. Status baru: ${newStatus}`);

    return this.documentRepository.update(documentId, {
      currentVersionId: versionId,
      status: newStatus,
      signedFileUrl: isTargetVersionSigned ? version.url : null,
    });
  }

  /**
   * @description Menghapus satu versi spesifik dari riwayat.
   */
  async deleteVersion(documentId, versionId, userId) {
    const document = await this.getDocumentById(documentId, userId);

    if (document.currentVersion.id === versionId) {
      throw new Error("Tidak dapat menghapus versi yang sedang aktif. Ganti ke versi lain terlebih dahulu.");
    }

    const versionToDelete = await this.versionRepository.findById(versionId);
    if (!versionToDelete || versionToDelete.documentId !== documentId) {
      throw new Error("Versi tidak ditemukan dalam riwayat dokumen ini.");
    }

    await this.fileStorage.deleteFile(versionToDelete.url);
    await this.versionRepository.deleteById(versionId);

    return { message: "Versi dokumen berhasil dihapus." };
  }
}
