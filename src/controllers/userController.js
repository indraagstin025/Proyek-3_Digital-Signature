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
     * * **Proses Kode:**
     * 1. Mengambil `userId` dari request user context (dari authentication middleware).
     * 2. Memanggil `userService.getMyProfile` untuk ambil data user dari database.
     * 3. Format URL avatar menggunakan `formatAvatarUrl` helper untuk normalisasi (signed URL jika dari storage).
     * 4. Mengembalikan data profil dengan avatar URL yang sudah diformat.
     * * @route   GET /api/users/me
     * @param {import("express").Request} req - Authenticated request.
     * @param {import("express").Response} res - Response object.
     * @access Private (authenticated users only)
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
     * @description Memperbarui profil pengguna dan/atau foto profil dengan 3 skenario berbeda.
     * * **Proses Kode:**
     * 1. Menerima updateData (fullName, phoneNumber), file (foto baru), atau profilePictureId (foto lama).
     * 2. **Skenario 1:** Tidak ada perubahan → Return profil current tanpa update.
     * 3. **Skenario 2:** Ada file foto baru → Call `updateUserProfileWithNewPicture`.
     * 4. **Skenario 3:** Gunakan foto lama dari history (profilePictureId) → Call `updateUserProfileWithOldPicture`.
     * 5. **Skenario 4:** Update teks saja → Call `updateUserProfile` + ambil history foto.
     * 6. Normalisasi URL di semua object (user utama & profile pictures array).
     * 7. Return updated data dengan formatted avatar URLs.
     * * @route   PUT /api/users/me
     * @param {import("express").Request} req - FormData: fullName, phoneNumber, profilePicture file, atau profilePictureId.
     * @param {import("express").Response} res - Response object.
     * @access Private (authenticated users only)
     * @note Mendukung multipart/form-data untuk upload file foto.
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
     * @description Mengambil riwayat semua foto profil yang pernah diupload user.
     * * **Proses Kode:**
     * 1. Mengambil `userId` dari request user context.
     * 2. Memanggil `userService.getUserProfilePictures` untuk ambil array history foto.
     * 3. Format setiap item dalam array menggunakan `formatAvatarUrl` untuk normalisasi URL.
     * 4. Mengembalikan list foto dengan URLs yang sudah diformat dan siap untuk ditampilkan.
     * * @route   GET /api/users/me/pictures
     * @param {import("express").Request} req - Authenticated request.
     * @param {import("express").Response} res - Response object.
     * @access Private (authenticated users only)
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
     * @description Menghapus salah satu foto dari riwayat profil.
     * * **Proses Kode:**
     * 1. Mengambil `userId` dari request user context dan `pictureId` dari parameter URL.
     * 2. Memanggil `userService.deleteUserProfilePicture` untuk:
     * - Hapus file foto dari storage.
     * - Update record di database (history foto & profil utama jika perlu).
     * 3. Format URL avatar di result (user utama & profilePictures array).
     * 4. Mengembalikan data user yang diupdate beserta history foto terbaru.
     * * @route   DELETE /api/users/me/pictures/:pictureId
     * @param {import("express").Request} req - Params: pictureId (ID foto dari history).
     * @param {import("express").Response} res - Response object.
     * @access Private (authenticated users only)
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
     * @description Mengambil informasi quota/limit penggunaan user.
     * * **Proses Kode:**
     * 1. Mengambil `userId` dari request user context.
     * 2. Memanggil `userService.getUserQuota` untuk ambil data quota dari database.
     * 3. Mengembalikan object dengan max/used limits untuk:
     * - Documents (maxDocuments, usedDocuments)
     * - Signatures (maxSignatures, usedSignatures)
     * - Storage (storageQuota, usedStorage dalam bytes)
     * * @route   GET /api/users/me/quota
     * @param {import("express").Request} req - Authenticated request.
     * @param {import("express").Response} res - Response object.
     * @access Private (authenticated users only)
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

    /**
     * @description Menandai bahwa user telah menyelesaikan tour/panduan tertentu.
     * * **Proses Kode:**
     * 1. Mengambil `userId` dari request user context.
     * 2. Menerima `tourKey` dari body (identifier unik untuk tour yang diselesaikan).
     * 3. Validasi bahwa tourKey tidak kosong, jika kosong throw 400 error.
     * 4. Memanggil `userService.updateTourProgress` untuk update status tour di database.
     * 5. Mengembalikan updated progress data untuk tracking onboarding di frontend.
     * * @route   PATCH /api/users/me/tour-progress
     * @param {import("express").Request} req - Body: tourKey (string identifier).
     * @param {import("express").Response} res - Response object.
     * @access Private (authenticated users only)
     * @throws {CommonError.BadRequest} Jika tourKey tidak diisi.
     */
    updateTourProgress: asyncHandler(async (req, res, next) => {
      const userId = req.user.id;
      const { tourKey } = req.body;

      if (!tourKey) {
        return res.status(400).json({
          status: "fail",
          message: "tourKey wajib diisi.",
        });
      }

      const updatedProgress = await userService.updateTourProgress(userId, tourKey);

      res.status(200).json({
        status: "success",
        message: `Tour '${tourKey}' berhasil disimpan.`,
        data: updatedProgress,
      });
    }),

    /**
     * @description User membuat laporan baru (bug/feedback).
     * @route POST /api/users/reports
     */
    createReport: asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { title, description } = req.body;

      const report = await userService.createReport(userId, { title, description });

      res.status(201).json({
        status: "success",
        message: "Laporan berhasil dikirim, terima kasih atas masukan Anda.",
        data: report,
      });
    }),
  };
};
