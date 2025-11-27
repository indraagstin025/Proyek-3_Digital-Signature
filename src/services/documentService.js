import crypto from "crypto";
import DocumentError from "../errors/DocumentError.js";
import CommonError from "../errors/CommonError.js";
import { isPdfEncrypted } from "../utils/pdfValidator.js";

export class DocumentService {
  constructor(documentRepository, versionRepository, signatureRepository, fileStorage, pdfService, groupMemberRepository) {
    if (!documentRepository || !versionRepository || !signatureRepository || !fileStorage || !pdfService || !groupMemberRepository) {
      throw new Error("Semua repository dan service harus disediakan.");
    }
    this.documentRepository = documentRepository;
    this.versionRepository = versionRepository;
    this.signatureRepository = signatureRepository;
    this.fileStorage = fileStorage;
    this.pdfService = pdfService;
    this.groupMemberRepository = groupMemberRepository;
  }

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

  async createDocument(userId, file, title) {
    if (!file) throw new Error("File dokumen wajib diunggah.");
    await this._validateFile(file);
    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const filePath = await this.fileStorage.uploadDocument(file, userId);
    return this.documentRepository.createWithFirstVersion(userId, title, filePath, hash);
  }

  async getAllDocuments(userId) {
    if (!userId) throw new Error("ID user tidak ditemukan.");
    return this.documentRepository.findAllByUserId(userId);
  }

  async getDocumentById(documentId, userId) {
    const document = await this.documentRepository.findById(documentId);
    if (!document) throw DocumentError.NotFound(documentId);

    if (document.userId === userId) return document;

    if (document.groupId) {
      const member = await this.groupMemberRepository.findByGroupAndUser(document.groupId, userId);
      if (member) return document;
    }

    throw DocumentError.UnauthorizedAccess();
  }

  async updateDocument(documentId, userId, updates) {
    const document = await this.getDocumentById(documentId, userId);
    const dataToUpdate = {};
    if (updates && updates.title) dataToUpdate.title = updates.title;
    if (Object.keys(dataToUpdate).length === 0) return document;
    return this.documentRepository.update(documentId, dataToUpdate);
  }

  async deleteDocument(documentId, userId) {
    const document = await this.getDocumentById(documentId, userId);
    const allVersions = await this.versionRepository.findAllByDocumentId(document.id);
    for (const version of allVersions) {
      await this.fileStorage.deleteFile(version.url);
    }
    await this.documentRepository.deleteById(document.id);
    return { message: "Dokumen dan semua riwayatnya berhasil dihapus." };
  }

  async getDocumentHistory(documentId, userId) {
    await this.getDocumentById(documentId, userId);
    return this.versionRepository.findAllByDocumentId(documentId);
  }

  async useOldVersion(documentId, versionId, userId) {
    await this.getDocumentById(documentId, userId);
    const version = await this.versionRepository.findById(versionId);

    if (!version || version.documentId !== documentId) {
      throw DocumentError.InvalidVersion(versionId, documentId);
    }

    const hasPersonalSig = version.signaturesPersonal && version.signaturesPersonal.some((sig) => sig.signatureImageUrl && sig.signatureImageUrl.trim() !== "");

    const hasPackageSig = version.packages && version.packages.some((p) => p.package && p.package.status === "completed");

    const isTargetVersionSigned = hasPersonalSig || hasPackageSig;

    const newStatus = isTargetVersionSigned ? "completed" : "draft";
    const newSignedFileUrl = isTargetVersionSigned ? version.url : null;

    return this.documentRepository.update(documentId, {
      currentVersionId: versionId,
      status: newStatus,
      signedFileUrl: newSignedFileUrl,
    });
  }

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
   * @function getDocumentFileUrl
   * @description Mendapatkan URL file untuk dokumen AKTIF (Current Version).
   * @param {boolean} isDownload - Jika true, akan menyertakan header Content-Disposition attachment.
   */
  async getDocumentFileUrl(documentId, userId, isDownload = false) {
    const document = await this.getDocumentById(documentId, userId);

    if (!document.currentVersionId) {
      throw new Error("Dokumen tidak memiliki versi aktif.");
    }
    const currentVersion = await this.versionRepository.findById(document.currentVersionId);

    let customFilename = null;
    if (isDownload) {
      const sanitizedTitle = document.title.replace(/\.pdf$/i, "").replace(/[\s/\\?%*:|"<>]/g, "_");

      customFilename = `${sanitizedTitle}.pdf`;
    }

    return this.fileStorage.getSignedUrl(currentVersion.url, 60, customFilename);
  }

  /**
   * @function getVersionFileUrl
   * @description Mendapatkan URL untuk versi SPESIFIK.
   * @param {boolean} isDownload - Jika true, paksa download. Jika false, hanya view.
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
          if (idx >= 0) versionNumber = idx + 1;
          else versionNumber = 1;
        } catch (err) {
          versionNumber = version.versionNumber || 1;
        }
      }

      const sanitizedTitle = document.title.replace(/\.pdf$/i, "").replace(/[\s/\\?%*:|"<>]/g, "_");
      customFilename = `signed-${sanitizedTitle}-v${versionNumber}.pdf`;
    }

    console.log(`[DocumentService] URL Generated. Mode Download: ${isDownload}`);

    return this.fileStorage.getSignedUrl(version.url, 60, customFilename);
  }

  /**
   * [BARU] Mendapatkan Internal Path (bukan Signed URL) dari versi aktif.
   * Digunakan oleh internal system (seperti AI Service).
   */
  async getDocumentFilePath(documentId, userId) {
    const document = await this.getDocumentById(documentId, userId);

    if (!document.currentVersionId) {
      throw new Error("Dokumen ini tidak memiliki versi aktif.");
    }

    const version = await this.versionRepository.findById(document.currentVersionId);
    if (!version) {
      throw new Error("Data versi dokumen tidak ditemukan.");
    }

    return version.url;
  }
}
