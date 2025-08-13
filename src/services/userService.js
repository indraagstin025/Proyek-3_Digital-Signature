import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Membuat user baru di database PostgreSQL lokal.
 * @param {object} userData - Data user, termasuk ID dari Supabase.
 * @returns {object} - User yang baru dibuat.
 */
export const createUser = async (userData) => {
    // Pengecekan email unik di sini opsional, karena sudah ada di skema Prisma.
    // Jika email sudah ada, Prisma akan melemparkan P2002 error.
    try {
        const newUser = await prisma.user.create({
            data: userData,
        });
        return newUser;
    } catch (error) {
        if (error.code === 'P2002') {
            throw new Error('Email sudah terdaftar. ');
        }
        throw error;
    }
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
        select: {
            id: true,
            email: true,
            name: true,
            isSuperAdmin: true,
            createdAt: true,
            // Hindari mengambil data sensitif seperti passwordHash, jika ada
        }
    });
    return user;
};