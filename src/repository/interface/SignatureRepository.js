/**
 * @description Abstraksi untuk operasi data pada entitas 'SignaturePersonal'.
 * Repository ini mendefinisikan kontrak dasar untuk interaksi data tanda tangan personal.
 */
export class SignatureRepository {
    /**
     * Membuat data tanda tangan personal baru di database.
     * @param {object} data - Data untuk membuat SignaturePersonal.
     * @param {string} data.userId - ID pemilik tanda tangan.
     * @param {string} data.documentVersionId - ID versi dokumen yang ditandatangani.
     * @param {string} data.signatureUrl - Lokasi/URL file tanda tangan.
     * @param {Date} [data.createdAt] - Tanggal pembuatan tanda tangan (opsional).
     * @returns {Promise<object>} Objek tanda tangan yang baru dibuat.
     * @throws {Error} Jika proses penyimpanan gagal.
     */
    async createPersonal(data) {
        throw new Error("Metode createPersonal belum diimplementasikan.");
    }

    /**
     * Menemukan satu tanda tangan berdasarkan ID uniknya.
     * @param {string} signatureId - ID dari tanda tangan.
     * @returns {Promise<object|null>} Objek tanda tangan jika ditemukan, atau null jika tidak ada.
     * @throws {Error} Jika query database gagal.
     */
    async findById(signatureId) {
        throw new Error("Metode findById belum diimplementasikan.");
    }

    /**
     * Menemukan semua tanda tangan yang terhubung ke satu versi dokumen.
     * @param {string} documentVersionId - ID dari versi dokumen.
     * @returns {Promise<object[]>} Array berisi objek tanda tangan terkait.
     * @throws {Error} Jika query database gagal.
     */
    async findByVersionId(documentVersionId) {
        throw new Error("Metode findByVersionId belum diimplementasikan.");
    }

    /**
     * Memperbarui data tanda tangan berdasarkan ID.
     * @param {string} signatureId - ID tanda tangan yang akan diperbarui.
     * @param {object} data - Data yang akan diperbarui (misalnya: signatureUrl, updatedAt).
     * @returns {Promise<object>} Objek tanda tangan setelah diperbarui.
     * @throws {Error} Jika proses update gagal.
     */
    async update(signatureId, data) {
        throw new Error("Metode update belum diimplementasikan.");
    }
}
