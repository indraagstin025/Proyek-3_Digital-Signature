import asyncHandler from "../utils/asyncHandler.js";
import { serialize } from "cookie";

/**
 * @file Controller untuk menangani semua logika terkait autentikasi.
 * @author (Your Name)
 */

/**
 * Membuat instance dari Auth Controller.
 * @param {import('../services/authService.js').AuthService} authService - Instance dari AuthService.
 * @returns {object} Kumpulan metode controller untuk rute autentikasi
 */
export const createAuthController = (authService) => {
    return {
        /**
         * @route   POST /api/auth/register
         * @desc    Mendaftarkan pengguna baru ke sistem.
         * @access  Public
         * @param {import("express").Request} req - Request object dari Express.
         * @param {import("express").Response} res - Response object dari Express.
         * @param {Function} next - Middleware Express berikutnya.
         */
        register: asyncHandler(async (req, res, next) => {
            const { email, password, name, phoneNumber, address } = req.body;
            const additionalData = { name, phoneNumber, address };

            const newUser = await authService.registerUser(
                email,
                password,
                additionalData
            );

            res.status(201).json({
                success: true,
                message:
                    "Registrasi berhasil. Silakan cek email Anda untuk verifikasi.",
                data: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                },
            });
        }),

        /**
         * @route   POST /api/auth/login
         * @desc    Melakukan login pengguna dan mengatur HttpOnly cookie untuk session.
         * @access  Public
         * @param {import("express").Request} req - Request object dari Express.
         * @param {import("express").Response} res - Response object dari Express.
         * @param {Function} next - Middleware Express berikutnya.
         */
        login: asyncHandler(async (req, res) => {
            const { email, password } = req.body;

            const { session, user } = await authService.loginUser(email, password);

            const cookieOptions = {
                httpOnly: true,
                path: "/",
                secure: true,
                sameSite: "none",
            };

            res.setHeader("Set-Cookie", [
                serialize("sb-access-token", session.access_token, {
                    ...cookieOptions,
                    maxAge: session.expires_in,
                }),
                serialize("sb-refresh-token", session.refresh_token, {
                    ...cookieOptions,
                    maxAge: 60 * 60 * 24 * 7,
                }),
            ]);

            res.status(200).json({
                success: true,
                message: "Login berhasil",
                data: { user },
            });
        }),



        /**
         * @route   POST /api/auth/logout
         * @desc    Melakukan logout pengguna dengan membersihkan session cookie.
         * @access  Private
         * @param {import("express").Request} req - Request object dari Express.
         * @param {import("express").Response} res - Response object dari Express.
         * @param {Function} next - Middleware Express berikutnya.
         */
        logout: asyncHandler(async (req, res, next) => {
            await authService.logoutUser();

            res.setHeader("Set-Cookie", [
                serialize("sb-access-token", "", { path: "/", expires: new Date(0) }),
                serialize("sb-refresh-token", "", { path: "/", expires: new Date(0) }),
            ]);

            res.status(200).json({
                success: true,
                message: "Anda telah berhasil Logout.",
            });
        }),

        /**
         * @route   POST /api/auth/forgot-password
         * @desc    Mengirim email untuk proses lupa password.
         * @access  Public
         * @param {import("express").Request} req - Request object dari Express.
         * @param {import("express").Response} res - Response object dari Express.
         * @param {Function} next - Middleware Express berikutnya.
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
         * @route   POST /api/auth/reset-password
         * @desc    Mereset password pengguna menggunakan 'code' dari email.
         * @access  Public
         * @param {import("express").Request} req - Request object dari Express.
         * @param {import("express").Response} res - Response object dari Express.
         * @param {Function} next - Middleware Express berikutnya.
         */
        resetPassword: asyncHandler(async (req, res, next) => {
            const { accessToken, refreshToken, newPassword } = req.body;

            const result = await authService.resetPassword(accessToken, refreshToken, newPassword);

            res.status(200).json({
                success: true,
                message: result.message,
            });
        }),

    };
};