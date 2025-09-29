import { Prisma } from '@prisma/client';
import { VersionRepository } from "../interface/VersionRepository.js";
import DocumentError from '../../errors/DocumentError.js'; // Gunakan DocumentError untuk error terkait versi
import CommonError from '../../errors/CommonError.js';

/**
 * @description Implementasi Repository untuk model 'Version' menggunakan Prisma.
 * @implements {VersionRepository}
 */
export class PrismaVersionRepository extends VersionRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma - Instance PrismaClient yang diinjeksi.
     */
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }

    /**
     * @description Membuat record versi dokumen baru.
     * @param {object} data - Data untuk versi baru.
     * @returns {Promise<object>}
     */
    async create(data) {
        // Metode create biasanya melempar error jika ada constraint violation (misal: foreign key),
        // yang bisa ditangani sebagai CommonError.DatabaseError jika diperlukan.
        // Untuk saat ini, membiarkannya bubble up ke service sudah cukup.
        return this.prisma.version.create({ data });
    }

    /**
     * @description Mencari versi dokumen berdasarkan hash untuk user tertentu.
     * @param {string} userId
     * @param {string} hash
     * @returns {Promise<object|null>}
     */
    async findByUserAndHash(userId, hash) {
        return this.prisma.version.findFirst({
            where: {
                document: {
                    userId: userId,
                },
                hash: hash,
            },
        });
    }

    /**
     * @description Mencari satu versi dokumen berdasarkan ID-nya, beserta relasinya.
     * @param {string} versionId
     * @returns {Promise<object|null>}
     */
    async findById(versionId) {
        return this.prisma.version.findUnique({
            where: { id: versionId },
            include: {
                document: true,
                signaturesPersonal: true,
            },
        });
    }

    /**
     * @description Mengambil semua versi dari satu dokumen, beserta relasinya.
     * @param {string} documentId
     * @returns {Promise<Array<object>>}
     */
    async findAllByDocumentId(documentId) {
        return this.prisma.version.findMany({
            where: { documentId },
            orderBy: { versionNumber: "desc" },
            include: {
                signaturesPersonal: true,
            },
        });
    }

    /**
     * @description Memperbarui data pada record versi dokumen.
     * @param {string} versionId - ID versi yang akan diperbarui.
     * @param {object} data - Data untuk diperbarui.
     * @returns {Promise<object>}
     * @throws {DocumentError.VersionNotFound} Jika versi tidak ditemukan.
     * @throws {CommonError.DatabaseError} Jika terjadi error database lainnya.
     */
    async update(versionId, data) {
        try {
            return await this.prisma.version.update({
                where: { id: versionId },
                data: data,
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw DocumentError.VersionNotFound(`Versi dengan ID ${versionId} tidak ditemukan untuk diperbarui.`);
            }
            throw CommonError.DatabaseError(error.message);
        }
    }

    /**
     * @description Menghapus satu versi dokumen dari database.
     * @param {string} versionId
     * @returns {Promise<object>}
     * @throws {DocumentError.VersionNotFound} Jika versi tidak ditemukan.
     * @throws {CommonError.DatabaseError} Jika terjadi error database lainnya.
     */
    async deleteById(versionId) {
        try {
            return await this.prisma.version.delete({
                where: { id: versionId },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw DocumentError.VersionNotFound(`Versi dengan ID ${versionId} tidak ditemukan untuk dihapus.`);
            }
            throw CommonError.DatabaseError(error.message);
        }
    }
}