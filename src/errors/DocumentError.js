import BaseError from "./BaseError.js";

/**
 * @description Kumpulan error spesifik untuk logika bisnis yang berkaitan dengan dokumen.
 * @extends BaseError
 */
class DocumentError extends BaseError {
  /**
   * @description Dilempar saat dokumen dengan ID tertentu tidak ditemukan.
   * @param {string} documentId - ID dokumen yang dicari.
   * @returns {DocumentError}
   */
  static NotFound(documentId) {
    return new DocumentError("DOCUMENT_NOT_FOUND", 404, `Dokumen dengan ID '${documentId}' tidak ditemukan.`);
  }

  /**
   * @description Dilempar saat pengguna mencoba mengakses dokumen yang bukan miliknya.
   * @returns {DocumentError}
   */
  static UnauthorizedAccess() {
    return new DocumentError("UNAUTHORIZED_DOCUMENT_ACCESS", 403, "Anda tidak memiliki izin untuk mengakses dokumen ini.");
  }

  /**
   * @description Dilempar saat pengguna mengunggah dokumen yang kontennya sudah ada.
   * @returns {DocumentError}
   */
  static AlreadyExists() {
    return new DocumentError("DOCUMENT_ALREADY_EXISTS", 409, "Dokumen dengan konten yang sama persis sudah ada.");
  }

  /**
   * @description Dilempar saat mencoba mengakses versi yang tidak terkait dengan dokumen tertentu.
   * @param {string} versionId - ID versi yang dicari.
   * @param {string} documentId - ID dokumen yang seharusnya memiliki versi tersebut.
   * @returns {DocumentError}
   */
  static InvalidVersion(versionId, documentId) {
    return new DocumentError("INVALID_VERSION_FOR_DOCUMENT", 404, `Versi ID '${versionId}' tidak valid atau tidak ditemukan untuk dokumen ID '${documentId}'.`);
  }

  /**
   * @description Dilempar saat mencoba menghapus versi yang sedang aktif.
   * @returns {DocumentError}
   */
  static DeleteActiveVersionFailed() {
    return new DocumentError("DELETE_ACTIVE_VERSION_FAILED", 400, "Tidak dapat menghapus versi yang sedang aktif. Ganti ke versi lain terlebih dahulu.");
  }

  /**
   * @description Dilempar saat pengguna mengunggah file yang akan dienkripsi (terproteksi password).
   * @param {string} [message] - Pesan error opsional.
   * @returns {DocumentError}
   */
  static EncryptedFileNotAllowed(message) {
    const defaultMessage = "File PDF terproteksi password dan tidak dapat diunggah.";
    return new DocumentError("ENCRYPTED_FILE_NOT_ALLOWED", 400, message || defaultMessage);
  }
}

export default DocumentError;
