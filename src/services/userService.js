import crypto from "crypto";

/**
 * @description Kelas UserService berisi semua logika bisnis yang terkait dengan pengguna.
 * Ini bertindak sebagai perantara antara controller dan lapisan data (repository).
 */
export class UserService {
  /**
   * @param {object} userRepository - Instance repository untuk operasi database pengguna.
   * @param {object} fileStorage - Instance service untuk operasi penyimpanan file (upload/delete).
   */
  constructor(userRepository, fileStorage) {
    if (!userRepository) throw new Error("UserRepository harus disediakan.");
    if (!fileStorage) throw new Error("FileStorage harus disediakan.");

    this.userRepository = userRepository;
    this.fileStorage = fileStorage;
  }

  /**
   * @description Mengambil data profil lengkap seorang pengguna berdasarkan ID.
   * @param {string} userId - ID unik pengguna.
   * @returns {Promise<object>} Objek data pengguna.
   */
  async getMyProfile(userId) {
    return this.userRepository.findById(userId);
  }

  /**
   * @description Memperbarui data teks profil pengguna (tanpa mengubah foto).
   * @param {string} userId - ID pengguna yang akan diperbarui.
   * @param {object} profileData - Objek berisi data baru (misal: name, address).
   * @returns {Promise<object>} Objek pengguna yang telah diperbarui.
   */
  async updateUserProfile(userId, profileData) {
    const allowedUpdates = {};
    if (profileData.name !== undefined) allowedUpdates.name = profileData.name;
    if (profileData.phoneNumber !== undefined) allowedUpdates.phoneNumber = profileData.phoneNumber;
    if (profileData.title !== undefined) allowedUpdates.title = profileData.title;
    if (profileData.address !== undefined) allowedUpdates.address = profileData.address;

    if (Object.keys(allowedUpdates).length === 0) {
      return this.userRepository.findById(userId);
    }

    return this.userRepository.update(userId, allowedUpdates);
  }

  /**
   * @description Memperbarui profil pengguna beserta unggahan foto profil baru.
   * Proses ini meliputi validasi, hashing file, pengecekan duplikat, upload, dan update database.
   * @param {string} userId - ID pengguna.
   * @param {object} profileData - Objek berisi data teks baru.
   * @param {object} file - Objek file yang diunggah (misal: dari multer).
   * @returns {Promise<object>} Objek pengguna yang telah diperbarui.
   */
  async updateUserProfileWithNewPicture(userId, profileData, file) {
    try {
      if (!userId || typeof userId !== "string" || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
        throw new Error("ID user tidak valid. Pastikan Anda sudah login.");
      }

      const allowedUpdates = {};
      if (profileData.name !== undefined) allowedUpdates.name = profileData.name;
      if (profileData.phoneNumber !== undefined) allowedUpdates.phoneNumber = profileData.phoneNumber;
      if (profileData.title !== undefined) allowedUpdates.title = profileData.title;
      if (profileData.address !== undefined) allowedUpdates.address = profileData.address;

      const fileBuffer = file.buffer || Buffer.from(await file.arrayBuffer());
      if (!Buffer.isBuffer(fileBuffer)) {
        throw new Error("File yang diupload tidak valid.");
      }

      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      const existingPicture = await this.userRepository.findProfilePictureByHash(userId, hash);
      if (existingPicture) {
        throw new Error("Foto ini sudah pernah diupload, gunakan foto lama dari history.");
      }

      const publicUrl = await this.fileStorage.uploadProfilePicture(file, userId);
      if (!publicUrl || typeof publicUrl !== "string") {
        throw new Error("Gagal mengunggah foto ke storage.");
      }

      const newPicture = await this.userRepository.createProfilePicture(userId, {
        url: publicUrl,
        hash,
        isActive: true,
      });

      if (!newPicture || !newPicture.id) {
        throw new Error("Gagal menyimpan data foto di database.");
      }

      await this.userRepository.deactivateOtherProfilePictures(userId, newPicture.id);

      allowedUpdates.profilePictureUrl = newPicture.url;

      return this.userRepository.update(userId, allowedUpdates);
    } catch (error) {
      console.error("[SERVICE_ERROR] Gagal update profil dengan foto baru:", error);
      throw error;
    }
  }

  /**
   * @description Memperbarui profil pengguna dengan memilih foto lama dari riwayat.
   * @param {string} userId - ID pengguna.
   * @param {object} profileData - Objek berisi data teks baru.
   * @param {string} profilePictureId - ID dari foto di riwayat yang akan diaktifkan.
   * @returns {Promise<object>} Objek pengguna yang telah diperbarui.
   */
  async updateUserProfileWithOldPicture(userId, profileData, profilePictureId) {
    const allowedUpdates = {};
    if (profileData.name !== undefined) allowedUpdates.name = profileData.name;
    if (profileData.phoneNumber !== undefined) allowedUpdates.phoneNumber = profileData.phoneNumber;
    if (profileData.title !== undefined) allowedUpdates.title = profileData.title;
    if (profileData.address !== undefined) allowedUpdates.address = profileData.address;

    const picture = await this.userRepository.findProfilePictureById(userId, profilePictureId);
    if (!picture) throw new Error("Foto profil tidak ditemukan atau bukan milik Anda.");

    await this.userRepository.deactivateOtherProfilePictures(userId, picture.id);
    await this.userRepository.setProfilePictureActive(picture.id);

    allowedUpdates.profilePictureUrl = picture.url;

    return this.userRepository.update(userId, allowedUpdates);
  }

  /**
   * @description Mengambil semua riwayat foto profil milik seorang pengguna.
   * @param {string} userId - ID pengguna.
   * @returns {Promise<Array<object>>} Sebuah array berisi objek-objek foto.
   */
  async getUserProfilePictures(userId) {
    return this.userRepository.findAllProfilePictures(userId);
  }

  /**
   * @description Menghapus sebuah foto dari riwayat foto profil dan storage.
   * @param {string} userId - ID pengguna.
   * @param {string} pictureId - ID foto yang akan dihapus.
   * @returns {Promise<object>} Mengembalikan data pengguna terbaru setelah operasi hapus selesai.
   */
  async deleteUserProfilePicture(userId, pictureId) {
    const picture = await this.userRepository.findProfilePictureById(userId, pictureId);
    if (!picture) throw new Error("Foto profil tidak ditemukan atau bukan milik Anda.");

    await this.fileStorage.deleteFile(picture.url);
    await this.userRepository.deletePictureInTransaction(userId, pictureId, picture.isActive);

    const freshUserData = await this.userRepository.findById(userId);
    return freshUserData;
  }
}