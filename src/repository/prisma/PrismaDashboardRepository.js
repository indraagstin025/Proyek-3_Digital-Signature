/**
 * Repository untuk Dashboard.
 * Menggunakan instance Prisma yang di-inject dari app.js
 */
export class PrismaDashboardRepository {
  /**
   * @param {import("@prisma/client").PrismaClient} prismaClient
   */
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  async countAllStatuses(userId) {
    const result = await this.prisma.document.groupBy({
      by: ["status"],
      where: { userId: userId },
      _count: { status: true },
    });
    return result.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count.status;
        return acc;
      },
      { draft: 0, pending: 0, completed: 0 }
    );
  }

  async findPendingSignatures(userId, limit = 3) {
    return this.prisma.signaturePersonal.findMany({
      where: {
        signerId: userId,
        signatureImageUrl: "",
        documentVersion: { document: { status: "pending" } },
      },
      take: limit,
      orderBy: { signedAt: "desc" },
      include: {
        documentVersion: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                updatedAt: true,
                owner: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    });
  }

  async findActionRequiredDocuments(userId, limit = 3) {
    return this.prisma.document.findMany({
      where: { userId: userId, status: { in: ["draft", "pending"] } },
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: { owner: { select: { name: true, email: true } } },
    });
  }

  async findRecentUpdatedDocuments(userId, limit = 5) {
    return this.prisma.document.findMany({
      where: { userId: userId },
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, status: true, updatedAt: true },
    });
  }

  /**
   * Mengambil aktivitas tanda tangan PERSONAL.
   */
  async findRecentSignatures(userId, limit = 5) {
    return this.prisma.signaturePersonal.findMany({
      where: { signerId: userId, signatureImageUrl: { not: "" } },
      take: limit,
      orderBy: { signedAt: "desc" },
      include: {
        documentVersion: {
          include: {
            document: {
              select: { id: true, title: true, status: true, groupId: true },
            },
            packages: { select: { id: true } },
          },
        },
      },
    });
  }

  /**
   * [BARU] Mengambil aktivitas tanda tangan GRUP.
   * Penting agar status di dashboard terbaca sebagai Group.
   */
  async findRecentGroupSignatures(userId, limit = 5) {
    return this.prisma.signatureGroup.findMany({
      where: {
        signerId: userId,
      },
      take: limit,

      orderBy: { signedAt: "desc" },
      include: {
        documentVersion: {
          include: {
            document: {
              select: { id: true, title: true, status: true, groupId: true },
            },
          },
        },
      },
    });
  }

  /**
   * Mengambil aktivitas tanda tangan PAKET (PackageSignature).
   */
  async findRecentPackageSignatures(userId, limit = 5) {
    return this.prisma.packageSignature.findMany({
      where: { signerId: userId },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        packageDocument: {
          include: {
            package: {
              select: { id: true, title: true, status: true },
            },
            docVersion: {
              include: {
                document: {
                  select: { id: true, title: true },
                },
              },
            },
          },
        },
      },
    });
  }
}

export const prismaDashboardRepository = new PrismaDashboardRepository();
