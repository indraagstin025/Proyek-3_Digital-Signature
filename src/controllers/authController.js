/**
 * @description Sebuah factory function yang membuat dan mengembalikan objek controller
 * dengan semua fungsi handler rute yang dibutuhkan.
 * @param {object} authService - Instance dari AuthService yang telah terinisialisasi.
 * @returns {object} - Objek yang berisi semua handler controller.
 */
export const createAuthController = (authService) => {
    return {
        /**
         * Controller untuk menangani registrasi pengguna.
         * Validasi input sudah ditangani oleh middleware di level rute.
         */
        register: async (req, res) => {
            try {
                // Validasi manual dihapus, karena sudah ditangani oleh express-validator.
                const { email, password, name, phoneNumber, address } = req.body;
                const additionalData = { name, phoneNumber, address };
                const newUser = await authService.registerUser(email, password, additionalData);

                // Buat objek respons yang bersih tanpa password hash
                const userResponse = {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                };

                return res.status(201).json({
                    message: 'Registrasi berhasil. Silakan cek email Anda untuk verifikasi.',
                    data: userResponse,
                });
            } catch (error) {
                console.error("Error di controller register:", error);
                if (error.message.includes("Email sudah terdaftar")) {
                    return res.status(409).json({ message: error.message });
                }
                return res.status(400).json({ message: error.message || "Registrasi gagal." });
            }
        },

        /**
         * Controller untuk menangani login pengguna.
         */
        login: async (req, res) => {
            try {
                // Validasi manual dihapus.
                const { email, password } = req.body;
                const result = await authService.loginUser(email, password);

                res.status(200).json({
                    message: 'Login berhasil',
                    session: result.session,
                    user: result.user,
                });
            } catch (error) {
                res.status(401).json({ message: error.message || "Email atau password salah." });
            }
        },

        /**
         * Controller untuk menangani logout pengguna.
         * Token diverifikasi oleh authMiddleware.
         */
        logout: async (req, res) => {
            try {
                // Tidak perlu lagi mengambil token dari header secara manual.
                await authService.logoutUser();
                res.status(200).json({ message: 'Anda telah berhasil Logout.' });
            } catch (error) {
                res.status(500).json({ message: 'Logout gagal, terjadi kesalahan pada server.' });
            }
        },

        /**
         * @description Controller untuk menangani permintaan reset password.
         */
        forgotPassword: async (req, res) => {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({ message: 'Email wajib diisi.' });
            }

            try {
                const { error } = await authService.forgotPassword(email);

                if (error) {
                    console.error(error);
                    return res.status(400).json({ message: error.message });
                }

                return res.status(200).json({
                    message: 'Jika email terdaftar, link untuk reset password sudah dikirimkan.',
                });
            } catch (error) {
                console.error(error);
                return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
            }
        },

        /**
         * @description Controller untuk menangani proses reset password.
         */
        resetPassword: async (req, res) => {
            const { token, newPassword } = req.body;
            if (!token || !newPassword) {
                console.warn("⚠️ Token atau password baru tidak ada");
                return res.status(400).json({
                    message: 'Token dan password baru wajib diisi.'
                });
            }

            try {
                const result = await authService.resetPassword(token, newPassword);
                return res.status(200).json({
                    message: result.message || 'Password berhasil diubah. Silakan login kembali.'
                });
            } catch (error) {
                console.error("❌ Reset password error (controller):", error);

                return res.status(500).json({
                    message: error.message || 'Terjadi kesalahan pada server.'
                });
            }
        }


    };
};