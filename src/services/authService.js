import AuthError from "../errors/AuthError.js";
import CommonError from "../errors/CommonError.js";
import supabaseAuth from "../config/supabaseAuth.js";

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
   */
  async registerUser(email, password, additionalData) {
    if (!password || password.length < 8) {
      throw AuthError.PasswordTooWeak("Password minimal 8 karakter.");
    }
    if (!/[0-9]/.test(password)) {
      throw AuthError.PasswordTooWeak("Password harus mengandung minimal satu angka.");
    }
    if (!/[A-Z]/.test(password)) {
      throw AuthError.PasswordTooWeak("Password harus mengandung minimal satu huruf kapital.");
    }
    if (!/[a-z]/.test(password)) {
      throw AuthError.PasswordTooWeak("Password harus mengandung minimal satu huruf kecil.");
    }

    return this.authRepository.registerUser(email, password, additionalData);
  }

  /**
   * @function loginUser
   * @description Melakukan login user berdasarkan email dan password.
   */
  async loginUser(email, password) {
    return this.authRepository.loginUser(email, password);
  }

  /**
   * @function logoutUser
   * @description Logout user dengan menghapus/invalidasi token.
   */
  async logoutUser() {
    return this.authRepository.logoutUser();
  }

  /**
   * @function forgotPassword
   * @description Meminta reset password dengan email.
   */
  async forgotPassword(email) {
    if (!email) {
      throw AuthError.UserNotFound("Email wajib diisi.");
    }
    return this.authRepository.forgotPassword(email);
  }

  /**
   * @function resetPassword
   * @description Reset password user menggunakan 'code' verifikasi dari email.
   */
  async resetPassword(accessToken, refreshToken, newPassword) {
    if (!accessToken || !refreshToken) {
      throw AuthError.ResetPasswordInvalid("Access token atau refresh token tidak ditemukan.");
    }

    if (!newPassword || newPassword.length < 8) {
      throw AuthError.PasswordTooWeak("Password minimal 8 karakter.");
    }
    if (!/[0-9]/.test(newPassword)) {
      throw AuthError.PasswordTooWeak("Password harus mengandung minimal satu angka.");
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw AuthError.PasswordTooWeak("Password harus mengandung minimal satu huruf kapital.");
    }
    if (!/[a-z]/.test(newPassword)) {
      throw AuthError.PasswordTooWeak("Password harus mengandung minimal satu huruf kecil.");
    }

    const { error: sessionError } = await supabaseAuth.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      console.error("Gagal setSession:", sessionError);
      throw AuthError.ResetPasswordInvalid("Tautan reset password sudah tidak valid atau kedaluwarsa.");
    }

    const { error: updateError } = await supabaseAuth.auth.updateUser({ password: newPassword });

    if (updateError) {
      console.error("Gagal update password:", updateError);
      throw AuthError.ResetPasswordInvalid("Password tidak memenuhi syarat atau token sudah tidak valid.");
    }

    return { message: "Password berhasil diubah." };
  }
}
