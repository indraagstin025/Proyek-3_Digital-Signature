import asyncHandler from "../utils/asyncHandler.js";
import { serialize } from "cookie";

/**
 * Membuat instance AuthController.
 * @param {Object} authService - Service yang menangani logika bisnis autentikasi (misal: Supabase Auth).
 * @returns {Object} Kumpulan method controller untuk rute autentikasi.
 */
export const createAuthController = (authService) => {
  return {
    /**
     * @description Mendaftarkan pengguna baru ke dalam sistem.
     * * **Proses Kode:**
     * 1. Mengambil data `email`, `password`, `name`, `phoneNumber`, dan `address` dari `req.body`.
     * 2. Mengelompokkan data profil tambahan ke dalam objek `additionalData`.
     * 3. Memanggil `authService.registerUser` untuk membuat akun di database (dan memicu pengiriman email verifikasi).
     * 4. Mengembalikan response HTTP 201 (Created) dengan pesan sukses.
     * * @route   POST /api/auth/register
     * @access  Public
     * @param {import("express").Request} req - Body: email, password, name, phoneNumber, address.
     * @param {import("express").Response} res - Response object.
     */
    register: asyncHandler(async (req, res) => {
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
     * @description Melakukan login dan menyimpan session token ke dalam HTTP-Only Cookie.
     * * **Proses Kode:**
     * 1. Menerima `email` dan `password` dari client.
     * 2. Memanggil `authService.loginUser` untuk memverifikasi kredensial.
     * 3. Jika valid, service mengembalikan objek `session` (berisi token) dan data `user`.
     * 4. Menyiapkan konfigurasi cookie yang aman (`httpOnly`, `secure`, `sameSite`) untuk mencegah XSS attack.
     * 5. Mengatur header `Set-Cookie` untuk menyimpan `sb-access-token` dan `sb-refresh-token`.
     * 6. Mengembalikan response HTTP 200 beserta data user.
     * * @route   POST /api/auth/login
     * @access  Public
     * @param {import("express").Request} req - Body: email, password.
     * @param {import("express").Response} res - Response object (Set-Cookie header).
     */
    login: asyncHandler(async (req, res) => {
      const { email, password } = req.body;
      const { session, user } = await authService.loginUser(email, password);
      const OneWeek = 7 * 24 * 60 * 60 * 1000;
      const isProduction = process.env.NODE_ENV === "production";

      const cookieOptions = {
        httpOnly: true,
        path: "/",
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 60 * 60 * 24 * 7,
        expires: new Date(Date.now() + OneWeek),
      };

      res.setHeader("Set-Cookie", [
        serialize("sb-access-token", session.access_token, {
          ...cookieOptions,
          maxAge: session.expires_in,
          expires: new Date(Date.now() + session.expires_in * 1000),
        }),
        serialize("sb-refresh-token", session.refresh_token, {
          ...cookieOptions,
          maxAge: 60 * 60 * 24 * 7, // 7 hari
          expires: new Date(Date.now() + OneWeek),
        }),
      ]);

      res.status(200).json({
        success: true,
        message: "Login berhasil",
        data: { user },
      });
    }),

    /**
     * @description Mengakhiri sesi pengguna (Logout) dan menghapus cookie.
     * * **Proses Kode:**
     * 1. Memanggil `authService.logoutUser()` untuk menghapus sesi di sisi server/database (jika didukung).
     * 2. Menimpa cookie `sb-access-token` dan `sb-refresh-token` yang ada di browser dengan string kosong.
     * 3. Mengatur waktu kadaluwarsa (`expires`) cookie ke masa lalu (`new Date(0)`) agar browser segera menghapusnya.
     * 4. Mengembalikan response HTTP 200.
     * * @route   POST /api/auth/logout
     * @access  Private
     * @param {import("express").Request} req - Request object.
     * @param {import("express").Response} res - Response object (Clear Cookie).
     */
    logout: asyncHandler(async (req, res) => {
        await authService.logoutUser();
        const isProduction = process.env.NODE_ENV === "production";
        const cookieOptions = {
            path: "/",
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
        };

        res.setHeader("Set-Cookie", [
            serialize("sb-access-token", "", {
                ...cookieOptions,
                expires: new Date(0),
            }),
            serialize("sb-refresh-token", "", {
                ...cookieOptions,
                expires: new Date(0),
            }),
        ]);

        res.status(200).json({
            success: true,
            message: "Anda telah berhasil Logout.",
        });
    }),

    /**
     * @description Mengirim email berisi instruksi reset password.
     * * **Proses Kode:**
     * 1. Mengambil `email` target dari `req.body`.
     * 2. Memanggil `authService.forgotPassword` yang akan memicu provider auth untuk mengirim email.
     * 3. Mengembalikan pesan umum. Pesan ini sengaja dibuat tidak spesifik (misal: "Jika email terdaftar...") untuk keamanan (mencegah User Enumeration).
     * * @route   POST /api/auth/forgot-password
     * @access  Public
     * @param {import("express").Request} req - Body: email.
     * @param {import("express").Response} res - Response object.
     */
    forgotPassword: asyncHandler(async (req, res) => {
      const { email } = req.body;

      await authService.forgotPassword(email);

      res.status(200).json({
        success: true,
        message: "Jika email terdaftar, link reset password sudah dikirim ke email Anda.",
      });
    }),

    /**
     * @description Mengatur ulang password pengguna baru.
     * * **Proses Kode:**
     * 1. Menerima `accessToken` dan `refreshToken` (yang didapat dari link email redirect) serta `newPassword`.
     * 2. Memanggil `authService.resetPassword` untuk memperbarui password user terkait sesi token tersebut.
     * 3. Mengembalikan response sukses jika password berhasil diubah.
     * * @route   POST /api/auth/reset-password
     * @access  Public (namun butuh valid token dari flow email)
     * @param {import("express").Request} req - Body: accessToken, refreshToken, newPassword.
     * @param {import("express").Response} res - Response object.
     */
    resetPassword: asyncHandler(async (req, res) => {
      const { accessToken, refreshToken, newPassword } = req.body;

      const result = await authService.resetPassword(accessToken, refreshToken, newPassword);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    }),
  };
};
