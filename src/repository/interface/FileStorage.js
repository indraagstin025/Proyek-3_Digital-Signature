import path from "path";

/**
 * @description Abstraksi untuk operasi penyimpanan file (unggah, unduh, hapus) menggunakan Supabase Storage.
 */
class FileStorage {
  /**
   * Membuat instance FileStorage.
   * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient - Instance Supabase.
   * @throws {Error} Jika Supabase client tidak diberikan
   */
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error("Supabase client harus diberikan.");
    }
    this.supabase = supabaseClient;
    this.bucketName = "profile-bucket";
  }

  /**
   * Unduh file dari storage.
   * @param {string} filePath - Lokasi file di storage (path relatif di bucket).
   * @returns {Promise<Buffer>} Isi file dalam bentuk Buffer.
   * @throws {Error} Jika gagal mengunduh file.
   */
  async downloadFile(filePath) {
    const { data, error } = await this.supabase.storage.from(this.bucketName).download(filePath);

    if (error) throw new Error(`Gagal download file: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
  }

  /**
   * Upload file ke storage.
   * @param {string} filePath - Lokasi file di storage (path relatif di bucket).
   * @param {Buffer} buffer - Isi file dalam bentuk Buffer.
   * @param {string} contentType - MIME type file (contoh: 'image/png').
   * @returns {Promise<void>}
   * @throws {Error} Jika gagal mengunggah file.
   */
  async uploadFile(filePath, buffer, contentType) {
    const { error } = await this.supabase.storage.from(this.bucketName).upload(filePath, buffer, { contentType, upsert: true });

    if (error) throw new Error(`Gagal upload file: ${error.message}`);
  }

  /**
   * Upload foto profil dan mengembalikan URL publik.
   * @param {Express.Multer.File} file - File dari middleware multer (req.file).
   * @param {string} userId - ID pengguna untuk membuat nama file unik.
   * @returns {Promise<string>} URL publik file yang dapat diakses.
   * @throws {Error} Jika gagal mengunggah file atau mengambil URL publik.
   */
  async uploadProfilePicture(file, userId) {
    const ext = path.extname(file.originalname);
    const fileName = `${userId}-${Date.now()}${ext}`;
    const filePath = `profile/${fileName}`;

    // Upload ke Supabase
    const { error } = await this.supabase.storage.from(this.bucketName).upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

    if (error) throw new Error(`Gagal upload ke Supabase: ${error.message}`);

    const { data, error: urlError } = this.supabase.storage.from(this.bucketName).getPublicUrl(filePath);

    if (urlError) throw new Error(`Gagal mendapatkan public URL: ${urlError.message}`);

    return data.publicUrl; // ✅ selalu string
  }

  /**
   * Hapus file dari storage.
   * @param {string} fileUrl - URL publik file yang akan dihapus.
   * @returns {Promise<void>}
   * @throws {void} Jika URL tidak valid, hanya menampilkan warning.
   */
  async deleteFile(fileUrl) {
    try {
      const url = new URL(fileUrl);
      const filePath = url.pathname.replace(/^\/+/, ""); // hapus leading slash

      const { error } = await this.supabase.storage.from(this.bucketName).remove([filePath]);

      if (error) console.warn("Gagal hapus file Supabase:", error.message);
    } catch (err) {
      console.warn("URL tidak valid, tidak bisa dihapus:", err.message);
    }
  }
}

export default FileStorage;
