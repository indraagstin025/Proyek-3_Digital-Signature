import asyncHandler from '../utils/asyncHandler.js';

/**
 * @description Factory function untuk membuat user controller.
 * @param {object} userService - Instance dari service pengguna.
 * @returns {object} Objek yang berisi semua metode controller pengguna.
 */
export const createUserController = (userService) => {
    return {
        /**
         * @description Mengambil profil dari pengguna yang sedang login.
         */
        getMyProfile: asyncHandler(async (req, res, next) => {
            const userId = req.user.id;
            const user = await userService.getMyProfile(userId);
            // Pengecekan 'if (!user)' sekarang dilakukan di service,
            // yang akan melempar UserError.NotFound jika tidak ada.
            res.status(200).json({
                status: "success",
                data: user,
            });
        }),

        /**
         * @description Memperbarui profil pengguna yang sedang login.
         */
        updateMyProfile: asyncHandler(async (req, res, next) => {
            const userId = req.user.id;
            const file = req.file;
            const { profilePictureId, ...updateData } = req.body;

            // Pengecekan ini bersifat pre-emptive dan boleh tetap di controller
            // untuk menghindari pemanggilan service yang tidak perlu.
            if (Object.keys(updateData).length === 0 && !file && !profilePictureId) {
                const currentUser = await userService.getMyProfile(userId);
                return res.status(200).json({
                    status: "success",
                    message: "Tidak ada data yang diubah.",
                    data: currentUser,
                });
            }

            let updatedUser;
            if (file) {
                updatedUser = await userService.updateUserProfileWithNewPicture(userId, updateData, file);
            } else if (profilePictureId) {
                // Asumsi endpoint terpisah untuk ini, atau bisa digabung.
                updatedUser = await userService.updateUserProfileWithOldPicture(userId, updateData, profilePictureId);
            } else {
                updatedUser = await userService.updateUserProfile(userId, updateData);
            }

            res.status(200).json({
                status: "success",
                message: "Profil berhasil diperbarui",
                data: updatedUser,
            });
        }),

        /**
         * @description Mengambil daftar riwayat foto profil.
         */
        getProfilePictures: asyncHandler(async (req, res, next) => {
            const userId = req.user.id;
            const pictures = await userService.getUserProfilePictures(userId);
            res.status(200).json({
                status: "success",
                message: "Daftar foto profil berhasil diambil",
                data: pictures,
            });
        }),

        /**
         * @description Menghapus sebuah foto dari riwayat foto profil.
         */
        deleteProfilePicture: asyncHandler(async (req, res, next) => {
            const userId = req.user.id;
            const { pictureId } = req.params;
            const updatedUser = await userService.deleteUserProfilePicture(userId, pictureId);
            res.status(200).json({
                status: "success",
                message: "Foto profil berhasil dihapus dari history",
                data: updatedUser,
            });
        }),

        // Catatan: Fungsi `createUser` dan `useOldProfilePicture` telah dihapus dari sini.
        // - `createUser` lebih cocok berada di `authController` (registrasi).
        // - Logika `useOldProfilePicture` sudah bisa dicakup oleh `updateMyProfile`.
    };
};