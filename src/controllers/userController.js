import { validationResult } from "express-validator";

/**
 * @description Factory function untuk membuat user controller.
 * Mengenkapsulasi semua logika rute yang berhubungan dengan pengguna.
 * @param {object} userService - Instance dari service pengguna untuk interaksi data.
 * @returns {object} Objek yang berisi semua metode controller pengguna.
 */
export const createUserController = (userService) => {
  return {
    /**
     * @description Mengambil profil dari pengguna yang sedang login.
     * @param {object} req - Objek request Express, diharapkan berisi `req.user.id` dari middleware autentikasi.
     * @param {object} res - Objek response Express.
     * @returns {Promise<void>} Mengirimkan data profil pengguna atau pesan error.
     */
    getMyProfile: async (req, res) => {
      try {
        const userId = req.user.id;
        const user = await userService.getMyProfile(userId);

        if (!user) {
          return res.status(404).json({ message: "Profil user tidak ditemukan" });
        }
        res.status(200).json({ data: user });
      } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server saat mengambil profil pengguna" });
      }
    },

    /**
     * @description Membuat pengguna baru.
     * @param {object} req - Objek request Express, berisi `name`, `email`, `password` di dalam `req.body`.
     * @param {object} res - Objek response Express.
     * @returns {Promise<void>} Mengirimkan data pengguna yang baru dibuat atau pesan error validasi/server.
     */
    createUser: async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
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
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: error.message || "Terjadi kesalahan pada server" });
      }
    },

    /**
     * @description Memperbarui profil pengguna yang sedang login.
     * Menangani tiga skenario: upload foto baru, menggunakan foto lama, atau hanya update data teks.
     * @param {object} req - Objek request Express. Bisa berisi `req.file` (dari multer), `profilePictureId` di body, dan data profil lainnya.
     * @param {object} res - Objek response Express.
     * @returns {Promise<void>} Mengirimkan data profil yang telah diperbarui.
     */
    updateMyProfile: async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const userId = req.user.id;
        const file = req.file;
        const { profilePictureId, ...updateData } = req.body;

        const isBodyEmpty = Object.keys(updateData).length === 0;
        const hasNoFile = !file;
        const hasNoOldPictureId = !profilePictureId;

        if (isBodyEmpty && hasNoFile && hasNoOldPictureId) {
          const currentUser = await userService.getMyProfile(userId);
          return res.status(200).json({
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
          message: "Profil berhasil diperbarui",
          data: updatedUser,
        });
      } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: error.message || "Terjadi kesalahan pada server" });
      }
    },

    /**
     * @description Mengambil daftar riwayat foto profil milik pengguna yang sedang login.
     * @param {object} req - Objek request Express.
     * @param {object} res - Objek response Express.
     * @returns {Promise<void>} Mengirimkan daftar URL dan ID foto profil.
     */
    getProfilePictures: async (req, res) => {
      try {
        const userId = req.user.id;
        const pictures = await userService.getUserProfilePictures(userId);

        res.status(200).json({
          message: "Daftar foto profil berhasil diambil",
          data: pictures,
        });
      } catch (error) {
        console.error("Error fetching profile pictures:", error);
        res.status(500).json({ message: error.message || "Terjadi kesalahan pada server" });
      }
    },

    /**
     * @description Mengatur foto profil lama dari riwayat untuk menjadi foto profil aktif saat ini.
     * @param {object} req - Objek request Express, berisi `pictureId` di `req.params`.
     * @param {object} res - Objek response Express.
     * @returns {Promise<void>} Mengirimkan data profil yang telah diperbarui.
     */
    useOldProfilePicture: async (req, res) => {
      try {
        const userId = req.user.id;
        const { pictureId } = req.params;

        if (!pictureId || !/^[0-9a-fA-F-]{36}$/.test(pictureId)) {
          return res.status(400).json({ message: "ID foto profil tidak valid" });
        }

        const updatedUser = await userService.updateUserProfileWithOldPicture(userId, {}, pictureId);

        res.status(200).json({
          message: "Foto profil berhasil diganti dengan foto lama",
          data: updatedUser,
        });
      } catch (error) {
        console.error("Error using old profile picture:", error);
        res.status(500).json({ message: error.message || "Terjadi kesalahan pada server" });
      }
    },

    /**
     * @description Menghapus sebuah foto dari riwayat foto profil pengguna.
     * @param {object} req - Objek request Express, berisi `pictureId` di `req.params`.
     * @param {object} res - Objek response Express.
     * @returns {Promise<void>} Mengirimkan data profil terbaru setelah foto dihapus.
     */
    deleteProfilePicture: async (req, res) => {
      try {
        const userId = req.user.id;
        const { pictureId } = req.params;
        const updatedUser = await userService.deleteUserProfilePicture(userId, pictureId);

        res.status(200).json({
          message: "Foto profil berhasil dihapus dari history",
          data: updatedUser,
        });
      } catch (error) {
        console.error("Error deleting profile picture:", error);
        res.status(500).json({ message: error.message || "Terjadi kesalahan pada server" });
      }
    },
  };
};