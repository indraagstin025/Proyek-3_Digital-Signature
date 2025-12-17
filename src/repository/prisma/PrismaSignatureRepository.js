import { SignatureRepository } from "../interface/SignatureRepository.js";
import CommonError from "../../errors/CommonError.js";

/**
 * @description Implementasi SignatureRepository menggunakan Prisma.
 * Mendukung fitur Status (Draft/Final) dan Client-Side UUID.
 */
export class PrismaSignatureRepository extends SignatureRepository {
  /**
   * @param {PrismaClient} prisma
   */
  constructor(prisma) {
    super();
    if (!prisma) {
      throw new Error("Prisma Client harus disediakan.");
    }
    this.prisma = prisma;
  }

  /**
   * [PERSONAL] Membuat signature personal.
   * UPDATE: Support 'id' (UUID Client) dan 'status'.
   */
  async createSignature(data) {
    const { id, type, ...validData } = data;

    return this.prisma.signaturePersonal.create({
      data: {
        documentVersion: { connect: { id: validData.documentVersionId } },
        signer: { connect: { id: validData.userId } },
        pageNumber: validData.pageNumber,
        positionX: parseFloat(validData.positionX),
        positionY: parseFloat(validData.positionY),
        width: parseFloat(validData.width || 0),
        height: parseFloat(validData.height || 0),
        signatureImageUrl: validData.signatureImageUrl || "",
        method: validData.method || "canvas",
        status: validData.status || "final",
      },
    });
  }

  /**
   * [GROUP] Membuat signature grup.
   * UPDATE: Support 'id' (UUID Client) dan 'status'.
   */
  async createGroupSignature(data) {
    const { type, ...validData } = data;
    return this.prisma.signatureGroup.create({
      data: {
        id: validData.id,
        documentVersion: { connect: { id: validData.documentVersionId } },
        signer: { connect: { id: validData.userId } },
        pageNumber: validData.pageNumber,
        positionX: parseFloat(validData.positionX),
        positionY: parseFloat(validData.positionY),
        width: parseFloat(validData.width || 0),
        height: parseFloat(validData.height || 0),
        signatureImageUrl: validData.signatureImageUrl || "",
        method: validData.method || "canvas",
        status: validData.status || "draft",
      },
      include: {
        signer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Mencari signature di Personal & Group.
   */
  async findById(signatureId) {
    const personal = await this.prisma.signaturePersonal.findUnique({
      where: { id: signatureId },
      include: {
        signer: true,
        documentVersion: { include: { document: true } },
      },
    });
    if (personal) return { ...personal, type: "PERSONAL" };

    const groupSig = await this.prisma.signatureGroup.findUnique({
      where: { id: signatureId },
      include: {
        signer: true,
        documentVersion: { include: { document: true } },
      },
    });
    if (groupSig) return { ...groupSig, type: "GROUP" };

    return null;
  }

  async findPersonalSignatureById(id) {
    return this.prisma.signaturePersonal.findUnique({ where: { id } });
  }

  async findGroupSignatureById(id) {
    return this.prisma.signatureGroup.findUnique({ where: { id } });
  }

  async findByVersionId(documentVersionId) {
    return this.prisma.signaturePersonal.findMany({
      where: { documentVersionId: documentVersionId },
      include: { signer: true },
    });
  }

  async findPendingByUserAndDoc(userId, documentId) {
    try {
      return await this.prisma.groupDocumentSigner.findFirst({
        where: {
          userId: userId,
          documentId: documentId,
          status: "PENDING",
        },
      });
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal cek status tanda tangan: ${err.message}`);
    }
  }

  /**
   * Mencari signature grup spesifik milik user di versi dokumen tertentu.
   * Penting untuk logika UPSERT (Cek ada atau tidak).
   */
  async findGroupSignatureBySigner(userId, documentVersionId) {
    return this.prisma.signatureGroup.findFirst({
      where: { signerId: userId, documentVersionId: documentVersionId },
    });
  }

  async findGroupSignaturesByVersionId(documentVersionId) {
    return this.prisma.signatureGroup.findMany({
      where: { documentVersionId: documentVersionId },
      orderBy: { signedAt: "asc" },
    });
  }

  /**
   * [UPDATE GROUP] Support update Status (Draft -> Final)
   */
  async updateGroupSignature(signatureId, data) {
    try {
      return await this.prisma.signatureGroup.update({
        where: { id: signatureId },
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
        include: {
          signer: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (error) {
      if (error.code === "P2025") return null;
      throw error;
    }
  }

  /**
   * [UPDATE PERSONAL] Support update Status
   */
  async updatePersonalSignature(signatureId, data) {
    try {
      return await this.prisma.signaturePersonal.update({
        where: { id: signatureId },
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

  /**
   * [DELETE] Delete Many agar aman (return count: 0 jika tidak ada)
   */
  async deleteGroupSignature(signatureId) {
    return this.prisma.signatureGroup.deleteMany({
      where: { id: signatureId },
    });
  }

  async deletePersonalSignature(signatureId) {
    return this.prisma.signaturePersonal.deleteMany({
      where: { id: signatureId },
    });
  }

  /**
   * [BARU] Menghapus DRAFT milik user tertentu di dokumen tertentu.
   * Berguna untuk Cleanup job.
   */
  async deleteManyDrafts(documentId, userId) {
    return this.prisma.signatureGroup.deleteMany({
      where: {
        signerId: userId,
        status: "draft",
        documentVersion: {
          documentId: documentId,
        },
      },
    });
  }

  /**
   * Menghapus signature berdasarkan User dan Version.
   * [UPDATE] Jika userId = null/undefined, maka hapus SEMUA signature di version tersebut.
   */
  async deleteBySignerAndVersion(userId, documentVersionId, isGroup = false) {
    const whereCondition = {
      documentVersionId: documentVersionId,
    };

    if (userId) {
      whereCondition.signerId = userId;
    }

    if (isGroup) {
      return this.prisma.signatureGroup.deleteMany({
        where: whereCondition,
      });
    } else {
      return this.prisma.signaturePersonal.deleteMany({
        where: whereCondition,
      });
    }
  }
}
