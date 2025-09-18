import { PrismaClient } from '@prisma/client';
import UserRepository from '../interface/UserRepository.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * @description Implementasi UserRepository menggunakan Prisma.
 * Menangani semua operasi database yang berkaitan dengan pengguna dan foto profil.
 * @extends UserRepository
 */
class PrismaUserRepository extends UserRepository {
  /**
   * @description Membuat pengguna baru di database dengan password yang di-hash.
   * @param {object} userData - Data pengguna baru.
   * @param {string} userData.name - Nama pengguna.
   * @param {string} userData.email - Email pengguna (harus unik).
   * @param {string} userData.password - Password pengguna (plain text).
   * @returns {Promise<object>} Objek pengguna yang baru dibuat (tanpa password).
   * @throws {Error} Jika email sudah terdaftar.
   */
  async createUser(userData) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      return await prisma.user.create({
        data: {
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new Error('Email sudah terdaftar.');
      }
      throw error;
    }
  }

  /**
   * @description Mencari satu pengguna berdasarkan ID uniknya.
   * @param {string} id - ID pengguna (format UUID).
   * @returns {Promise<object|null>} Objek data pengguna atau null jika tidak ditemukan.
   * @throws {Error} Jika ID tidak valid atau pengguna tidak ditemukan.
   */
  async findById(id) {
    if (!id || typeof id !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      throw new Error("ID user tidak valid.");
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, phoneNumber: true,
        title: true, address: true, profilePictureUrl: true,
        isSuperAdmin: true, createdAt: true, updatedAt: true,
      },
    });

    if (!user) throw new Error(`User dengan ID ${id} tidak ditemukan.`);
    return user;
  }

  /**
   * @description Mengambil semua pengguna dari database.
   * @returns {Promise<Array<object>>} Array berisi objek data pengguna.
   */
  async findAll() {
    return prisma.user.findMany({
      select: {
        id: true, email: true, name: true,
        isSuperAdmin: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * @description Memperbarui data pengguna berdasarkan ID.
   * @param {string} id - ID pengguna yang akan diperbarui.
   * @param {object} userData - Data baru untuk pengguna.
   * @returns {Promise<object>} Objek pengguna yang telah diperbarui.
   * @throws {Error} Jika ID tidak valid atau pengguna tidak ditemukan.
   */
  async update(id, userData) {
    if (!id || typeof id !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      throw new Error("ID user tidak valid.");
    }

    const updateData = { ...userData };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    try {
      return await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true, email: true, name: true, phoneNumber: true,
          title: true, address: true, profilePictureUrl: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new Error(`User dengan ID ${id} tidak ditemukan.`);
      }
      throw error;
    }
  }

  /**
   * @description Menyimpan data foto profil baru ke database.
   * @param {string} userId - ID pengguna pemilik foto.
   * @param {object} pictureData - Data foto yang akan disimpan.
   * @param {string} pictureData.url - URL publik dari foto.
   * @param {string} pictureData.hash - Hash SHA-256 dari file foto.
   * @param {boolean} [pictureData.isActive=false] - Status keaktifan foto.
   * @returns {Promise<object>} Objek data foto yang baru dibuat.
   */
  async createProfilePicture(userId, pictureData) {
    if (!userId || typeof userId !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
      throw new Error("userId harus string UUID yang valid.");
    }
    if (!pictureData || !pictureData.url || !pictureData.hash) {
      throw new Error("Data foto tidak lengkap. Pastikan url dan hash tersedia.");
    }

    return prisma.userProfilePicture.create({
      data: {
        userId,
        url: pictureData.url,
        hash: pictureData.hash,
        isActive: pictureData.isActive ?? false,
      },
      select: {
        id: true, url: true, hash: true,
        isActive: true, createdAt: true,
      },
    });
  }

  /**
   * @description Mencari foto profil berdasarkan hash file untuk pengguna tertentu.
   * @param {string} userId - ID pengguna.
   * @param {string} hash - Hash SHA-256 dari file foto.
   * @returns {Promise<object|null>} Objek foto profil atau null jika tidak ditemukan.
   */
  async findProfilePictureByHash(userId, hash) {
    return prisma.userProfilePicture.findFirst({
      where: { userId, hash },
    });
  }

  /**
   * @description Mencari foto profil berdasarkan ID foto dan ID pengguna.
   * @param {string} userId - ID pengguna.
   * @param {string} pictureId - ID foto profil.
   * @returns {Promise<object|null>} Objek foto profil atau null jika tidak ditemukan.
   */
  async findProfilePictureById(userId, pictureId) {
    return prisma.userProfilePicture.findFirst({
      where: { id: pictureId, userId },
    });
  }

  /**
   * @description Menonaktifkan semua foto profil lain milik seorang pengguna.
   * @param {string} userId - ID pengguna.
   * @param {string} [activePictureId] - ID foto yang dikecualikan (yang baru saja aktif).
   * @returns {Promise<object>} Hasil operasi updateMany dari Prisma.
   */
  async deactivateOtherProfilePictures(userId, activePictureId) {
    return prisma.userProfilePicture.updateMany({
      where: {
        userId,
        id: activePictureId ? { not: activePictureId } : undefined,
      },
      data: { isActive: false },
    });
  }

  /**
   * @description Mengatur status sebuah foto profil menjadi aktif.
   * @param {string} pictureId - ID foto profil.
   * @returns {Promise<object>} Objek foto profil yang telah diperbarui.
   */
  async setProfilePictureActive(pictureId) {
    return prisma.userProfilePicture.update({
      where: { id: pictureId },
      data: { isActive: true },
    });
  }

  /**
   * @description Mengambil semua riwayat foto profil milik seorang pengguna.
   * @param {string} userId - ID pengguna.
   * @returns {Promise<Array<object>>} Array berisi objek foto profil.
   */
  async findAllProfilePictures(userId) {
    return prisma.userProfilePicture.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * @description Menghapus data foto dari database dalam sebuah transaksi.
   * Jika foto yang dihapus adalah foto aktif, maka `profilePictureUrl` di tabel user akan di-null-kan.
   * @param {string} userId - ID pengguna.
   * @param {string} pictureId - ID foto yang akan dihapus.
   * @param {boolean} isActive - Status keaktifan foto yang akan dihapus.
   * @returns {Promise<void>}
   */
  async deletePictureInTransaction(userId, pictureId, isActive) {
    if (!userId || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
      throw new Error("ID user tidak valid.");
    }

    return prisma.$transaction(async (tx) => {
      await tx.userProfilePicture.delete({
        where: { id: pictureId },
      });

      if (isActive) {
        await tx.user.update({
          where: { id: userId },
          data: { profilePictureUrl: null },
        });
      }
    });
  }

  /**
   * @description Menghapus foto profil berdasarkan ID foto dan ID pengguna.
   * @param {string} userId - ID pengguna.
   * @param {string} pictureId - ID foto profil.
   * @returns {Promise<object>} Hasil operasi deleteMany dari Prisma.
   */
  async deleteProfilePicture(userId, pictureId) {
    return prisma.userProfilePicture.deleteMany({
      where: { id: pictureId, userId },
    });
  }
}

export default PrismaUserRepository;