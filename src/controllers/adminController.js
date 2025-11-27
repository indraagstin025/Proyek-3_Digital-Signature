import asyncHandler from "../utils/asyncHandler.js";

/**
 * Membuat instance AdminController dengan dependency injection.
 * * @param {Object} adminService - Service yang menangani logika bisnis untuk admin/user.
 * @returns {Object} Objek yang berisi kumpulan method controller untuk rute admin.
 */
export const createAdminController = (adminService) => {
  return {
    /**
     * @description Mengambil semua daftar pengguna dari database.
     * * **Proses Kode:**
     * 1. Menerima request GET dari client.
     * 2. Memanggil `adminService.getAllUsers()` untuk mengambil data raw dari database.
     * 3. Mengembalikan response HTTP 200 (OK) beserta array data pengguna dan jumlah totalnya.
     * * @param {import("express").Request} req - Objek Request Express.
     * @param {import("express").Response} res - Objek Response Express.
     */
    getAllUsers: asyncHandler(async (req, res) => {
      const users = await adminService.getAllUsers();

      res.status(200).json({
        success: true,
        count: users.length,
        data: users,
      });
    }),

    /**
     * @description Membuat pengguna baru (Create User) melalui akses Admin.
     * * **Proses Kode:**
     * 1. Mengekstrak data `email`, `password`, `name`, dan `isSuperAdmin` dari `req.body`.
     * 2. Memanggil `adminService.createNewUser()` dan mengirimkan payload data tersebut untuk divalidasi dan disimpan ke database.
     * 3. Jika berhasil, mengembalikan response HTTP 201 (Created) dengan pesan sukses dan data user yang baru dibuat.
     * * @param {import("express").Request} req - Objek Request Express (Body berisi data user baru).
     * @param {import("express").Response} res - Objek Response Express.
     */
    createUser: asyncHandler(async (req, res) => {
      const { email, password, name, isSuperAdmin } = req.body;

      const newUser = await adminService.createNewUser({
        email,
        password,
        name,
        isSuperAdmin,
      });

      res.status(201).json({
        success: true,
        message: "User berhasil dibuat oleh admin.",
        data: newUser,
      });
    }),

    /**
     * @description Memperbarui data pengguna yang sudah ada berdasarkan ID.
     * * **Proses Kode:**
     * 1. Mengambil `userId` dari parameter URL (`req.params`).
     * 2. Mengambil data perubahan dari `req.body`.
     * 3. Memanggil `adminService.updateUser()` dengan `userId` dan data baru untuk melakukan update di database.
     * 4. Mengembalikan response HTTP 200 (OK) beserta data user yang telah diperbarui.
     * * @param {import("express").Request} req - Objek Request Express (Params: userId, Body: data update).
     * @param {import("express").Response} res - Objek Response Express.
     */
    updateUser: asyncHandler(async (req, res) => {
      const { userId } = req.params;

      const updatedUser = await adminService.updateUser(userId, req.body);

      res.status(200).json({
        success: true,
        message: "User berhasil diperbaharui.",
        data: updatedUser,
      });
    }),

    /**
     * @description Menghapus pengguna secara permanen berdasarkan ID.
     * * **Proses Kode:**
     * 1. Mengambil `userId` target dari parameter URL (`req.params`).
     * 2. Memanggil `adminService.deleteUser(userId)` untuk menghapus record dari database.
     * 3. Mengembalikan response HTTP 200 (OK) dengan pesan konfirmasi penghapusan.
     * * @param {import("express").Request} req - Objek Request Express (Params: userId).
     * @param {import("express").Response} res - Objek Response Express.
     */
    deleteUser: asyncHandler(async (req, res) => {
      const { userId } = req.params;

      await adminService.deleteUser(userId);

      res.status(200).json({
        success: true,
        message: `User dengan ID ${userId} berhasil dihapus`,
      });
    }),
  };
};
