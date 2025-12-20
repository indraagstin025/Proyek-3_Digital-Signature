import crypto from "crypto";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";

export class SignatureService {
  constructor(signatureRepository, documentRepository, versionRepository, pdfService, auditService) {
    this.signatureRepository = signatureRepository;
    this.documentRepository = documentRepository;
    this.versionRepository = versionRepository;
    this.pdfService = pdfService;
    this.auditService = auditService;
  }

  /**
   * [PERSONAL - FINAL]
   * Menambahkan Tanda Tangan Personal Mandiri.
   * Proses:
   * 1. Buat Versi Baru.
   * 2. Simpan Data Signature ke DB.
   * 3. Burn PDF (Generate Signed PDF).
   * 4. Update Dokumen jadi Completed.
   */
  async addPersonalSignature(userId, originalVersionId, signaturesData, auditData, options = { displayQrCode: true }, req = null) {
    let originalVersion;
    try {
      originalVersion = await this.versionRepository.findById(originalVersionId);
    } catch (dbError) {
      throw CommonError.DatabaseError(`Gagal mengambil data versi: ${dbError.message}`);
    }

    if (!originalVersion) throw CommonError.NotFound(`Versi dokumen ${originalVersionId} tidak ditemukan.`);

    const document = await this.documentRepository.findById(originalVersion.documentId, userId);
    if (!document) throw CommonError.NotFound(`Dokumen tidak ditemukan atau akses ditolak.`);
    if (document.status === "completed") throw CommonError.BadRequest("Dokumen sudah selesai (Completed).");

    let newVersionId = null;

    try {
      // 1. Buat Versi Baru (Container untuk hasil ttd)
      const newVersion = await this.versionRepository.create({
        documentId: originalVersion.documentId,
        userId: userId,
        url: "",
      });
      newVersionId = newVersion.id;

      // 2. Simpan Signature ke DB
      const payloadArray = Array.isArray(signaturesData) ? signaturesData : [signaturesData];
      const savedSignatures = [];

      for (const sigData of payloadArray) {
        const savedSig = await this.signatureRepository.create({
          userId: userId,
          documentVersionId: newVersion.id,
          method: sigData.method || "canvas",
          signatureImageUrl: sigData.signatureImageUrl,
          positionX: sigData.positionX,
          positionY: sigData.positionY,
          pageNumber: sigData.pageNumber,
          width: sigData.width,
          height: sigData.height,
          status: "final", // Langsung final untuk personal
          ...auditData,
        });
        savedSignatures.push(savedSig);
      }

      // 3. Generate PDF (Burning)
      const firstSignatureId = savedSignatures[0]?.id;
      const BASE_VERIFY_URL = process.env.VERIFICATION_URL || "http://localhost:5173";
      const verificationUrl = `${BASE_VERIFY_URL.replace(/\/$/, "")}/verify/${firstSignatureId}`;

      const { signedFileBuffer, publicUrl } = await this.pdfService.generateSignedPdf(
          originalVersionId,
          payloadArray,
          { displayQrCode: options.displayQrCode, verificationUrl }
      );

      // 4. Update Versi & Dokumen
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
   * [PUBLIC] Mengambil detail untuk Scan QR Code
   * Bisa dipakai untuk verifikasi signature Personal maupun Group (karena ID unik).
   */
  async getVerificationDetails(signatureId) {
    // Cari di tabel Personal & Group (Repository akan handle pencarian di kedua tabel)
    const signature = await this.signatureRepository.findById(signatureId);

    if (!signature) {
      throw SignatureError.NotFound(signatureId);
    }

    if (!signature.documentVersion || !signature.signer) {
      throw CommonError.InternalServerError("Data integritas tidak lengkap (Relasi hilang).");
    }

    return {
      signerName: signature.signer.name,
      signerEmail: signature.signer.email,
      signerIpAddress: signature.ipAddress || "-",
      documentTitle: signature.documentVersion.document.title,
      signedAt: signature.signedAt,
      verificationStatus: "REGISTERED",
      verificationMessage: "Tanda tangan terdaftar dan valid.",
      originalDocumentUrl: signature.documentVersion.url,
      type: signature.type || "UNKNOWN",
    };
  }

  /**
   * [PUBLIC] Verifikasi Manual Upload PDF
   */
  async verifyUploadedFile(signatureId, uploadedFileBuffer) {
    const signature = await this.signatureRepository.findById(signatureId);

    if (!signature) throw SignatureError.NotFound(signatureId);

    const storedHash = signature.documentVersion.signedFileHash;
    if (!storedHash) throw CommonError.InternalServerError("Data Hash dokumen asli tidak ditemukan.");

    const recalculateHash = crypto.createHash("sha256").update(uploadedFileBuffer).digest("hex");
    const isHashMatch = recalculateHash === storedHash;

    return {
      signerName: signature.signer.name,
      documentTitle: signature.documentVersion.document.title,
      signedAt: signature.signedAt,
      verificationStatus: isHashMatch ? "VALID (Integritas OK)" : "TIDAK VALID (Hash Mismatch)",
      isHashMatch: isHashMatch,
    };
  }
}