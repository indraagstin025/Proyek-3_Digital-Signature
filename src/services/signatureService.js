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

    // [FIX] Ambil data User untuk Audit Trail (Nama & Email)
    let signerName = "User";
    let signerEmail = "user@email.com";
    if (this.signatureRepository.prisma) {
      const user = await this.signatureRepository.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        signerName = user.name;
        signerEmail = user.email;
      }
    }

    let newVersionId = null;

    try {
      // 1. Buat Versi Baru
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
          status: "final",
          ...auditData,
        });
        savedSignatures.push(savedSig);
      }

      // 3. Generate PDF (Burning)
      const firstSignatureId = savedSignatures[0]?.id;
      const BASE_VERIFY_URL = process.env.VERIFICATION_URL || "http://localhost:5173";
      const verificationUrl = `${BASE_VERIFY_URL.replace(/\/$/, "")}/verify/${firstSignatureId}`;

      // [FIX] Gabungkan Data Visual + Audit menjadi satu payload
      const signaturesForPdf = payloadArray.map((sig, index) => ({
        ...sig, // Data Visual (x, y, image)

        // Data Audit (Wajib untuk halaman belakang)
        id: savedSignatures[index].id,
        signerName: signerName,
        signerEmail: signerEmail,
        ipAddress: auditData.ipAddress,
        signedAt: new Date()
      }));

      // [FIX] Panggil dengan 3 argumen saja
      const { signedFileBuffer, publicUrl, accessCode } = await this.pdfService.generateSignedPdf(
          originalVersionId,
          signaturesForPdf,
          { displayQrCode: options.displayQrCode, verificationUrl }
      );

      // [BARU] Simpan Access Code (PIN)
      if (accessCode && firstSignatureId) {
        await this.signatureRepository.update(firstSignatureId, { accessCode });
      }

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
        await this.auditService.log("SIGN_DOCUMENT_PERSONAL", userId, originalVersion.documentId, `User menandatangani dokumen personal.`, req);
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


  // =========================================================================
  // 👇 BAGIAN VERIFIKASI (UPDATED WITH PIN) 👇
  // =========================================================================

  /**
   * [PUBLIC] Mengambil detail untuk Scan QR Code
   * [UPDATED] Mengembalikan status locked jika ada accessCode.
   */
  async getVerificationDetails(signatureId) {
    const signature = await this.signatureRepository.findById(signatureId);

    if (!signature) {
      throw SignatureError.NotFound(signatureId);
    }

    // [LOGIC BARU] Jika ada accessCode, kunci data!
    if (signature.accessCode) {
      return {
        isLocked: true,
        signatureId: signature.id,
        documentTitle: signature.documentVersion?.document?.title || "Dokumen Terkunci",
        type: "PERSONAL",
        message: "Dokumen dilindungi kode akses (PIN). Silakan masukkan PIN yang tertera di dokumen."
      };
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
      storedFileHash: signature.documentVersion.signedFileHash,
      verificationStatus: "REGISTERED",
      verificationMessage: "Tanda tangan terdaftar dan valid.",
      originalDocumentUrl: signature.documentVersion.url,
      type: "PERSONAL",
    };
  }

  /**
   * [BARU] Membuka Kunci Dokumen dengan PIN + Rate Limiting
   */
  async unlockVerification(signatureId, inputCode) {
    const signature = await this.signatureRepository.findById(signatureId);
    if (!signature) return null;

    // 1. CEK APAKAH SEDANG TERKUNCI?
    if (signature.lockedUntil && new Date() < new Date(signature.lockedUntil)) {
      const waitTime = Math.ceil((new Date(signature.lockedUntil) - new Date()) / 60000);
      throw CommonError.Forbidden(`Dokumen terkunci sementara. Coba lagi dalam ${waitTime} menit.`);
    }

    // 2. JIKA PIN SALAH
    if (!signature.accessCode || signature.accessCode !== inputCode) {
      const newRetryCount = (signature.retryCount || 0) + 1;
      const MAX_ATTEMPTS = 3;

      if (newRetryCount >= MAX_ATTEMPTS) {
        // Kunci selama 30 menit
        const lockTime = new Date(Date.now() + 30 * 60 * 1000);

        await this.signatureRepository.update(signature.id, {
          retryCount: newRetryCount,
          lockedUntil: lockTime
        });

        throw CommonError.Forbidden("Terlalu banyak percobaan salah. Dokumen dikunci selama 30 menit.");
      } else {
        // Update counter saja
        await this.signatureRepository.update(signature.id, {
          retryCount: newRetryCount
        });

        const sisa = MAX_ATTEMPTS - newRetryCount;
        throw CommonError.BadRequest(`PIN Salah. Sisa percobaan: ${sisa} kali.`);
      }
    }

    // 3. JIKA PIN BENAR (Reset Counter)
    if (signature.retryCount > 0 || signature.lockedUntil) {
      await this.signatureRepository.update(signature.id, {
        retryCount: 0,
        lockedUntil: null // Reset lock
      });
    }

    // Return Data Lengkap
    return {
      signerName: signature.signer.name,
      signerEmail: signature.signer.email,
      signerIpAddress: signature.ipAddress || "-",
      documentTitle: signature.documentVersion.document.title,
      signedAt: signature.signedAt,
      storedFileHash: signature.documentVersion.signedFileHash,
      verificationStatus: "REGISTERED",
      verificationMessage: "Tanda tangan terdaftar dan valid.",
      originalDocumentUrl: signature.documentVersion.url,
      type: "PERSONAL",
      isLocked: false,
      requireUpload: true
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

    // Hitung Hash file upload
    const recalculateHash = crypto.createHash("sha256").update(uploadedFileBuffer).digest("hex");
    const isHashMatch = recalculateHash === storedHash;

    return {
      signerName: signature.signer.name,
      signerEmail: signature.signer.email,
      ipAddress: signature.ipAddress || "-",

      documentTitle: signature.documentVersion.document.title,
      signedAt: signature.signedAt,

      storedFileHash: storedHash,
      recalculatedFileHash: recalculateHash,

      verificationStatus: isHashMatch ? "VALID" : "INVALID",
      isHashMatch: isHashMatch,
      type: "PERSONAL"
    };
  }
}