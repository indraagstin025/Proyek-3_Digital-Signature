import AuthError from '../errors/AuthError.js';
import CommonError from '../errors/CommonError.js'; // Mungkin diperlukan untuk error internal

/**
 * @description Service untuk menangani logika bisnis autentikasi.
 */
export class AuthService {
    /**
     * @param {AuthRepository} authRepository - Dependency yang diinject
     */
    constructor(authRepository) {
        if (!authRepository) {
            // Melempar error jika dependensi tidak ada adalah hal yang benar
            throw CommonError.InternalServerError("AuthRepository harus disediakan.");
        }
        this.authRepository = authRepository;
    }

    /**
     * @description Registrasi user baru.
     */
    async registerUser(email, password, additionalData) {
        // ✅ Logika bisnis seperti ini TEPAT berada di service.
        if (!/[0-9]/.test(password)) {
            throw AuthError.PasswordTooWeak("Password harus mengandung minimal satu angka.");
        }
        if (!/[A-Z]/.test(password)) {
            throw AuthError.PasswordTooWeak("Password harus mengandung minimal satu huruf kapital.");
        }
        // ... validasi bisnis lainnya

        // ❌ Blok try...catch dihapus.
        // Kita percaya repository akan memberikan error yang benar jika gagal.
        return this.authRepository.registerUser(email, password, additionalData);
    }

    /**
     * @description Login user
     */
    async loginUser(email, password) {
        // ❌ Blok try...catch dihapus.
        // Service hanya memanggil repository. Jika repository melempar AuthError.InvalidCredentials,
        // error itu akan langsung diteruskan ke controller.
        return this.authRepository.loginUser(email, password);
    }

    /**
     * @description Logout user
     */
    async logoutUser(token) {
        // ✅ Validasi input sederhana tetap di sini.
        if (!token) {
            throw AuthError.MissingToken();
        }
        // ❌ Blok try...catch dihapus.
        return this.authRepository.logoutUser(token);
    }

    /**
     * @description Request forgot password
     */
    async forgotPassword(email) {
        if (!email) {
            // Ini bisa dianggap validasi, tapi lebih baik ditangani oleh express-validator.
            // Namun, tidak masalah jika tetap di sini.
            throw AuthError.UserNotFound("Email wajib diisi.");
        }
        return this.authRepository.forgotPassword(email);
    }

    /**
     * @description Reset password dengan token dari email
     */
    async resetPassword(token, newPassword) {
        // ✅ Validasi bisnis untuk password baru ada di sini.
        if (!token) throw AuthError.ResetPasswordInvalid();
        if (!newPassword || newPassword.length < 8) {
            throw AuthError.PasswordTooWeak("Password minimal 8 karakter.");
        }

        // ❌ Blok try...catch dihapus.
        return this.authRepository.resetPassword(token, newPassword);
    }
}