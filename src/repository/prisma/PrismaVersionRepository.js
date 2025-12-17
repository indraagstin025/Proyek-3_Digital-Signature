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
          signedFileHash: data.signedFileHash || null,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        console.warn("[PrismaVersionRepository] Versi duplikat terdeteksi. Mengembalikan versi yang sudah ada...");
        const existingVersion = await this.prisma.documentVersion.findFirst({
          where: { documentId: data.documentId, hash: data.hash },
        });
        if (existingVersion) return existingVersion;
      }
      throw CommonError.DatabaseError(`Gagal membuat versi baru: ${err.message}`);
    }
  }

  async findByUserAndHash(userId, hash) {
    try {
      return await this.prisma.documentVersion.findFirst({
        where: {
          hash: hash,
          document: { userId: userId },
        },
        include: { document: true },
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
          signaturesPersonal: {
            include: { signer: { select: { id: true, name: true, email: true } } },
          },
          signaturesGroup: {
            include: { signer: { select: { id: true, name: true, email: true } } },
          },
          packages: {
            include: {
              signatures: {
                include: { signer: { select: { id: true, name: true, email: true } } },
              },
              package: { select: { status: true, title: true } },
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
          signaturesPersonal: { include: { signer: { select: { id: true, name: true, email: true } } } },
          signaturesGroup: { include: { signer: { select: { id: true, name: true, email: true } } } },
          packages: {
            include: {
              signatures: { include: { signer: { select: { id: true, name: true, email: true } } } },
              package: { select: { status: true, title: true } },
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
      if (err.code === "P2025") throw CommonError.NotFound("Versi dokumen yang ingin diperbarui tidak ditemukan.");
      throw CommonError.DatabaseError(`Gagal memperbarui versi dokumen: ${err.message}`);
    }
  }

  async deleteById(versionId) {
    try {
      const versionToDelete = await this.prisma.documentVersion.findUnique({
        where: { id: versionId },
        select: { id: true, documentId: true },
      });

      if (!versionToDelete) {
        throw CommonError.NotFound("Versi dokumen tidak ditemukan.");
      }

      const totalVersions = await this.prisma.documentVersion.count({
        where: { documentId: versionToDelete.documentId },
      });

      if (totalVersions <= 1) {
        throw CommonError.BadRequest("Anda tidak dapat menghapus versi asli (satu-satunya). Silakan hapus dokumen secara keseluruhan jika ingin menghapusnya.");
      }

      return await this.prisma.documentVersion.delete({
        where: { id: versionId },
      });
    } catch (err) {
      if (err instanceof CommonError) throw err;
      throw CommonError.DatabaseError(`Gagal menghapus versi dokumen: ${err.message}`);
    }
  }
}
