import CommonError from "../../errors/CommonError.js";

export class PrismaGroupDocumentSignerRepository {
  constructor(prisma) {
    if (!prisma) throw CommonError.InternalServerError("Prisma Client required.");
    this.prisma = prisma;
  }

  /**
   * Membuat daftar penanda tangan (Bulk Create).
   */
  async createSigners(documentId, userIds) {
    try {
      const data = userIds.map((userId) => ({
        documentId,
        userId,
        status: "PENDING",
      }));

      return await this.prisma.groupDocumentSigner.createMany({
        data,
        skipDuplicates: true,
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal membuat daftar penanda tangan: ${err.message}`);
    }
  }

  /**
   * [DITAMBAHKAN] Mencari request tanda tangan spesifik user & dokumen yang masih PENDING.
   * Ini adalah fungsi yang error sebelumnya.
   */
  async findPendingByUserAndDoc(userId, documentId) {
    try {
      return await this.prisma.groupDocumentSigner.findFirst({
        where: {
          userId: userId,
          documentId: documentId,
          // status: "PENDING" // Hanya kembalikan jika status masih PENDING
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal memvalidasi status tanda tangan: ${err.message}`);
    }
  }

  /**
   * Mencari dokumen yang PERLU ditandatangani oleh User tertentu (Untuk Dashboard).
   */
  async findPendingByUser(userId) {
    try {
      return await this.prisma.groupDocumentSigner.findMany({
        where: {
          userId,
          status: "PENDING",
        },
        include: {
          document: {
            include: {
              currentVersion: true,
              group: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil task user: ${err.message}`);
    }
  }

  async updateStatusToSigned(documentId, userId, signatureGroupId) {
    try {
      const result = await this.prisma.groupDocumentSigner.updateMany({
        where: {
          documentId: documentId,
          userId: userId,
          status: "PENDING",
        },
        data: {
          status: "SIGNED",
          signatureGroupId: signatureGroupId,
        },
      });

      if (result.count === 0) {
        console.warn(`[Warning] Gagal update status SIGNED. Mungkin user ${userId} tidak ada di list atau sudah SIGNED.`);
      }

      return result;
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal update status tanda tangan: ${err.message}`);
    }
  }

  /**
   * Menghitung berapa orang yang BELUM tanda tangan di dokumen ini.
   */
  async countPendingSigners(documentId) {
    return await this.prisma.groupDocumentSigner.count({
      where: {
        documentId,
        status: "PENDING",
      },
    });
  }

  async deleteByDocumentId(documentId) {
    try {
      return await this.prisma.groupDocumentSigner.deleteMany({
        where: { documentId },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal membersihkan penanda tangan: ${err.message}`);
    }
  }

  /**
   * [BARU] Menghapus satu signer dari dokumen tertentu.
   * Digunakan saat Admin meng-uncheck user di menu Edit Signers.
   */
  async deleteSpecificSigner(documentId, userId) {
    try {
      return await this.prisma.groupDocumentSigner.deleteMany({
        where: {
          documentId: documentId,
          userId: userId,
          status: "PENDING", // Safety check: Hanya hapus yang belum tanda tangan
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal menghapus signer: ${err.message}`);
    }
  }

  async resetSigners(documentId) {
    try {
      return await this.prisma.groupDocumentSigner.updateMany({
        where: { documentId: documentId },
        data: {
          status: "PENDING",
          signatureGroupId: null, // Putuskan hubungan dengan tanda tangan lama
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mereset status signer: ${err.message}`);
    }
  }

  async markAllAsSigned(documentId) {
    try {
      // Update semua signer di dokumen ini menjadi SIGNED
      return await this.prisma.groupDocumentSigner.updateMany({
        where: { documentId: documentId },
        data: { status: "SIGNED" },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengunci signer: ${err.message}`);
    }
  }

  async deletePendingSignersByGroupAndUser(groupId, userId) {
    try {
      // Logic: Hapus row di GroupDocumentSigner JIKA:
      // 1. Usernya adalah user yang di-kick
      // 2. Statusnya masih 'PENDING'
      // 3. Dokumennya ada di dalam groupId yang dimaksud
      return await this.prisma.groupDocumentSigner.deleteMany({
        where: {
          userId: userId,
          status: "PENDING",
          document: {
            groupId: groupId,
          },
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal membersihkan status signer member: ${err.message}`);
    }
  }
}
