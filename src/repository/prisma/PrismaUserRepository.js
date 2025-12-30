import UserRepository from "../interface/UserRepository.js";
import bcrypt from "bcrypt";
import UserError from "../../errors/UserError.js";
import CommonError from "../../errors/CommonError.js";

/**
 * @description Implementasi UserRepository menggunakan Prisma.
 * @extends UserRepository
 */
class PrismaUserRepository extends UserRepository {
  /**
   * @param {PrismaClient} prismaClient - Instance Prisma yang di-inject.
   */
  constructor(prismaClient) {
    super();
    if (!prismaClient) {
      throw new CommonError.InternalServerError("PrismaClient harus disediakan.");
    }
    this.prisma = prismaClient;
  }

  /**
   * @description Membuat pengguna baru. Menerjemahkan error P2002 dari Prisma.
   */
  async createUser(userData) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      return await this.prisma.user.create({
        data: {
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
        },
        select: { id: true, name: true, email: true, createdAt: true },
      });
    } catch (error) {
      if (error.code === "P2002") {
        throw UserError.DuplicateEmail();
      }
      throw error;
    }
  }

  /**
   * @description Mencari satu pengguna berdasarkan ID.
   */
  async findById(id) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        title: true,
        address: true,
        profilePictureUrl: true,
        isSuperAdmin: true,
        userStatus: true,
        premiumUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * @description Mengambil semua pengguna.
   */
  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * @description Memperbarui data pengguna. Menerjemahkan error P2025 dari Prisma.
   */
  async update(id, userData) {
    const updateData = { ...userData };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          phoneNumber: true,
          title: true,
          address: true,
          profilePictureUrl: true,
          userStatus: true,
          premiumUntil: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (error.code === "P2025") {
        throw UserError.NotFound(`User dengan ID ${id} untuk diupdate tidak ditemukan.`);
      }
      throw error;
    }
  }

  /**
   * @description Menyimpan data foto profil baru ke database.
   */
  async createProfilePicture(userId, pictureData) {
    return this.prisma.userProfilePicture.create({
      data: {
        userId,
        url: pictureData.url,
        hash: pictureData.hash,
        isActive: pictureData.isActive ?? false,
      },
    });
  }

  /**
   * @description Mencari foto profil berdasarkan hash file.
   */
  async findProfilePictureByHash(userId, hash) {
    return this.prisma.userProfilePicture.findFirst({ where: { userId, hash } });
  }

  /**
   * @description Mencari foto profil berdasarkan ID-nya.
   */
  async findProfilePictureById(userId, pictureId) {
    return this.prisma.userProfilePicture.findFirst({ where: { id: pictureId, userId } });
  }

  /**
   * @description Menonaktifkan semua foto profil lain.
   */
  async deactivateOtherProfilePictures(userId, activePictureId) {
    return this.prisma.userProfilePicture.updateMany({
      where: { userId, id: { not: activePictureId } },
      data: { isActive: false },
    });
  }

  /**
   * @description Mengaktifkan sebuah foto profil.
   */
  async setProfilePictureActive(pictureId) {
    return this.prisma.userProfilePicture.update({
      where: { id: pictureId },
      data: { isActive: true },
    });
  }

  /**
   * @description Mengambil semua riwayat foto profil pengguna.
   */
  async findAllProfilePictures(userId) {
    return this.prisma.userProfilePicture.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * @description Menghapus foto profil menggunakan transaksi.
   */
  async deletePictureInTransaction(userId, pictureId, isActive) {
    return this.prisma.$transaction(async (tx) => {
      await tx.userProfilePicture.delete({ where: { id: pictureId } });
      if (isActive) {
        await tx.user.update({ where: { id: userId }, data: { profilePictureUrl: null } });
      }
    });
  }

  /**
   * @description Menghapus foto profil (metode sederhana).
   */
  async deleteProfilePicture(userId, pictureId) {
    return this.prisma.userProfilePicture.deleteMany({ where: { id: pictureId, userId } });
  }
}

export default PrismaUserRepository;
