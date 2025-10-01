/**
 * @description Abstraksi untuk operasi autentikasi pengguna.
 * Implementasi bisa menggunakan Supabase, Firebase, dsb.
 */
class AuthRepository {
    /**
     * Mendaftarkan pengguna baru.
     * @abstract
     * @param {string} email - Email pengguna.
     * @param {string} password - Password pengguna.
     * @param {object} [additionalData] - Data tambahan seperti nama atau profil.
     * @returns {Promise<object>} Data pengguna yang berhasil terdaftar.
     * @throws {Error} Jika metode belum diimplementasikan.
     */
    async registerUser(email, password, additionalData) {
        throw new Error("Metode registerUser belum diimplementasikan.");
    }

    /**
     * Melakukan login pengguna.
     * @abstract
     * @param {string} email - Email pengguna.
     * @param {string} password - Password pengguna.
     * @returns {Promise<object>} Token autentikasi atau sesi pengguna.
     * @throws {Error} Jika metode belum diimplementasikan.
     */
    async loginUser(email, password) {
        throw new Error("Metode loginUser belum diimplementasikan.");
    }

    /**
     * Melakukan logout pengguna.
     * @abstract
     * @param {string} token - Token sesi atau akses pengguna.
     * @returns {Promise<void>} Konfirmasi logout berhasil.
     * @throws {Error} Jika metode belum diimplementasikan.
     */
    async logoutUser(token) {
        throw new Error("Metode logoutUser belum diimplementasikan.");
    }

    /**
     * Mengirimkan email reset password ke pengguna.
     * @abstract
     * @param {string} email - Email pengguna.
     * @returns {Promise<void>} Konfirmasi bahwa email reset terkirim.
     * @throws {Error} Jika metode belum diimplementasikan.
     */
    async forgotPassword(email) {
        throw new Error("Metode forgotPassword belum diimplementasikan.");
    }

    /**
     * Mereset password pengguna dengan token valid.
     * @abstract
     * @param {string} token - Token untuk verifikasi reset password.
     * @param {string} newPassword - Password baru yang akan disimpan.
     * @returns {Promise<void>} Konfirmasi reset password berhasil.
     * @throws {Error} Jika metode belum diimplementasikan.
     */
    async resetPassword(token, newPassword) {
        throw new Error("Metode resetPassword belum diimplementasikan.");
    }
}

export default AuthRepository;
