import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();


/**
 * Membuat user baru di database PostgreSQL lokal.
 * @param {object} userData - Data user, termasuk ID dari Supabase.
 * @returns {object} - User yang baru dibuat.
 */
export const createUser = async (userData) => {
    const existingUser = await prisma.user.findUnique({
        where: {
            email: userData.email,
        },
    });

    if (existingUser) {
        throw new Error("Email sudah terdaftar.");
    }

    const newUser = await prisma.user.create({
        data: userData,
    });

    return newUser;
};

/**
 * Mendapatkan data satu user berdasarkan ID.
 * @param {string} id - ID user.
 * @returns {object | null} - Data user atau null jika tidak ditemukan.
 */
export const getByUserId = async (id) => {
    const user = await prisma.user.findUnique({
        where: {
            id: id,
        },
    });
    return user;
};
