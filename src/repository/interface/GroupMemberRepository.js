/**
 * @interface GroupMemberRepository
 * @description Kontrak untuk operasi data model GroupMember.
 */
export class GroupMemberRepository {
  constructor() {
    if (this.constructor === GroupMemberRepository) {
      throw new Error("Kelas abstrak 'GroupMemberRepository' tidak dapat diinstansiasi secara langsung.");
    }
  }
  async findByGroupAndUser(groupId, userId) {
    throw new Error("Metode 'findByGroupAndUser' belum diimplementasi.");
  }
  async findAllByUserId(userId, options) {
    throw new Error("Metode 'findAllByUserId' belum diimplementasi.");
  }
  async createFromInvitation(invitation, userId) {
    throw new Error("Metode 'createFromInvitation' belum diimplementasi.");
  }
  async deleteById(memberId) {
    throw new Error("Metode 'deleteById' belum diimplementasi.");
  }
}
