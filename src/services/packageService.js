import crypto from "crypto";
import CommonError from "../errors/CommonError.js";
import DocumentError from "../errors/DocumentError.js";

import PaymentError from "../errors/PaymentError.js";

/**
 * Service untuk seluruh lifecycle Signing Package (batch).
 */
export class PackageService {
  /**
   * [UPDATED] Menambahkan userService di constructor
   */
  constructor(packageRepository, documentRepository, versionRepository, pdfService, auditService, userService) {
    if (!packageRepository || !documentRepository || !versionRepository || !pdfService || !auditService || !userService) {
      throw CommonError.InternalServerError("PackageService: Repository, Services, dan UserService wajib diberikan.");
    }
    this.packageRepository = packageRepository;
    this.documentRepository = documentRepository;
    this.versionRepository = versionRepository;
    this.pdfService = pdfService;
    this.auditService = auditService;
    this.userService = userService;
  }

  /**
   * Membuat package beserta kumpulan dokumen versi aktif.
   * [UPDATED] Menambahkan Pengecekan Limit Premium (3 vs 20).
   */
  async createPackage(userId, title, documentIds) {
    const isPremium = await this.userService.isUserPremium(userId);

    const LIMIT_FREE = 3;
    const LIMIT_PREMIUM = 20;
    const limit = isPremium ? LIMIT_PREMIUM : LIMIT_FREE;

    if (documentIds.length > limit) {
      throw PaymentError.PremiumRequired(`Maksimal ${limit} dokumen per paket. ${!isPremium ? "Upgrade ke Premium untuk kapasitas lebih besar (hingga 20 dokumen)." : ""}`);
    }

    const docVersionIds = [];

    const docPromises = documentIds.map((docId) => this.documentRepository.findById(docId, userId));
    const docs = await Promise.all(docPromises);

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const docId = documentIds[i];

      if (!doc) throw DocumentError.NotFound(docId);
      if (!doc.currentVersionId) throw DocumentError.InvalidVersion("Tidak memiliki versi aktif", docId);
      if (doc.status === "completed") throw CommonError.BadRequest(`Dokumen '${doc.title}' sudah selesai & tidak dapat ditambahkan ke paket.`);

      docVersionIds.push(doc.currentVersionId);
    }

    if (docVersionIds.length === 0) throw CommonError.BadRequest("Tidak ada dokumen valid untuk diproses.");

    return await this.packageRepository.createPackageWithDocuments(userId, title, docVersionIds);
  }

  async getPackageDetails(packageId, userId) {
    return await this.packageRepository.findPackageById(packageId, userId);
  }

  /**
   * Eksekusi signing untuk seluruh dokumen dalam paket.
   * [FITUR] Menangkap Access Code (PIN) dan menyimpannya ke DB.
   */
  async signPackage(packageId, userId, signaturesPayload, userIpAddress, req = null) {
    const pkg = await this.getPackageDetails(packageId, userId);
    if (pkg.status === "completed") throw CommonError.BadRequest("Paket ini sudah selesai & tidak dapat diproses ulang.");

    let signerName = "User";
    let signerEmail = "user@email.com";

    if (this.packageRepository.prisma) {
      const user = await this.packageRepository.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        signerName = user.name;
        signerEmail = user.email;
      }
    }

    const results = { success: [], failed: [] };

    for (const packageDoc of pkg.documents) {
      const originalDocId = packageDoc.docVersion.document.id;
      const originalVersionId = packageDoc.docVersion.id;
      const docTitle = packageDoc.docVersion.document.title;

      let createdSignatureIds = [];
      let signedFileBuffer = null;

      try {
        console.log(`[PackageService] 🔄 Processing: ${docTitle}...`);

        const isPremium = await this.userService.isUserPremium(userId);
        const versionLimit = isPremium ? 20 : 5;
        const currentVersionCount = await this.versionRepository.countByDocumentId(originalDocId);

        if (currentVersionCount >= versionLimit) {
          throw CommonError.Forbidden(`Dokumen "${docTitle}" sudah mencapai batas revisi (${versionLimit} versi). ${!isPremium ? "Upgrade ke Premium untuk batas 20 versi." : ""}`);
        }

        const signaturesForThisDoc = signaturesPayload.filter((sig) => sig.packageDocId === packageDoc.id);
        if (signaturesForThisDoc.length === 0) throw new Error("Tidak ada konfigurasi tanda tangan untuk dokumen ini.");

        const signaturesToCreate = signaturesForThisDoc.map((sig) => ({
          packageDocumentId: packageDoc.id,
          signerId: userId,
          signatureImageUrl: sig.signatureImageUrl,
          pageNumber: sig.pageNumber,
          positionX: sig.positionX,
          positionY: sig.positionY,
          width: sig.width,
          height: sig.height,
          ipAddress: userIpAddress,
        }));

        const createdSignatures = await this.packageRepository.createPackageSignatures(signaturesToCreate);
        if (!createdSignatures?.length) throw new Error("Database gagal menyimpan tanda tangan.");

        createdSignatureIds = createdSignatures.map((s) => s.id);
        const firstSignatureId = createdSignatures[0].id;

        const base = (process.env.VERIFICATION_URL || "http://localhost:5173").replace(/\/$/, "");
        const verificationUrl = `${base}/verify/${firstSignatureId}`;
        const displayQrCode = signaturesForThisDoc[0].displayQrCode ?? true;

        const signaturesForPdf = signaturesForThisDoc.map((sig, index) => ({
          ...sig,
          id: createdSignatureIds[index],
          signerName: signerName,
          signerEmail: signerEmail,
          ipAddress: userIpAddress,
          signedAt: new Date(),
        }));

        const pdfResult = await this.pdfService.generateSignedPdf(originalVersionId, signaturesForPdf, { displayQrCode, verificationUrl });

        signedFileBuffer = pdfResult.signedFileBuffer;
        const publicUrl = pdfResult.publicUrl;
        const accessCode = pdfResult.accessCode;

        if (accessCode) {
          await this.packageRepository.updateSignature(firstSignatureId, { accessCode });
        }

        const hash = crypto.createHash("sha256").update(signedFileBuffer).digest("hex");

        const newVersion = await this.versionRepository.create({
          documentId: originalDocId,
          userId,
          url: publicUrl,
          hash,
          signedFileHash: hash,
        });

        await this.packageRepository.updatePackageDocumentVersion(packageId, originalVersionId, newVersion.id);
        await this.documentRepository.update(originalDocId, {
          currentVersionId: newVersion.id,
          status: "completed",
          signedFileUrl: publicUrl,
        });

        console.log(`[PackageService] ✅ Success: ${docTitle}`);
        results.success.push(originalDocId);
      } catch (error) {
        console.error(`[PackageService] ❌ Failed doc ${originalDocId}:`, error.message);

        if (createdSignatureIds.length > 0) await this.packageRepository.deleteSignaturesByIds(createdSignatureIds);
        results.failed.push({ documentId: originalDocId, error: error.message });
      } finally {
        signedFileBuffer = null;
      }
    }

    const status = results.failed.length === 0 ? "completed" : "partial_failure";
    await this.packageRepository.updatePackageStatus(packageId, status);

    if (this.auditService) {
      await this.auditService.log("SIGN_PACKAGE", userId, packageId, `User menandatangani paket dokumen.`, req);
    }

    return { packageId, status, ...results };
  }

  /**
   * [PUBLIC] Cek QR Code (Gatekeeper)
   * [UPDATED] Mengembalikan status locked jika ada accessCode.
   */
  async getPackageSignatureVerificationDetails(signatureId) {
    const sig = await this.packageRepository.findPackageSignatureById(signatureId);
    if (!sig) return null;

    if (sig.accessCode) {
      let isTimeLocked = false;
      if (sig.lockedUntil && new Date() < new Date(sig.lockedUntil)) {
        isTimeLocked = true;
      }

      return {
        isLocked: true,
        signatureId: sig.id,
        documentTitle: sig.packageDocument?.docVersion?.document?.title || "Dokumen Terkunci",
        type: "PACKAGE",
        message: isTimeLocked ? "Akses dibekukan sementara karena terlalu banyak percobaan gagal." : "Dokumen dilindungi kode akses (PIN). Silakan masukkan PIN yang tertera di dokumen.",

        lockedUntil: sig.lockedUntil,
      };
    }

    const docVersion = sig.packageDocument?.docVersion;
    const signer = sig.signer;
    const storedHash = docVersion?.signedFileHash || docVersion?.hash;

    if (!docVersion || !signer || !storedHash) return null;

    return {
      signerName: signer.name,
      signerEmail: signer.email,
      signerIpAddress: sig.ipAddress || "-",
      documentTitle: docVersion.document.title,
      signedAt: sig.createdAt,
      storedFileHash: storedHash,
      verificationStatus: "REGISTERED",
      verificationMessage: "Tanda tangan terdaftar dan valid.",
      originalDocumentUrl: docVersion.url,
      type: "PACKAGE",
    };
  }

  /**
   * [BARU] Membuka Kunci dengan PIN + Rate Limiting
   */
  async unlockVerification(signatureId, inputCode) {
    const sig = await this.packageRepository.findPackageSignatureById(signatureId);
    if (!sig) return null;

    if (sig.lockedUntil && new Date() < new Date(sig.lockedUntil)) {
      const waitTime = Math.ceil((new Date(sig.lockedUntil) - new Date()) / 60000);
      throw CommonError.Forbidden(`Dokumen terkunci sementara. Coba lagi dalam ${waitTime} menit.`);
    }

    if (!sig.accessCode || sig.accessCode !== inputCode) {
      const newRetryCount = (sig.retryCount || 0) + 1;
      const MAX_ATTEMPTS = 3;

      if (newRetryCount >= MAX_ATTEMPTS) {
        const lockTime = new Date(Date.now() + 30 * 60 * 1000);
        await this.packageRepository.updateSignature(sig.id, {
          retryCount: newRetryCount,
          lockedUntil: lockTime,
        });
        throw CommonError.Forbidden("Terlalu banyak percobaan salah. Dokumen dikunci selama 30 menit.");
      } else {
        await this.packageRepository.updateSignature(sig.id, { retryCount: newRetryCount });
        const sisa = MAX_ATTEMPTS - newRetryCount;
        throw CommonError.BadRequest(`PIN Salah. Sisa percobaan: ${sisa} kali.`);
      }
    }

    if (sig.retryCount > 0 || sig.lockedUntil) {
      await this.packageRepository.updateSignature(sig.id, { retryCount: 0, lockedUntil: null });
    }

    const docVersion = sig.packageDocument?.docVersion;
    const signer = sig.signer;
    const storedHash = docVersion?.signedFileHash || docVersion?.hash;

    return {
      signerName: null,
      signerEmail: null,

      signerIpAddress: null,
      ipAddress: null,
      signedAt: null,

      documentTitle: signature.documentVersion.document.title,
      storedFileHash: signature.documentVersion.signedFileHash,

      verificationStatus: "REGISTERED",
      verificationMessage: "PIN Diterima. Unggah file untuk membuka seluruh metadata.",
      type: "PACKAGE",

      isLocked: false,
      requireUpload: true,
    };
  }

  async verifyUploadedPackageFile(signatureId, uploadedFileBuffer, inputAccessCode = null) {
    const sig = await this.packageRepository.findPackageSignatureById(signatureId);
    if (!sig) return null;

    if (sig.accessCode) {
      if (!inputAccessCode || sig.accessCode !== inputAccessCode) {
        return {
          isLocked: true,
          signatureId: sig.id,
          documentTitle: "Dokumen Terkunci",
          message: "Dokumen dilindungi kode akses (PIN).",
          type: "PACKAGE",
        };
      }
    }

    const docVersion = sig.packageDocument?.docVersion;
    const signer = sig.signer;
    const storedHash = docVersion?.signedFileHash || docVersion?.hash;

    if (!storedHash) return null;

    const recalculateHash = crypto.createHash("sha256").update(uploadedFileBuffer).digest("hex");
    const isHashMatch = recalculateHash === storedHash;

    return {
      signerName: signer.name,
      signerEmail: signer.email,
      ipAddress: sig.ipAddress || "-",

      documentTitle: docVersion.document.title,
      signedAt: sig.createdAt,

      storedFileHash: storedHash,
      recalculatedFileHash: recalculateHash,

      verificationStatus: isHashMatch ? "VALID" : "INVALID",
      isHashMatch: isHashMatch,
      type: "PACKAGE",
      isLocked: false,
    };
  }
}
