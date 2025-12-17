import { GroupMemberRepository } from "../interface/GroupMemberRepository.js";
import CommonError from "../../errors/CommonError.js";

/**
 * @description Implementasi Repository untuk model 'GroupMember' menggunakan Prisma.
 */
export class PrismaGroupMemberRepository extends GroupMemberRepository {
  constructor(prisma) {
    super();
    if (!prisma) {
      throw CommonError.InternalServerError("Prisma client tidak ditemukan.");
    }
    this.prisma = prisma;
  }

  /**
   * @description Mencari data keanggotaan spesifik berdasarkan groupId dan userId.
   * @param {number} groupId - ID grup (INT).
   * @param {string} userId - ID user (UUID String).
   * @returns {Promise<object|null>} Objek keanggotaan atau null.
   */
  async findByGroupAndUser(groupId, userId) {
    try {
      return await this.prisma.groupMember.findFirst({
        where: {
          groupId,
          userId,
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mencari anggota grup: ${err.message}`);
    }
  }

  /**
   * @description Menemukan semua keanggotaan grup dari seorang user.
   * @param {string} userId - ID user (UUID String).
   * @param {object} options - Opsi Prisma (misal: { include: { group: true } }).
   * @returns {Promise<object[]>} Array keanggotaan.
   */
  async findAllByUserId(userId, options = {}) {
    try {
      return await this.prisma.groupMember.findMany({
        where: { userId },
        ...options,
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil daftar grup user: ${err.message}`);
    }
  }

  /**
   * @description Transaksi untuk menerima undangan:
   * 1. Membuat anggota baru.
   * 2. [UPDATE] Cek Logic Limit: Kurangi usageLimit jika ada. Set 'used' hanya jika limit habis.
   * @param {object} invitation - Objek undangan yang valid.
   * @param {string} userId - ID user yang menerima.
   * @returns {Promise<object>} Objek GroupMember yang baru.
   */
  async createFromInvitation(invitation, userId) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. CEK WAKTU (Validasi Utama Anda)
        if (invitation.expiresAt < new Date()) {
          throw CommonError.BadRequest("Undangan telah kedaluwarsa.");
        }

        // 2. CEK LIMIT (Hanya jika diset angka, jika null lewat saja)
        if (typeof invitation.usageLimit === "number" && invitation.usageLimit <= 0) {
          throw CommonError.BadRequest("Kuota undangan ini sudah habis.");
        }

        // 3. Masukkan User ke Grup
        const newMember = await tx.groupMember.create({
          data: {
            groupId: invitation.groupId,
            userId: userId,
            role: invitation.role,
          },
        });

        // 4. LOGIKA UPDATE (Hanya jalan jika Anda suatu saat pakai limit angka)
        // Jika usageLimit NULL (Unlimited), blok ini TIDAK AKAN DIJALANKAN.
        if (typeof invitation.usageLimit === "number") {
          const updatedInvite = await tx.groupInvitation.update({
            where: { id: invitation.id },
            data: {
              usageLimit: { decrement: 1 },
            },
          });

          if (updatedInvite.usageLimit <= 0) {
            await tx.groupInvitation.update({
              where: { id: invitation.id },
              data: { status: "used" },
            });
          }
        }

        return newMember;
      });
    } catch (err) {
      if (err instanceof CommonError) throw err;
      throw CommonError.DatabaseError(`Gagal memproses penerimaan undangan: ${err.message}`);
    }
  }

  /**
   * @description Menghapus keanggotaan berdasarkan ID unik record GroupMember.
   * @param {number} memberId - ID unik dari tabel GroupMember (INT).
   * @returns {Promise<object>}
   */
  async deleteById(memberId) {
    try {
      return await this.prisma.groupMember.delete({
        where: { id: memberId },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal menghapus anggota grup: ${err.message}`);
    }
  }
}
