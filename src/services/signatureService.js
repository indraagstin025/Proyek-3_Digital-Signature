import crypto from "crypto";

export class SignatureService {
  /**
   * @param {object} signatureRepository
   * @param {object} documentRepository
   * @param {object} versionRepository
   * @param {object} pdfService
   */
  constructor(signatureRepository, documentRepository, versionRepository, pdfService) {
    this.signatureRepository = signatureRepository;
    this.documentRepository = documentRepository;
    this.versionRepository = versionRepository;
    this.pdfService = pdfService;
  }

  /**
   * @description Mengorkestrasi proses penambahan tanda tangan mandiri, yang akan menghasilkan VERSI BARU dari dokumen.
   * @param {string} userId - ID user yang melakukan aksi (harus pemilik).
   * @param {string} originalVersionId - ID versi dokumen ASLI yang akan ditandatangani.
   * @param {object} signatureData - Data tanda tangan { method, signatureImageUrl, ... }.
   * @param {object} auditData - Data jejak audit { ipAddress, userAgent }.
   * @param {object} options - Opsi tambahan { displayQrCode: boolean }.
   * @returns {Promise<object>} Dokumen induk yang telah diperbarui.
   */
  async addPersonalSignature(userId, originalVersionId, signatureData, auditData, options = { displayQrCode: true }) {
    const originalVersion = await this.versionRepository.findById(originalVersionId);
    if (!originalVersion || originalVersion.userId !== userId) {
      throw new Error("Akses ditolak atau versi tidak ditemukan.");
    }

    const document = await this.documentRepository.findById(originalVersion.documentId, userId);
    if (document.status === "completed") {
      throw new Error("Dokumen ini sudah selesai dan tidak dapat ditandatangani lagi.");
    }

    const newVersion = await this.versionRepository.create({
      documentId: originalVersion.documentId,
      userId: userId,
      url: "",
    });

    const dataToSave = {
      signer: { connect: { id: userId } },
      documentVersion: { connect: { id: newVersion.id } },
      ...signatureData,
      ...auditData,
      displayQrCode: options.displayQrCode,
    };
    const newSignatureRecord = await this.signatureRepository.createPersonal(dataToSave);

    const verificationUrl = `https://websiteanda.com/verify/${newSignatureRecord.id}`;

    const pdfOptions = {
      displayQrCode: options.displayQrCode,
      verificationUrl: verificationUrl,
    };

    const { signedFileBuffer, publicUrl } = await this.pdfService.generateSignedPdf(originalVersionId, [signatureData], pdfOptions);

    const signedHash = crypto.createHash("sha256").update(signedFileBuffer).digest("hex");

    await this.versionRepository.update(newVersion.id, {
      url: publicUrl,
      signedFileHash: signedHash,
    });

    return this.documentRepository.update(originalVersion.documentId, {
      currentVersionId: newVersion.id,
      status: "completed",
      signedFileUrl: publicUrl,
    });
  }

  /**
   * @description Membuat record tanda tangan personal di database.
   * @param {object} data - Data lengkap untuk membuat SignaturePersonal.
   * @returns {Promise<object>}
   */
  async createPersonalSignature(data) {
    return this.signatureRepository.createPersonal(data);
  }

  /**
   * @description Mengambil detail untuk halaman verifikasi tanda tangan.
   * @param {string} signatureId - ID unik dari tanda tangan.
   * @returns {Promise<object>}
   */
  async getVerificationDetails(signatureId) {
    const signature = await this.signatureRepository.findById(signatureId);
    if (!signature) {
      throw new Error("Tanda tangan tidak ditemukan.");
    }

    return {
      signerName: signature.signer.name,
      signerEmail: signature.signer.email,
      documentTitle: signature.documentVersion.document.title,
      signedAt: signature.signedAt,
      signatureImageUrl: signature.signatureImageUrl,
      ipAddress: signature.ipAddress,
    };
  }
}
