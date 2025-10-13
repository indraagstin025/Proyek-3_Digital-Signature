/**
 * @description Implementasi Repository untuk model 'Document' menggunakan Prisma.
 */
export class PrismaDocumentRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * @description Membuat Dokumen baru beserta Versi pertamanya dalam satu transaksi.
   * @param {string} userId - ID pemilik.
   * @param {string} title - Judul dokumen.
   * @param {string} url - URL file untuk versi pertama.
   * @param {string} hash - Hash file untuk versi pertama
   * @returns {Promise<object>} Objek dokumen yang baru dibuat, termasuk data versi pertamanya.
   */
  async createWithFirstVersion(userId, title, url, hash) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          userId,
          title,
        },
      });

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          userId: userId,
          url,
          hash,
        },
      });

      const updatedDocument = await tx.document.update({
        where: { id: document.id },
        data: { currentVersionId: version.id },
        include: {
          currentVersion: true,
        },
      });

      return updatedDocument;
    });
  }

  /**
   * @description Mengambil semua dokumen milik user, beserta detail versi terkininya DAN tanda tangannya.
   */
  async findAllByUserId(userId) {
    return this.prisma.document.findMany({
      where: { userId },
      include: {
        currentVersion: {
          include: {
            signaturesPersonal: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * @description Mencari satu dokumen berdasarkan ID, beserta detail versi terkininya DAN tanda tangannya.
   */
  async findById(documentId, userId) {
    return this.prisma.document.findFirst({
      where: {
        id: documentId,
        userId: userId,
      },
      include: {
        currentVersion: {
          include: {
            signaturesPersonal: true,
          },
        },
      },
    });
  }

  /**
   * @description Memperbarui data pada tabel Dokumen (misal: title atau currentVersionId).
   */
  async update(documentId, dataToUpdate) {
    return this.prisma.document.update({
      where: { id: documentId },
      data: dataToUpdate,
      include: {
        currentVersion: true,
      },
    });
  }

  /**
   * @description Menghapus record dokumen dari database berdasarkan ID.
   * Karena ada `onDelete: Cascade` di skema, ini akan otomatis menghapus semua versinya.
   */
  async deleteById(documentId) {
    return this.prisma.document.delete({
      where: { id: documentId },
    });
  }
}
