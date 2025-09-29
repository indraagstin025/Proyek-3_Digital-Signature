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
            // Pengecekan `!user` sekarang dilakukan di service, yang akan melempar UserError.NotFound
            res.status(200).json({ data: user });
        }),

        /**
         * @description Membuat pengguna baru (biasanya oleh admin).
         */
        createUser: asyncHandler(async (req, res, next) => {
            const { name, email, password } = req.body;
            const newUser = await userService.createUser({ name, email, password });

            const userResponse = {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                createdAt: newUser.createdAt,
            };

            res.status(201).json({
                message: "User berhasil dibuat",
                data: userResponse,
            });
        }),

        /**
         * @description Memperbarui profil pengguna yang sedang login.
         */
        updateMyProfile: asyncHandler(async (req, res, next) => {
            const userId = req.user.id;
            const file = req.file;
            const { profilePictureId, ...updateData } = req.body;

            const updatedUser = await userService.updateMyProfile(userId, updateData, file, profilePictureId);

            res.status(200).json({
                message: "Profil berhasil diperbarui",
                data: updatedUser,
            });
        }),

        /**
         * @description Mengambil daftar riwayat foto profil pengguna.
         */
        getProfilePictures: asyncHandler(async (req, res, next) => {
            const userId = req.user.id;
            const pictures = await userService.getUserProfilePictures(userId);
            res.status(200).json({
                message: "Daftar foto profil berhasil diambil",
                data: pictures,
            });
        }),

        /**
         * @description Mengatur foto profil lama menjadi foto aktif.
         */
        useOldProfilePicture: asyncHandler(async (req, res, next) => {
            const userId = req.user.id;
            const { pictureId } = req.params;
            const updatedUser = await userService.updateUserProfileWithOldPicture(userId, {}, pictureId);
            res.status(200).json({
                message: "Foto profil berhasil diganti dengan foto lama",
                data: updatedUser,
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
                message: "Foto profil berhasil dihapus dari riwayat",
                data: updatedUser,
            });
        }),
    };
};