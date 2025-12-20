import asyncHandler from "../utils/asyncHandler.js";
import { serialize } from "cookie";

/**
 * Membuat instance AuthController.
 * @param {Object} authService - Service yang menangani logika bisnis autentikasi.
 * @returns {Object} Kumpulan method controller untuk rute autentikasi.
 */
export const createAuthController = (authService) => {
    const getCookieOptions = () => {
        const isProduction = process.env.NODE_ENV === "production";
        const cookieDomain = process.env.COOKIE_DOMAIN;

        return {
            httpOnly: true,
            path: "/",
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
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
            const { session, user } = await authService.loginUser(email, password);

            const OneWeek = 7 * 24 * 60 * 60 * 1000;
            const baseCookieOptions = getCookieOptions();

            // Set header cookie
            res.setHeader("Set-Cookie", [
                serialize("sb-access-token", session.access_token, {
                    ...baseCookieOptions,
                    maxAge: session.expires_in, // Sesuai expire dari Supabase
                    expires: new Date(Date.now() + session.expires_in * 1000),
                }),
                serialize("sb-refresh-token", session.refresh_token, {
                    ...baseCookieOptions,
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
         * @description Logout dan hapus cookie.
         * @route POST /api/auth/logout
         */
        logout: asyncHandler(async (req, res) => {
            await authService.logoutUser();

            const baseCookieOptions = getCookieOptions();

            res.setHeader("Set-Cookie", [
                serialize("sb-access-token", "", {
                    ...baseCookieOptions,
                    expires: new Date(0),
                }),
                serialize("sb-refresh-token", "", {
                    ...baseCookieOptions,
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