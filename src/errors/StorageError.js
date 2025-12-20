import BaseError from "./BaseError.js";

/**
 * @description Kumpulan error spesifik untuk masalah teknis pada layanan penyimpanan file.
 * @extends BaseError
 */
class StorageError extends BaseError {
  /**
   * @description Dilempar saat proses unggah file ke cloud storage gagal.
   * @param {string} originalErrorMessage - Pesan error asli dari library/client storage.
   * @returns {StorageError}
   */
  static UploadFailed(originalErrorMessage) {
    return new StorageError("STORAGE_UPLOAD_FAILED", 500, `Gagal mengunggah file: ${originalErrorMessage}`);
  }

  /**
   * @description Dilempar saat proses unduh file dari cloud storage gagal.
   * @param {string} originalErrorMessage - Pesan error asli dari library/client storage.
   * @returns {StorageError}
   */
  static DownloadFailed(originalErrorMessage) {
    return new StorageError("STORAGE_DOWNLOAD_FAILED", 500, `Gagal mengunduh file: ${originalErrorMessage}`);
  }

  /**
   * @description Dilempar saat URL yang diberikan untuk operasi file tidak valid.
   * @param {string} url - URL yang tidak valid.
   * @returns {StorageError}
   */
  static InvalidUrl(url) {
    return new StorageError("STORAGE_INVALID_URL", 400, `URL file tidak valid: ${url}`);
  }

  /**
   * [BARU] Dilempar saat layanan Storage sedang down/sibuk (Bad Gateway 502/504).
   * @param {string} message - Pesan tambahan.
   * @returns {StorageError}
   */
  static ServiceUnavailable(message = "Layanan Storage sedang sibuk/down.") {
    return new StorageError("STORAGE_SERVICE_UNAVAILABLE", 503, message);
  }

  /**
   * [BARU] Dilempar saat proses retry gagal setelah beberapa kali percobaan.
   * @param {string} operation - Nama operasi (Upload/Download).
   * @returns {StorageError}
   */
  static RetryLimitExceeded(operation) {
    return new StorageError("STORAGE_RETRY_EXCEEDED", 504, `Gagal melakukan ${operation} setelah beberapa kali percobaan.`);
  }
}

export default StorageError;