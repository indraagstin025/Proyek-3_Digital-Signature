import BaseError from "./BaseError.js";

/**
 * @description Kumpulan error spesifik untuk logika bisnis yang berkaitan dengan tanda tangan.
 * @extends BaseError
 */
class SignatureError extends BaseError {
  /**
   * @description Dilempar saat record tanda tangan dengan ID tertentu tidak ditemukan.
   * @param {string} signatureId - ID tanda tangan yang dicari.
   * @returns {SignatureError}
   */
  static NotFound(signatureId) {
    return new SignatureError("SIGNATURE_NOT_FOUND", 404, `Tanda tangan dengan ID '${signatureId} tidak ditemukan.`);
  }

  /**
   * @description Dilempar saat pengguna mencoba menandatangani dokumen yang bukan miliknya.
   * @returns {SignatureError}
   */
  static Unauthorized() {
    return new SignatureError("UNAUTHORIZED_SIGNATURE_ACCESS", 403, "Anda tidak memiliki izin untuk mengakses atau menandatangani dokumen ini.");
  }

  /**
   * @description Dilempar saat mencoba menandatangani dokumen yang statusnya sudah 'completed'.
   * @returns {SignatureError}
   */
  static AlreadyCompleted() {
    return new SignatureError("DOCUMENT_ALREADY_COMPLETED", 409, "Dokumen ini sudah selesai dan tidak dapat ditandatangani lagi.");
  }

  /**
   * @description Dilempar saat service dipanggil tanpa data tanda tangan yang valid.
   * @returns {SignatureError}
   */
  static MissingSignatureData() {
    return new SignatureError("MISSING_SIGNATURE_DATA", 400, "Tidak ada data tanda tangan valid yang diberikan untuk ditempelkan.");
  }

  /**
   * @description Dilempar saat versi dokumen yang akan ditandatangani tidak ditemukan.
   * @param {string} versionId - ID versi dokumen yang dicari.
   * @returns {SignatureError}
   */
  static VersionNotFound(versionId) {
    return new SignatureError("VERSION_FOR_SIGNATURE_NOT_FOUND", 404, `Versi dokumen dengan ID '${versionId}' untuk ditandatangani tidak ditemukan.`);
  }
}

export default SignatureError;
