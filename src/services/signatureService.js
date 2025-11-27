import crypto from "crypto";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";

export class SignatureService {
  constructor(signatureRepository, documentRepository, versionRepository, pdfService) {
    this.signatureRepository = signatureRepository;
    this.documentRepository = documentRepository;
    this.versionRepository = versionRepository;
    this.pdfService = pdfService;
  }

  /**
   * [UPDATE] Sekarang menerima signaturesData sebagai ARRAY
   */
  async addPersonalSignature(userId, originalVersionId, signaturesData, auditData, options = { displayQrCode: true }) {
    let originalVersion;
    try {
      originalVersion = await this.versionRepository.findById(originalVersionId);
    } catch (dbError) {
      throw CommonError.DatabaseError(`Gagal mengambil data versi: ${dbError.message}`);
    }

    if (!originalVersion) throw SignatureError.VersionNotFound(originalVersionId);
    if (originalVersion.userId !== userId) throw SignatureError.Unauthorized();

    let document;
    try {
      document = await this.documentRepository.findById(originalVersion.documentId);
    } catch (dbError) {
      throw CommonError.DatabaseError(`Gagal mengambil data dokumen: ${dbError.message}`);
    }

    if (!document) throw CommonError.InternalServerError(`Inkonsistensi data: Dokumen tidak ditemukan.`);
    if (document.status === "completed") throw SignatureError.AlreadyCompleted();

    let newVersionId = null;

    try {
      const newVersion = await this.versionRepository.create({
        documentId: originalVersion.documentId,
        userId: userId,
        url: "",
      });

      newVersionId = newVersion.id;

      const payloadArray = Array.isArray(signaturesData) ? signaturesData : [signaturesData];

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
          ...auditData,
          displayQrCode: options.displayQrCode,
        };

        await this.signatureRepository.createSignature(dataToSave);
      }

      const firstSignatureId = (await this.signatureRepository.findByVersionId(newVersion.id))[0]?.id;

      const BASE_VERIFY_URL = process.env.VERIFICATION_URL || "http://localhost:5173";
      const verificationUrl = `${BASE_VERIFY_URL.replace(/\/$/, "")}/verify/${firstSignatureId}`;

      const pdfOptions = { displayQrCode: options.displayQrCode, verificationUrl };

      const { signedFileBuffer, publicUrl } = await this.pdfService.generateSignedPdf(originalVersionId, payloadArray, pdfOptions);

      const signedHash = crypto.createHash("sha256").update(signedFileBuffer).digest("hex");

      await this.versionRepository.update(newVersion.id, {
        url: publicUrl,
        signedFileHash: signedHash,
      });

      return await this.documentRepository.update(originalVersion.documentId, {
        currentVersionId: newVersion.id,
        status: "completed",
        signedFileUrl: publicUrl,
      });
    } catch (processError) {
      console.error("[SignatureService] Gagal memproses tanda tangan:", processError);

      if (newVersionId) {
        console.warn(`[Rollback] Menghapus versi dokumen yang gagal (ID: ${newVersionId})...`);
        try {
          await this.versionRepository.deleteById(newVersionId);
          console.warn("[Rollback] Berhasil membersihkan data.");
        } catch (cleanupError) {
          console.error("[Rollback] Gagal membersihkan data sampah:", cleanupError);
        }
      }

      throw CommonError.InternalServerError(`Proses penandatanganan gagal: ${processError.message}`);
    }
  }

  /**
   * @description Mengambil detail informasi tanda tangan untuk ditampilkan saat Scan QR.
   * LOGIKA BARU: Fungsi ini TIDAK memverifikasi isi file fisik/lokal user (karena server tidak melihatnya).
   * Fungsi ini hanya mengonfirmasi bahwa ID Tanda Tangan tersebut ADA di database.
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
    };
  }

  /**
   * @description Memverifikasi tanda tangan digital pada file PDF yang diunggah (Uji Integritas File yang Beredar).
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
      throw CommonError.InternalServerError(`Inkonsistensi data: Relasi penanda tangan atau dokumen tidak ditemukan untuk ID: ${signatureId}`);
    }

    const storedHash = signature.documentVersion.signedFileHash;

    if (!storedHash) {
      throw CommonError.InternalServerError("Data Hash dokumen asli tidak ditemukan untuk verifikasi integritas.");
    }

    const recalculateHash = crypto.createHash("sha256").update(uploadedFileBuffer).digest("hex");
    const isHashMatch = recalculateHash === storedHash;

    let verificationStatus = isHashMatch ? "VALID (Integritas OK)" : "TIDAK VALID (Integritas GAGAL)";

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
