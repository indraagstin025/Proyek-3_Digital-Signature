import crypto from "crypto";
import DocumentError from "../errors/DocumentError.js";
import CommonError from "../errors/CommonError.js";
import { isPdfEncrypted } from "../utils/pdfValidator.js";
import userRepository from "../repository/interface/UserRepository.js";

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
   * @param {object} userService
   * @throws {Error} Jika ada dependency yang tidak diberikan
   */
  constructor(documentRepository, versionRepository, signatureRepository, fileStorage, pdfService, groupMemberRepository, groupDocumentSignerRepository, aiService, groupSignatureRepository, userService) {
    if (!documentRepository || !versionRepository || !signatureRepository || !fileStorage || !pdfService || !groupMemberRepository || !groupDocumentSignerRepository || !aiService || !groupSignatureRepository || !userService) {
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
    this.userService = userService;
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
  async createDocument(userId, file, title, manualType) {
    if (!file) throw new Error("File dokumen wajib diunggah.");
    await this._validateFile(file);
    const isPremium = await this.userService.isUserPremium(userId);
    const maxSize = isPremium ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

    if (file.size > maxSize) {
      const limitLabel = isPremium ? "50MB" : "10MB";
      throw CommonError.BadRequest(`Ukuran file melebihi batas paket Anda (${limitLabel}). ${!isPremium ? "Upgrade ke Premium untuk upload hingga 50MB." : ""}`);
    }

    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const existingVersion = await this.versionRepository.findByUserAndHash(userId, hash);

    if (existingVersion) {
      throw DocumentError.AlreadyExists();
    }

    // [NEW] Cek Duplikasi Judul (Personal Document)
    const existingTitleDoc = await this.documentRepository.findFirst({
      where: {
        userId: userId,
        title: title,
        groupId: null, // Pastikan hanya cek dokumen pribadi
      },
    });

    if (existingTitleDoc) {
      throw DocumentError.DuplicateTitle(title);
    }

    const finalType = manualType || "General";

    console.log(`📂 Uploading Document: "${title}" | Type: "${finalType}" | Premium: ${isPremium}`);
    const filePath = await this.fileStorage.uploadDocument(file, userId);
    // The hash calculation was moved here from above in the provided snippet.
    // Keeping the original hash calculation position for consistency with existing logic
    // unless the intent was to reorder it. Assuming the intent is to add group logic.
    // If the hash calculation was meant to be moved, please specify.

    // The provided snippet seems to be for a createGroupDocument method or a modified createDocument
    // that accepts groupId and signerUserIds. Since the instruction is to add deduplication logic
    // and the snippet includes group-specific checks, I will assume this logic is intended for
    // a new method or a modified existing method that handles group documents.
    // As the current createDocument does not accept groupId or signerUserIds,
    // I will add the provided logic as a new method `createGroupDocument`
    // and adjust its parameters and internal references accordingly.

    return this.documentRepository.createWithFirstVersion(userId, title, filePath, hash, finalType);
  }

  /**
   * Membuat dokumen baru untuk grup sekaligus menyimpan versi pertama.
   * Alur kerja:
   * 1. Validasi file wajib ada.
   * 2. Validasi PDF & cek enkripsi.
   * 3. Generate hash untuk mendeteksi duplikasi.
   * 4. Cek duplikasi file di dalam grup (same hash + same group).
   * 5. Cek duplikasi judul di dalam grup.
   * 6. Upload file → simpan database → kembalikan data dokumen.
   *
   * @param {string} userId - ID user yang mengunggah dokumen
   * @param {string} groupId - ID grup tempat dokumen diunggah
   * @param {object} file - File yang diunggah
   * @param {string} title - Judul dokumen
   * @param {string[]} signerUserIds - Array ID user yang akan menjadi penanda tangan
   * @throws {CommonError} Jika file atau judul duplikat
   * @returns {Promise<object>}
   */
  async createGroupDocument(userId, groupId, file, title, signerUserIds) {
    if (!file) throw new Error("File dokumen wajib diunggah.");
    await this._validateFile(file);
    const isPremium = await this.userService.isUserPremium(userId);
    const maxSize = isPremium ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

    if (file.size > maxSize) {
      const limitLabel = isPremium ? "50MB" : "10MB";
      throw CommonError.BadRequest(`Ukuran file melebihi batas paket Anda (${limitLabel}). ${!isPremium ? "Upgrade ke Premium untuk upload hingga 50MB." : ""}`);
    }

    const finalType = "Group"; // Group documents typically have a fixed type or derived from group context

    console.log(`📂 Uploading Document: "${title}" | Type: "${finalType}" | Premium: ${isPremium}`);
    const filePath = await this.fileStorage.uploadDocument(file, userId);
    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

    // [NEW] Cek Duplikasi File di dalam Grup (Same Hash + Same Group)
    // Menggunakan prisma instance dari repository jika tersedia
    // Assuming documentRepository has access to prisma or a method to query versions across documents in a group
    const existingFileInGroup = await this.versionRepository.findFirst({ // Changed to versionRepository as it holds hash
      where: {
        hash: hash,
        document: { groupId: groupId },
      },
      include: { document: true },
    });

    if (existingFileInGroup) {
      throw DocumentError.AlreadyExists();
    }

    // [NEW] Cek Duplikasi Judul di dalam Grup
    const existingTitleInGroup = await this.documentRepository.findFirst({
      where: {
        groupId: groupId,
        title: title,
      },
    });

    if (existingTitleInGroup) {
      throw DocumentError.DuplicateTitle(title);
    }

    const newDoc = await this.documentRepository.createGroupDocument(userId, groupId, title, filePath, hash, signerUserIds);
    return newDoc; // Return the newly created document
  }

  /**
   * Validasi Limit Versi.
   * Dipanggil oleh SignatureService SEBELUM membuat tanda tangan/versi baru.
   * Free: Max 5 Versi, Premium: Max 20 Versi.
   */
  async checkVersionLimitOrLock(documentId, userId) {
    const isPremium = await this.userService.isUserPremium(userId);
    const limit = isPremium ? 20 : 5;
    const currentCount = await this.versionRepository.countByDocumentId(documentId);

    if (currentCount >= limit) {
      await this.documentRepository.update(documentId, { status: "completed" });
      throw CommonError.Forbidden(`Batas revisi dokumen tercapai (${limit} versi). Dokumen otomatis dikunci menjadi 'Completed'. ${!isPremium ? "Upgrade ke Premium untuk batas 20 versi." : ""}`);
    }
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

    if (updates?.title) {
      // [NEW] Cek Duplikasi Judul saat Rename
      // Logic dipisah antara Personal vs Group
      let existingTitleDoc = null;

      if (document.groupId) {
        // Cek di lingkup Grup
        existingTitleDoc = await this.documentRepository.findFirst({
          where: {
            groupId: document.groupId,
            title: updates.title,
            NOT: { id: documentId },
          },
        });
      } else {
        // Cek di lingkup Pribadi
        existingTitleDoc = await this.documentRepository.findFirst({
          where: {
            userId: userId,
            title: updates.title,
            groupId: null,
            NOT: { id: documentId },
          },
        });
      }

      if (existingTitleDoc) {
        throw DocumentError.DuplicateTitle(updates.title);
      }

      dataToUpdate.title = updates.title;
    }

    if (updates?.type) dataToUpdate.type = updates.type;

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
    const document = await this.documentRepository.findById(documentId, userId);
    if (!document) throw DocumentError.NotFound("Dokumen tidak ditemukan.");

    const requestUserId = String(userId);
    const docOwnerId = String(document.userId);
    const isUploader = requestUserId === docOwnerId;

    if (document.groupId) {
      if (!isUploader) {
        const member = await this.groupMemberRepository.findByGroupAndUser(document.groupId, userId);
        if (!member || member.role !== "admin_group") {
          throw DocumentError.Forbidden("Akses Ditolak: Hanya Admin Grup yang dapat mengembalikan versi dokumen. Signer hanya diizinkan menandatangani.");
        }
      }

      // [VALIDATION] Cegah rollback jika sudah ada yang menandatangani versi saat ini
      if (document.currentVersionId && this.groupSignatureRepository) {
        const existingSignatures = await this.groupSignatureRepository.findAllByVersionId(document.currentVersionId);
        // Cek jika ada signature yang statusnya bukan draft (misal 'signed' atau valid)
        // Adjust logic based on signature status if needed, but usually existence implies action.
        // Assuming findAllByVersionId returns all signatures including drafts?
        // Helper findAllByVersionId usually returns all.
        // We should strictly block only if 'valid' signatures exist, or maybe any?
        // User said: "ada user yang sudah tanda tangan".
        // Let's filter for non-draft if possible, or just count > 0 if implementation treats them as signed.
        // Looking at PrismaGroupSignatureRepo, create sets status='draft' by default, update sets to 'final'.
        // So we should probably check for status != 'draft' or just any signature depending on flow.
        // But usually 'signed' means committed.
        // Let's check status 'final' or 'signed' to be safe.
        // Based on repo, status is dynamic. Let's assume we block if any signature record exists that is NOT a draft.
        // However, PrismaGroupSignatureRepository.js creates with 'draft'.
        // Let's filter for status !== 'draft'.

        const hasValidSignatures = existingSignatures.some(sig => sig.status !== 'draft');

        if (hasValidSignatures) {
          throw CommonError.BadRequest("Dokumen tidak dapat di-rollback karena sudah ada anggota yang menandatangani versi ini.");
        }
      }
    } else {
      if (!isUploader) {
        throw DocumentError.Forbidden("Anda tidak memiliki akses untuk mengubah dokumen ini.");
      }
    }

    const version = await this.versionRepository.findById(versionId);
    if (!version || version.documentId !== documentId) {
      throw DocumentError.InvalidVersion(versionId, documentId);
    }

    const allVersions = await this.versionRepository.findAllByDocumentId(documentId);
    allVersions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const isFirstVersion = allVersions.length > 0 && allVersions[0].id === versionId;

    let newStatus = "pending";
    let newSignedFileUrl = null;

    if (isFirstVersion) {
      console.log(`🔄 [ROLLBACK] Kembali ke Versi Awal (V1). Cleaning Signatures...`);
      newStatus = "pending";

      if (this.signatureRepository) await this.signatureRepository.deleteBySignerAndVersion(null, versionId);
      if (this.groupSignatureRepository) await this.groupSignatureRepository.deleteBySignerAndVersion(null, versionId);

      if (document.groupId && this.groupDocumentSignerRepository) {
        if (typeof this.groupDocumentSignerRepository.resetSigners === "function") {
          await this.groupDocumentSignerRepository.resetSigners(documentId);
        }
      }
    } else {
      const isBurnedFinal = !!version.signedFileHash || !!version.url;
      if (isBurnedFinal) {
        newStatus = "completed";
        newSignedFileUrl = version.url;
      } else {
        newStatus = "pending";
      }
    }

    return this.documentRepository.update(documentId, {
      currentVersionId: versionId,
      status: newStatus,
      signedFileUrl: newSignedFileUrl,
    });
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

  /**
   * [BARU] Menghapus satu versi spesifik dari riwayat dokumen.
   * Method ini menangani validasi hak akses dan pembersihan file fisik.
   */
  async deleteVersion(documentId, versionId, userId) {
    const document = await this.documentRepository.findByIdSimple(documentId);

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
      throw DocumentError.Forbidden("Anda tidak memiliki izin untuk menghapus versi dokumen ini.");
    }

    let versionToDelete;
    try {
      versionToDelete = await this.versionRepository.findById(versionId);
    } catch (e) {
      throw DocumentError.NotFound("Versi dokumen tidak ditemukan.");
    }

    await this.versionRepository.deleteById(versionId);

    if (versionToDelete.url) {
      try {
        await this.fileStorage.deleteFile(versionToDelete.url);
      } catch (err) {
        console.warn(`[Warning] Gagal menghapus file fisik versi ${versionId}:`, err.message);
      }
    }

    return { message: "Versi dokumen berhasil dihapus." };
  }
}
