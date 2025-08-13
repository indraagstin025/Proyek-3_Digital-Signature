import * as authService from '../services/authService.js';

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
        // Status 400 lebih tepat untuk error seperti "Email sudah terdaftar."
        res.status(400).json({ message: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email dan password wajib diisi.' });
        }

        // Asumsi authService.loginUser mengembalikan { session, user: localUser }
        const result = await authService.loginUser(email, password);

        res.status(200).json({
            message: 'Login berhasil',
            session: result.session,
            user: result.user, // Kirim data pengguna dari database lokal
        });
    } catch (error) {
        // Status 401 untuk otentikasi gagal (password salah, dll.)
        res.status(401).json({ message: error.message });
    }
};

export const logout = async (req, res) => {
    try {
        // Perbaikan: Pisahkan token dengan spasi (' ')
        const token = req.headers.authorization.split(' ')[1];

        await authService.logoutUser(token);

        res.status(200).json({ message: 'Anda telah berhasil Logout.' });
    } catch (error) {
        // Status 401 untuk token yang tidak valid
        res.status(401).json({ message: 'Token tidak valid.' });
    }
};