import supabaseAdmin from "../../config/supabaseAdmin.js";

import CommonError from "../../errors/CommonError.js";

export class PrismaAdminRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async findAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        profilePictureUrl: true,
        isSuperAdmin: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async createUser({ email, password, name, isSuperAdmin = false }) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      throw CommonError.BadRequest(`Gagal membuat user di Supabase Auth: ${authError.message}`);
    }

    try {
      return await this.prisma.user.create({
        data: {
          id: authData.user.id,
          email,
          name,
          isSuperAdmin,
        },
      });
    } catch (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw CommonError.DatabaseError(`Gagal menyimpan profil user: ${dbError.message}`);
    }
  }

  async deleteUserById(userId) {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError && authError.status !== 404) {
      throw CommonError.SupabaseError(`Gagal menghapus user dari Supabase Auth: ${authError.message}`);
    }

    try {
      return await this.prisma.user.delete({ where: { id: userId } });
    } catch (dbError) {
      if (dbError.code === "P2025") {
        throw CommonError.NotFound(`User dengan ID ${userId} tidak ditemukan di database lokal.`);
      }
      throw CommonError.DatabaseError(dbError.message);
    }
  }

  async updateUserById(userId, dataToUpdate) {
    const authUpdateData = {};
    if (dataToUpdate.email) {
      authUpdateData.email = dataToUpdate.email;
    }
    if (dataToUpdate.password && dataToUpdate.password.length > 0) {
      authUpdateData.password = dataToUpdate.password;
    }

    if (Object.keys(authUpdateData).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdateData);
      if (authError) {
        throw CommonError.BadRequest(`Gagal update user di Supabase Auth: ${authError.message}`);
      }
    }

    const prismaUpdateData = { ...dataToUpdate };
    delete prismaUpdateData.password;

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: prismaUpdateData,
      });
    } catch (dbError) {
      if (dbError.code === "P2025") {
        throw CommonError.NotFound(`User dengan ID ${userId} tidak ditemukan.`);
      }
      throw CommonError.DatabaseError(`Gagal update profil user: ${dbError.message}`);
    }
  }

  /**
   * Mengambil statistik ringkas sistem (Total User, Dokumen, dll).
   */
  async getSystemStats() {
    try {
      const [totalUsers, totalDocuments, totalGroups, totalSignatures] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.document.count(),
        this.prisma.group.count(),
        this.prisma.signaturePersonal.count().then((c1) => this.prisma.signatureGroup.count().then((c2) => c1 + c2)),
      ]);

      return { totalUsers, totalDocuments, totalGroups, totalSignatures };
    } catch (error) {
      throw CommonError.DatabaseError(`Gagal mengambil statistik: ${error.message}`);
    }
  }

  /**
   * Menghapus dokumen secara paksa (Bypass permission check)
   */
  async forceDeleteDocument(documentId) {
    try {
      return await this.prisma.document.delete({
        where: { id: documentId },
      });
    } catch (error) {
      if (error.code === "P2025") {
        throw CommonError.NotFound("Dokumen tidak ditemukan.");
      }
      throw CommonError.DatabaseError(`Gagal menghapus dokumen secara paksa: ${error.message}`);
    }
  }

  /**
   * Mengambil semua dokumen untuk keperluan moderasi admin.
   */
  async findAllDocuments() {
    return await this.prisma.document.findMany({
      // Hapus 'take: limit' agar mengambil semua data
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: { name: true, email: true }
        },
        group: {
          select: { name: true }
        },
      },
    });
  }

  async getTrafficStats() {
    const twentyFourHoursAgo = new Date(new Date() - 24 * 60 * 60 * 1000);

    try {
      return await this.prisma.apiRequestLog.findMany({
        where: {
          createdAt: {
            gte: twentyFourHoursAgo,
          },
        },
        select: {
          createdAt: true, // Kita hanya butuh waktu request-nya
        },
      });
    } catch (error) {
      console.error("Gagal ambil traffic stats:", error);
      return []; // Return array kosong jika gagal, jangan throw error agar dashboard tetap jalan
    }
  }
  /**
   * Mengambil semua laporan user dengan pagination (optional)
   */
  async findAllReports() {
    return this.prisma.userReport.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true, email: true, profilePictureUrl: true },
        },
      },
    });
  }

  /**
   * Mengupdate status laporan user
   */
  async updateReportStatus(reportId, newStatus) {
    try {
      return await this.prisma.userReport.update({
        where: { id: reportId },
        data: { status: newStatus },
      });
    } catch (error) {
      if (error.code === "P2025") {
        throw CommonError.NotFound(`Laporan dengan ID ${reportId} tidak ditemukan.`);
      }
      throw CommonError.DatabaseError(`Gagal update laporan: ${error.message}`);
    }
  }
}
