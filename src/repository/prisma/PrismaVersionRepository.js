import { VersionRepository } from "../interface/VersionRepository.js";
import CommonError from "../../errors/CommonError.js";

/**
 * @description Implementasi Repository untuk model 'DocumentVersion' menggunakan Prisma.
 */
export class PrismaVersionRepository extends VersionRepository {
  constructor(prisma) {
    super();
    if (!prisma) throw CommonError.InternalServerError("Prisma client tidak ditemukan.");
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
      throw CommonError.DatabaseError(`Gagal membuat versi baru: ${err.message}`);
    }
  }

    async findByUserAndHash(userId, hash) {
        try {
            return await this.prisma.documentVersion.findFirst({
                where: {
                    hash: hash,
                    document: {
                        userId: userId,
                    },
                },
                include: {
                    document: true,
                },
            });
        } catch (err) {
            throw CommonError.DatabaseError(`Gagal mengecek duplikasi versi: ${err.message}`);
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
              signatures: true,

              package: {
                select: {
                  status: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      if (!version) {
        throw CommonError.NotFound(`Versi dokumen dengan ID '${versionId}' tidak ditemukan.`);
      }

      return version;
    } catch (err) {
      if (err instanceof CommonError) throw err;
      throw CommonError.DatabaseError(`Gagal mengambil versi dokumen: ${err.message}`);
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
          packages: {
            include: {
              signatures: true,

              package: {
                select: {
                  status: true,
                  title: true,
                },
              },
            },
          },
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil semua versi dokumen: ${err.message}`);
    }
  }

  async update(versionId, data) {
    try {
      return await this.prisma.documentVersion.update({
        where: { id: versionId },
        data,
      });
    } catch (err) {
      if (err.code === "P2025") {
        throw CommonError.NotFound("Versi dokumen yang ingin diperbarui tidak ditemukan.");
      }
      throw CommonError.DatabaseError(`Gagal memperbarui versi dokumen: ${err.message}`);
    }
  }

  /**
   * @description Menghapus versi dokumen, TAPI melarang penghapusan Versi Pertama (Asli).
   */
  async deleteById(versionId) {
    try {
      const versionToDelete = await this.prisma.documentVersion.findUnique({
        where: { id: versionId },
        select: { id: true, documentId: true },
      });

      if (!versionToDelete) {
        throw CommonError.NotFound("Versi dokumen tidak ditemukan.");
      }

      const firstVersion = await this.prisma.documentVersion.findFirst({
        where: { documentId: versionToDelete.documentId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (firstVersion && firstVersion.id === versionId) {
        throw CommonError.BadRequest("Versi asli (versi pertama) dokumen tidak dapat dihapus. Anda hanya dapat menghapus versi turunannya.");
      }

      return await this.prisma.documentVersion.delete({
        where: { id: versionId },
      });
    } catch (err) {
      if (err instanceof CommonError) {
        throw err;
      }

      if (err.code === "P2025") {
        throw CommonError.NotFound("Versi dokumen tidak ditemukan saat akan dihapus.");
      }

      throw CommonError.DatabaseError(`Gagal menghapus versi dokumen: ${err.message}`);
    }
  }
}
