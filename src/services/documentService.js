import crypto from "crypto";
import DocumentError from "../errors/DocumentError.js";
import CommonError from "../errors/CommonError.js";
import { isPdfEncrypted } from "../utils/pdfValidator.js";

export class DocumentService {
  /**
   * DocumentService Constructor
   * @param {object} documentRepository - Repository untuk entity Dokumen
   * @param {object} versionRepository - Repository untuk versi dokumen
   * @param {object} signatureRepository - Repository tanda tangan dokumen
   * @param {object} fileStorage - Service penyimpanan file (S3/local/Cloud)
   * @param {object} pdfService - Service utility PDF
   * @param {object} groupMemberRepository - Repository yang mengecek akses dokumen grup
   * @param {object} aiService
   * @throws {Error} Jika ada dependency yang tidak diberikan
   */
  constructor(documentRepository, versionRepository, signatureRepository, fileStorage, pdfService, groupMemberRepository, groupDocumentSignerRepository, aiService, groupSignatureRepository) {
    if (!documentRepository || !versionRepository || !signatureRepository || !fileStorage || !pdfService || !groupMemberRepository || !groupDocumentSignerRepository || !aiService || !groupSignatureRepository) {
      throw new Error("Semua repository dan service harus disediakan.");
    }

    this.documentRepository = documentRepository;
    this.versionRepository = versionRepository;
    this.signatureRepository = signatureRepository;
    this.fileStorage = fileStorage;
    this.pdfService = pdfService;
    this.groupMemberRepository = groupMemberRepository;
    this.groupDocumentSignerRepository = groupDocumentSignerRepository;
    this.aiService = aiService;
    this.groupSignatureRepository = groupSignatureRepository;
  }

  /**
   * Validasi format file dan cek enkripsi PDF.
   * Alur proses:
   * 1. Mengecek apakah file merupakan PDF.
   * 2. Jika PDF, lakukan scanning untuk mendeteksi apakah terenkripsi.
   * 3. Jika terenkripsi → throw DocumentError.
   * 4. Error lain akan dilempar sebagai BadRequest.
   *
   * @param {object} file - File yang diunggah (mimetype + buffer)
   * @returns {Promise<void>}
   */
  async _validateFile(file) {
    if (file.mimetype !== "application/pdf") return;

    try {
      const isEncrypted = await isPdfEncrypted(file.buffer);
      if (isEncrypted) throw DocumentError.EncryptedFileNotAllowed();
    } catch (error) {
      if (error instanceof DocumentError) throw error;
      throw CommonError.BadRequest(error.message);
    }
  }

  /**
   * Membuat dokumen baru sekaligus menyimpan versi pertama.
   * Alur kerja:
   * 1. Validasi file wajib ada.
   * 2. Validasi PDF & cek enkripsi.
   * 3. Generate hash untuk mendeteksi duplikasi.
   * 4. Jika hash sudah pernah diunggah user → upload ditolak.
   * 5. Upload file → simpan database → kembalikan data dokumen.
   *
   * @param {string} userId
   * @param {object} file
   * @param {string} title
   * @throws {CommonError} Jika file duplikat
   * @returns {Promise<object>}
   */
  async createDocument(userId, file, title) {
    if (!file) throw new Error("File dokumen wajib diunggah.");

    await this._validateFile(file);
    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const existingVersion = await this.versionRepository.findByUserAndHash(userId, hash);

    if (existingVersion) {
      throw CommonError.BadRequest(`File ini sudah pernah diunggah pada dokumen: "${existingVersion.document.title}". Tidak diizinkan mengupload file duplikat.`);
    }

    let detectedType = "General";

    try {
      const aiAnalysis = await this.aiService.analyzeDocumentContent(file.buffer);

      if (aiAnalysis && aiAnalysis.document_type) {
        detectedType = aiAnalysis.document_type;
        console.log(`✅ Tipe Dokumen Tersimpan: ${detectedType}`);
      }
    } catch (error) {
      console.warn("⚠️ Gagal klasifikasi otomatis, lanjut dengan General.");
    }

    const filePath = await this.fileStorage.uploadDocument(file, userId);
    return this.documentRepository.createWithFirstVersion(userId, title, filePath, hash, detectedType);
  }

  /**
   * Mengambil semua dokumen milik user.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  async getAllDocuments(userId, search = "") {
    if (!userId) throw new Error("ID user tidak ditemukan.");

    return this.documentRepository.findAllByUserId(userId, search);
  }

  /**
   * Mengambil dokumen berdasarkan ID dengan pengecekan hak akses.
   * Alur kerja:
   * 1. Cari dokumen berdasarkan ID.
   * 2. Jika tidak ditemukan → error NotFound.
   * 3. Jika pemilik = user → akses diberikan.
   * 4. Jika dokumen milik grup → cek apakah user anggota → jika iya akses diberikan.
   * 5. Jika bukan pemilik/anggota grup → Unauthorized.
   * @param {string} documentId
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getDocumentById(documentId, userId) {
    const document = await this.documentRepository.findById(documentId, userId);

    if (!document) throw DocumentError.NotFound(documentId);

    return document;
  }

  /**
   * Update data dokumen (saat ini hanya judul).
   * @param {string} documentId
   * @param {string} userId
   * @param {object} updates
   * @returns {Promise<object>}
   */
  async updateDocument(documentId, userId, updates) {
    const document = await this.getDocumentById(documentId, userId);
    const dataToUpdate = {};

    if (updates?.title) dataToUpdate.title = updates.title;
    if (!Object.keys(dataToUpdate).length) return document;

    return this.documentRepository.update(documentId, dataToUpdate);
  }

  /**
   * Menghapus dokumen beserta semua versi di dalamnya.
   * [FIXED] Menggunakan pengecekan manual agar tidak terblokir oleh getDocumentById.
   */
  async deleteDocument(documentId, userId) {
    let document;
    try {
      document = await this.documentRepository.findByIdSimple(documentId);
    } catch (e) {
      throw DocumentError.NotFound("Dokumen tidak ditemukan.");
    }

    if (!document) {
      throw DocumentError.NotFound("Dokumen tidak ditemukan.");
    }

    let canDelete = false;

    if (document.userId === userId) {
      canDelete = true;
    }

    if (!canDelete && document.groupId) {
      const member = await this.groupMemberRepository.findByGroupAndUser(document.groupId, userId);
      if (member && member.role === "admin_group") {
        canDelete = true;
      }
    }

    if (!canDelete) {
      throw DocumentError.Forbidden("Anda tidak memiliki izin untuk menghapus dokumen ini. Hanya pemilik dokumen atau admin grup aktif yang dapat menghapusnya.");
    }

    const allVersions = await this.versionRepository.findAllByDocumentId(document.id);
    for (const version of allVersions) {
      if (version.url) {
        try {
          await this.fileStorage.deleteFile(version.url);
        } catch (err) {
          console.warn(`[Warning] Gagal menghapus file fisik ${version.url}:`, err.message);
        }
      }
    }

    await this.documentRepository.deleteById(document.id);

    return { message: "Dokumen dan semua riwayatnya berhasil dihapus." };
  }

  /**
   * Mendapatkan riwayat seluruh versi dokumen.
   * @param {string} documentId
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  async getDocumentHistory(documentId, userId) {
    await this.getDocumentById(documentId, userId);
    return this.versionRepository.findAllByDocumentId(documentId);
  }

  /**
   * Mengembalikan dokumen ke versi tertentu.
   * Alur Kerja:
   * 1. Cek akses dokumen.
   * 2. Validasi versi apakah milik dokumen yang sama.
   * 3. Periksa apakah versi sudah memiliki tanda tangan.
   * 4. Jika sudah ditandatangani → status completed, signedFileUrl ikut dipasang.
   * 5. Jika belum → status draft.
   * @returns {Promise<object>}
   */
  async useOldVersion(documentId, versionId, userId) {
    // 1. Validasi Dokumen & Versi
    const document = await this.documentRepository.findById(documentId, userId);
    if (!document) throw DocumentError.NotFound("Dokumen tidak ditemukan.");

    const version = await this.versionRepository.findById(versionId);
    if (!version || version.documentId !== documentId) {
      throw DocumentError.InvalidVersion(versionId, documentId);
    }

    // 2. Cek apakah ini Versi Pertama (V1)?
    const allVersions = await this.versionRepository.findAllByDocumentId(documentId);
    // Sort asc (terlama ke terbaru)
    allVersions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const isFirstVersion = allVersions.length > 0 && allVersions[0].id === versionId;

    let newStatus = "pending";
    let newSignedFileUrl = null;

    if (isFirstVersion) {
      console.log(`🔄 [ROLLBACK] Kembali ke Versi Awal (V1). Cleaning Signatures...`);
      newStatus = "pending"; // Dokumen jadi mentah lagi

      // A. Hapus Semua Signature Personal di Versi ini
      // Parameter userId = null artinya "Hapus SEMUA, bukan cuma punya user ini"
      if (this.signatureRepository) {
        await this.signatureRepository.deleteBySignerAndVersion(null, versionId);
      }

      // B. Hapus Semua Signature Group di Versi ini (PENTING: Pakai Repo Group)
      if (this.groupSignatureRepository) {
        await this.groupSignatureRepository.deleteBySignerAndVersion(null, versionId);
      }

      // C. Reset Status Checklist Signer (Jika Dokumen Group)
      // Semua anggota statusnya jadi 'PENDING' lagi agar bisa ttd ulang
      if (document.groupId && this.groupDocumentSignerRepository) {
        if (typeof this.groupDocumentSignerRepository.resetSigners === "function") {
          await this.groupDocumentSignerRepository.resetSigners(documentId);
        }
      }

    } else {
      // Logic jika rollback ke versi yang sudah jadi (V2, V3, dst)
      // Biasanya versi selain V1 adalah hasil burn PDF yang sudah ada isinya

      const isBurnedFinal = !!version.signedFileHash || !!version.url;

      if (isBurnedFinal) {
        console.log(`🔒 [ROLLBACK] Kembali ke Versi Signed. Mengunci dokumen...`);
        newStatus = "completed";
        newSignedFileUrl = version.url;

        // Opsional: Jika dokumen grup, tandai semua signer 'SIGNED' (karena ini versi jadi)
        // Tapi hati-hati, biasanya rollback ke completed jarang dilakukan kecuali untuk view history.
      } else {
        // Jika V2 tapi belum diburn (kasus jarang), tetap pending
        newStatus = "pending";
      }
    }

    // 3. Update Dokumen Utama
    return this.documentRepository.update(documentId, {
      currentVersionId: versionId,
      status: newStatus,
      signedFileUrl: newSignedFileUrl,
    });
  }

  /**
   * Menghapus versi dokumen tertentu.
   * Tidak boleh menghapus versi yang sedang aktif.
   *
   * @returns {Promise<{message:string}>}
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

  /**
   * Mendapatkan Signed URL untuk versi aktif (bisa view/download).
   * @param {string} documentId
   * @param {string} userId
   * @param {boolean} isDownload
   * @returns {Promise<string>} Signed URL file
   */
  async getDocumentFileUrl(documentId, userId, isDownload = false) {
    const document = await this.getDocumentById(documentId, userId);

    if (!document.currentVersionId || !document.currentVersion) {
      throw new Error("Dokumen tidak memiliki versi aktif.");
    }

    const currentVersion = document.currentVersion;
    let customFilename = null;

    if (isDownload) {
      const sanitizedTitle = document.title.replace(/\.pdf$/i, "").replace(/[\s/\\?%*:|"<>]/g, "_");
      customFilename = `${sanitizedTitle}.pdf`;
    }

    return this.fileStorage.getSignedUrl(currentVersion.url, 60, customFilename);
  }

  /**
   * Mendapatkan Signed URL berdasarkan nomor versi tertentu.
   * Dapat digunakan untuk view atau download.
   *
   * @returns {Promise<string>} URL file versi dokumen
   */
  async getVersionFileUrl(documentId, versionId, userId, isDownload = false) {
    const document = await this.getDocumentById(documentId, userId);
    const version = await this.versionRepository.findById(versionId);

    if (!version || version.documentId !== documentId) {
      throw DocumentError.InvalidVersion(versionId, documentId);
    }

    let customFilename = null;

    if (isDownload) {
      let versionNumber = version.versionNumber;

      if (!versionNumber || typeof versionNumber !== "number") {
        try {
          const allVersions = await this.versionRepository.findAllByDocumentId(documentId);
          allVersions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          const idx = allVersions.findIndex((v) => v.id === versionId);
          versionNumber = idx >= 0 ? idx + 1 : 1;
        } catch {
          versionNumber = version.versionNumber || 1;
        }
      }

      const sanitizedTitle = document.title.replace(/\.pdf$/i, "").replace(/[\s/\\?%*:|"<>]/g, "_");
      customFilename = `signed-${sanitizedTitle}-v${versionNumber}.pdf`;
    }

    return this.fileStorage.getSignedUrl(version.url, 60, customFilename);
  }

  /**
   * Mengambil internal file path dari versi aktif (tanpa Signed URL).
   * Digunakan oleh sistem internal seperti AI Processing.
   *
   * @returns {Promise<string>}
   */
  async getDocumentFilePath(documentId, userId) {
    const document = await this.getDocumentById(documentId, userId);

    if (!document.currentVersionId) {
      throw new Error("Dokumen ini tidak memiliki versi aktif.");
    }

    const version = await this.versionRepository.findById(document.currentVersionId);
    if (!version) throw new Error("Data versi dokumen tidak ditemukan.");

    return version.url;
  }
}
