/**
 * @description Abstraksi untuk operasi pada entitas 'DocumentVersion'.
 * Mendefinisikan kontrak yang harus diikuti oleh implementasi konkret
 * (misalnya: PrismaVersionRepository, MongoVersionRepository, dsb).
 */
export class VersionRepository {
    /**
     * Membuat record versi dokumen baru.
     * @param {object} data - Data versi dokumen.
     * @param {string} data.documentId - ID dokumen induk.
     * @param {string} data.userId - ID pengguna yang mengunggah versi ini.
     * @param {string} data.url - URL file versi dokumen.
     * @param {string} data.hash - Hash SHA256 file versi.
     * @returns {Promise<object>} Objek versi dokumen yang berhasil dibuat.
     * @throws {Error} Jika proses penyimpanan gagal.
     */
    async create(data) {
        throw new Error("Metode create belum diimplementasikan.");
    }

    /**
     * Menemukan versi dokumen berdasarkan ID user dan hash file.
     * Digunakan untuk mencegah duplikasi file versi.
     * @param {string} userId - ID pengguna.
     * @param {string} hash - Hash SHA256 file.
     * @returns {Promise<object|null>} Objek versi dokumen jika ditemukan, atau null jika tidak ada.
     * @throws {Error} Jika query database gagal.
     */
    async findByUserAndHash(userId, hash) {
        throw new Error("Metode findByUserAndHash belum diimplementasikan.");
    }

    /**
     * Menemukan satu versi dokumen berdasarkan ID uniknya.
     * @param {string} versionId - ID versi dokumen.
     * @returns {Promise<object|null>} Objek versi dokumen jika ditemukan, atau null.
     * @throws {Error} Jika query database gagal.
     */
    async findById(versionId) {
        throw new Error("Metode findById belum diimplementasikan.");
    }

    /**
     * Mengambil semua versi yang dimiliki oleh satu dokumen.
     * @param {string} documentId - ID dokumen induk.
     * @returns {Promise<object[]>} Array berisi semua versi dokumen.
     * @throws {Error} Jika query database gagal.
     */
    async findAllByDocumentId(documentId) {
        throw new Error("Metode findAllByDocumentId belum diimplementasikan.");
    }

    /**
     * Memperbarui data pada record versi dokumen.
     * @param {string} versionId - ID versi yang akan diperbarui.
     * @param {object} data - Data untuk diperbarui (misalnya: { signedFileHash: string, url: string }).
     * @returns {Promise<object>} Objek versi dokumen yang telah diperbarui.
     * @throws {Error} Jika update gagal.
     */
    async update(versionId, data) {
        throw new Error("Metode update belum diimplementasikan.");
    }

    /**
     * Menghapus satu versi dokumen berdasarkan ID.
     * @param {string} versionId - ID versi dokumen.
     * @returns {Promise<void>} Tidak ada nilai kembali jika berhasil.
     * @throws {Error} Jika penghapusan gagal.
     */
    async deleteById(versionId) {
        throw new Error("Metode deleteById belum diimplementasikan.");
    }
}
