import supabaseAdmin from "../../config/supabaseAdmin.js";
import prisma from "../../config/prismaClient.js";
import CommonError from "../../errors/CommonError.js";

export class PrismaAdminRepository {
  async findAllUsers() {
    return prisma.user.findMany({
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
      return await prisma.user.create({
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
      return await prisma.user.delete({ where: { id: userId } });
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
      return await prisma.user.update({
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
}
