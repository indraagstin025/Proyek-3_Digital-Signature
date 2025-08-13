// src/services/authService.js
import { supabase } from "../config/supabaseClient.js";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Mendaftarkan user ke Supabase Auth, lalu menyimpannya ke database lokal.
 * @param {string} email
 * @param {string} password
 * @param {object} additionalData - Berisi nama, phoneNumber, dll.
 * @returns {object} - Data user lokal yang baru dibuat.
 */
export const registerUser = async (email, password, additionalData) => {
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

    // Siapkan data untuk disimpan ke database lokal (Prisma)
    // isSuperAdmin akan otomatis 'false' sesuai default di schema.prisma
    const newUserData = {
        id: authData.user.id,
        email: authData.user.email,
        name: additionalData.name,
        phoneNumber: additionalData.phoneNumber,
        address: additionalData.address,
    };

    try {
        const localUser = await prisma.user.create({ data: newUserData });
        return localUser; // Cukup kembalikan data user lokal
    } catch (dbError) {
        console.error("User di Supabase sudah dibuat, tapi gagal simpan ke DB lokal:", dbError);
        // Disarankan untuk menghapus user di Supabase jika ini terjadi untuk menghindari user yatim.
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error("Gagal menyimpan data pengguna. Silakan coba lagi.");
    }
};

/**
 * Fungsi untuk melakukan Login.
 * @param {string} email
 * @param {string} password
 * @return {object} - Objek berisi session dari Supabase dan user dari database lokal.
 */
export const loginUser = async (email, password) => {
    // Langkah 1: Autentikasi dengan Supabase
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

    // Langkah 2: Ambil data user dari database lokal dengan Prisma
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

    // Langkah 3: Gabungkan dan kembalikan data
    return {
        session: authData.session,
        user: localUser,
    };
};

/**
 * Fungsi untuk Melakukan Logout.
 * @returns {object} - Hasil dari proses Logout.
 */
export const logoutUser = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error("Logout error:", error);
        throw new Error('Gagal melakukan Logout: ' + error.message);
    }

    return { message: 'Logout Berhasil' };
};