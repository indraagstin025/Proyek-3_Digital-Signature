// File: repository/interface/PackageRepository.js

/**
 * @description Interface (kontrak) abstrak untuk Package Repository.
 * Mendefinisikan metode apa saja yang HARUS ada di implementasi
 * (seperti PrismaPackageRepository).
 */
export class PackageRepository {
  constructor() {
    if (this.constructor === PackageRepository) {
      throw new Error("Class abstrak tidak bisa di-instansiasi secara langsung.");
    }
  }

  /**
   * @description Membuat 'SigningPackage' baru dan 'PackageDocument' terkait.
   * @param {string} userId - ID pemilik paket.
   * @param {string} title - Judul paket.
   * @param {string[]} docVersionIds - Array dari ID Versi Dokumen.
   * @returns {Promise<object>} Objek SigningPackage yang baru dibuat.
   */
  async createPackageWithDocuments(userId, title, docVersionIds) {
    throw new Error("Metode 'createPackageWithDocuments' harus diimplementasi.");
  }

  /**
   * @description Menemukan satu SigningPackage berdasarkan ID dan ID pemilik.
   * @param {string} packageId - ID paket.
   * @param {string} userId - ID user (untuk validasi kepemilikan).
   * @returns {Promise<object|null>}
   */
  async findPackageById(packageId, userId) {
    throw new Error("Metode 'findPackageById' harus diimplementasi.");
  }

  /**
   * @description Memperbarui status sebuah SigningPackage.
   * @param {string} packageId - ID paket.
   * @param {string} status - Status baru (misal: "completed").
   * @returns {Promise<object>}
   */
  async updatePackageStatus(packageId, status) {
    throw new Error("Metode 'updatePackageStatus' harus diimplementasi.");
  }

  /**
   * @description Menyimpan (createMany) array dari data tanda tangan paket.
   * @param {Array<object>} signaturesData - Array objek data TTD.
   * @returns {Promise<object>} Hasil dari createMany (jumlah TTD yang dibuat).
   */
  async createPackageSignatures(signaturesData) {
    throw new Error("Metode 'createPackageSignatures' harus diimplementasi.");
  }
}
