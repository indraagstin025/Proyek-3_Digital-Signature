import { VersionRepository } from "../interface/VersionRepository.js";
import VersionError from "../../errors/StorageError.js";

/**
 * @description Implementasi Repository untuk model 'DocumentVersion' menggunakan Prisma.
 */
export class PrismaVersionRepository extends VersionRepository {
    constructor(prisma) {
        super();
        if (!prisma) throw VersionError.InternalServerError("Prisma client tidak ditemukan.");
        this.prisma = prisma;
    }

    async create(data) {
        try {
            return await this.prisma.documentVersion.create({
                data: {
                    documentId: data.documentId,
                    userId: data.userId,
                    url: data.url,
                    hash: data.hash,
                    // Jika schema Prisma Anda memiliki kolom versionNumber,
                    // Anda bisa menambahkannya di sini (biasanya dihitung di service layer)
                },
            });
        } catch (err) {
            throw VersionError.InternalServerError(`Gagal membuat versi baru: ${err.message}`);
        }
    }

    async findByUserAndHash(userId, hash) {
        try {
            return await this.prisma.documentVersion.findUnique({
                where: {
                    user_document_version_hash_unique: {
                        userId,
                        hash,
                    },
                },
            });
        } catch (err) {
            throw VersionError.InternalServerError(`Gagal mengecek versi: ${err.message}`);
        }
    }

    async findById(versionId) {
        try {
            const version = await this.prisma.documentVersion.findUnique({
                where: { id: versionId },
                include: {
                    document: true,
                    signaturesPersonal: true,
                    signaturesGroup: true,
                    packages: {
                        include: {
                            signatures: true
                        }
                    }
                },
            });
            if (!version) throw VersionError.NotFound("Versi dokumen tidak ditemukan.");
            return version;
        } catch (err) {
            if (err instanceof VersionError) throw err;
            throw VersionError.InternalServerError(`Gagal mengambil versi dokumen: ${err.message}`);
        }
    }

    async findAllByDocumentId(documentId) {
        try {
            return await this.prisma.documentVersion.findMany({
                where: { documentId },
                orderBy: { createdAt: "desc" }, // Menampilkan versi terbaru di paling atas
                include: {
                    document: true,
                    signaturesPersonal: true,
                    signaturesGroup: true,
                    packages: {
                        include: {
                            signatures: true
                        }
                    }
                },
            });
        } catch (err) {
            throw VersionError.InternalServerError(`Gagal mengambil semua versi dokumen: ${err.message}`);
        }
    }

    async update(versionId, data) {
        try {
            return await this.prisma.documentVersion.update({
                where: { id: versionId },
                data,
            });
        } catch (err) {
            throw VersionError.InternalServerError(`Gagal memperbarui versi dokumen: ${err.message}`);
        }
    }

    /**
     * @description Menghapus versi dokumen, TAPI melarang penghapusan Versi Pertama (Asli).
     */
    async deleteById(versionId) {
        try {
            // 1. Ambil data versi yang mau dihapus untuk mendapatkan documentId-nya
            const versionToDelete = await this.prisma.documentVersion.findUnique({
                where: { id: versionId },
                select: { id: true, documentId: true } // Kita hanya butuh ID dan DocumentID
            });

            if (!versionToDelete) {
                throw VersionError.NotFound("Versi dokumen tidak ditemukan.");
            }

            // 2. Cari versi paling PERTAMA (Original) dari dokumen tersebut
            // Kita cari berdasarkan waktu dibuat (createdAt) paling lama (asc)
            const firstVersion = await this.prisma.documentVersion.findFirst({
                where: { documentId: versionToDelete.documentId },
                orderBy: { createdAt: 'asc' }, // Urutkan dari yang terlama
                select: { id: true }
            });

            // 3. Validasi: Jika ID yang mau dihapus == ID versi pertama, TOLAK.
            if (firstVersion && firstVersion.id === versionId) {
                // Gunakan Error yang sesuai, misalnya Forbidden atau BadRequest
                throw new Error("Versi asli (versi pertama) dokumen tidak dapat dihapus. Anda hanya dapat menghapus versi turunannya.");
            }

            // 4. Jika bukan versi pertama, lakukan penghapusan
            return await this.prisma.documentVersion.delete({
                where: { id: versionId },
            });

        } catch (err) {
            // Pastikan error yang kita lempar di atas (validasi) diteruskan dengan benar
            if (err.message.includes("tidak dapat dihapus")) {
                throw VersionError.BadRequest(err.message);
            }
            if (err instanceof VersionError) throw err;

            throw VersionError.InternalServerError(`Gagal menghapus versi dokumen: ${err.message}`);
        }
    }
}