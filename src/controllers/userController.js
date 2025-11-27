import asyncHandler from "../utils/asyncHandler.js";

/**
 * Membuat instance UserController dengan Dependency Injection.
 * @param {import('../services/userService.js').UserService} userService - Service yang menangani logika bisnis pengguna.
 * @returns {Object} Kumpulan method controller untuk manajemen user.
 */
export const createUserController = (userService) => {
  return {
    /**
     * @description Mengambil data profil lengkap dari pengguna yang sedang login.
     * * **Proses Kode:**
     * 1. Mengambil `userId` dari token autentikasi (`req.user`).
     * 2. Memanggil `userService.getMyProfile` untuk mendapatkan data user.
     * - Service ini otomatis men-generate **Signed URL** baru untuk foto profil agar bisa diakses frontend.
     * 3. Mengembalikan response JSON berisi objek user.
     * * @route   GET /api/users/me
     * @access  Private
     * @param {import("express").Request} req - Request object (User ID dari token).
     * @param {import("express").Response} res - Response object.
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
     * @description Memperbarui profil pengguna (Nama, Password, dll) serta Foto Profil (Upload Baru atau Pilih dari Riwayat).
     * * **Proses Kode:**
     * 1. Mengekstrak `file` (jika upload baru), `profilePictureId` (jika pilih lama), dan sisa data (`updateData`) dari body.
     * 2. **Skenario 1 (Tanpa Perubahan):** Jika body kosong dan tidak ada file, kembalikan data user saat ini.
     * 3. **Skenario 2 (Upload Foto Baru):** Jika ada `req.file`, panggil `updateUserProfileWithNewPicture`. Service mengembalikan user + list foto terbaru.
     * 4. **Skenario 3 (Gunakan Foto Lama):** Jika ada `profilePictureId`, panggil `updateUserProfileWithOldPicture`.
     * 5. **Skenario 4 (Hanya Data Teks):** Jika hanya update nama/info lain, update user biasa, lalu fetch manual list foto agar response tetap konsisten formatnya (`{ user, profilePictures }`).
     * 6. Mengembalikan response seragam berisi data user dan array riwayat foto profil.
     * * @route   PUT /api/users/me
     * @access  Private
     * @param {import("express").Request} req - Body: updates, profilePictureId. File: req.file.
     * @param {import("express").Response} res - Response object.
     */
    updateMyProfile: asyncHandler(async (req, res, next) => {
      const userId = req.user.id;
      const file = req.file;
      const { profilePictureId, ...updateData } = req.body;

      let updatedData;

      if (Object.keys(updateData).length === 0 && !file && !profilePictureId) {
        updatedData = await userService.getFullUserProfileData(userId);

        return res.status(200).json({
          status: "success",
          message: "Tidak ada data yang diubah.",
          data: updatedData,
        });
      }

      if (file) {
        updatedData = await userService.updateUserProfileWithNewPicture(userId, updateData, file);
      } else if (profilePictureId) {
        updatedData = await userService.updateUserProfileWithOldPicture(userId, updateData, profilePictureId);
      } else {
        const user = await userService.updateUserProfile(userId, updateData);

        const pictures = await userService.getUserProfilePictures(userId);

        updatedData = { user, profilePictures: pictures };
      }

      res.status(200).json({
        status: "success",
        message: "Profil berhasil diperbarui",
        data: updatedData,
      });
    }),

    /**
     * @description Mengambil riwayat semua foto profil yang pernah digunakan user.
     * * **Proses Kode:**
     * 1. Mengambil `userId`.
     * 2. Memanggil service untuk mengambil daftar foto dari database.
     * 3. Service otomatis memperbarui Signed URL untuk setiap foto agar bisa ditampilkan di frontend.
     * 4. Mengembalikan array objek foto.
     * * @route   GET /api/users/me/pictures
     * @access  Private
     * @param {import("express").Request} req - Request object.
     * @param {import("express").Response} res - Response object.
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
     * @description Menghapus salah satu foto dari riwayat foto profil.
     * * **Proses Kode:**
     * 1. Mengambil `pictureId` target dari parameter URL.
     * 2. Memanggil `userService.deleteUserProfilePicture`.
     * 3. Service akan menghapus file dari Storage (Supabase/S3) dan record dari Database.
     * 4. Mengembalikan data user terbaru dan sisa daftar foto profil.
     * * @route   DELETE /api/users/me/pictures/:pictureId
     * @access  Private
     * @param {import("express").Request} req - Params: pictureId.
     * @param {import("express").Response} res - Response object.
     */
    deleteProfilePicture: asyncHandler(async (req, res, next) => {
      const userId = req.user.id;
      const { pictureId } = req.params;

      const result = await userService.deleteUserProfilePicture(userId, pictureId);

      res.status(200).json({
        status: "success",
        message: "Foto profil berhasil dihapus dari history",
        data: result,
      });
    }),
  };
};
