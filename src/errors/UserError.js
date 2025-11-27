import BaseError from "./BaseError.js";

/**
 * @description Kelas untuk error spesifik yang terkait dengan entitas Pengguna (user).
 */
class UserError extends BaseError {
  constructor(code, statusCode = 400, message = "Terjadi kesalahan pada modul user.") {
    super(code, statusCode, message);
  }

  /**
   * @description Error saat user atau Profile tidak ditemukan.
   * @param {string} message
   * @returns {UserError}
   */
  static NotFound(message = "Profil user tidak ditemukan.") {
    return new UserError("USER_NOT_FOUND", 404, message);
  }

  /**
   * @description Error saat foto profil spesifik dari riwayat tidak ditemukan.
   * @param {string} message
   * @returns {UserError}
   */
  static PictureNotFound(message = "Foto profil tidak ditemukan dalam riwayat.") {
    return new UserError("PICTURE_NOT_FOUND", 404, message);
  }

  /**
   * @description Error saat mencoba menghapus foto profil yang sedang aktif.
   * @param {string} message
   * @returns {UserError}
   */
  static CannotDeleteActivePicture(message = "Tidak dapat menghapus foto profil yang sedang aktif.") {
    return new UserError("CANNOT_DELETE_ACTIVE_PICTURE", 400, message);
  }

  /**
   * @description Error saat user mengunggah foto profil yang sama persis.
   * @param {string} message
   * @returns {UserError}
   */
  static DuplicateProfilePicture(message = "Foto ini sudah pernah diunggah sebelumnya.") {
    return new UserError("DUPLICATE_PROFILE_PICTURE", 409, message); 
  }
}

export default UserError;
