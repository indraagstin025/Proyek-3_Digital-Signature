import { SignatureRepository } from "../interface/SignatureRepository.js";

export class PrismaSignatureRepository extends SignatureRepository {
  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  // ... (Method create, findById, update, delete tetap sama) ...

  async create(data) {
    const { id, type, documentVersionId, userId, ...rest } = data;
    return this.prisma.signaturePersonal.create({
      data: {
        documentVersion: { connect: { id: documentVersionId } },
        signer: { connect: { id: userId } },
        pageNumber: rest.pageNumber,
        positionX: parseFloat(rest.positionX),
        positionY: parseFloat(rest.positionY),
        width: parseFloat(rest.width || 0),
        height: parseFloat(rest.height || 0),
        signatureImageUrl: rest.signatureImageUrl || "",
        method: rest.method || "canvas",
        status: rest.status || "final",
      },
    });
  }

  async findById(id) {
    return this.prisma.signaturePersonal.findUnique({
      where: { id },
      include: {
        signer: true,
        documentVersion: { include: { document: true } },
      },
    });
  }

  async findAllByVersionId(documentVersionId) {
    return this.prisma.signaturePersonal.findMany({
      where: { documentVersionId },
      include: { signer: true },
    });
  }

  async update(id, data) {
    try {
      return await this.prisma.signaturePersonal.update({
        where: { id },
        data: {
          positionX: data.positionX !== undefined ? parseFloat(data.positionX) : undefined,
          positionY: data.positionY !== undefined ? parseFloat(data.positionY) : undefined,
          width: data.width !== undefined ? parseFloat(data.width) : undefined,
          height: data.height !== undefined ? parseFloat(data.height) : undefined,
          pageNumber: data.pageNumber,
          signatureImageUrl: data.signatureImageUrl,
          method: data.method,
          status: data.status,
        },
      });
    } catch (error) {
      if (error.code === "P2025") return null;
      throw error;
    }
  }

  async delete(id) {
    return this.prisma.signaturePersonal.deleteMany({
      where: { id },
    });
  }

  /**
   * [FIXED] Delete By Signer & Version.
   * Logic:
   * - Jika userId ada -> Hapus punya user itu saja (Re-sign).
   * - Jika userId NULL -> Hapus SEMUA (Rollback).
   */
  async deleteBySignerAndVersion(userId, documentVersionId) {
    const whereCondition = {
      documentVersionId: documentVersionId,
    };

    // 🔥 PENTING: Hanya masukkan signerId ke filter jika userId TIDAK null
    if (userId) {
      whereCondition.signerId = userId;
    }

    return this.prisma.signaturePersonal.deleteMany({
      where: whereCondition,
    });
  }
}