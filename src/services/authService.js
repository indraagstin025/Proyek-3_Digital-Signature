import AuthError from "../errors/AuthError.js";

/**
 * @description Kelas layanan untuk menangani logika bisnis autentikasi pengguna.
 */
export class AuthService {
    /**
     * @description Konstruktor untuk melakukan dependency injection pada repository.
     * @param {object} authRepository - Instance dari kelas yang mengimplementasikan AuthRepository.
     */
    constructor(authRepository) {
        if (!authRepository) {
            throw new Error('AuthRepository harus disediakan');
        }
        this.authRepository = authRepository;
    }

    /**
     * @description Fungsi ini buat user untuk melakukan
     * registrasi dan ada kode validasi passwordnya.
     * @param {string} email
     * @param {string} password
     * @param {object} additionalData
     * @returns {Promise<*|Object>}
     */
    async registerUser(email, password, additionalData) {
        if (!password || password.length < 8 ) {
            throw AuthError.PasswordTooWeak('Password harus memiliki minimal 8 karakter.');
        }

        if (!/\d/.test(password)) {
            throw AuthError.PasswordTooWeak('Password harus mengandung setidaknya satu angka.');
        }

        return this.authRepository.registerUser(email, password, additionalData);
    }

    /**
     * @description Fungsi untuk melakukan autentikasi atau login untuk User
     * dengan memasukkan email dan password.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<*|Object>}
     */
    async loginUser(email, password) {
        return this.authRepository.loginUser(email, password);
    }

    /**
     * @description Buat logout User
     * @returns {Promise<void>}
     */
    async logoutUser(){
        return this.authRepository.logoutUser();
    }

    /**
     * @description Fungsi ini buat user jika lupa password.
     * @param {string} email
     * @returns {Promise<object>}
     */
    async forgotPassword(email) {
        return this.authRepository.forgotPassword(email);
    }

    /**
     * @description Buat resep password pengguna.
     * @param {string} token - Token reset password dari email.
     * @param {string} newPassword - Password baru
     * @returns {Promise<object>}
     */
    async resetPassword(token, newPassword) {
        return this.authRepository.resetPassword(token, newPassword);
    }
}
