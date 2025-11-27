/**
 * @interface GroupRepository
 * @description Kontrak untuk operasi data model Group.
 */
export class GroupRepository {
  constructor() {
    if (this.constructor === GroupRepository) {
      throw new Error("Kelas abstrak 'GroupRepository' tidak dapat diinstansiasi secara langsung.");
    }
  }
  async createWithAdmin(adminId, name) {
    throw new Error("Metode 'createWithAdmin' belum diimplementasi.");
  }
  async findById(groupId) {
    throw new Error("Metode 'findById' belum diimplementasi.");
  }
  async update(groupId, data) {
    throw new Error("Metode 'update' belum diimplementasi.");
  }
  async deleteById(groupId) {
    throw new Error("Metode 'deleteById' belum diimplementasi.");
  }
}
