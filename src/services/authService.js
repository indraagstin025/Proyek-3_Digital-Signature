import { supabase } from "../config/supabaseClient.js";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * @description Mendaftarkan pengguna ke Supabase Auth dan menyimpannya ke database lokal.
 * @param {string} email - Email pengguna.
 * @param {string} password - Kata sandi pengguna.
 * @param {object} additionalData - Data tambahan pengguna (nama, phoneNumber, address).
 * @returns {Promise<object>} - Promise yang berisi data pengguna lokal yang baru dibuat.
 * @throws {Error} - Jika ada kegagalan saat registrasi atau penyimpanan data.
 */
export const registerUser = async (email, password, additionalData) => {

    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new Error("Email sudah terdaftar. Silakan gunakan email lain.");
    }

    // ✅ Daftar ke Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        throw new Error("Gagal mendaftarkan user di Supabase: " + authError.message);
    }
    if (!authData.user) {
        throw new Error("Registrasi Supabase berhasil namun data user tidak ditemukan.");
    }

    const newUserData = {
        id: authData.user.id, // pakai UUID dari Supabase
        email: authData.user.email,
        name: additionalData.name,
        phoneNumber: additionalData.phoneNumber,
        address: additionalData.address,
    };

    try {
        const localUser = await prisma.user.create({ data: newUserData });
        return localUser;
    } catch (dbError) {
        console.error("User di Supabase sudah dibuat, tapi gagal simpan ke DB lokal:", dbError);
        // ❌ Rollback: hapus user di Supabase kalau gagal simpan ke DB lokal
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error("Gagal menyimpan data pengguna. Silakan coba lagi.");
    }
};

/**
 * @description Mengautentikasi pengguna dan mengambil data dari database lokal.
 * @param {string} email - Email pengguna.
 * @param {string} password - Kata sandi pengguna.
 * @returns {Promise<object>} - Promise yang berisi session dari Supabase dan data pengguna lokal.
 * @throws {Error} - Jika login gagal.
 */
export const loginUser = async (email, password) => {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (authError) {
        throw new Error(authError.message);
    }
    if (!authData.user) {
        throw new Error("Login gagal: User tidak ditemukan.");
    }

    const localUser = await prisma.user.findUnique({
        where: { id: authData.user.id },
        select: {
            id: true,
            email: true,
            name: true,
            isSuperAdmin: true,
        },
    });

    if (!localUser) {
        throw new Error("Data pengguna tidak ditemukan di database lokal.");
    }

    return {
        session: authData.session,
        user: localUser,
    };
};

/**
 * @description Melakukan logout dari Supabase.
 * @returns {Promise<object>} - Promise yang berisi pesan sukses.
 * @throws {Error} - Jika logout gagal.
 */
export const logoutUser = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error("Logout error:", error);
        throw new Error('Gagal melakukan Logout: ' + error.message);
    }

    return { message: 'Logout Berhasil' };
};

/**
 * @description Meminta email reset password melalui Supabase.
 * @param {string} email - Email pengguna yang meminta reset password.
 * @returns {Promise<object>} - Promise yang berisi data atau error dari Supabase.
 */
export const forgotPassword = async (email) => {
    // Redirect ke halaman reset password di frontend
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: process.env.RESET_PASSWORD_URL || 'http://localhost:3000/reset-password',
    });

    if (error) {
        console.error("Forgot password error:", error);
        return { data: null, error };
    }

    return {
        data: { message: 'Jika email terdaftar, link untuk reset password sudah dikirimkan.' },
        error: null,
    };
};

/**
 * @description Mereset password pengguna dengan token yang diberikan.
 * @param {string} token - Token dari URL reset password.
 * @param {string} newPassword - Kata sandi baru pengguna.
 * @returns {Promise<object>} - Promise yang berisi data atau error dari Supabase.
 */
export const resetPassword = async (token, newPassword) => {
    // Menggunakan fungsi Supabase untuk menukar token dan memperbarui password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
        console.error("Reset password error:", updateError);
        throw new Error('Gagal mereset password: ' + updateError.message);
    }

    return {
        data: { message: 'Password berhasil diubah.' },
        error: null,
    };
};
