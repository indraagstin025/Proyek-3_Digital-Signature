import * as authService from '../services/authService.js';

export const register = async (req, res) => {
    try {
        const {email, password, name, phoneNumber, address} = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({message: 'Email, password, dan nama wajib diisi. '});
        }

        const additionalData = {name, phoneNumber, address};
        const result = await authService.registerUser(email, password, additionalData);

        res.status(201).json({
            message: 'Registrasi berhasil! Silakan cek email Anda untuk verifikasi. ',
            data: result.localUser,
        });
    } catch (error) {
        res.status(400).json({message: error.message});
    }
};

export const login = async (req, res) => {
    try {
        const { email, password} = req.body;

        if (!email || !password) {
            return res.status(400).json({message: 'Email dan password wajib diisi. '});
        }

        const result = await authService.loginUser(email, password);

        res.status(200).json({
            message: 'Login berhasil',
            session: result.session,
        });
    } catch (error) {

        res.status(401).json({message: error.message});

    }
}

export const logout = async (req, res) => {
    try {
        const token = req.headers.authorization.split('')[1];

        await authService.logoutUser(token);

        res.status(200).json({message: 'Anda telah berhasil Logout. '});
    } catch (error){
        res.status(500).json({message: error.message});
    }
};