import { HistoryRepository } from "../interface/HistoryRepository.js";
import CommonError from "../../errors/CommonError.js";

export class PrismaHistoryRepository extends HistoryRepository {
  constructor(prisma) {
    super();
    if (!prisma) {
      throw CommonError.InternalServerError("Prisma Client harus disediakan.");
    }
    this.prisma = prisma;
  }

  async findPersonalSignatures(userId) {
    try {
      return await this.prisma.signaturePersonal.findMany({
        where: { signerId: userId },
        orderBy: { signedAt: "desc" },
        select: {
          id: true,
          signedAt: true,
          ipAddress: true,
          documentVersion: {
            select: {
              document: { select: { title: true } },
            },
          },
        },
      });
    } catch (error) {
      throw CommonError.DatabaseError(`Gagal mengambil history personal: ${error.message}`);
    }
  }

  async findGroupSignatures(userId) {
    try {
      return await this.prisma.signatureGroup.findMany({
        where: { signerId: userId },
        orderBy: { signedAt: "desc" },
        select: {
          id: true,
          signedAt: true,
          ipAddress: true,
          documentVersion: {
            select: {
              document: { select: { title: true } },
            },
          },
        },
      });
    } catch (error) {
      throw CommonError.DatabaseError(`Gagal mengambil history group: ${error.message}`);
    }
  }

  async findPackageSignatures(userId) {
    try {
      return await this.prisma.packageSignature.findMany({
        where: { signerId: userId },
        orderBy: { createdAt: "desc" }, // Perhatikan fieldnya createdAt di schema paket
        select: {
          id: true,
          createdAt: true,
          ipAddress: true,
          packageDocument: {
            select: {
              docVersion: {
                select: {
                  document: { select: { title: true } },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      throw CommonError.DatabaseError(`Gagal mengambil history package: ${error.message}`);
    }
  }
}
