/**
 * @description Abstraksi untuk operasi pada entitas 'Document'.
 * Mendefinisikan kontrak yang harus diikuti oleh implementasi konkret (misal: PrismaDocumentRepository).
 */
export class DocumentRepository {
  /**
   * Membuat dokumen baru beserta versi pertamanya.
   * @abstract
   * @param {string} userId - ID pengguna pemilik dokumen.
   * @param {string} title - Judul dokumen.
   * @param {string} url - URL lokasi penyimpanan dokumen (misalnya di Supabase/Cloud Storage).
   * @param {string} hash - Hash unik untuk validasi integritas dokumen.
   * @returns {Promise<object>} Dokumen yang berhasil dibuat.
   * @throws {Error} Jika metode belum diimplementasikan.
   */
  async createWithFirstVersion(userId, title, url, hash) {
    throw new Error("Metode createWithFirstVersion belum diimplementasikan.");
  }

  /**
   * Menemukan semua dokumen milik seorang user.
   * @abstract
   * @param {string} userId - ID pengguna pemilik dokumen.
   * @returns {Promise<object[]>} Array daftar dokumen.
   * @throws {Error} Jika metode belum diimplementasikan.
   */
  async findAllByUserId(userId) {
    throw new Error("Metode findAllByUserId belum diimplementasikan.");
  }

  /**
   * Menemukan satu dokumen berdasarkan ID dokumen dan ID user.
   * @abstract
   * @param {string} documentId - ID dokumen.
   * @param {string} userId - ID pengguna pemilik dokumen.
   * @returns {Promise<object|null>} Dokumen yang ditemukan atau null jika tidak ada.
   * @throws {Error} Jika metode belum diimplementasikan.
   */
  async findById(documentId, userId) {
    throw new Error("Metode findById belum diimplementasikan.");
  }

  /**
   * Memperbarui data pada record dokumen.
   * @abstract
   * @param {string} documentId - ID dokumen yang akan diperbarui.
   * @param {object} dataToUpdate - Data baru untuk memperbarui dokumen.
   * @returns {Promise<object>} Dokumen yang sudah diperbarui.
   * @throws {Error} Jika metode belum diimplementasikan.
   */
  async update(documentId, dataToUpdate) {
    throw new Error("Metode update belum diimplementasikan.");
  }

  /**
   * Menghapus dokumen berdasarkan ID.
   * @abstract
   * @param {string} documentId - ID dokumen yang akan dihapus.
   * @returns {Promise<void>} Konfirmasi penghapusan.
   * @throws {Error} Jika metode belum diimplementasikan.
   */
  async deleteById(documentId) {
    throw new Error("Metode deleteById belum diimplementasikan.");
  }
}
