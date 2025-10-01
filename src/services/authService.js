import AuthError from "../errors/AuthError.js";
import CommonError from "../errors/CommonError.js";

/**
 * @class AuthService
 * @description Service untuk menangani logika bisnis autentikasi.
 */
export class AuthService {
  /**
   * @constructor
   * @param {import('../repositories/authRepository.js').AuthRepository} authRepository - Dependency repository autentikasi yang di-inject.
   * @throws {CommonError} Jika repository tidak disediakan.
   */
  constructor(authRepository) {
    if (!authRepository) {
      throw CommonError.InternalServerError("AuthRepository harus disediakan.");
    }
    this.authRepository = authRepository;
  }

  /**
   * @function registerUser
   * @description Registrasi user baru. Memvalidasi kekuatan password sebelum mendaftarkan.
   * @param {string} email - Email user baru.
   * @param {string} password - Password user (harus mengandung huruf kapital & angka).
   * @param {object} additionalData - Data tambahan (misalnya nama, role, dll).
   * @throws {AuthError.PasswordTooWeak} Jika password tidak memenuhi kriteria.
   * @returns {Promise<object>} Data user yang berhasil terdaftar.
   */
  async registerUser(email, password, additionalData) {
    if (!/[0-9]/.test(password)) {
      throw AuthError.PasswordTooWeak("Password harus mengandung minimal satu angka.");
    }
    if (!/[A-Z]/.test(password)) {
      throw AuthError.PasswordTooWeak("Password harus mengandung minimal satu huruf kapital.");
    }

    return this.authRepository.registerUser(email, password, additionalData);
  }

  /**
   * @function loginUser
   * @description Melakukan login user berdasarkan email dan password.
   * @param {string} email - Email user.
   * @param {string} password - Password user.
   * @returns {Promise<object>} Data login (misalnya token JWT, info user).
   */
  async loginUser(email, password) {
    return this.authRepository.loginUser(email, password);
  }

  /**
   * @function logoutUser
   * @description Logout user dengan menghapus/invalidasi token.
   * @param {string} token - Token autentikasi yang akan di-logout.
   * @throws {AuthError.MissingToken} Jika token tidak disediakan.
   * @returns {Promise<void>} Hasil logout (misalnya token dihapus dari DB atau cache).
   */
  async logoutUser(token) {
    if (!token) {
      throw AuthError.MissingToken();
    }

    return this.authRepository.logoutUser(token);
  }

  /**
   * @function forgotPassword
   * @description Meminta reset password dengan email (mengirim token reset ke email user).
   * @param {string} email - Email user yang ingin reset password.
   * @throws {AuthError.UserNotFound} Jika email tidak disediakan.
   * @returns {Promise<object>} Informasi proses reset password (misalnya status email terkirim).
   */
  async forgotPassword(email) {
    if (!email) {
      throw AuthError.UserNotFound("Email wajib diisi.");
    }
    return this.authRepository.forgotPassword(email);
  }

  /**
   * @function resetPassword
   * @description Reset password user menggunakan token yang dikirim via email.
   * @param {string} token - Token reset password yang valid.
   * @param {string} newPassword - Password baru minimal 8 karakter.
   * @throws {AuthError.ResetPasswordInvalid} Jika token tidak valid.
   * @throws {AuthError.PasswordTooWeak} Jika password baru terlalu lemah.
   * @returns {Promise<object>} Hasil update password user.
   */
  async resetPassword(token, newPassword) {
    if (!token) throw AuthError.ResetPasswordInvalid();
    if (!newPassword || newPassword.length < 8) {
      throw AuthError.PasswordTooWeak("Password minimal 8 karakter.");
    }

    return this.authRepository.resetPassword(token, newPassword);
  }
}
