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

  async findByGroupAndHash(groupId, hash) {
    try {
      return await this.prisma.documentVersion.findFirst({
        where: {
          hash: hash,
          document: { groupId: groupId },
        },
        include: { document: true },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengecek duplikasi dokumen grup: ${err.message}`);
    }
  }

  /**
   * Lightweight version lookup - only essential fields, no heavy includes
   * Use this when you don't need signature/package relations
   */
  async findByIdSimple(versionId) {
    try {
      const version = await this.prisma.documentVersion.findUnique({
        where: { id: versionId },
        select: {
          id: true,
          documentId: true,
          url: true,
          hash: true,
          signedFileHash: true,
          createdAt: true,
        },
      });
      return version;
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil versi dokumen: ${err.message}`);
    }
  }

  /**
   * Get the first (oldest) version ID of a document - optimized for rollback checks
   */
  async findFirstVersionId(documentId) {
    try {
      const first = await this.prisma.documentVersion.findFirst({
        where: { documentId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      return first?.id || null;
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil versi pertama: ${err.message}`);
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

  async countByDocumentId(documentId) {
    try {
      return await this.prisma.documentVersion.count({
        where: { documentId: documentId },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal menghitung versi dokumen: ${err.message}`);
    }
  }

  // PrismaVersionRepository.js

  async deleteById(versionId) {
    try {
      const versionToDelete = await this.prisma.documentVersion.findUnique({
        where: { id: versionId },
        select: { id: true, documentId: true },
      });

      if (!versionToDelete) {
        throw CommonError.NotFound("Versi dokumen tidak ditemukan.");
      }

      // --- [LOGIKA BARU DIMULAI DISINI] ---

      // 1. Ambil ID versi pertama (terlama)
      const firstVersionId = await this.findFirstVersionId(versionToDelete.documentId);

      // 2. Cek apakah versi yang mau dihapus adalah versi pertama?
      if (firstVersionId === versionId) {
        throw CommonError.BadRequest("DILARANG: Versi pertama (Original) tidak boleh dihapus demi integritas riwayat dokumen.");
      }

      // --- [LOGIKA BARU SELESAI] ---

      // (Logika lama: Cek jumlah total versi agar tidak kosong)
      const totalVersions = await this.prisma.documentVersion.count({
        where: { documentId: versionToDelete.documentId },
      });

      if (totalVersions <= 1) {
        throw CommonError.BadRequest("Anda tidak dapat menghapus satu-satunya versi yang tersisa.");
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
