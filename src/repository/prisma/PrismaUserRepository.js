import { Prisma } from '@prisma/client';
import { UserRepository } from '../interface/UserRepository.js';
import bcrypt from 'bcrypt';
import AuthError from '../../errors/AuthError.js';
import UserError from '../../errors/UserError.js';
import CommonError from '../../errors/CommonError.js';

/**
 * @description Implementasi UserRepository menggunakan Prisma.
 * @implements {UserRepository}
 */
export class PrismaUserRepository extends UserRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }

    async createUser(userData) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            return await this.prisma.user.create({
                data: { ...userData, password: hashedPassword },
                select: { id: true, name: true, email: true, createdAt: true },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw AuthError.EmailAlreadyExist();
            }
            throw CommonError.DatabaseError(error.message);
        }
    }

    async findById(id) {
        return this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true, email: true, name: true, phoneNumber: true,
                title: true, address: true, profilePictureUrl: true,
                isSuperAdmin: true, createdAt: true, updatedAt: true,
            },
        });
    }

    async findAll() {
        return this.prisma.user.findMany({
            select: { id: true, email: true, name: true, isSuperAdmin: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async update(id, userData) {
        try {
            const updateData = { ...userData };
            if (updateData.password) {
                updateData.password = await bcrypt.hash(updateData.password, 10);
            }
            return await this.prisma.user.update({
                where: { id },
                data: updateData,
                select: {
                    id: true, email: true, name: true, phoneNumber: true,
                    title: true, address: true, profilePictureUrl: true, updatedAt: true,
                },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw UserError.NotFound(`User dengan ID ${id} tidak ditemukan.`);
            }
            throw CommonError.DatabaseError(error.message);
        }
    }

    // --- Metode Foto Profil ---

    async createProfilePicture(userId, pictureData) {
        return this.prisma.userProfilePicture.create({
            data: { userId, ...pictureData },
        });
    }

    async findProfilePictureByHash(userId, hash) {
        return this.prisma.userProfilePicture.findFirst({
            where: { userId, hash },
        });
    }

    async findProfilePictureById(userId, pictureId) {
        return this.prisma.userProfilePicture.findFirst({
            where: { id: pictureId, userId },
        });
    }

    async setProfilePictureActive(userId, pictureId) {
        return this.prisma.$transaction(async (tx) => {
            await tx.userProfilePicture.updateMany({
                where: { userId, id: { not: pictureId } },
                data: { isActive: false },
            });
            return tx.userProfilePicture.update({
                where: { id: pictureId },
                data: { isActive: true },
            });
        });
    }

    async findAllProfilePictures(userId) {
        return this.prisma.userProfilePicture.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async deleteProfilePicture(pictureId) {
        try {
            return await this.prisma.userProfilePicture.delete({
                where: { id: pictureId },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw UserError.PictureNotFound(`Foto profil dengan ID ${pictureId} tidak ditemukan.`);
            }
            throw CommonError.DatabaseError(error.message);
        }
    }
}