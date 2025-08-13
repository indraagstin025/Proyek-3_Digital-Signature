import * as authService from '../services/authService.js';

/**
 * @description Controller untuk menangani registrasi pengguna.
 * @param {object} req - Objek request dari Express.
 * @param {object} res - Objek response dari Express.
 */
export const register = async (req, res) => {
    try {
        const { email, password, name, phoneNumber, address } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ message: 'Email, password, dan nama wajib diisi.' });
        }

        const additionalData = { name, phoneNumber, address };
        const result = await authService.registerUser(email, password, additionalData);

        res.status(201).json({
            message: 'Registrasi berhasil. Silakan cek email Anda untuk verifikasi.',
            data: result,
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * @description Controller untuk menangani login pengguna.
 * @param {object} req - Objek request dari Express.
 * @param {object} res - Objek response dari Express.
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email dan password wajib diisi.' });
        }

        const result = await authService.loginUser(email, password);

        res.status(200).json({
            message: 'Login berhasil',
            session: result.session,
            user: result.user,
        });
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
};

/**
 * @description Controller untuk menangani logout pengguna.
 * @param {object} req - Objek request dari Express.
 * @param {object} res - Objek response dari Express.
 */
export const logout = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];

        await authService.logoutUser(token);

        res.status(200).json({ message: 'Anda telah berhasil Logout.' });
    } catch (error) {
        res.status(401).json({ message: 'Token tidak valid.' });
    }
};

/**
 * @description Controller untuk menangani permintaan reset password.
 * @param {object} req - Objek request dari Express.
 * @param {object} res - Objek response dari Express.
 */
export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email wajib diisi.'});
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
};

/**
 * @description Controller untuk menangani proses reset password.
 * @param {object} req - Objek request dari Express.
 * @param {object} res - Objek response dari Express.
 */
export const resetPassword = async (req, res) => {
    const { newPassword } = req.body;
    const { token } = req.query;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token dan password baru wajib diisi.'});
    }

    try {
        const { error } = await authService.resetPassword(token, newPassword);

        if (error) {
            console.error(error);
            return res.status(400).json({ message: error.message });
        }

        return res.status(200).json({
            message: 'Password berhasil diubah. Silakan login kembali.',
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};