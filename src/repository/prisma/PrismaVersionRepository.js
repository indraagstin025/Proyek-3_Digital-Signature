import { VersionRepository } from "../interface/VersionRepository.js";

/**
 * @description Implementasi Repository untuk model 'DocumentVersion' menggunakan Prisma.
 */

export class PrismaVersionRepository extends VersionRepository {
  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  /**
   * @description Membuat record versi dokumen baru.
   * Digunakan saat user mengunggah file baru untuk dokumen yang sudah ada.
   */
  async create(data) {
    return this.prisma.documentVersion.create({
      data: {
        documentId: data.documentId,
        userId: data.userId,
        url: data.url,
        hash: data.hash,
      },
    });
  }

  /**
   * @description Mencari versi dokumen berdasarkan hash untuk user tertentu.
   */
  async findByUserAndHash(userId, hash) {
    return this.prisma.documentVersion.findUnique({
      where: {
        user_document_version_hash_unique: {
          userId,
          hash,
        },
      },
    });
  }

  /**
   * @description Mencari satu versi dokumen berdasarkan ID-nya, beserta tanda tangannya.
   */
  async findById(versionId) {
    return this.prisma.documentVersion.findUnique({
      where: { id: versionId },

      include: {
        document: true,
        signaturesPersonal: true,
        signaturesGroup: true,
      },
    });
  }

  /**
   * @description Mengambil semua versi dari satu dokumen, beserta tanda tangannya.
   */
  async findAllByDocumentId(documentId) {
    return this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
      include: {
        document: true,
        signaturesPersonal: true,
        signaturesGroup: true,
      },
    });
  }

  /**
   * @description Memperbarui data pada record versi dokumen.
   * @param {string} versionId - ID versi yang akan diperbarui.
   * @param {object} data - Data untuk diperbarui.
   * @returns {Promise<object>}
   */
  async update(versionId, data) {
    return this.prisma.documentVersion.update({
      where: { id: versionId },
      data: data,
    });
  }

  /**
   * @description Menghapus satu versi dokumen dari database.
   */
  async deleteById(versionId) {
    return this.prisma.documentVersion.delete({
      where: { id: versionId },
    });
  }
}
