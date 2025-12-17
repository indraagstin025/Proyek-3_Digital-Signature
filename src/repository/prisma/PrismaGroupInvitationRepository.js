import { GroupInvitationRepository } from "../interface/GroupInvitationRepository.js";
import CommonError from "../../errors/CommonError.js";

/**
 * @description Implementasi Repository untuk model 'GroupInvitation' menggunakan Prisma.
 */
export class PrismaGroupInvitationRepository extends GroupInvitationRepository {
  constructor(prisma) {
    super();
    if (!prisma) {
      throw CommonError.InternalServerError("Prisma client tidak ditemukan.");
    }
    this.prisma = prisma;
  }

  /**
   * @description Membuat record undangan baru.
   * @param {object} data - Data untuk undangan baru.
   * @returns {Promise<object>}
   */
  async create(data) {
    try {
      return await this.prisma.groupInvitation.create({
        data,
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal membuat undangan: ${err.message}`);
    }
  }

  /**
   * @description Mencari undangan berdasarkan token uniknya.
   * @param {string} token - Token undangan.
   * @returns {Promise<object|null>}
   */
  async findByToken(token) {
    try {
      return await this.prisma.groupInvitation.findUnique({
        where: { token },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mencari undangan: ${err.message}`);
    }
  }

  /**
   * [UPDATED] Mengganti 'updateStatus' menjadi 'update' yang lebih fleksibel.
   * Ini memungkinkan kita mengupdate 'usageLimit' dan 'status' secara bersamaan.
   * @param {number} invitationId - ID undangan.
   * @param {object} data - Object data yang ingin diupdate (misal: { status: 'used', usageLimit: 0 }).
   */
  async update(invitationId, data) {
    try {
      return await this.prisma.groupInvitation.update({
        where: { id: invitationId },
        data: data,
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal memperbarui data undangan: ${err.message}`);
    }
  }
}
