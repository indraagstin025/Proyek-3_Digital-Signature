import path from "path";
// Pastikan path ini benar mengarah ke file config Anda
import supabaseAdmin from "../../config/supabaseAdmin.js";

/**
 * @description Abstraksi untuk operasi penyimpanan file PROFIL PENGGUNA.
 * MENGGUNAKAN SUPABASE ADMIN (SERVICE ROLE) UNTUK BYPASS RLS.
 */
class FileStorage {
  /**
   * Membuat instance FileStorage.
   */
  constructor() {
    // [PERBAIKAN] Gunakan 'supabaseAdmin' (sesuai nama import di atas)
    this.supabase = supabaseAdmin;

    this.bucketName = "avatar";
  }

  /**
   * Generate signed URL untuk akses file private.
   */
  async getSignedUrl(filePath, expiresIn = 3600) {
    if (!filePath) return null;

    const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error("Gagal generate signed URL:", error.message);
      throw new Error(`Gagal generate signed URL: ${error.message}`);
    }
    return data.signedUrl;
  }

  /**
   * Mendapatkan Public URL (Link Bersih).
   */
  getPublicUrl(filePath) {
    if (!filePath) return null;

    const { data } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Upload foto profil ke bucket 'avatar'.
   */
  async uploadProfilePicture(file, userId) {
    if (!file) throw new Error("File untuk diunggah tidak ditemukan.");

    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}${ext}`;

    const filePath = `${userId}/${fileName}`;

    // Upload file
    const { error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

    if (error) {
      console.error("Supabase Storage Error:", error);
      throw new Error(`Gagal upload foto profil ke Supabase: ${error.message}`);
    }

    return filePath;
  }

  /**
   * Hapus file dari storage.
   */
  async deleteFile(filePath) {
    if (!filePath || typeof filePath !== "string") return;

    const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

    if (error) {
      throw new Error(`Gagal hapus file di Supabase: ${error.message}`);
    }
  }
}

export default FileStorage;