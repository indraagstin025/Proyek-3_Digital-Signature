/**
 * @description Implementasi Repository untuk model 'Document' menggunakan Prisma.
 */
export class PrismaDocumentRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * @description Membuat Dokumen baru beserta Versi pertamanya dalam satu transaksi.
   * @param {string} userId - ID pemilik.
   * @param {string} title - Judul dokumen.
   * @param {string} url - URL file untuk versi pertama.
   * @param {string} hash - Hash file untuk versi pertama
   * @returns {Promise<object>} Objek dokumen yang baru dibuat, termasuk data versi pertamanya.
   */
  async createWithFirstVersion(userId, title, url, hash, type = "General") {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          userId,
          title,
          type: type,
        },
      });

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          userId: userId,
          url,
          hash,
        },
      });

      const updatedDocument = await tx.document.update({
        where: { id: document.id },
        data: { currentVersionId: version.id },
        include: {
          currentVersion: true,
        },
      });

      return updatedDocument;
    });
  }

  /**
   * @description Mengambil semua dokumen milik user, beserta detail versi terkininya DAN tanda tangannya.
   */

  /**
   * [FIXED] Mengambil semua dokumen user + Status Signer Group
   */

  /**
   * [UPDATE] Mengambil dokumen dengan Filter Pencarian (Title ATAU Type).
   */
  async findAllByUserId(userId, search = "") {
    const searchFilter = search
        ? {
          OR: [{ title: { contains: search, mode: "insensitive" } }, { type: { contains: search, mode: "insensitive" } }],
        }
        : {};

    return this.prisma.document.findMany({
      where: {
        AND: [
          {
            OR: [{ userId: userId }, { group: { members: { some: { userId: userId } } } }],
          },
          searchFilter,
        ],
      },
      include: {
        signerRequests: {
          where: { userId: userId },
          select: { status: true },
        },
        currentVersion: {
          include: {
            signaturesPersonal: { where: { signatureImageUrl: { not: "" } } },
            signaturesGroup: { where: { signatureImageUrl: { not: "" } }, orderBy: { signedAt: "asc" } },
            packages: { include: { signatures: true, package: true } },
          },
        },
        // [FIX DI SINI] Ambil info Admin & Members agar Frontend bisa cek hak akses
        group: {
          select: {
            id: true,
            name: true,
            adminId: true, // <--- PENTING: Untuk cek admin
            members: {     // <--- PENTING: Untuk cek role member user ini
              where: { userId: userId },
              select: { role: true }
            }
          }
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(documentId, userId) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            members: {
              where: { userId: userId },
              select: { role: true },
            },
          },
        },
        signerRequests: { include: { user: true } },
        currentVersion: {
          include: {
            signaturesPersonal: true,
            signaturesGroup: {
              include: {
                signer: {
                  select: { id: true, name: true, email: true },
                },
              },
              orderBy: { signedAt: "asc" },
            },
            packages: true,
          },
        },
      },
    });

    if (!doc) return null;

    const isMember = doc.group && doc.group.members.length > 0;
    if (doc.userId === userId) return doc;
    if (isMember) return doc;

    return null;
  }

  /**
   * @description Membuat Dokumen Grup + Versi + Daftar Penanda Tangan (Transaction).
   * Ini adalah inti inisialisasi Group Signing.
   */
  /**
   * @description Membuat Dokumen Grup + Versi + Daftar Penanda Tangan (Transaction).
   * [FIXED] Status otomatis jadi PENDING jika ada signer.
   */
  async createGroupDocument(userId, groupId, title, url, hash, signerUserIds) {
    return this.prisma.$transaction(async (tx) => {
      const initialStatus = signerUserIds && signerUserIds.length > 0 ? "pending" : "draft";

      const document = await tx.document.create({
        data: {
          userId,
          groupId,
          title,
          status: initialStatus,
        },
      });

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          userId,
          url,
          hash,
        },
      });

      await tx.document.update({
        where: { id: document.id },
        data: { currentVersionId: version.id },
      });

      if (signerUserIds && signerUserIds.length > 0) {
        const signerData = signerUserIds.map((signerId) => ({
          documentId: document.id,
          userId: signerId,
          status: "PENDING",
        }));

        await tx.groupDocumentSigner.createMany({
          data: signerData,
        });
      }

      return document;
    });
  }

  /**
   * @description Memperbarui data pada tabel Dokumen (misal: title atau currentVersionId).
   * [PERBAIKAN]: Fungsi ini sekarang menangani pembaruan relasi 'currentVersion'.
   */
  async update(documentId, dataToUpdate) {
    const { currentVersionId, ...otherData } = dataToUpdate;

    const finalData = {
      ...otherData,
    };

    if (currentVersionId) {
      finalData.currentVersion = {
        connect: {
          id: currentVersionId,
        },
      };
    }

    return this.prisma.document.update({
      where: { id: documentId },
      data: finalData,
      include: {
        currentVersion: true,
      },
    });
  }

  /**
   * @description Mencari satu dokumen berdasarkan kriteria 'where' kustom.
   * Ini dibutuhkan oleh GroupService untuk mencari berdasarkan { id, groupId }.
   * @param {object} query - Objek query Prisma findFirst (misal: { where: { ... } }).
   * @returns {Promise<object|null>}
   */
  async findFirst(query) {
    return this.prisma.document.findFirst(query);
  }

  /**
   * [BARU] Mencari dokumen hanya berdasarkan ID tanpa cek kepemilikan.
   * Digunakan oleh Service untuk validasi delete manual.
   */
  async findByIdSimple(documentId) {
    return this.prisma.document.findUnique({
      where: { id: documentId },

      include: {
        group: true,
      },
    });
  }

  /**
   * [UPDATE/PASTIKAN] Menghapus dokumen murni berdasarkan ID.
   */
  async deleteById(documentId) {
    return this.prisma.document.delete({
      where: { id: documentId },
    });
  }
}
