import asyncHandler from "../utils/asyncHandler.js";

/**
 * Membuat objek controller untuk autentikasi.
 * Controller ini berfungsi sebagai jembatan antara request (client)
 * dengan service (logika utama autentikasi).
 *
 * @param {import('../services/authService.js').AuthService} authService - Instance dari AuthService yang berisi logika autentikasi.
 * @returns {object} - Kumpulan fungsi handler autentikasi untuk digunakan di routing.
 */
export const createAuthController = (authService) => {
  return {
    /**
     * Registrasi user baru.
     *
     * - Email dan password wajib diisi
     * - Data tambahan (nama, nomor telepon, alamat) bisa ditambahkan
     * - Jika berhasil, user baru dibuat dan dikirimkan instruksi verifikasi email
     *
     * @route POST /auth/register
     * @param {import("express").Request} req - Request dari client (berisi email, password, name, phoneNumber, address).
     * @param {import("express").Response} res - Response ke client.
     * @param {Function} next - Middleware berikutnya (untuk error handling).
     * @returns {Promise<object>} Response JSON berisi user baru.
     */
    register: asyncHandler(async (req, res, next) => {
      const { email, password, name, phoneNumber, address } = req.body;
      const additionalData = { name, phoneNumber, address };

      const newUser = await authService.registerUser(email, password, additionalData);

      res.status(201).json({
        success: true,
        message: "Registrasi berhasil. Silakan cek email Anda untuk verifikasi.",
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      });
    }),

    /**
     * Login user.
     *
     * - User memasukkan email dan password
     * - Jika sesuai, session/token login dikembalikan
     * - Data user juga ikut dikembalikan
     *
     * @route POST /auth/login
     * @param {import("express").Request} req - Request dari client (berisi email dan password).
     * @param {import("express").Response} res - Response ke client.
     * @param {Function} next - Middleware berikutnya.
     * @returns {Promise<object>} Response JSON berisi session dan data user.
     */
    login: asyncHandler(async (req, res, next) => {
      const { email, password } = req.body;

      const result = await authService.loginUser(email, password);

      res.status(200).json({
        success: true,
        message: "Login berhasil",
        data: {
          session: result.session,
          user: result.user,
        },
      });
    }),

    /**
     * Logout user.
     *
     * - Token diambil dari header Authorization
     * - Token dihapus/invalidasi dari sistem
     *
     * @route POST /auth/logout
     * @param {import("express").Request} req - Request dari client (berisi header Authorization dengan Bearer token).
     * @param {import("express").Response} res - Response ke client.
     * @param {Function} next - Middleware berikutnya.
     * @returns {Promise<object>} Response JSON konfirmasi logout.
     */
    logout: asyncHandler(async (req, res, next) => {
      const token = req.headers.authorization?.split(" ")[1];
      await authService.logoutUser(token);

      res.status(200).json({
        success: true,
        message: "Anda telah berhasil Logout.",
      });
    }),

    /**
     * Lupa password.
     *
     * - User memasukkan email
     * - Jika email terdaftar, sistem akan mengirimkan link reset password
     *
     * @route POST /auth/forgot-password
     * @param {import("express").Request} req - Request dari client (berisi email).
     * @param {import("express").Response} res - Response ke client.
     * @param {Function} next - Middleware berikutnya.
     * @returns {Promise<object>} Response JSON konfirmasi pengiriman link reset password.
     */
    forgotPassword: asyncHandler(async (req, res, next) => {
      const { email } = req.body;

      await authService.forgotPassword(email);

      res.status(200).json({
        success: true,
        message: "Jika email terdaftar, link reset password sudah dikirim.",
      });
    }),

    /**
     * Reset password.
     *
     * - User memasukkan token dan password baru
     * - Jika token valid, password user diperbarui
     *
     * @route POST /auth/reset-password
     * @param {import("express").Request} req - Request dari client (berisi token reset dan password baru).
     * @param {import("express").Response} res - Response ke client.
     * @param {Function} next - Middleware berikutnya.
     * @returns {Promise<object>} Response JSON konfirmasi bahwa password sudah diubah.
     */
    resetPassword: asyncHandler(async (req, res, next) => {
      const { token, newPassword } = req.body;

      const result = await authService.resetPassword(token, newPassword);

      res.status(200).json({
        success: true,
        message: result.message || "Password berhasil diubah. Silakan login kembali.",
      });
    }),
  };
};
