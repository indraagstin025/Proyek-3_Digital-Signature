import { PackageRepository } from "../interface/PackageRepository.js";
import CommonError from "../../errors/CommonError.js";

export class PrismaPackageRepository extends PackageRepository {
  constructor(prisma) {
    super();
    if (!prisma) {
      throw CommonError.InternalServerError("Prisma Client harus disediakan untuk PrismaPackageRepository.");
    }
    this.prisma = prisma;
  }

  /**
   * @param userId
   * @param title
   * @param docVersionIds
   * @returns {Promise<*>}
   */
  async createPackageWithDocuments(userId, title, docVersionIds) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const newPackage = await tx.signingPackage.create({
          data: {
            userId: userId,
            title: title || "Paket Dokumen Baru",
            status: "draft",
          },
        });

        const packageDocumentsData = docVersionIds.map((versionId, index) => ({
          packageId: newPackage.id,
          docVersionId: versionId,
          order: index + 1,
        }));

        await tx.packageDocument.createMany({
          data: packageDocumentsData,
        });

        return newPackage;
      });
    } catch (error) {
      throw CommonError.DatabaseError(`Gagal membuat paket di database: ${error.message}`);
    }
  }

  /**
   * @param packageId
   * @param userId
   */
  async findPackageById(packageId, userId) {
    try {
      const pkg = await this.prisma.signingPackage.findFirst({
        where: { id: packageId, userId: userId },
        include: {
          documents: {
            orderBy: { order: "asc" },
            include: {
              docVersion: {
                include: {
                  document: { select: { id: true, title: true } },
                },
              },
            },
          },
        },
      });

      if (!pkg) {
        throw CommonError.NotFound(`Paket tanda tangan dengan ID '${packageId}' tidak ditemukan.`);
      }

      return pkg;
    } catch (error) {
      if (error instanceof CommonError) throw error;
      throw CommonError.DatabaseError(`Gagal mencari paket: ${error.message}`);
    }
  }

  /**
   * @param packageId
   * @param status
   */
  async updatePackageStatus(packageId, status) {
    try {
      return await this.prisma.signingPackage.update({
        where: { id: packageId },
        data: { status: status },
      });
    } catch (error) {
      if (error.code === "P2025") {
        throw CommonError.NotFound(`Paket dengan ID '${packageId}' tidak ditemukan untuk diupdate.`);
      }
      throw CommonError.DatabaseError(`Gagal update status paket: ${error.message}`);
    }
  }

  /**
   * @description Memindahkan relasi PackageDocument dari versi lama (Draft) ke versi baru (Signed).
   */
  async updatePackageDocumentVersion(packageId, oldVersionId, newVersionId) {
    try {
      const packageDoc = await this.prisma.packageDocument.findFirst({
        where: {
          packageId: packageId,
          docVersionId: oldVersionId,
        },
      });

      if (!packageDoc) {
        console.warn(`[Repo] PackageDocument tidak ditemukan untuk dipindahkan. Pkg: ${packageId}, Ver: ${oldVersionId}`);
        return null;
      }

      return await this.prisma.packageDocument.update({
        where: { id: packageDoc.id },
        data: {
          docVersionId: newVersionId,
        },
      });
    } catch (error) {
      throw CommonError.DatabaseError(`Gagal memindahkan versi dokumen paket: ${error.message}`);
    }
  }

  /**
   * @description Menyimpan banyak signature sekaligus.
   * UPDATE: Karena schema.prisma sudah ada ipAddress, method ini otomatis support
   * selama objek 'signaturesData' memiliki properti ipAddress.
   * @param {object[]} signaturesData
   */
  async createPackageSignatures(signaturesData) {
    try {
      const promises = signaturesData.map((data) => this.prisma.packageSignature.create({ data: data }));

      return await Promise.all(promises);
    } catch (error) {
      throw CommonError.DatabaseError(`Gagal menyimpan data tanda tangan paket: ${error.message}`);
    }
  }

  /**
   * Mengambil relasi ke Signer dan Dokumen.
   * UPDATE: Otomatis mengambil ipAddress dan createdAt karena tidak ada 'select' yang membatasi fields utama.
   * @param {string} signatureId
   */
  async findPackageSignatureById(signatureId) {
    try {
      return await this.prisma.packageSignature.findUnique({
        where: { id: signatureId },
        include: {
          signer: {
            select: {
              name: true,
              email: true,
            },
          },

          packageDocument: {
            include: {
              docVersion: {
                include: {
                  document: {
                    select: { title: true },
                  },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      throw CommonError.DatabaseError(`Gagal mencari signature paket: ${error.message}`);
    }
  }

  async deleteSignaturesByIds(signatureIds) {
    try {
      return await this.prisma.packageSignature.deleteMany({
        where: {
          id: { in: signatureIds },
        },
      });
    } catch (error) {
      console.error("[Repo] Gagal rollback signatures:", error);
    }
  }
}
