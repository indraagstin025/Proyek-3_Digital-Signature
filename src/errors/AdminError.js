import BaseError from "./BaseError.js";

class AdminError extends BaseError {
  /**
   * @param {string} code
   * @param {number} statusCode
   * @param {string} message
   */
  constructor(code, statusCode, message) {
    super(code, statusCode, message);
  }

  /**
   * Static method untuk error 403 Forbidden.
   * Digunakan saat user non-admin mencoba mengakses resource admin.
   * @param {string} message
   * @returns {AdminError}
   */
  static Forbidden(message = "Akses ditolak. Anda tidak memiliki hak akses admin.") {
    return new AdminError("FORBIDDEN_ACCESS", 403, message);
  }

  /**
   * Contoh static method lain yang mungkin berguna.
   * Digunakan saat admin mencoba melakukan aksi yang tidak diizinkan pada dirinya sendiri.
   * @param {string} message
   * @returns {AdminError}
   */
  static SelfActionNotAllowed(message = "Tindakan ini tidak dapat dilakukan pada akun admin sendiri.") {
    return new AdminError("SELF_ACTION_NOT_ALLOWED", 400, message);
  }
}

export default AdminError;
