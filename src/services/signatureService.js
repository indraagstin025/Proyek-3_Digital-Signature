import crypto from "crypto";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";
import DocumentError from "../errors/DocumentError.js";

export class SignatureService {
  constructor(signatureRepository, documentRepository, versionRepository, pdfService, groupDocumentSignerRepository, auditService) {
    this.signatureRepository = signatureRepository;
    this.documentRepository = documentRepository;
    this.versionRepository = versionRepository;
    this.pdfService = pdfService;
    this.groupDocumentSignerRepository = groupDocumentSignerRepository;
    this.auditService = auditService;
  }
  /**
   * [PERSONAL - FINAL]
   * Menambahkan Tanda Tangan Personal, Generate PDF Final, dan Log Audit.
   * FIX: Memastikan ID dari frontend tidak dipaksakan masuk ke DB.
   */
  async addPersonalSignature(userId, originalVersionId, signaturesData, auditData, options = { displayQrCode: true }, req = null) {
    let originalVersion;
    try {
      originalVersion = await this.versionRepository.findById(originalVersionId);
    } catch (dbError) {
      throw CommonError.DatabaseError(`Gagal mengambil data versi: ${dbError.message}`);
    }

    if (!originalVersion) throw CommonError.NotFound(`Versi dokumen ${originalVersionId} tidak ditemukan.`);

    let document;
    try {
      document = await this.documentRepository.findById(originalVersion.documentId, userId);
    } catch (dbError) {
      throw CommonError.DatabaseError(`Gagal mengambil data dokumen: ${dbError.message}`);
    }

    if (!document) throw CommonError.NotFound(`Dokumen tidak ditemukan atau akses ditolak.`);
    if (document.status === "completed") throw CommonError.BadRequest("Dokumen sudah selesai (Completed).");

    let newVersionId = null;

    try {
      const newVersion = await this.versionRepository.create({
        documentId: originalVersion.documentId,
        userId: userId,
        url: "",
      });

      newVersionId = newVersion.id;

      const payloadArray = Array.isArray(signaturesData) ? signaturesData : [signaturesData];
      const savedSignatures = [];

      for (const sigData of payloadArray) {
        const dataToSave = {
          userId: userId,
          documentVersionId: newVersion.id,
          method: sigData.method || "canvas",
          signatureImageUrl: sigData.signatureImageUrl,
          positionX: sigData.positionX,
          positionY: sigData.positionY,
          pageNumber: sigData.pageNumber,
          width: sigData.width,
          height: sigData.height,
          status: "final",
          ...auditData,
          displayQrCode: options.displayQrCode,
        };

        const savedSig = await this.signatureRepository.createSignature(dataToSave);
        savedSignatures.push(savedSig);
      }

      const firstSignatureId = savedSignatures[0]?.id;
      const BASE_VERIFY_URL = process.env.VERIFICATION_URL || "http://localhost:5173";
      const verificationUrl = `${BASE_VERIFY_URL.replace(/\/$/, "")}/verify/${firstSignatureId}`;

      const { signedFileBuffer, publicUrl } = await this.pdfService.generateSignedPdf(originalVersionId, payloadArray, { displayQrCode: options.displayQrCode, verificationUrl });

      const signedHash = crypto.createHash("sha256").update(signedFileBuffer).digest("hex");

      await this.versionRepository.update(newVersion.id, {
        url: publicUrl,
        signedFileHash: signedHash,
      });

      const result = await this.documentRepository.update(originalVersion.documentId, {
        currentVersionId: newVersion.id,
        status: "completed",
        signedFileUrl: publicUrl,
      });

      await this.signatureRepository.deleteBySignerAndVersion(userId, originalVersion.id, false);

      if (this.auditService) {
        await this.auditService.log("SIGN_DOCUMENT_PERSONAL", userId, originalVersion.documentId, `User menandatangani dokumen personal: ${document.title}`, req);
      }

      return result;
    } catch (processError) {
      console.error("[SignatureService] Gagal memproses tanda tangan:", processError);
      if (newVersionId) {
        await this.versionRepository.deleteById(newVersionId).catch(() => {});
      }
      throw CommonError.InternalServerError(`Proses penandatanganan gagal: ${processError.message}`);
    }
  }

  /**
   * [GROUP - REFACTORED UTAMA]
   * Menggunakan logika UPSERT (Update or Insert) untuk menjaga stabilitas ID.
   */
  async addGroupSignature(userId, documentId, signatureData, auditData, req = null) {
    const signerRequest = await this.groupDocumentSignerRepository.findPendingByUserAndDoc(userId, documentId);
    if (!signerRequest) {
      throw CommonError.BadRequest("Anda tidak memiliki akses tanda tangan atau Anda sudah menyelesaikannya.");
    }

    const document = await this.documentRepository.findById(documentId, userId);
    if (!document) throw CommonError.NotFound(`Dokumen ${documentId} tidak ditemukan.`);

    const currentVersion = document.currentVersion;
    if (!currentVersion) throw CommonError.InternalServerError("Versi dokumen tidak valid.");

    const existingSignature = await this.signatureRepository.findGroupSignatureBySigner(userId, currentVersion.id);

    let finalSignature;

    if (existingSignature) {
      console.log(`[SignatureService] Promoting/Updating signature ID: ${existingSignature.id} to FINAL`);

      finalSignature = await this.signatureRepository.updateGroupSignature(existingSignature.id, {
        positionX: signatureData.positionX,
        positionY: signatureData.positionY,
        width: signatureData.width,
        height: signatureData.height,
        pageNumber: signatureData.pageNumber,
        signatureImageUrl: signatureData.signatureImageUrl,
        method: signatureData.method || "canvas",
        status: "final",
      });
    } else {
      console.log(`[SignatureService] Creating new FINAL signature for User: ${userId}`);

      finalSignature = await this.signatureRepository.createGroupSignature({
        id: signatureData.id,
        userId: userId,
        documentVersionId: currentVersion.id,
        method: signatureData.method || "canvas",
        signatureImageUrl: signatureData.signatureImageUrl,
        positionX: signatureData.positionX,
        positionY: signatureData.positionY,
        pageNumber: signatureData.pageNumber,
        width: signatureData.width,
        height: signatureData.height,
        status: "final",
        ...auditData,
      });
    }

    await this.groupDocumentSignerRepository.updateStatusToSigned(documentId, userId, finalSignature.id);

    if (this.auditService) {
      await this.auditService.log("SIGN_DOCUMENT_GROUP", userId, documentId, `User menandatangani dokumen grup: ${document.title}`, req);
    }

    const pendingCount = await this.groupDocumentSignerRepository.countPendingSigners(documentId);

    return {
      ...finalSignature,
      message: pendingCount === 0 ? "Tanda tangan berhasil. Menunggu finalisasi." : "Tanda tangan disimpan.",
      isComplete: false,
      readyToFinalize: pendingCount === 0,
      remainingSigners: pendingCount,
    };
  }

  /**
   * [REVISED] Simpan ke Draft (Auto-save saat Drag & Drop)
   * Mengembalikan respon sukses palsu untuk Personal Document agar Frontend tidak error.
   */
  async saveDraftSignature(userId, documentId, signatureData) {
    const document = await this.documentRepository.findById(documentId, userId);
    if (!document) throw DocumentError.NotFound(documentId);

    const currentVersion = document.currentVersion;
    if (!currentVersion) throw CommonError.BadRequest("Versi Dokumen tidak ditemukan.");

    if (!document.groupId) {
      console.log("[SignatureService] Personal Document. Mengirim respon draft palsu agar Frontend senang.");

      return {
        id: signatureData.id,
        userId: userId,
        documentVersionId: currentVersion.id,
        status: "draft",
        method: signatureData.method || "canvas",
        signatureImageUrl: signatureData.signatureImageUrl,
        positionX: signatureData.positionX,
        positionY: signatureData.positionY,
        width: signatureData.width,
        height: signatureData.height,
        pageNumber: signatureData.pageNumber,
        isMocked: true,
      };
    }

    const payload = {
      id: signatureData.id,
      userId: userId,
      documentVersionId: currentVersion.id,
      method: signatureData.method || "canvas",
      signatureImageUrl: signatureData.signatureImageUrl,
      positionX: signatureData.positionX,
      positionY: signatureData.positionY,
      pageNumber: signatureData.pageNumber,
      width: signatureData.width || 0,
      height: signatureData.height || 0,
      status: "draft",
    };

    console.log("[Service] Saving Group Draft with ID:", payload.id);

    const existing = await this.signatureRepository.findGroupSignatureById(payload.id);

    if (existing) {
      console.log(`[Service] Draft ID ${payload.id} exists. Updating...`);
      return await this.signatureRepository.updateGroupSignature(payload.id, payload);
    } else {
      return await this.signatureRepository.createGroupSignature(payload);
    }
  }

  /**
   * [FIXED] Update Posisi & Ukuran dengan Error Reporting yang Jelas
   * Fungsi ini dipanggil saat user melakukan Drag/Resize.
   */
  async updateSignaturePosition(userId, signatureId, positionData) {
    const updatePayload = {
      positionX: positionData.positionX,
      positionY: positionData.positionY,
      width: positionData.width,
      height: positionData.height,
      pageNumber: positionData.pageNumber,
      ...(positionData.signatureImageUrl && { signatureImageUrl: positionData.signatureImageUrl }),
      ...(positionData.method && { method: positionData.method }),
    };

    let updated = null;

    try {
      updated = await this.signatureRepository.updateGroupSignature(signatureId, updatePayload);
    } catch (error) {
      if (error.code !== "P2025") throw error;
    }

    if (!updated) {
      try {
        updated = await this.signatureRepository.updatePersonalSignature(signatureId, updatePayload);
      } catch (error) {
        if (error.code !== "P2025") throw error;
      }
    }

    if (!updated) {
      throw CommonError.NotFound(`Tanda tangan dengan ID ${signatureId} belum tersedia.`);
    }

    return updated;
  }

  /**
   * Menghapus signature (Draft/Pending)
   */
  async deleteSignature(userId, signatureId) {
    const groupResult = await this.signatureRepository.deleteGroupSignature(signatureId);
    if (groupResult && groupResult.count > 0) {
      return true;
    }

    try {
      await this.signatureRepository.deletePersonalSignature(signatureId);
    } catch (error) {
      if (error.code !== "P2025") {
        console.error("Gagal delete personal signature:", error);
      }
    }

    return true;
  }

  /**
   * Mengambil detail untuk Scan QR Code
   */
  async getVerificationDetails(signatureId) {
    let signature;
    try {
      signature = await this.signatureRepository.findById(signatureId);
    } catch (dbError) {
      throw CommonError.DatabaseError(`Gagal mengambil data tanda tangan: ${dbError.message}`);
    }

    if (!signature) {
      throw SignatureError.NotFound(signatureId);
    }

    if (!signature.documentVersion || !signature.signer) {
      throw CommonError.InternalServerError("Data integritas tidak lengkap (Relasi hilang).");
    }

    const storedHash = signature.documentVersion.signedFileHash;
    const documentUrl = signature.documentVersion.url;

    return {
      signerName: signature.signer.name,
      signerEmail: signature.signer.email,
      signerIpAddress: signature.ipAddress || "-",
      documentTitle: signature.documentVersion.document.title,
      signedAt: signature.signedAt,
      signatureImageUrl: signature.signatureImageUrl,
      verificationStatus: "REGISTERED",
      verificationMessage: "Tanda tangan terdaftar di sistem. Harap pastikan isi dokumen tidak mengalami perubahan.",
      storedFileHash: storedHash,
      originalDocumentUrl: documentUrl,
      type: signature.type || "UNKNOWN",
    };
  }

  /**
   * Memverifikasi integritas file PDF yang diupload (Manual Upload Verify)
   */
  async verifyUploadedFile(signatureId, uploadedFileBuffer) {
    let signature;
    try {
      signature = await this.signatureRepository.findById(signatureId);
    } catch (dbError) {
      throw CommonError.DatabaseError(`Gagal mengambil tanda tangan: ${dbError.message}`);
    }

    if (!signature) {
      throw SignatureError.NotFound(signatureId);
    }

    if (!signature.signer || !signature.documentVersion || !signature.documentVersion.document) {
      throw CommonError.InternalServerError(`Inkonsistensi data: Relasi penanda tangan atau dokumen tidak ditemukan.`);
    }

    const storedHash = signature.documentVersion.signedFileHash;
    if (!storedHash) {
      throw CommonError.InternalServerError("Data Hash dokumen asli tidak ditemukan.");
    }

    const recalculateHash = crypto.createHash("sha256").update(uploadedFileBuffer).digest("hex");
    const isHashMatch = recalculateHash === storedHash;

    const verificationStatus = isHashMatch ? "VALID (Integritas OK)" : "TIDAK VALID (Integritas GAGAL)";

    return {
      signerName: signature.signer.name,
      signerEmail: signature.signer.email,
      documentTitle: signature.documentVersion.document.title,
      signedAt: signature.signedAt,
      verificationStatus: verificationStatus,
      ipAddress: signature.ipAddress || "-",
      isSignatureValid: true,
      isHashMatch: isHashMatch,
      storedFileHash: storedHash,
      recalculatedFileHash: recalculateHash,
    };
  }
}
