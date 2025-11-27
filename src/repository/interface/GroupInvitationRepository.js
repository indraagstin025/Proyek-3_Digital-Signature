/**
 * @interface GroupInvitationRepository
 * @description Kontrak untuk operasi data model GroupInvitation.
 */
export class GroupInvitationRepository {
  constructor() {
    if (this.constructor === GroupInvitationRepository) {
      throw new Error("Kelas abstrak 'GroupInvitationRepository' tidak dapat diinstansiasi secara langsung.");
    }
  }
  async create(data) {
    throw new Error("Metode 'create' belum diimplementasi.");
  }
  async findByToken(token) {
    throw new Error("Metode 'findByToken' belum diimplementasi.");
  }
  async updateStatus(invitationId, status) {
    throw new Error("Metode 'updateStatus' belum diimplementasi.");
  }
}
