import { Prisma } from '@prisma/client';
import { DocumentRepository } from "../interface/DocumentRepository.js";
import DocumentError from '../../errors/DocumentError.js';
import CommonError from '../../errors/CommonError.js';

/**
 * @description Implementasi dari DocumentRepository yang menggunakan Prisma ORM.
 * @implements {DocumentRepository}
 */
export class PrismaDocumentRepository extends DocumentRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma - Instance PrismaClient yang diinjeksi.
     */
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }

    /**
     * @description Membuat Dokumen baru beserta Versi pertamanya dalam satu transaksi.
     * @param {string} userId - ID pemilik.
     * @param {string} title - Judul dokumen.
     * @param {string} url - URL file untuk versi pertama.
     * @param {string} hash - Hash file untuk versi pertama.
     * @returns {Promise<object>} Objek dokumen yang baru dibuat.
     * @throws {CommonError.DatabaseError} Jika transaksi gagal.
     */
    async createWithFirstVersion(userId, title, url, hash) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const document = await tx.document.create({
                    data: { userId, title, status: 'draft' },
                });

                const version = await tx.version.create({
                    data: { documentId: document.id, url, hash, versionNumber: 1 },
                });

                return tx.document.update({
                    where: { id: document.id },
                    data: { currentVersionId: version.id },
                    include: { currentVersion: true },
                });
            });
        } catch (error) {
            throw CommonError.DatabaseError(`Gagal membuat dokumen dalam transaksi: ${error.message}`);
        }
    }

    /**
     * @description Mengambil semua dokumen milik user, beserta detail versi terkininya.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<Array<object>>} Daftar dokumen.
     */
    async findAllByUserId(userId) {
        return this.prisma.document.findMany({
            where: { userId },
            include: { currentVersion: true },
            orderBy: { createdAt: "desc" },
        });
    }

    /**
     * @description Mencari satu dokumen berdasarkan ID dan ID user.
     * @param {string} documentId - ID dokumen.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<object|null>} Dokumen yang ditemukan atau null.
     */
    async findById(documentId, userId) {
        return this.prisma.document.findFirst({
            where: { id: documentId, userId: userId },
            include: { currentVersion: true },
        });
    }

    /**
     * @description Memperbarui data pada tabel Dokumen.
     * @param {string} documentId - ID dokumen.
     * @param {object} dataToUpdate - Data yang akan diupdate.
     * @returns {Promise<object>} Dokumen yang telah diupdate.
     * @throws {DocumentError.NotFound} Jika dokumen tidak ditemukan.
     * @throws {CommonError.DatabaseError} Jika terjadi error lain.
     */
    async update(documentId, dataToUpdate) {
        try {
            return await this.prisma.document.update({
                where: { id: documentId },
                data: dataToUpdate,
                include: { currentVersion: true },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw DocumentError.NotFound(`Dokumen dengan ID ${documentId} tidak ditemukan untuk diperbarui.`);
            }
            throw CommonError.DatabaseError(error.message);
        }
    }

    /**
     * @description Menghapus record dokumen dari database berdasarkan ID.
     * @param {string} documentId - ID dokumen.
     * @returns {Promise<object>} Dokumen yang telah dihapus.
     * @throws {DocumentError.NotFound} Jika dokumen tidak ditemukan.
     * @throws {CommonError.DatabaseError} Jika terjadi error lain.
     */
    async deleteById(documentId) {
        try {
            return await this.prisma.document.delete({ where: { id: documentId } });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw DocumentError.NotFound(`Dokumen dengan ID ${documentId} tidak ditemukan untuk dihapus.`);
            }
            throw CommonError.DatabaseError(error.message);
        }
    }
}