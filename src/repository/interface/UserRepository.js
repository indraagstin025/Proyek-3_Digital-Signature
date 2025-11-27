/**
 * @description Abstraksi untuk operasi data pengguna.
 * Semua repository user (misalnya Prisma, Mongo, dll) harus mengimplementasikan class ini.
 */
class UserRepository {
  /**
   * Membuat pengguna baru di database.
   * @param {object} userData - Data pengguna yang akan dibuat.
   * @param {string} userData.email - Email unik pengguna.
   * @param {string} userData.passwordHash - Hash password pengguna.
   * @param {string} [userData.name] - Nama lengkap pengguna.
   * @param {string} [userData.phoneNumber] - Nomor telepon pengguna.
   * @param {string} [userData.address] - Alamat pengguna.
   * @returns {Promise<object>} Data pengguna yang berhasil dibuat.
   * @throws {Error} Jika penyimpanan gagal.
   */
  async createUser(userData) {
    throw new Error("Metode createUser belum diimplementasikan.");
  }

  /**
   * Mencari pengguna berdasarkan ID unik.
   * @param {string} id - ID pengguna.
   * @returns {Promise<object|null>} Objek data pengguna jika ditemukan, atau null jika tidak ada.
   * @throws {Error} Jika query database gagal.
   */
  async findById(id) {
    throw new Error("Metode findById belum diimplementasikan.");
  }

  /**
   * Mengambil semua pengguna dari database.
   * @returns {Promise<object[]>} Daftar semua pengguna.
   * @throws {Error} Jika query database gagal.
   */
  async findAll() {
    throw new Error("Metode findAll belum diimplementasikan.");
  }

  /**
   * Memperbarui data pengguna tertentu.
   * @param {string} id - ID pengguna yang akan diperbarui.
   * @param {object} data - Data baru yang akan diperbarui.
   * @param {string} [data.name] - Nama baru pengguna.
   * @param {string} [data.phoneNumber] - Nomor telepon baru.
   * @param {string} [data.address] - Alamat baru.
   * @param {string} [data.profilePictureUrl] - URL foto profil baru.
   * @returns {Promise<object>} Data pengguna yang telah diperbarui.
   * @throws {Error} Jika proses update gagal.
   */
  async update(id, data) {
    throw new Error("Metode update belum diimplementasikan.");
  }
}

export default UserRepository;
