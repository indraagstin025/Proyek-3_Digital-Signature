import path from "path";

/**
 * @description Abstraksi untuk operasi penyimpanan file PROFIL PENGGUNA.
 * Disesuaikan untuk bekerja dengan bucket private menggunakan Signed URL.
 * Pola ini konsisten dengan SupabaseFileStorage untuk dokumen.
 */
class FileStorage {
  /**
   * Membuat instance FileStorage.
   * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient - Instance Supabase.
   * @throws {Error} Jika Supabase client tidak diberikan.
   */
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error("Supabase client harus diberikan.");
    }
    this.supabase = supabaseClient;

    this.bucketName = "profile-pictures";
  }

  /**
   * BARU: Generate signed URL untuk akses file private.
   * Ini adalah "link" sementara yang aman untuk menampilkan gambar.
   * @param {string} filePath - Path relatif file di bucket (mis: 'profile/user-id/123.jpg').
   * @param {number} expiresIn - Masa berlaku dalam detik (default: 3600 detik / 1 jam).
   * @returns {Promise<string|null>} Signed URL atau null jika gagal.
   */
  async getSignedUrl(filePath, expiresIn = 3600) {
    if (!filePath) {
      return null;
    }

    const { data, error } = await this.supabase.storage.from(this.bucketName).createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error("Gagal generate signed URL:", error.message);

      throw new Error(`Gagal generate signed URL: ${error.message}`);
    }
    return data.signedUrl;
  }

  /**
   * UBAH: Upload foto profil dan kembalikan PATH FILE.
   * Tidak lagi mengembalikan URL publik.
   * @param {Express.Multer.File} file - File dari middleware multer.
   * @param {string} userId - ID pengguna untuk membuat folder unik.
   * @returns {Promise<string>} Path file relatif yang akan disimpan ke database.
   * @throws {Error} Jika gagal mengunggah file.
   */
  async uploadProfilePicture(file, userId) {
    if (!file) throw new Error("File untuk diunggah tidak ditemukan.");

    const ext = path.extname(file.originalname);

    const fileName = `${Date.now()}${ext}`;
    const filePath = `profile-pictures/${userId}/${fileName}`;

    const { error } = await this.supabase.storage.from(this.bucketName).upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

    if (error) {
      throw new Error(`Gagal upload foto profil ke Supabase: ${error.message}`);
    }

    return filePath;
  }

  /**
   * UBAH: Hapus file dari storage berdasarkan PATH FILE.
   * Lebih robust dan tidak bergantung pada parsing URL.
   * @param {string} filePath - Path relatif file yang akan dihapus.
   * @returns {Promise<void>}
   */
  async deleteFile(filePath) {
    if (!filePath || typeof filePath !== "string") {
      console.warn("deleteFile dipanggil dengan filePath yang tidak valid, proses dilewati.");
      return;
    }

    const { error } = await this.supabase.storage.from(this.bucketName).remove([filePath]);

    if (error) {
      throw new Error(`Gagal hapus file di Supabase: ${error.message}`);
    }
  }
}

export default FileStorage;
