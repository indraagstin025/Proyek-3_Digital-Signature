import CommonError from "../../errors/CommonError.js";

/**
 * @class PrismaDashboardRepository
 * @description Implementasi Repository untuk mengambil data agregat Dashboard menggunakan Prisma ORM.
 */
export class PrismaDashboardRepository {
  /**
   * @constructor
   * @param {import("@prisma/client").PrismaClient} prisma - Dependency Prisma Client yang di-inject.
   * @throws {CommonError} Jika Prisma Client tidak disediakan.
   */
  constructor(prisma) {
    if (!prisma) {
      throw CommonError.InternalServerError("Prisma Client harus disediakan.");
    }
    this.prisma = prisma;
  }

  /**
   * @function countAllStatuses
   * @description Menghitung jumlah dokumen yang dikelompokkan berdasarkan statusnya (draft, pending, completed).
   * @param {string} userId - ID pengguna.
   * @returns {Promise<Object>} Object berisi jumlah count per status.
   */
  async countAllStatuses(userId) {
    try {
      const result = await this.prisma.document.groupBy({
        by: ["status"],
        where: { userId: userId },
        _count: { status: true },
      });

      return result.reduce(
          (acc, curr) => {
            acc[curr.status] = curr._count.status;
            return acc;
          },
          { draft: 0, pending: 0, completed: 0 }
      );
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal menghitung status dokumen: ${err.message}`);
    }
  }

  /**
   * @function findPendingSignatures
   * @description Mencari permintaan tanda tangan PERSONAL yang belum dikerjakan oleh user.
   * @param {string} userId - ID pengguna.
   * @param {number} limit - Batas jumlah data.
   */
  async findPendingSignatures(userId, limit = 3) {
    try {
      return await this.prisma.signaturePersonal.findMany({
        where: {
          signerId: userId,
          signatureImageUrl: "", // Belum ada tanda tangan
          documentVersion: {
            document: {
              status: "pending", // Hanya dokumen yang masih aktif
            },
          },
        },
        take: limit,
        orderBy: { signedAt: "desc" }, // Sort berdasarkan waktu request (bisa disesuaikan createdAt)
        include: {
          documentVersion: {
            include: {
              document: {
                select: {
                  id: true,
                  title: true,
                  updatedAt: true,
                  owner: { select: { name: true, email: true } },
                },
              },
            },
          },
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil pending signatures: ${err.message}`);
    }
  }

  /**
   * @function findActionRequiredDocuments
   * @description Mencari dokumen milik user sendiri yang masih draft atau pending (Action Required).
   */
  async findActionRequiredDocuments(userId, limit = 3) {
    try {
      return await this.prisma.document.findMany({
        where: {
          userId: userId,
          status: { in: ["draft", "pending"] },
        },
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          owner: { select: { name: true, email: true } },
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil dokumen action required: ${err.message}`);
    }
  }

  /**
   * @function findRecentUpdatedDocuments
   * @description Mengambil dokumen yang baru saja diedit oleh user.
   */
  async findRecentUpdatedDocuments(userId, limit = 5) {
    try {
      return await this.prisma.document.findMany({
        where: { userId: userId },
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, status: true, updatedAt: true, groupId: true},
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil dokumen terbaru: ${err.message}`);
    }
  }

  /**
   * @function findRecentSignatures
   * @description Mengambil riwayat tanda tangan PERSONAL yang sudah selesai.
   */
  async findRecentSignatures(userId, limit = 5) {
    try {
      return await this.prisma.signaturePersonal.findMany({
        where: {
          signerId: userId,
          signatureImageUrl: { not: "" }, // Sudah ada gambar tanda tangan
        },
        take: limit,
        orderBy: { signedAt: "desc" },
        include: {
          documentVersion: {
            include: {
              document: {
                select: { id: true, title: true, status: true, groupId: true },
              },
              packages: { select: { id: true } },
            },
          },
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil riwayat tanda tangan personal: ${err.message}`);
    }
  }

  /**
   * @function findRecentGroupSignatures
   * @description Mengambil riwayat tanda tangan GRUP yang sudah selesai.
   */
  async findRecentGroupSignatures(userId, limit = 5) {
    try {
      return await this.prisma.signatureGroup.findMany({
        where: {
          signerId: userId,
          // Biasanya signatureGroup row dibuat saat assign, status dicek lewat field status/img
          status: "signed", // Pastikan field ini sesuai schema Prisma Anda (misal: status='signed' atau check signatureImageUrl)
        },
        take: limit,
        orderBy: { signedAt: "desc" },
        include: {
          documentVersion: {
            include: {
              document: {
                select: { id: true, title: true, status: true, groupId: true },
              },
            },
          },
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil riwayat tanda tangan grup: ${err.message}`);
    }
  }

  /**
   * @function findRecentPackageSignatures
   * @description Mengambil riwayat tanda tangan PAKET yang sudah selesai.
   */
  async findRecentPackageSignatures(userId, limit = 5) {
    try {
      return await this.prisma.packageSignature.findMany({
        where: { signerId: userId },
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          packageDocument: {
            include: {
              package: {
                select: { id: true, title: true, status: true },
              },
              docVersion: {
                include: {
                  document: {
                    select: { id: true, title: true },
                  },
                },
              },
            },
          },
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil riwayat tanda tangan paket: ${err.message}`);
    }
  }
}