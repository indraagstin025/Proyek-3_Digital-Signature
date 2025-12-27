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

    this.bucketName = "avatar";
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
   * [UBAH] Mendapatkan Public URL (Link Bersih).
   * Tidak lagi menggunakan createSignedUrl.
   * * @param {string} filePath - Path relatif file di bucket.
   * @returns {string} URL publik file.
   */
  getPublicUrl(filePath) {
    if (!filePath) return null;

    // Logic Supabase untuk Public URL (Synchronous / Tidak perlu await)
    const { data } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * [UBAH] Upload foto profil ke bucket 'avatar'.
   */
  async uploadProfilePicture(file, userId) {
    if (!file) throw new Error("File untuk diunggah tidak ditemukan.");

    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}${ext}`;

    // Path: userId/filename.jpg (Lebih rapi tanpa folder 'profile-pictures' lagi karena bucketnya sudah khusus)
    const filePath = `${userId}/${fileName}`;

    // Upload dengan opsi public (biasanya default untuk bucket public)
    const { error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true, // Timpa jika nama sama
        });

    if (error) {
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
