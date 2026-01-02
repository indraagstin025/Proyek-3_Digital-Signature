import crypto from "crypto";
import CommonError from "../errors/CommonError.js";
import DocumentError from "../errors/DocumentError.js";
// [BARU] Import PaymentError untuk handling limitasi
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
    this.userService = userService; // [BARU] Inject UserService
  }

  /**
   * Membuat package beserta kumpulan dokumen versi aktif.
   * [UPDATED] Menambahkan Pengecekan Limit Premium (3 vs 20).
   */
  async createPackage(userId, title, documentIds) {
    // --- [LOGIC BARU] 1. Cek Limit Dokumen per Paket ---
    // Gunakan userService yang sudah kita update sebelumnya
    const isPremium = await this.userService.isUserPremium(userId);

    const LIMIT_FREE = 3;
    const LIMIT_PREMIUM = 20;
    const limit = isPremium ? LIMIT_PREMIUM : LIMIT_FREE;

    if (documentIds.length > limit) {
      throw PaymentError.PremiumRequired(`Maksimal ${limit} dokumen per paket. ${!isPremium ? "Upgrade ke Premium untuk kapasitas lebih besar (hingga 20 dokumen)." : ""}`);
    }
    // ----------------------------------------------------

    const docVersionIds = [];

    // 2. Fetch semua dokumen secara paralel (Cepat)
    const docPromises = documentIds.map((docId) => this.documentRepository.findById(docId, userId));
    const docs = await Promise.all(docPromises);

    // 3. Validasi Dokumen
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

    // Ambil Data User untuk Audit Trail PDF
    let signerName = "User";
    let signerEmail = "user@email.com";

    // Cek apakah repository punya akses ke prisma client user
    if (this.packageRepository.prisma) {
      const user = await this.packageRepository.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        signerName = user.name;
        signerEmail = user.email;
      }
    }

    const results = { success: [], failed: [] };

    // Loop Sequential (Satu per satu agar aman memory)
    for (const packageDoc of pkg.documents) {
      const originalDocId = packageDoc.docVersion.document.id;
      const originalVersionId = packageDoc.docVersion.id;
      const docTitle = packageDoc.docVersion.document.title;

      let createdSignatureIds = [];
      let signedFileBuffer = null;

      try {
        console.log(`[PackageService] 🔄 Processing: ${docTitle}...`);

        // [LIMIT CHECK] Cek apakah sudah mencapai batas versi
        const isPremium = await this.userService.isUserPremium(userId);
        const versionLimit = isPremium ? 20 : 5;
        const currentVersionCount = await this.versionRepository.countByDocumentId(originalDocId);

        if (currentVersionCount >= versionLimit) {
          throw CommonError.Forbidden(`Dokumen "${docTitle}" sudah mencapai batas revisi (${versionLimit} versi). ${!isPremium ? "Upgrade ke Premium untuk batas 20 versi." : ""}`);
        }

        // 1. Filter Config Signature
        const signaturesForThisDoc = signaturesPayload.filter((sig) => sig.packageDocId === packageDoc.id);
        if (signaturesForThisDoc.length === 0) throw new Error("Tidak ada konfigurasi tanda tangan untuk dokumen ini.");

        // 2. Siapkan Data Signature DB (Audit Log Awal)
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
          // Status awal SIGNED, nanti diupdate jika ada PIN
        }));

        // 3. Simpan ke DB (Dapatkan ID)
        const createdSignatures = await this.packageRepository.createPackageSignatures(signaturesToCreate);
        if (!createdSignatures?.length) throw new Error("Database gagal menyimpan tanda tangan.");

        createdSignatureIds = createdSignatures.map((s) => s.id);
        const firstSignatureId = createdSignatures[0].id;

        // 4. Generate URL Verifikasi
        const base = (process.env.VERIFICATION_URL || "http://localhost:5173").replace(/\/$/, "");
        const verificationUrl = `${base}/verify/${firstSignatureId}`;
        const displayQrCode = signaturesForThisDoc[0].displayQrCode ?? true;

        // 5. Konstruksi Payload untuk PDF Service
        // Gabungkan data visual dengan data Audit (IP, Time, ID)
        const signaturesForPdf = signaturesForThisDoc.map((sig, index) => ({
          ...sig,
          id: createdSignatureIds[index], // ID Database
          signerName: signerName,
          signerEmail: signerEmail,
          ipAddress: userIpAddress,
          signedAt: new Date(),
        }));

        // 6. Generate PDF (Burning)
        const pdfResult = await this.pdfService.generateSignedPdf(originalVersionId, signaturesForPdf, { displayQrCode, verificationUrl });

        signedFileBuffer = pdfResult.signedFileBuffer;
        const publicUrl = pdfResult.publicUrl;
        const accessCode = pdfResult.accessCode; // PIN dari PDF Service

        // 7. [FITUR PIN] Simpan Access Code ke DB jika ada
        if (accessCode) {
          await this.packageRepository.updateSignature(firstSignatureId, { accessCode });
        }

        // 8. Hashing & Versioning
        const hash = crypto.createHash("sha256").update(signedFileBuffer).digest("hex");

        const newVersion = await this.versionRepository.create({
          documentId: originalDocId,
          userId,
          url: publicUrl,
          hash,
          signedFileHash: hash,
        });

        // 9. Update Relasi & Status Dokumen
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
        // Rollback signature di DB jika gagal generate PDF
        if (createdSignatureIds.length > 0) await this.packageRepository.deleteSignaturesByIds(createdSignatureIds);
        results.failed.push({ documentId: originalDocId, error: error.message });
      } finally {
        signedFileBuffer = null; // Cleanup memory
      }
    }

    // Update Status Paket
    const status = results.failed.length === 0 ? "completed" : "partial_failure";
    await this.packageRepository.updatePackageStatus(packageId, status);

    if (this.auditService) {
      await this.auditService.log("SIGN_PACKAGE", userId, packageId, `User menandatangani paket dokumen.`, req);
    }

    return { packageId, status, ...results };
  }

  // =========================================================================
  // 👇 BAGIAN VERIFIKASI (UPDATED WITH PIN) 👇
  // =========================================================================

  /**
   * [PUBLIC] Cek QR Code (Gatekeeper)
   * [UPDATED] Mengembalikan status locked jika ada accessCode.
   */
  async getPackageSignatureVerificationDetails(signatureId) {
    const sig = await this.packageRepository.findPackageSignatureById(signatureId);
    if (!sig) return null;

    // [LOGIC BARU] Jika ada accessCode, kunci data!
    if (sig.accessCode) {
      return {
        isLocked: true,
        signatureId: sig.id,
        documentTitle: sig.packageDocument?.docVersion?.document?.title || "Dokumen Terkunci",
        type: "PACKAGE",
        message: "Dokumen dilindungi kode akses (PIN). Silakan masukkan PIN yang tertera di dokumen.",
      };
    }

    const docVersion = sig.packageDocument?.docVersion;
    const signer = sig.signer;
    const storedHash = docVersion?.signedFileHash || docVersion?.hash;

    if (!docVersion || !signer || !storedHash) return null;

    return {
      signerName: signer.name,
      signerEmail: signer.email,
      signerIpAddress: sig.ipAddress || "-", // Fallback IP
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

    // 1. CEK LOCK
    if (sig.lockedUntil && new Date() < new Date(sig.lockedUntil)) {
      const waitTime = Math.ceil((new Date(sig.lockedUntil) - new Date()) / 60000);
      throw CommonError.Forbidden(`Dokumen terkunci sementara. Coba lagi dalam ${waitTime} menit.`);
    }

    // 2. JIKA PIN SALAH
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

    // 3. JIKA PIN BENAR (Reset)
    if (sig.retryCount > 0 || sig.lockedUntil) {
      await this.packageRepository.updateSignature(sig.id, { retryCount: 0, lockedUntil: null });
    }

    // Return Data
    const docVersion = sig.packageDocument?.docVersion;
    const signer = sig.signer;
    const storedHash = docVersion?.signedFileHash || docVersion?.hash;

    return {
      signerName: signer.name,
      signerEmail: signer.email,
      signerIpAddress: sig.ipAddress || "-",
      documentTitle: docVersion.document.title,
      signedAt: sig.createdAt,
      storedFileHash: storedHash,
      verificationStatus: "REGISTERED",
      verificationMessage: "Akses diberikan. Silakan verifikasi file fisik.",
      originalDocumentUrl: docVersion.url,
      type: "PACKAGE",
      isLocked: false,
      requireUpload: true,
    };
  }

  async verifyUploadedPackageFile(signatureId, uploadedFileBuffer) {
    const sig = await this.packageRepository.findPackageSignatureById(signatureId);
    if (!sig) return null;

    const docVersion = sig.packageDocument?.docVersion;
    const signer = sig.signer;
    const storedHash = docVersion?.signedFileHash || docVersion?.hash;

    if (!storedHash) return null;

    // Hitung Hash file upload
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
    };
  }
}
