import asyncHandler from "../utils/asyncHandler.js";
import { serialize } from "cookie";

/**
 * Membuat instance AuthController.
 * @param {Object} authService - Service yang menangani logika bisnis autentikasi.
 * @returns {Object} Kumpulan method controller untuk rute autentikasi.
 */
export const createAuthController = (authService) => {
  /**
   * Helper untuk mendapatkan konfigurasi cookie yang konsisten.
   * PENTING: Harus SAMA PERSIS dengan yang ada di authMiddleware.js
   */
  const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieDomain = process.env.COOKIE_DOMAIN;

    return {
      httpOnly: true,
      path: "/",

      // [FIX] Cross-Site Cookie: Gunakan 'none' agar bisa diakses dari domain frontend yang berbeda
      // Wajib Secure: true jika SameSite: none
      secure: isProduction, // Pastikan production menggunakan HTTPS
      sameSite: isProduction ? "none" : "lax", // None untuk Prod (Cross-Site), Lax untuk Dev (Localhost)

      domain: isProduction && cookieDomain ? cookieDomain : undefined,
    };
  };

  return {
    /**
     * @description Mendaftarkan pengguna baru
     * Proses:
     * 1. Validasi input (email format, password strength, required fields)
     * 2. Cek apakah email sudah terdaftar di database
     * 3. Encrypt password dengan bcrypt
     * 4. Simpan data user baru ke Supabase Auth
     * 5. Simpan data tambahan user (name, phoneNumber, address) ke database
     * 6. Kirim email verifikasi ke alamat email user
     * 7. Return user data tanpa password
     * @route POST /api/auth/register
     * @param {string} email - Email user (unique, format email valid)
     * @param {string} password - Password minimal 8 karakter
     * @param {string} name - Nama lengkap user
     * @param {string} [phoneNumber] - Nomor telepon (opsional)
     * @param {string} [address] - Alamat lengkap (opsional)
     * @returns {201} User baru berhasil dibuat dengan id, email, name
     * @error {400} Email sudah terdaftar atau validasi gagal
     * @error {400} Password tidak memenuhi kriteria (minimal 8 karakter)
     * @error {500} Server error atau gagal kirim email
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
     * @description Login user dan set HTTP-only cookies
     * Proses:
     * 1. Validasi email dan password user
     * 2. Cek kredensial di Supabase Auth
     * 3. Jika valid, ambil session dan user data
     * 4. Set HTTP-only cookie untuk sb-access-token dan sb-refresh-token
     * 5. Cookie diset dengan domain domain untuk cross-subdomain access
     * 6. Return user data tanpa token (token hanya di cookie)
     * CATATAN: Token disimpan di HTTP-ONLY COOKIE, bukan di response body
     * @route POST /api/auth/login
     * @param {string} email - Email user terdaftar
     * @param {string} password - Password user
     * @returns {200} User login berhasil, cookies diset di header Set-Cookie
     * @error {401} Email atau password salah
     * @error {401} User belum verifikasi email
     * @error {500} Server error atau Supabase error
     */
    login: asyncHandler(async (req, res) => {
      const { email, password } = req.body;

      // 1. Proses Login ke Supabase
      const { session, user } = await authService.loginUser(email, password);

      // 2. Ambil Config Cookie (Lax + Domain)
      const cookieOptions = getCookieOptions();

      // 3. Debugging Ukuran Token (Opsional, untuk memantau limit 4KB)
      // Jika access token terlalu besar, cookie akan gagal diset browser tanpa error
      if (process.env.NODE_ENV !== "production") {
        const tokenSize = Buffer.byteLength(session.access_token || "", "utf8");
        console.log(`[AUTH] Login Token Size: ${tokenSize} bytes`);
      }

      // 4. Ensure maxAge is valid integer (minimum 1 hour = 3600 seconds)
      // Fix: Prevent undefined/0/decimal maxAge that causes cookie to not set
      const accessTokenMaxAge = Math.max(Math.floor(session.expires_in || 3600), 3600);

      // 5. Set Header Cookie
      res.setHeader("Set-Cookie", [
        serialize("sb-access-token", session.access_token, {
          ...cookieOptions,
          maxAge: accessTokenMaxAge, // ✅ Fixed: Validated integer >= 3600
        }),
        serialize("sb-refresh-token", session.refresh_token, {
          ...cookieOptions,
          maxAge: 60 * 60 * 24 * 7, // 7 hari (Detik)
        }),
      ]);

      res.status(200).json({
        success: true,
        message: "Login berhasil",
        data: { user },
      });
    }),

    /**
     * @description Logout user dan hapus HTTP-only cookies
     * Proses:
     * 1. Call logout service untuk invalidate session di backend
     * 2. Ambil cookie configuration untuk memastikan cookie terdelete
     * 3. Set cookie dengan maxAge=-1 untuk menghapus di browser
     * 4. Cookie options harus IDENTIK dengan saat set login
     * 5. Return success message
     * CATATAN: Cookie harus dihapus dengan options yang sama persis (domain, path, sameSite)
     * @route POST /api/auth/logout
     * @security cookieAuth: []
     * @returns {200} Logout berhasil, cookies dihapus
     * @error {401} User tidak authenticated atau cookie tidak valid
     * @error {500} Server error
     */
    logout: asyncHandler(async (req, res) => {
      await authService.logoutUser();

      const cookieOptions = getCookieOptions();

      // Hapus cookie dengan men-set expire ke masa lalu (Date 0)
      // PENTING: Options (domain/path) harus sama persis agar bisa terhapus
      res.setHeader("Set-Cookie", [
        serialize("sb-access-token", "", {
          ...cookieOptions,
          maxAge: -1,
          expires: new Date(0),
        }),
        serialize("sb-refresh-token", "", {
          ...cookieOptions,
          maxAge: -1,
          expires: new Date(0),
        }),
      ]);

      res.status(200).json({
        success: true,
        message: "Anda telah berhasil Logout.",
      });
    }),

    /**
     * @description Request link reset password via email
     * Proses:
     * 1. Validasi input email format
     * 2. Cari user berdasarkan email di database
     * 3. Jika user ditemukan, generate reset token
     * 4. Simpan reset token dengan expiry time (biasanya 1 jam)
     * 5. Kirim email dengan link reset password ke user
     * 6. Jika email tidak ditemukan, tetap return success (untuk keamanan)
     * 7. User akan menerima email jika email terdaftar
     * CATATAN: Respon selalu success untuk mencegah email enumeration attack
     * @route POST /api/auth/forgot-password
     * @param {string} email - Email terdaftar untuk menerima link reset
     * @returns {200} Email reset password dikirim (atau akan dikirim jika email terdaftar)
     * @error {500} Server error atau gagal kirim email
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
     * @description Reset password menggunakan token dari email
     * Proses:
     * 1. Validasi input (accessToken, refreshToken, newPassword)
     * 2. Verify token dengan Supabase menggunakan access dan refresh token
     * 3. Cek apakah token sudah expired
     * 4. Validasi password baru (minimal 8 karakter, format password kuat)
     * 5. Jika valid, update password di Supabase Auth
     * 6. Invalidate old session/token
     * 7. Return success message
     * CATATAN: Token hanya berlaku beberapa jam dari email dikirim
     * @route POST /api/auth/reset-password
     * @param {string} accessToken - Access token dari link di email reset
     * @param {string} refreshToken - Refresh token dari link di email reset
     * @param {string} newPassword - Password baru minimal 8 karakter
     * @returns {200} Password berhasil direset
     * @error {400} Token tidak valid atau expired
     * @error {400} Password tidak memenuhi kriteria
     * @error {500} Server error atau Supabase error
     */
    resetPassword: asyncHandler(async (req, res) => {
      const { accessToken, refreshToken, newPassword } = req.body;
      const result = await authService.resetPassword(accessToken, refreshToken, newPassword);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    }),

    /**
     * @description Handle Google OAuth callback dari frontend
     * @route POST /api/auth/google/callback
     * @param {string} accessToken - Access token dari Supabase OAuth
     * @param {string} refreshToken - Refresh token dari Supabase OAuth
     */
    googleCallback: asyncHandler(async (req, res) => {
      const { accessToken, refreshToken } = req.body;

      // 1. Proses OAuth callback
      const { session, user } = await authService.handleGoogleCallback(accessToken, refreshToken);

      // 2. Set cookies sama seperti login biasa
      const cookieOptions = getCookieOptions();

      // Fix: Ensure maxAge is a valid integer (minimum 1 hour)
      const accessTokenMaxAge = Math.max(Math.floor(session.expires_in || 3600), 3600);

      res.setHeader("Set-Cookie", [
        serialize("sb-access-token", session.access_token, {
          ...cookieOptions,
          maxAge: accessTokenMaxAge,
        }),
        serialize("sb-refresh-token", session.refresh_token, {
          ...cookieOptions,
          maxAge: 60 * 60 * 24 * 7, // 7 hari
        }),
      ]);

      res.status(200).json({
        success: true,
        message: "Login dengan Google berhasil",
        data: { user },
      });
    }),
  };
};
