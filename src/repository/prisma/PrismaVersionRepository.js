import { VersionRepository } from "../interface/VersionRepository.js";
import  VersionError  from "../../errors/StorageError.js";

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
                orderBy: { createdAt: "desc" },
                include: {
                    document: true,
                    signaturesPersonal: true,
                    signaturesGroup: true,
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

    async deleteById(versionId) {
        try {
            return await this.prisma.documentVersion.delete({
                where: { id: versionId },
            });
        } catch (err) {
            throw VersionError.InternalServerError(`Gagal menghapus versi dokumen: ${err.message}`);
        }
    }
}
