import { SignatureRepository } from "../interface/SignatureRepository.js";

export class PrismaSignatureRepository extends SignatureRepository {
  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

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

        // Data Audit
        ipAddress: rest.ipAddress || null,
        userAgent: rest.userAgent || null,

        // [BARU] Access Code (PIN)
        accessCode: rest.accessCode || null,
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
          accessCode: data.accessCode,
          retryCount: data.retryCount,
          lockedUntil: data.lockedUntil,
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
   * Delete By Signer & Version.
   */
  async deleteBySignerAndVersion(userId, documentVersionId) {
    const whereCondition = {
      documentVersionId: documentVersionId,
    };

    if (userId) {
      whereCondition.signerId = userId;
    }

    return this.prisma.signaturePersonal.deleteMany({
      where: whereCondition,
    });
  }
}