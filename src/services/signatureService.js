export class SignatureService {
  /**
   * @param {import('../repository/prisma/PrismaSignatureRepository.js').PrismaSignatureRepository} signatureRepository
   */
  constructor(signatureRepository) {
    this.signatureRepository = signatureRepository;
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
    };
  }
}
