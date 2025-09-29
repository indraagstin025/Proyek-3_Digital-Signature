import asyncHandler from "../utils/asyncHandler.js";

/**
 * @description Factory Function untuk membuat auth controller.
 * @param {object} authService - Instance dari AuthService
 * @returns {object} - Object berisi semua handler controller.
 */
export const createAuthController = (authService) => {
    return {
        /**
         * Menangani registrasi pengguna.
         */
        register: asyncHandler(async (req, res, next) => {
            const { email, password, name, phoneNumber, address } = req.body;
            const additionalData = { name, phoneNumber, address };
            const newUser = await authService.registerUser(email, password, additionalData);

            const userResponse = {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
            };

            res.status(201).json({
                message: 'Registrasi berhasil. Silahkan cek email Anda untuk verifikasi.',
                data: userResponse,
            });
        }),

        /**
         * Menangani login pengguna.
         */
        login: asyncHandler(async (req, res, next) => {
            const { email, password } = req.body;
            const result = await authService.loginUser(email, password);

            res.status(200).json({
                success: true,
                message: 'Login berhasil',
                session: result.session,
                user: result.user,
            });
        }),

        /**
         * Menangani logout pengguna.
         */
        logout: asyncHandler(async (req, res, next) => {
            await authService.logoutUser();
            res.status(200).json({ message: 'Anda telah berhasil Logout.' });
        }),

        /**
         * Menangani permintaan reset password.
         */
        forgotPassword: asyncHandler(async  (req, res, next) => {
            const { email } = req.body;
            await authService.forgotPassword(email);

            res.status(200).json({
                message: 'Jika email terdaftar, link untuk reset password sydah dikirimkan.',
            });
        }),

        /**
         * Menangani proses reset password.
         */
        resetPassword: asyncHandler(async (req, res, next) => {
            const { token, newPassword } = req.body;
            const result = await authService.resetPassword(token, newPassword);

            res.status(200).json({
                message: result.message || 'Password berhasil diubah. Silahkan login kembali',
            });
        }),
    }
}