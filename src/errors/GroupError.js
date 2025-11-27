import BaseError from "./BaseError.js";

/**
 * @description Error kustom untuk semua operasi yang terkait dengan Grup,
 * Anggota Grup, dan Undangan Grup.
 * Mewarisi dari BaseError.
 */
class GroupError extends BaseError {
  /**
   * @param {string} code - Kode error unik (misalnya: GROUP_NOT_FOUND)
   * @param {number} statusCode - HTTP status code (400, 403, 404, dll.)
   * @param {string} message - Pesan error yang jelas.
   */
  constructor(code, statusCode = 500, message = "Terjadi kesalahan terkait grup.") {
    super(code, statusCode, message);
  }

  /**
   * @description Error untuk request yang buruk/tidak valid,
   * misalnya nama grup kosong.
   * @param {string} message - Pesan spesifik.
   */
  static BadRequest(message = "Request tidak valid.") {
    return new GroupError("GROUP_BAD_REQUEST", 400, message);
  }

  /**
   * @description Error ketika grup yang dicari tidak ditemukan.
   * @param {string} message - Pesan spesifik.
   */
  static NotFound(message = "Grup tidak ditemukan.") {
    return new GroupError("GROUP_NOT_FOUND", 404, message);
  }

  /**
   * @description Error ketika user mencoba melakukan aksi
   * yang tidak diizinkan (misal: bukan admin).
   * @param {string} message - Pesan spesifik.
   */
  static UnauthorizedAccess(message = "Anda tidak memiliki izin untuk tindakan ini.") {
    return new GroupError("GROUP_UNAUTHORIZED", 403, message);
  }

  /**
   * @description Error jika undangan tidak valid, kedaluwarsa, atau sudah digunakan.
   * @param {string} message - Pesan spesifik.
   */
  static InvalidInvitation(message = "Undangan tidak valid atau telah kedaluwarsa.") {
    return new GroupError("INVALID_INVITATION", 400, message);
  }

  /**
   * @description Error jika user mencoba bergabung ke grup
   * di mana dia sudah menjadi anggota.
   * @param {string} message - Pesan spesifik.
   */
  static AlreadyMember(message = "Anda sudah menjadi anggota grup ini.") {
    return new GroupError("ALREADY_MEMBER", 409, message);
  }
}

export default GroupError;
