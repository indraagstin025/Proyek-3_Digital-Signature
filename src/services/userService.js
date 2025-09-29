import crypto from "crypto";
import UserError from "../errors/UserError.js";
import CommonError from "../errors/CommonError.js";

/**
 * @description Kelas UserService berisi semua logika bisnis yang terkait dengan pengguna.
 */
export class UserService {
    /**
     * @param {object} userRepository - Instance repository untuk operasi database pengguna.
     * @param {object} fileStorage - Instance service untuk operasi penyimpanan file.
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
     * @description Memperbarui profil pengguna secara fleksibel (data teks, foto baru, atau foto lama).
     * @param {string} userId - ID pengguna.
     * @param {object} updateData - Data teks untuk diperbarui (name, address, dll).
     * @param {object} [file] - File foto profil baru (opsional).
     * @param {string} [profilePictureId] - ID foto profil lama yang akan digunakan (opsional).
     * @returns {Promise<object>} Pengguna yang telah diperbarui.
     */
    async updateMyProfile(userId, updateData, file, profilePictureId) {
        // Pastikan user ada sebelum melakukan operasi apa pun
        await this.getMyProfile(userId);

        const allowedUpdates = {};
        if (updateData.name !== undefined) allowedUpdates.name = updateData.name;
        if (updateData.phoneNumber !== undefined) allowedUpdates.phoneNumber = updateData.phoneNumber;
        if (updateData.title !== undefined) allowedUpdates.title = updateData.title;
        if (updateData.address !== undefined) allowedUpdates.address = updateData.address;

        if (file) {
            // Skenario 1: Upload foto baru
            const fileBuffer = file.buffer;
            const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

            const existingPicture = await this.userRepository.findProfilePictureByHash(userId, hash);
            if (existingPicture) {
                throw UserError.DuplicateProfilePicture();
            }

            const publicUrl = await this.fileStorage.uploadProfilePicture(file, userId);
            const newPicture = await this.userRepository.createProfilePicture(userId, { url: publicUrl, hash });

            allowedUpdates.profilePictureUrl = newPicture.url;
            await this.userRepository.setProfilePictureActive(userId, newPicture.id);

        } else if (profilePictureId) {
            // Skenario 2: Pakai foto lama
            const picture = await this.userRepository.findProfilePictureById(userId, profilePictureId);
            if (!picture) {
                throw UserError.PictureNotFound();
            }

            allowedUpdates.profilePictureUrl = picture.url;
            await this.userRepository.setProfilePictureActive(userId, picture.id);
        }

        // Skenario 3: Hanya update data teks, atau tidak ada update sama sekali
        if (Object.keys(allowedUpdates).length === 0) {
            return this.getMyProfile(userId); // Kembalikan data saat ini jika tidak ada perubahan
        }

        return this.userRepository.update(userId, allowedUpdates);
    }

    /**
     * @description Mengambil semua riwayat foto profil milik seorang pengguna.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<Array<object>>} Array berisi objek-objek foto.
     */
    async getUserProfilePictures(userId) {
        return this.userRepository.findAllProfilePictures(userId);
    }

    /**
     * @description Menghapus sebuah foto dari riwayat foto profil dan storage.
     * @param {string} userId - ID pengguna.
     * @param {string} pictureId - ID foto yang akan dihapus.
     * @returns {Promise<{message: string}>} Pesan konfirmasi.
     * @throws {UserError.PictureNotFound} Jika foto tidak ditemukan.
     * @throws {UserError.CannotDeleteActivePicture} Jika mencoba menghapus foto yang aktif.
     */
    async deleteUserProfilePicture(userId, pictureId) {
        const picture = await this.userRepository.findProfilePictureById(userId, pictureId);
        if (!picture) {
            throw UserError.PictureNotFound();
        }
        // Aturan Bisnis: Tidak boleh menghapus foto yang sedang aktif.
        if (picture.isActive) {
            throw UserError.CannotDeleteActivePicture();
        }

        await this.fileStorage.deleteFile(picture.url);
        await this.userRepository.deleteProfilePicture(pictureId);

        return { message: "Foto profil berhasil dihapus dari riwayat." };
    }
}