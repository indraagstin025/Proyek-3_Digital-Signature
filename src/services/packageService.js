import crypto from "crypto";
import CommonError from "../errors/CommonError.js";
import DocumentError from "../errors/DocumentError.js";

/**
 * Service untuk seluruh lifecycle Signing Package (batch).
 */
export class PackageService {
  constructor(packageRepository, documentRepository, versionRepository, pdfService, auditService) {
    if (!packageRepository || !documentRepository || !versionRepository || !pdfService || !auditService) {
      throw CommonError.InternalServerError("PackageService: Repository & PDF Service wajib diberikan.");
    }
    this.packageRepository = packageRepository;
    this.documentRepository = documentRepository;
    this.versionRepository = versionRepository;
    this.pdfService = pdfService;
    this.auditService = auditService;
  }

  /**
   * Membuat package beserta kumpulan dokumen versi aktif.
   */
  async createPackage(userId, title, documentIds) {
    const docVersionIds = [];

    // 1. Fetch semua dokumen secara paralel (Cepat)
    const docPromises = documentIds.map((docId) => this.documentRepository.findById(docId, userId));
    const docs = await Promise.all(docPromises);

    // 2. Validasi
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const docId = documentIds[i];

      if (!doc) throw DocumentError.NotFound(docId);
      if (!doc.currentVersionId) throw DocumentError.InvalidVersion("Tidak memiliki versi aktif", docId);
      if (doc.status === "completed") throw CommonError.BadRequest(`Dokumen '${doc.title}' selesai & tidak dapat ditambah ke paket.`);

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
   * [UPDATED] Menangkap Access Code (PIN) dan menyimpannya.
   */
  async signPackage(packageId, userId, signaturesPayload, userIpAddress, req = null) {
    const pkg = await this.getPackageDetails(packageId, userId);
    if (pkg.status === "completed") throw CommonError.BadRequest("Paket ini sudah selesai & tidak dapat diproses ulang.");

    // [FIX] Ambil Data User untuk Audit Trail
    let signerName = "User";
    let signerEmail = "user@email.com";
    if (this.packageRepository.prisma) {
      const user = await this.packageRepository.prisma.user.findUnique({ where: { id: userId } });
      if(user) { signerName = user.name; signerEmail = user.email; }
    }

    const results = { success: [], failed: [] };

    // Loop Sequential
    for (const packageDoc of pkg.documents) {
      const originalDocId = packageDoc.docVersion.document.id;
      const originalVersionId = packageDoc.docVersion.id;
      const docTitle = packageDoc.docVersion.document.title;

      let createdSignatureIds = [];
      let signedFileBuffer = null;

      try {
        console.log(`[PackageService] 🔄 Processing: ${docTitle}...`);

        // 1. Filter Config Signature
        const signaturesForThisDoc = signaturesPayload.filter((sig) => sig.packageDocId === packageDoc.id);
        if (signaturesForThisDoc.length === 0) throw new Error("Tidak ada konfigurasi tanda tangan untuk dokumen ini.");

        // 2. Siapkan Data Signature DB
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

        // 3. Simpan ke DB (Dapatkan ID)
        const createdSignatures = await this.packageRepository.createPackageSignatures(signaturesToCreate);
        if (!createdSignatures?.length) throw new Error("Database gagal menyimpan tanda tangan.");

        createdSignatureIds = createdSignatures.map((s) => s.id);
        const firstSignatureId = createdSignatures[0].id;

        // 4. Generate URL Verifikasi
        const base = (process.env.VERIFICATION_URL || "http://localhost:5173").replace(/\/$/, "");
        const verificationUrl = `${base}/verify/${firstSignatureId}`;
        const displayQrCode = signaturesForThisDoc[0].displayQrCode ?? true;

        // [FIX] Konstruksi Payload PDF SETELAH ID signature tersedia
        const signaturesForPdf = signaturesForThisDoc.map((sig, index) => ({
          ...sig, // Visual data
          id: createdSignatureIds[index], // ID dari DB
          signerName: signerName,
          signerEmail: signerEmail,
          ipAddress: userIpAddress,
          signedAt: new Date()
        }));

        // 5. Generate PDF
        const pdfResult = await this.pdfService.generateSignedPdf(
            originalVersionId,
            signaturesForPdf, // Gunakan payload gabungan
            { displayQrCode, verificationUrl }
        );

        signedFileBuffer = pdfResult.signedFileBuffer;
        const publicUrl = pdfResult.publicUrl;
        const accessCode = pdfResult.accessCode;

        // [BARU] Simpan Access Code
        if (accessCode) {
          await this.packageRepository.updateSignature(firstSignatureId, { accessCode });
        }

        // 6. Hashing & Versioning
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
      await this.auditService.log("SIGN_PACKAGE", userId, packageId, `User menandatangani paket.`, req);
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
        message: "Dokumen dilindungi kode akses (PIN). Silakan masukkan PIN yang tertera di dokumen."
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
          lockedUntil: lockTime
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
      requireUpload: true
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