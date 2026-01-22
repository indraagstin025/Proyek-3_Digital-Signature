import { GroupRepository } from "../interface/GroupRepository.js";
import CommonError from "../../errors/CommonError.js";

/**
 * @description Implementasi Repository untuk model 'Group' menggunakan prisma.
 */
export class PrismaGroupRepository extends GroupRepository {
  constructor(prisma) {
    super();
    if (!prisma) {
      throw CommonError.InternalServerError("Prisma Client tidak ditemukan.");
    }
    this.prisma = prisma;
  }

  /**
   * @description Membuat Grup baru dan Anggota (admin) pertamanya dalam satu transaksi.
   * @param {string} adminId - ID pemilik (User ID).
   * @param {string} name - Nama grup.
   * @returns {Promise<object>} Objek grup yang baru dibuat.
   */
  async createWithAdmin(adminId, name) {
    try {
      const start = Date.now();
      const result = await this.prisma.$transaction(async (tx) => {
        const group = await tx.group.create({
          data: {
            name,
            adminId,
          },
        });

        await tx.groupMember.create({
          data: {
            groupId: group.id,
            userId: adminId,
            role: "admin_group",
          },
        });
        return group;
      });
      return result;
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal membuat grup di database: ${err.message}`);
    }
  }

  /**
   * @description Mencari satu grup berdasarkan ID-nya (INT).
   * @param {number} groupId - ID grup (Ingat, ini adalah INT).
   * @returns {Promise<object>} Objek grup, termasuk admin dan anggotanya.
   */
  /**
   * @description Mencari satu grup berdasarkan ID-nya (INT).
   * [UPDATED] Mengambil status Admin dan Member untuk validasi Limit di Frontend.
   */
  async findById(groupId) {
    try {
      const start = Date.now();
      const result = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
              userStatus: true,
              premiumUntil: true
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  userStatus: true,
                  profilePictureUrl: true
                },
              },
            },
          },
          documents: {
            orderBy: { createdAt: "desc" },
            include: {
              currentVersion: true,
              signerRequests: {
                include: {
                  user: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
      return result;
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mencari grup: ${err.message}`);
    }
  }

  async update(groupId, data) {
    try {
      return await this.prisma.group.update({
        where: { id: groupId },
        data,
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal memperbarui grup: ${err.message}`);
    }
  }

  async countByAdminId(adminId) {
    try {
      const start = Date.now();
      const result = await this.prisma.group.count({
        where: { adminId: adminId },
      });
      return result;
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal menghitung jumlah grup admin: ${err.message}`);
    }
  }

  async deleteById(groupId) {
    try {
      return await this.prisma.group.delete({
        where: { id: groupId },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal menghapus grup: ${err.message}`);
    }
  }
}
