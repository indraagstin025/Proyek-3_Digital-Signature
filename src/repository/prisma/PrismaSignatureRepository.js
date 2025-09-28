import { SignatureRepository } from "../interface/SignatureRepository.js";

/**
 * @description Implementasi SignatureRepository menggunakan Prisma.
 * Bertanggung jawab atas interaksi database khusus untuk tanda tangan.
 */
export class PrismaSignatureRepository extends SignatureRepository {
  /**
   * @param {PrismaClient} prisma - Instance dari Prisma Client.
   */
  constructor(prisma) {
    super();
    if (!prisma) {
      throw new Error("Prisma Client harus disediakan.");
    }
    this.prisma = prisma;
  }

  /**
   * @description Membuat data tanda tangan personal baru di database.
   * @param {object} data - Data lengkap untuk membuat SignaturePersonal.
   * @returns {Promise<object>}
   */
  async createPersonal(data) {
    return this.prisma.signaturePersonal.create({
      data: data,
    });
  }

  /**
   * @description Menemukan satu tanda tangan berdasarkan ID uniknya.
   * @param {string} signatureId - ID dari tanda tangan.
   * @returns {Promise<object|null>}
   */
  async findById(signatureId) {
    return this.prisma.signaturePersonal.findUnique({
      where: { id: signatureId },
      include: {
        signer: true,
        documentVersion: {
          include: {
            document: true,
          },
        },
      },
    });
  }

  /**
   * @description Menemukan semua tanda tangan yang terhubung ke satu versi dokumen.
   * @param {string} documentVersionId - ID dari versi dokumen.
   * @returns {Promise<object[]>}
   */
  async findByVersionId(documentVersionId) {
    return this.prisma.signaturePersonal.findMany({
      where: { documentVersionId: documentVersionId },
      include: {
        signer: true,
      },
    });
  }

  /**
   * @description Memperbarui data tanda tangan berdasarkan ID.
   * @param {string} signatureId - ID tanda tangan yang akan diperbarui.
   * @param {object} data - Data yang akan diperbarui.
   * @returns {Promise<object>} Objek tanda tangan setelah diperbarui.
   */
  async update(signatureId, data) {
    return this.prisma.signaturePersonal.update({
      where: { id: signatureId },
      data: data,
    });
  }
}
