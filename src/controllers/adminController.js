/**
 * @description Factory function untuk membuat admin controller.
 * Controller ini menangani semua logika yang berkaitan dengan rute admin.
 * @param {object} userService - Instance dari service pengguna yang menyediakan metode untuk interaksi data pengguna.
 * @returns {object} Objek yang berisi metode-metode controller untuk admin.
 */
export const createAdminController = (userService) => {
  return {
    /**
     * @description Mengambil semua data pengguna dalam sistem.
     * Didesain untuk digunakan pada rute yang dilindungi dan hanya bisa diakses oleh admin.
     * @param {object} req - Objek request dari Express.
     * @param {object} res - Objek response dari Express.
     * @returns {Promise<void>} Mengirimkan respons JSON berisi daftar pengguna atau pesan error.
     */
    getAllUsers: async (req, res) => {
      try {
        const users = await userService.getAllUsers();
        res.status(200).json({ data: users });
      } catch (error) {
        console.error("Error fetching all users:", error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server saat mengambil semua pengguna.' });
      }
    },
  };
};