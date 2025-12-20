import supabaseAdmin, { supabaseBucket } from "../../config/supabaseAdmin.js";
import path from "path";
import crypto from "crypto";
import CommonError from "../../errors/CommonError.js";

/**
 * @class SupabaseFileStorage
 * @description Service untuk manajemen file menggunakan Supabase Storage.
 * Mencakup upload (dengan Retry Logic), download, delete, dan utilitas path.
 */
class SupabaseFileStorage {
  /**
   * [INTERNAL HELPER] Wrapper untuk melakukan upload dengan mekanisme RETRY.
   * Mengatasi masalah "Unexpected token <" (502 Bad Gateway) dari Supabase.
   */
  async _uploadWithRetry(filePath, buffer, contentType) {
    const MAX_RETRIES = 3;
    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_RETRIES) {
      try {
        if (attempt > 0) {
          console.log(`⚠️ [Supabase] Retry upload #${attempt} for ${filePath}...`);
        }

        const { error } = await supabaseAdmin.storage
            .from(supabaseBucket)
            .upload(filePath, buffer, {
              contentType,
              upsert: true,
            });

        if (error) throw error;

        // Jika sukses, langsung return path
        return filePath;

      } catch (err) {
        lastError = err;
        attempt++;

        // Cek apakah errornya Network/HTML (Bad Gateway)
        const isNetworkError = err.message && (
            err.message.includes("<!DOCTYPE") ||
            err.message.includes("Unexpected token") ||
            err.message.includes("fetch failed") ||
            err.status === 502 ||
            err.status === 503 ||
            err.status === 504
        );

        // Jika errornya BUKAN masalah jaringan (misal: file corrupt, permission denied), jangan retry.
        if (!isNetworkError) break;

        // Tunggu sebentar sebelum coba lagi (Backoff: 1s, 2s, 3s)
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }

    // Jika sudah habis kesempatan retry, lempar error
    console.error(`❌ [Supabase] Upload gagal total setelah ${MAX_RETRIES}x:`, lastError.message);

    if (lastError.message && lastError.message.includes("<!DOCTYPE")) {
      throw CommonError.SupabaseError("Layanan Storage sedang sibuk (502 Bad Gateway). Silakan coba sebentar lagi.");
    }

    throw CommonError.SupabaseError(`Gagal mengunggah file: ${lastError.message}`);
  }

  /**
   * @description Upload file umum ke Supabase Storage (With Retry).
   */
  async uploadFile(filePath, buffer, contentType) {
    return this._uploadWithRetry(filePath, buffer, contentType);
  }

  /**
   * @description Upload dokumen user ke Supabase Storage (auto-generate nama unik) + Retry.
   */
  async uploadDocument(file, userId) {
    if (!file || !userId) {
      throw new Error("File dan User ID wajib disediakan.");
    }

    const ext = path.extname(file.originalname);
    const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    const filePath = `documents/${userId}/${uniqueFileName}`;

    return this._uploadWithRetry(filePath, file.buffer, file.mimetype);
  }

  /**
   * @description Upload foto profil user ke Supabase Storage + Retry.
   */
  async uploadProfilePicture(file, userId) {
    if (!file) throw new Error("File tidak ditemukan.");
    const ext = path.extname(file.originalname);
    const fileName = `profile-pictures/${userId}/${Date.now()}${ext}`;

    return this._uploadWithRetry(fileName, file.buffer, file.mimetype);
  }

  /**
   * @description Generate signed URL untuk akses file private.
   */
  async getSignedUrl(filePath, expiresIn = 60, downloadFilename = null) {
    const options = downloadFilename ? { transform: {}, download: downloadFilename } : { transform: {} };

    const { data, error } = await supabaseAdmin.storage.from(supabaseBucket).createSignedUrl(filePath, expiresIn, options);

    if (error) {
      throw CommonError.SupabaseError(`Gagal generate signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * @description Download file dan mengembalikannya sebagai buffer.
   */
  async downloadFileAsBuffer(filePath) {
    const { data, error } = await supabaseAdmin.storage.from(supabaseBucket).download(filePath);

    if (error) {
      throw CommonError.SupabaseError(`Gagal mengunduh file: ${error.message}`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    return buffer;
  }

  /**
   * @description Menghapus file berdasarkan relative path.
   */
  async deleteFile(filePath) {
    if (!filePath || typeof filePath !== "string") {
      console.warn("deleteFile dipanggil dengan filePath yang tidak valid.");
      return;
    }

    const { error } = await supabaseAdmin.storage.from(supabaseBucket).remove(filePath);
    if (error) {
      throw CommonError.SupabaseError(`Supabase gagal menghapus file: ${error.message}`);
    }
  }
}

export default SupabaseFileStorage;