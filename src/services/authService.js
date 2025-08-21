/**
 * @description Kelas layanan untuk menangani logika bisnis autentikasi pengguna.
 * Kelas ini bergantung pada sebuah abstraksi (AuthRepository)
 * dan tidak peduli dengan detail implementasi database atau autentikasi.
 */
export class AuthService {
    /**
     * @description Konstruktor untuk menginjeksi dependensi repository.
     * @param {object} authRepository - Instance dari kelas yang mengimplementasikan AuthRepository.
     */
    constructor(authRepository) {
        if (!authRepository) {
            throw new Error('AuthRepository harus disediakan.');
        }
        this.authRepository = authRepository;
    }

    /**
     * @description Mendaftarkan pengguna baru.
     * @param {string} email
     * @param {string} password
     * @param {object} additionalData
     * @returns {Promise<object>}
     */
    async registerUser(email, password, additionalData) {
        if (password.length < 8) {
            throw new Error('Password harus memiliki minimal 8 Karakter. ');
        }

        if (!/\d/.test(password)) {
            throw new Error('Paasword harus mengandung setidaknya satu angka. ');
        }
        return this.authRepository.registerUser(email, password, additionalData);
    }

    /**
     * @description Mengautentikasi pengguna.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<object>}
     */
    async loginUser(email, password) {
        return this.authRepository.loginUser(email, password);
    }

    /**
     * @description Melakukan logout pengguna.
     * @returns {Promise<void>}
     */
    async logoutUser() {
        return this.authRepository.logoutUser();
    }

    /**
     * @description Meminta email untuk reset password.
     * @param {string} email
     * @returns {Promise<object>}
     */
    async forgotPassword(email) {
        return this.authRepository.forgotPassword(email);
    }

    /**
     * @description Mereset password pengguna.
     * @param {string} token
     * @param {string} newPassword
     * @returns {Promise<object>}
     */
    async resetPassword(token, newPassword) {
        return this.authRepository.resetPassword(token, newPassword);
    }
}