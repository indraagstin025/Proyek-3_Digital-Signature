import asyncHandler from "../utils/asyncHandler.js";

/**
 * @description Factory function untuk membuat user controller.
 * @param {object} userService - Instance dari service pengguna.
 * @returns {object} Objek yang berisi semua metode controller pengguna.
 */
export const createUserController = (userService) => {
    return {
        /**
         * @function getMyProfile
         * @description Mengambil profil dari pengguna yang sedang login.
         * @route GET /api/users/me
         * @access Private
         */
        getMyProfile: asyncHandler(async (req, res, next) => {
            const userId = req.user.id;
            // UserService.getMyProfile hanya mengembalikan objek user (dengan Signed URL segar)
            const user = await userService.getMyProfile(userId);

            res.status(200).json({
                status: "success",
                data: user,
            });
        }),

        /**
         * @function updateMyProfile
         * @description Memperbarui profil pengguna, termasuk foto profil baru/lama.
         * @route PUT /api/users/me
         * @access Private
         */
        updateMyProfile: asyncHandler(async (req, res, next) => {
            const userId = req.user.id;
            const file = req.file;
            const { profilePictureId, ...updateData } = req.body;

            let updatedData; // Variabel ini akan menampung { user, profilePictures } atau { user }

            // Kasus 1: Tidak ada perubahan yang dilakukan
            if (Object.keys(updateData).length === 0 && !file && !profilePictureId) {
                // PERBAIKAN: Mengembalikan data lengkap (termasuk riwayat foto segar)
                updatedData = await userService.getFullUserProfileData(userId);
                return res.status(200).json({
                    status: "success",
                    message: "Tidak ada data yang diubah.",
                    data: updatedData,
                });
            }

            // Kasus 2: Mengunggah foto baru
            if (file) {
                // ✅ Perubahan: Service mengembalikan { user, profilePictures }
                updatedData = await userService.updateUserProfileWithNewPicture(userId, updateData, file);
            }
            // Kasus 3: Menggunakan foto lama
            else if (profilePictureId) {
                // ✅ Perubahan: Service mengembalikan { user, profilePictures }
                updatedData = await userService.updateUserProfileWithOldPicture(userId, updateData, profilePictureId);
            }
            // Kasus 4: Update data non-foto biasa
            else {
                const user = await userService.updateUserProfile(userId, updateData);
                // PERBAIKAN: Bungkus respons agar formatnya { user, profilePictures }
                const pictures = await userService.getUserProfilePictures(userId);
                updatedData = { user, profilePictures: pictures };
            }

            res.status(200).json({
                status: "success",
                message: "Profil berhasil diperbarui",
                // 🎯 updatedData sekarang dijamin berupa objek { user, profilePictures }
                data: updatedData,
            });
        }),

        /**
         * @function getProfilePictures
         * @description Mengambil daftar riwayat foto profil (dengan Signed URL segar).
         * @route GET /api/users/me/pictures
         * @access Private
         */
        getProfilePictures: asyncHandler(async (req, res, next) => {
            const userId = req.user.id;
            // pictures adalah Array<object> dengan Signed URL segar
            const pictures = await userService.getUserProfilePictures(userId);
            res.status(200).json({
                status: "success",
                message: "Daftar foto profil berhasil diambil",
                data: pictures,
            });
        }),

        /**
         * @function deleteProfilePicture
         * @description Menghapus sebuah foto dari riwayat foto profil user.
         * @route DELETE /api/users/me/pictures/:pictureId
         * @access Private
         */
        deleteProfilePicture: asyncHandler(async (req, res, next) => {
            const userId = req.user.id;
            const { pictureId } = req.params;

            // ✅ Perubahan: Service mengembalikan { user, profilePictures }
            const result = await userService.deleteUserProfilePicture(userId, pictureId);

            res.status(200).json({
                status: "success",
                message: "Foto profil berhasil dihapus dari history",
                // 🎯 result sekarang berupa objek { user, profilePictures }
                data: result,
            });
        }),
    };
};