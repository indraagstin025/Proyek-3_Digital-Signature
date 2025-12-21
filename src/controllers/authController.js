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

        // Pastikan variabel ini diisi ".moodvis.my.id" di Railway
        const cookieDomain = process.env.COOKIE_DOMAIN;

        return {
            httpOnly: true, // Wajib agar tidak bisa diakses JS client
            path: "/",

            // Production wajib HTTPS (Secure)
            secure: isProduction,

            // GUNAKAN 'lax' (Sama seperti Middleware)
            // Aman untuk Mobile dan Cross-Subdomain (www <-> api)
            sameSite: "lax",

            // WAJIB ADA DOMAIN (Sama seperti Middleware)
            // Agar cookie bisa dibaca oleh frontend 'www'
            domain: isProduction && cookieDomain ? cookieDomain : undefined,
        };
    };

    return {
        /**
         * @description Mendaftarkan pengguna baru.
         * @route POST /api/auth/register
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
         * @description Login dan set cookie.
         * @route POST /api/auth/login
         */
        login: asyncHandler(async (req, res) => {
            const { email, password } = req.body;

            // 1. Proses Login ke Supabase
            const { session, user } = await authService.loginUser(email, password);

            // 2. Ambil Config Cookie (Lax + Domain)
            const cookieOptions = getCookieOptions();

            // 3. Debugging Ukuran Token (Opsional, untuk memantau limit 4KB)
            // Jika access token terlalu besar, cookie akan gagal diset browser tanpa error
            if (process.env.NODE_ENV !== 'production') {
                const tokenSize = Buffer.byteLength(session.access_token || '', 'utf8');
                console.log(`[AUTH] Login Token Size: ${tokenSize} bytes`);
            }

            // 4. Set Header Cookie
            res.setHeader("Set-Cookie", [
                serialize("sb-access-token", session.access_token, {
                    ...cookieOptions,
                    maxAge: session.expires_in, // Sesuai expire dari Supabase (Detik)
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
         * @description Logout dan hapus cookie.
         * @route POST /api/auth/logout
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
         * @description Forgot Password.
         * @route POST /api/auth/forgot-password
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
         * @description Reset Password.
         * @route POST /api/auth/reset-password
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