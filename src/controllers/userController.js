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
     * @access Private (hanya pengguna yang sudah login)
     * @param {import("express").Request} req - Objek request Express (req.user harus ada dari authMiddleware).
     * @param {import("express").Response} res - Objek response Express.
     * @param {import("express").NextFunction} next - Fungsi middleware berikutnya untuk error handling.
     * @returns {Promise<void>} JSON berisi data profil pengguna.
     */
    getMyProfile: asyncHandler(async (req, res, next) => {
      const userId = req.user.id;
      const user = await userService.getMyProfile(userId);

      res.status(200).json({
        status: "success",
        data: user,
      });
    }),

    /**
     * @function updateMyProfile
     * @description Memperbarui profil pengguna yang sedang login. 
     * Dapat memperbarui data profil (email/username) dan juga foto profil.
     * - Jika ada file, maka unggah foto baru.
     * - Jika ada profilePictureId, gunakan foto lama dari riwayat.
     * - Jika hanya updateData, update field tertentu saja.
     * @route PUT /api/users/me
     * @access Private
     * @param {import("express").Request} req - Objek request Express (berisi req.user.id, req.body, dan req.file jika ada).
     * @param {import("express").Response} res - Objek response Express.
     * @param {import("express").NextFunction} next - Fungsi middleware berikutnya.
     * @returns {Promise<void>} JSON berisi data profil pengguna yang sudah diperbarui.
     */
    updateMyProfile: asyncHandler(async (req, res, next) => {
      const userId = req.user.id;
      const file = req.file;
      const { profilePictureId, ...updateData } = req.body;

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
     * @function getProfilePictures
     * @description Mengambil daftar riwayat foto profil milik user yang sedang login.
     * @route GET /api/users/me/pictures
     * @access Private
     * @param {import("express").Request} req - Objek request Express.
     * @param {import("express").Response} res - Objek response Express.
     * @param {import("express").NextFunction} next - Fungsi middleware berikutnya.
     * @returns {Promise<void>} JSON berisi daftar foto profil user.
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
     * @function deleteProfilePicture
     * @description Menghapus sebuah foto dari riwayat foto profil user.
     * @route DELETE /api/users/me/pictures/:pictureId
     * @access Private
     * @param {import("express").Request} req - Objek request Express (req.params.pictureId harus ada).
     * @param {import("express").Response} res - Objek response Express.
     * @param {import("express").NextFunction} next - Fungsi middleware berikutnya.
     * @returns {Promise<void>} JSON berisi data user setelah foto dihapus dari history.
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
  };
};
