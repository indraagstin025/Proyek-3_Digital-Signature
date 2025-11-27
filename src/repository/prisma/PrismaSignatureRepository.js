import { SignatureRepository } from "../interface/SignatureRepository.js";

/**
 * @description Implementasi SignatureRepository menggunakan Prisma.
 * Bertanggung jawab atas interaksi database khusus untuk tanda tangan.
 */
export class PrismaSignatureRepository extends SignatureRepository {
    /**
     * @param {PrismaClient} prisma - Instance dari Prisma Client.
     */
    constructor(prisma) {
        super();
        if (!prisma) {
            throw new Error("Prisma Client harus disediakan.");
        }
        this.prisma = prisma;
    }

    /**
     * [METHOD LAMA]
     * @description Membuat data tanda tangan personal baru di database.
     * @param {object} data - Data lengkap untuk membuat SignaturePersonal.
     * @returns {Promise<object>}
     */
    async createPersonal(data) {
        return this.prisma.signaturePersonal.create({
            data: data,
        });
    }

    /**
     * [FIXED V3] Membuat signature baru (Generic).
     * Digunakan oleh AI Auto-Tagging.
     * Menyesuaikan dengan keterbatasan Schema Prisma (tanpa kolom 'type').
     */
    async createSignature(data) {

        // Hapus properti 'type' dari data input agar Prisma tidak error
        // (Karena kolom 'type' tidak ada di database)
        const { type, ...validData } = data;

        return this.prisma.signaturePersonal.create({
            data: {
                documentVersion: {
                    connect: { id: validData.documentVersionId }
                },
                signer: {
                    connect: { id: validData.userId }
                },

                pageNumber: validData.pageNumber,
                positionX: validData.positionX,
                positionY: validData.positionY,
                width: validData.width,
                height: validData.height,

                // Trik: Gunakan string kosong untuk menandai placeholder
                signatureImageUrl: validData.signatureImageUrl || "",

                // Gunakan nilai default valid dari Enum SigningMethod
                // Jika 'auto', kita paksa jadi 'canvas' agar database terima.
                method: (validData.method === 'auto' || !validData.method) ? 'canvas' : validData.method,

                ipAddress: validData.ipAddress || null,
                userAgent: validData.userAgent || null
            },
        });
    }

    /**
     * @description Menemukan satu tanda tangan berdasarkan ID uniknya.
     * Digunakan untuk verifikasi, sehingga harus menyertakan semua data kriptografi.
     * @param {string} signatureId - ID dari tanda tangan.
     * @returns {Promise<object|null>}
     */
    async findById(signatureId) {
        return this.prisma.signaturePersonal.findUnique({
            where: { id: signatureId },
            include: {
                signer: true,
                documentVersion: {
                    include: {
                        document: true,
                    },
                },
            },
        });
    }

    /**
     * @description Menemukan semua tanda tangan yang terhubung ke satu versi dokumen.
     * @param {string} documentVersionId - ID dari versi dokumen.
     * @returns {Promise<object[]>}
     */
    async findByVersionId(documentVersionId) {
        return this.prisma.signaturePersonal.findMany({
            where: { documentVersionId: documentVersionId },
            include: {
                signer: true,
            },
        });
    }

    /**
     * @description Memperbarui data tanda tangan berdasarkan ID.
     * @param {string} signatureId - ID tanda tangan yang akan diperbarui.
     * @param {object} data - Data yang akan diperbarui.
     * @returns {Promise<object>} Objek tanda tangan setelah diperbarui.
     */
    async update(signatureId, data) {
        return this.prisma.signaturePersonal.update({
            where: { id: signatureId },
            data: data,
        });
    }
}