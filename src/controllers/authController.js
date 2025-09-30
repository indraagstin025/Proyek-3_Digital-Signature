import asyncHandler from '../utils/asyncHandler.js'; // <-- 1. Import asyncHandler

/**
 * Auth Controller dengan Dependency Injection
 * Semua dependency (service & error classes) di-inject dari luar.
 */
export const createAuthController = (authService) => {
    return {
        // ================================
        // REGISTER
        // ================================
        register: asyncHandler(async (req, res, next) => { // <-- 2. Bungkus fungsi dengan asyncHandler
            // Blok try...catch sudah tidak diperlukan lagi
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

        // ================================
        // LOGIN
        // ================================
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

        // ================================
        // LOGOUT
        // ================================
        logout: asyncHandler(async (req, res, next) => {
            const token = req.headers.authorization?.split(" ")[1];
            await authService.logoutUser(token);

            res.status(200).json({
                success: true,
                message: "Anda telah berhasil Logout.",
            });
        }),

        // ================================
        // FORGOT PASSWORD
        // ================================
        forgotPassword: asyncHandler(async (req, res, next) => {
            const { email } = req.body;

            await authService.forgotPassword(email);

            res.status(200).json({
                success: true,
                message: "Jika email terdaftar, link reset password sudah dikirim.",
            });
        }),

        // ================================
        // RESET PASSWORD
        // ================================
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