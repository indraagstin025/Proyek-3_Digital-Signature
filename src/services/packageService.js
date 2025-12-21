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
   * * [OPTIMASI]: Menggunakan Promise.all untuk fetch metadata dokumen
   * karena ini ringan (hanya database query) dan mempercepat respon UI.
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
   * * [STRATEGI]: Menggunakan SEQUENTIAL LOOP (for...of) untuk mencegah RAM Crash.
   * Proses satu per satu, selesai, bersihkan memori, baru lanjut ke dokumen berikutnya.
   */
  async signPackage(packageId, userId, signaturesPayload, userIpAddress, req = null) {
    const pkg = await this.getPackageDetails(packageId, userId);
    if (pkg.status === "completed") throw CommonError.BadRequest("Paket ini sudah selesai & tidak dapat diproses ulang.");

    const results = { success: [], failed: [] };

    // Loop Sequential (Wajib untuk Railway 512MB)
    for (const packageDoc of pkg.documents) {
      const originalDocId = packageDoc.docVersion.document.id;
      const originalVersionId = packageDoc.docVersion.id;
      const docTitle = packageDoc.docVersion.document.title;

      let createdSignatureIds = [];
      let signedFileBuffer = null; // Inisialisasi variabel buffer

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

        // 3. Simpan Placeholder ke DB
        const createdSignatures = await this.packageRepository.createPackageSignatures(signaturesToCreate);
        if (!createdSignatures?.length) throw new Error("Database gagal menyimpan tanda tangan.");

        createdSignatureIds = createdSignatures.map((s) => s.id);
        const firstSignatureId = createdSignatures[0].id;

        // 4. Generate URL Verifikasi
        const base = (process.env.VERIFICATION_URL || "http://localhost:5173").replace(/\/$/, "");
        const verificationUrl = `${base}/verify/${firstSignatureId}`;
        const displayQrCode = signaturesForThisDoc[0].displayQrCode ?? true;

        // 5. 🔥 PROSES BERAT: PDF GENERATION 🔥
        // Hasilnya adalah Buffer besar
        const pdfResult = await this.pdfService.generateSignedPdf(originalVersionId, signaturesForThisDoc, { displayQrCode, verificationUrl });

        signedFileBuffer = pdfResult.signedFileBuffer; // Simpan buffer
        const publicUrl = pdfResult.publicUrl;

        // 6. Hashing (CPU Bound)
        const hash = crypto.createHash("sha256").update(signedFileBuffer).digest("hex");

        // 7. Update DB (Versi Baru)
        const newVersion = await this.versionRepository.create({
          documentId: originalDocId,
          userId,
          url: publicUrl,
          hash,
          signedFileHash: hash,
        });

        // 8. Update Status Dokumen
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

        // Rollback: Hapus signature yang sempat terbuat di DB jika PDF gagal
        if (createdSignatureIds.length > 0) await this.packageRepository.deleteSignaturesByIds(createdSignatureIds);

        results.failed.push({ documentId: originalDocId, error: error.message });
      } finally {
        // [MANUAL GC HELP]
        // Sangat Penting: Kosongkan variabel buffer agar RAM segera dilepas
        // sebelum lanjut ke iterasi loop dokumen berikutnya.
        signedFileBuffer = null;
      }
    }

    const status = results.failed.length === 0 ? "completed" : "partial_failure";
    await this.packageRepository.updatePackageStatus(packageId, status);

    // Audit Log
    if (this.auditService) {
      const successCount = results.success.length;
      const failCount = results.failed.length;
      await this.auditService.log(
          "SIGN_PACKAGE",
          userId,
          packageId,
          `User menandatangani paket. Sukses: ${successCount}, Gagal: ${failCount}`,
          req
      );
    }

    return { packageId, status, ...results };
  }

  // ... (Method verification lainnya tetap sama) ...

  async getPackageSignatureVerificationDetails(signatureId) {
    const sig = await this.packageRepository.findPackageSignatureById(signatureId);
    if (!sig) return null;

    const docVersion = sig.packageDocument?.docVersion;
    const signer = sig.signer;
    const storedHash = docVersion?.signedFileHash || docVersion?.hash;

    if (!docVersion || !signer || !storedHash) return null;

    return {
      signerName: signer.name,
      signerEmail: signer.email,
      documentTitle: docVersion.document.title,
      signedAt: sig.createdAt,
      signatureImageUrl: sig.signatureImageUrl,
      ipAddress: sig.ipAddress ?? "-",
      verificationStatus: "REGISTERED",
      storedFileHash: storedHash,
      originalDocumentUrl: docVersion.url,
      type: "PACKAGE",
    };
  }

  async verifyUploadedPackageFile(signatureId, uploadedFileBuffer) {
    const sig = await this.packageRepository.findPackageSignatureById(signatureId);
    if (!sig) return null;

    const docVersion = sig.packageDocument?.docVersion;
    const signer = sig.signer;
    const storedHash = docVersion?.signedFileHash || docVersion?.hash;
    if (!storedHash) return null;

    const recalculatedHash = crypto.createHash("sha256").update(uploadedFileBuffer).digest("hex");
    const isMatch = recalculatedHash === storedHash;

    return {
      signerName: signer.name,
      signerEmail: signer.email,
      documentTitle: docVersion.document.title,
      signedAt: sig.createdAt,
      ipAddress: sig.ipAddress ?? "-",
      verificationStatus: isMatch ? "VALID" : "INVALID",
      isSignatureValid: true,
      isHashMatch: isMatch,
      storedFileHash: storedHash,
      recalculatedFileHash: recalculatedHash,
      type: "PACKAGE",
    };
  }
}