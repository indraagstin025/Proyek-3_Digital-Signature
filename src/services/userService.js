import crypto from "crypto";
import UserError from "../errors/UserError.js";
import CommonError from "../errors/CommonError.js";

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
        if (!userRepository || !fileStorage) {
            throw CommonError.InternalServerError("Dependensi untuk UserService tidak lengkap.");
        }
        this.userRepository = userRepository;
        this.fileStorage = fileStorage;
    }

    /**
     * @description Mengambil data profil lengkap seorang pengguna berdasarkan ID.
     * @param {string} userId - ID unik pengguna.
     * @returns {Promise<object>} Objek data pengguna.
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
     * @param {string} userId - ID pengguna.
     * @param {object} profileData - Objek berisi data teks baru.
     * @param {object} file - Objek file yang diunggah.
     * @returns {Promise<object>} Objek pengguna yang telah diperbarui.
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
     * @param {string} userId - ID pengguna.
     * @param {object} profileData - Objek berisi data teks baru.
     * @param {string} profilePictureId - ID dari foto di riwayat yang akan diaktifkan.
     * @returns {Promise<object>} Objek pengguna yang telah diperbarui.
     */
    async updateUserProfileWithOldPicture(userId, profileData, profilePictureId) {
        const picture = await this.userRepository.findProfilePictureById(userId, profilePictureId);
        if (!picture) {
            throw UserError.PictureNotFound();
        }

        await this.userRepository.deactivateOtherProfilePictures(userId, picture.id);
        await this.userRepository.setProfilePictureActive(picture.id);

        const allowedUpdates = { ...profileData }; // Salin data teks yang ada
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
        if (!picture) {
            throw UserError.PictureNotFound();
        }

        // Aturan bisnis: tidak boleh menghapus foto yang sedang aktif.
        if (picture.isActive) {
            throw UserError.CannotDeleteActivePicture();
        }

        await this.fileStorage.deleteFile(picture.url);
        await this.userRepository.deleteProfilePicture(userId, pictureId);

        return this.userRepository.findById(userId);
    }
}