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
  async createWithFirstVersion(userId, title, url, hash) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          userId,
          title,
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
// ... kode sebelumnya ...

    /**
     * [FIXED] Mengambil semua dokumen user.
     * Hanya ambil signature yang valid (bukan placeholder kosong).
     */
    async findAllByUserId(userId) {
        return this.prisma.document.findMany({
            where: { userId },
            include: {
                currentVersion: {
                    include: {
                        // FILTER DI SINI: Hanya ambil yang punya gambar
                        signaturesPersonal: {
                            where: {
                                signatureImageUrl: { not: "" }
                            }
                        },
                        packages: {
                            include: {
                                signatures: true,
                                package: {
                                    select: {
                                        status: true,
                                        title: true
                                    }
                                }
                            }
                        }
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    /**
     * [FIXED] Mencari satu dokumen.
     * Filter juga diterapkan di sini agar konsisten.
     */
    async findById(documentId, userId) {
        return this.prisma.document.findFirst({
            where: {
                id: documentId,
                userId: userId,
            },
            include: {
                currentVersion: {
                    include: {
                        // FILTER DI SINI JUGA
                        signaturesPersonal: {
                            where: {
                                signatureImageUrl: { not: "" }
                            }
                        },
                        packages: {
                            include: {
                                signatures: true,
                                package: {
                                    select: {
                                        status: true,
                                        title: true
                                    }
                                }
                            }
                        }
                    },
                },
            },
        });
    }

// ... sisa kode ...

  /**
   * @description Memperbarui data pada tabel Dokumen (misal: title atau currentVersionId).
   */
    /**
     * @description Memperbarui data pada tabel Dokumen (misal: title atau currentVersionId).
     * [PERBAIKAN]: Fungsi ini sekarang menangani pembaruan relasi 'currentVersion'.
     */
    async update(documentId, dataToUpdate) {

        // 1. Ekstrak 'currentVersionId' (jika ada) dari sisa data.
        const { currentVersionId, ...otherData } = dataToUpdate;

        // 2. Siapkan objek data final untuk Prisma.
        const finalData = {
            ...otherData, // (misal: { status, signedFileUrl })
        };

        // 3. Jika 'currentVersionId' ada, ubah menjadi objek 'connect'
        //    yang dimengerti oleh Prisma untuk memperbarui relasi.
        if (currentVersionId) {
            finalData.currentVersion = {
                connect: {
                    id: currentVersionId,
                },
            };
        }

        // 4. Jalankan query update dengan data yang sudah diformat dengan benar.
        return this.prisma.document.update({
            where: { id: documentId },
            data: finalData, // Menggunakan 'finalData' yang sudah dimodifikasi
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
   * @description Menghapus record dokumen dari database berdasarkan ID.
   * Karena ada `onDelete: Cascade` di skema, ini akan otomatis menghapus semua versinya.
   */
  async deleteById(documentId) {
    return this.prisma.document.delete({
      where: { id: documentId },
    });
  }
}
