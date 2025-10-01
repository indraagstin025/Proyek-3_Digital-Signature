import { supabase, supabaseBucket } from "../../config/supabaseClient.js";
import path from "path";
import crypto from "crypto";

import CommonError from "../../errors/CommonError.js";

/**
 * @class SupabaseFileStorage
 * @description Service untuk manajemen file menggunakan Supabase Storage.
 * Mencakup upload, download, delete, dan utilitas path.
 */
class SupabaseFileStorage {
  /**
   * @description Upload file umum ke Supabase Storage.
   * @param {string} filePath - Path tujuan penyimpanan file di bucket.
   * @param {Buffer} buffer - Buffer file yang akan diupload.
   * @param {string} contentType - MIME type file.
   * @returns {Promise<string>} Public URL dari file yang diupload.
   * @throws {CommonError.SupabaseError}
   */
  async uploadFile(filePath, buffer, contentType) {
    const { error } = await supabase.storage.from(supabaseBucket).upload(filePath, buffer, { contentType, upsert: true });

    if (error) {
      throw CommonError.SupabaseError(`Gagal mengunggah file generik: ${error.message}`);
    }
    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  /**
   * @description Upload dokumen user ke Supabase Storage (auto-generate nama unik).
   * @param {Express.Multer.File} file - File dokumen yang akan diupload.
   * @param {string} userId - ID pengguna pemilik dokumen.
   * @returns {Promise<string>} Public URL dari dokumen.
   * @throws {CommonError.SupabaseError|Error}
   */
  async uploadDocument(file, userId) {
    if (!file || !userId) {
      throw new Error("File dan User ID wajib disediakan.");
    }

    const ext = path.extname(file.originalname);
    const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    const filePath = `documents/${userId}/${uniqueFileName}`;

    const { error } = await supabase.storage.from(supabaseBucket).upload(filePath, file.buffer, { contentType: file.mimetype });

    if (error) {
      throw CommonError.SupabaseError(`Gagal mengunggah dokumen: ${error.message}`);
    }

    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  /**
   * @description Download file dari public URL dan mengembalikannya sebagai buffer.
   * @param {string} publicUrl - Public URL file yang akan diunduh.
   * @returns {Promise<Buffer>} Buffer file.
   * @throws {CommonError.SupabaseError|CommonError.InternalServerError}
   */
  async downloadFileAsBuffer(publicUrl) {
    const filePath = this.getFilePathFromUrl(publicUrl);

    if (!filePath) {
      throw CommonError.InternalServerError("Gagal mengekstrak path dari URL untuk diunduh.");
    }

    const { data, error } = await supabase.storage.from(supabaseBucket).download(decodeURIComponent(filePath));

    if (error) {
      throw CommonError.SupabaseError(`Gagal mengunduh file: ${error.message}`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    return buffer;
  }

  /**
   * @description Menghapus file berdasarkan public URL.
   * @param {string} publicUrl - Public URL file yang akan dihapus.
   * @returns {Promise<void>}
   */
  async deleteFile(publicUrl) {
    try {
      if (!publicUrl) return;
      const filePath = this.getFilePathFromUrl(publicUrl);
      if (!filePath) return;
      const decodedFilePath = decodeURIComponent(filePath);
      const { error } = await supabase.storage.from(supabaseBucket).remove([decodedFilePath]);
      if (error) {
        console.error(`Supabase gagal menghapus file: ${error.message}`);
      }
    } catch (error) {
      console.error("Terjadi error di fungsi deleteFile:", error);
    }
  }

  /**
   * @description Upload foto profil user ke Supabase Storage.
   * @param {Express.Multer.File} file - File gambar profil.
   * @param {string} userId - ID pengguna.
   * @returns {Promise<string>} Public URL dari foto profil.
   * @throws {CommonError.SupabaseError|Error}
   */
  async uploadProfilePicture(file, userId) {
    if (!file) throw new Error("File tidak ditemukan.");
    const ext = path.extname(file.originalname);
    const fileName = `profile-pictures/${userId}/${Date.now()}${ext}`;

    const { error } = await supabase.storage.from(supabaseBucket).upload(fileName, file.buffer, { contentType: file.mimetype });

    if (error) {
      throw CommonError.SupabaseError(`Upload profile gagal: ${error.message}`);
    }
    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(fileName);
    return data.publicUrl;
  }

  /**
   * @description Mengambil relative file path dari Supabase public URL.
   * @param {string} publicUrl - Public URL Supabase.
   * @returns {string|null} File path relatif atau null jika gagal.
   */
  getFilePathFromUrl(publicUrl) {
    try {
      const url = new URL(publicUrl);
      const pathParts = url.pathname.split(`/${supabaseBucket}/`);
      return pathParts[1] || null;
    } catch (e) {
      console.error("URL tidak valid:", publicUrl);
      return null;
    }
  }
}

export default SupabaseFileStorage;
