import crypto from "crypto";
import UserError from "../errors/UserError.js";
import CommonError from "../errors/CommonError.js";

/**
 * @description Service untuk menangani logika bisnis pengguna.
 * Menjadi perantara antara controller dan repository (lapisan data).
 */
export class UserService {
  /**
   * @param {object} userRepository - Repository untuk operasi database pengguna.
   *   Harus menyediakan method:
   *   - findById, update, findProfilePictureByHash, createProfilePicture,
   *   - deactivateOtherProfilePictures, findProfilePictureById,
   *   - setProfilePictureActive, findAllProfilePictures, deleteProfilePicture.
   * @param {object} fileStorage - Service penyimpanan file.
   *   Harus menyediakan method:
   *   - uploadProfilePicture(file, userId), deleteFile(fileUrl).
   */
  constructor(userRepository, fileStorage) {
    if (!userRepository || !fileStorage) {
      throw CommonError.InternalServerError("Dependensi untuk UserService tidak lengkap.");
    }
    this.userRepository = userRepository;
    this.fileStorage = fileStorage;
  }

  /**
   * @description Mengambil data profil lengkap pengguna berdasarkan ID.
   * @async
   * @param {string} userId - ID unik pengguna.
   * @returns {Promise<object>} Objek data pengguna.
   * @throws {UserError.NotFound} Jika pengguna tidak ditemukan.
   */
  async getMyProfile(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw UserError.NotFound();
    }
    return user;
  }

  /**
   * @description Memperbarui data teks profil pengguna (tanpa mengubah foto).
   * @async
   * @param {string} userId - ID pengguna yang akan diperbarui.
   * @param {object} profileData - Data baru (misalnya: { name, phoneNumber, title, address }).
   * @returns {Promise<object>} Objek pengguna yang sudah diperbarui.
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
   * @description Memperbarui profil pengguna dengan foto baru (unggahan).
   * @async
   * @param {string} userId - ID pengguna.
   * @param {object} profileData - Data teks profil (misalnya: { name, title, address }).
   * @param {object} file - File upload dari user.
   * @param {Buffer} file.buffer - Buffer file gambar.
   * @returns {Promise<object>} Objek pengguna yang sudah diperbarui.
   * @throws {CommonError.InvalidInput} Jika file tidak valid.
   * @throws {UserError.DuplicateProfilePicture} Jika foto sudah ada di riwayat (hash sama).
   * @throws {CommonError.ServiceUnavailable} Jika gagal upload ke storage.
   */
  async updateUserProfileWithNewPicture(userId, profileData, file) {
    const allowedUpdates = {};
    if (profileData.name !== undefined) allowedUpdates.name = profileData.name;
    if (profileData.phoneNumber !== undefined) allowedUpdates.phoneNumber = profileData.phoneNumber;
    if (profileData.title !== undefined) allowedUpdates.title = profileData.title;
    if (profileData.address !== undefined) allowedUpdates.address = profileData.address;

    if (!file || !file.buffer) {
      throw CommonError.InvalidInput("File untuk diunggah tidak valid atau tidak ada.");
    }

    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

    const existingPicture = await this.userRepository.findProfilePictureByHash(userId, hash);
    if (existingPicture) {
      throw UserError.DuplicateProfilePicture();
    }

    const publicUrl = await this.fileStorage.uploadProfilePicture(file, userId);
    if (!publicUrl) {
      throw CommonError.ServiceUnavailable("Layanan penyimpanan file gagal.");
    }

    const newPicture = await this.userRepository.createProfilePicture(userId, {
      url: publicUrl,
      hash,
      isActive: true,
    });

    await this.userRepository.deactivateOtherProfilePictures(userId, newPicture.id);

    allowedUpdates.profilePictureUrl = newPicture.url;

    return this.userRepository.update(userId, allowedUpdates);
  }

  /**
   * @description Memperbarui profil pengguna dengan memilih foto lama dari riwayat.
   * @async
   * @param {string} userId - ID pengguna.
   * @param {object} profileData - Data teks profil (misalnya: { name, title, address }).
   * @param {string} profilePictureId - ID foto di riwayat yang akan diaktifkan.
   * @returns {Promise<object>} Objek pengguna yang sudah diperbarui.
   * @throws {UserError.PictureNotFound} Jika foto tidak ditemukan.
   */
  async updateUserProfileWithOldPicture(userId, profileData, profilePictureId) {
    const picture = await this.userRepository.findProfilePictureById(userId, profilePictureId);
    if (!picture) {
      throw UserError.PictureNotFound();
    }

    await this.userRepository.deactivateOtherProfilePictures(userId, picture.id);
    await this.userRepository.setProfilePictureActive(picture.id);

    const allowedUpdates = { ...profileData };
    allowedUpdates.profilePictureUrl = picture.url;

    return this.userRepository.update(userId, allowedUpdates);
  }

  /**
   * @description Mengambil semua riwayat foto profil pengguna.
   * @async
   * @param {string} userId - ID pengguna.
   * @returns {Promise<Array<object>>} Array objek foto profil.
   */
  async getUserProfilePictures(userId) {
    return this.userRepository.findAllProfilePictures(userId);
  }

  /**
   * @description Menghapus sebuah foto dari riwayat profil dan storage.
   * @async
   * @param {string} userId - ID pengguna.
   * @param {string} pictureId - ID foto yang akan dihapus.
   * @returns {Promise<object>} Data pengguna terbaru setelah foto dihapus.
   * @throws {UserError.PictureNotFound} Jika foto tidak ditemukan.
   * @throws {UserError.CannotDeleteActivePicture} Jika mencoba menghapus foto yang aktif.
   */
  async deleteUserProfilePicture(userId, pictureId) {
    const picture = await this.userRepository.findProfilePictureById(userId, pictureId);
    if (!picture) {
      throw UserError.PictureNotFound();
    }

    if (picture.isActive) {
      throw UserError.CannotDeleteActivePicture();
    }

    await this.fileStorage.deleteFile(picture.url);
    await this.userRepository.deleteProfilePicture(userId, pictureId);

    return this.userRepository.findById(userId);
  }
}
