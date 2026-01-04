import asyncHandler from "../utils/asyncHandler.js";
// ✅ IMPORT HELPER URL YANG BARU DIBUAT
import { formatAvatarUrl } from "../utils/urlHelper.js";

/**
 * Membuat instance UserController dengan Dependency Injection.
 * @param {import('../services/userService.js').UserService} userService
 * @returns {Object} Kumpulan method controller untuk manajemen user.
 */
export const createUserController = (userService) => {
  return {
    /**
     * @description Mengambil data profil lengkap dari pengguna yang sedang login.
     * @route   GET /api/users/me
     * @access  Private
     */
    getMyProfile: asyncHandler(async (req, res, next) => {
      const userId = req.user.id;
      const user = await userService.getMyProfile(userId);

      // 🔥 [MODIFIKASI] Format URL Foto sebelum dikirim ke frontend
      if (user) {
        user.profilePictureUrl = formatAvatarUrl(user.profilePictureUrl);
      }

      res.status(200).json({
        status: "success",
        data: user,
      });
    }),

    /**
     * @description Memperbarui profil pengguna & Foto Profil.
     * @route   PUT /api/users/me
     * @access  Private
     */
    updateMyProfile: asyncHandler(async (req, res, next) => {
      const userId = req.user.id;
      const file = req.file;
      const { profilePictureId, ...updateData } = req.body;

      let updatedData;

      // Skenario 1: Tidak ada perubahan
      if (Object.keys(updateData).length === 0 && !file && !profilePictureId) {
        updatedData = await userService.getFullUserProfileData(userId);

        // Format URL jika updatedData adalah object user langsung
        if (updatedData && updatedData.profilePictureUrl) {
          updatedData.profilePictureUrl = formatAvatarUrl(updatedData.profilePictureUrl);
        }

        return res.status(200).json({
          status: "success",
          message: "Tidak ada data yang diubah.",
          data: updatedData,
        });
      }

      // Skenario 2, 3, 4: Update dengan Foto Baru / Lama / Teks saja
      if (file) {
        updatedData = await userService.updateUserProfileWithNewPicture(userId, updateData, file);
      } else if (profilePictureId) {
        updatedData = await userService.updateUserProfileWithOldPicture(userId, updateData, profilePictureId);
      } else {
        const user = await userService.updateUserProfile(userId, updateData);
        const pictures = await userService.getUserProfilePictures(userId);
        updatedData = { user, profilePictures: pictures };
      }

      // 🔥 [MODIFIKASI] Normalisasi URL di dalam object updatedData
      // 1. Format User Utama
      if (updatedData.user) {
        updatedData.user.profilePictureUrl = formatAvatarUrl(updatedData.user.profilePictureUrl);
      }

      // 2. Format List History Foto (jika ada)
      if (updatedData.profilePictures && Array.isArray(updatedData.profilePictures)) {
        updatedData.profilePictures = updatedData.profilePictures.map((pic) => ({
          ...pic,
          // Asumsi nama kolom di table history adalah 'url' atau 'storagePath' atau 'profilePictureUrl'
          // Kita coba format kolom yang relevan
          url: formatAvatarUrl(pic.url || pic.path || pic.profilePictureUrl),
        }));
      }

      res.status(200).json({
        status: "success",
        message: "Profil berhasil diperbarui",
        data: updatedData,
      });
    }),

    /**
     * @description Mengambil riwayat semua foto profil.
     * @route   GET /api/users/me/pictures
     * @access  Private
     */
    getProfilePictures: asyncHandler(async (req, res, next) => {
      const userId = req.user.id;

      const pictures = await userService.getUserProfilePictures(userId);

      // 🔥 [MODIFIKASI] Format setiap item dalam array
      const formattedPictures = pictures.map((pic) => ({
        ...pic,
        url: formatAvatarUrl(pic.url || pic.path || pic.profilePictureUrl),
      }));

      res.status(200).json({
        status: "success",
        message: "Daftar foto profil berhasil diambil",
        data: formattedPictures,
      });
    }),

    /**
     * @description Menghapus salah satu foto dari riwayat.
     * @route   DELETE /api/users/me/pictures/:pictureId
     * @access  Private
     */
    deleteProfilePicture: asyncHandler(async (req, res, next) => {
      const userId = req.user.id;
      const { pictureId } = req.params;

      // result biasanya berisi { user, profilePictures }
      const result = await userService.deleteUserProfilePicture(userId, pictureId);

      // 🔥 [MODIFIKASI] Format hasil return
      if (result.user) {
        result.user.profilePictureUrl = formatAvatarUrl(result.user.profilePictureUrl);
      }
      if (result.profilePictures && Array.isArray(result.profilePictures)) {
        result.profilePictures = result.profilePictures.map((pic) => ({
          ...pic,
          url: formatAvatarUrl(pic.url || pic.path || pic.profilePictureUrl),
        }));
      }

      res.status(200).json({
        status: "success",
        message: "Foto profil berhasil dihapus dari history",
        data: result,
      });
    }),

    /**
     * @description Mengambil informasi quota/limit user.
     * @route   GET /api/users/me/quota
     * @access  Private
     */
    getMyQuota: asyncHandler(async (req, res, next) => {
      const userId = req.user.id;
      const quotaData = await userService.getUserQuota(userId);
      // Quota tidak ada hubungannya dengan foto, return langsung
      res.status(200).json({
        status: "success",
        data: quotaData,
      });
    }),
  };
};