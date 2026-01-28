import CommonError from "../../errors/CommonError.js";

export class PrismaGroupSignatureRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }

    /**
     * [CREATE] Group Signature
     * [FIXED] Menambahkan penyimpanan ipAddress, userAgent, dan accessCode
     */
    async create(data) {
        const { id, documentVersionId, userId, ...rest } = data;
        return this.prisma.signatureGroup.create({
            data: {
                id: id,
                documentVersion: { connect: { id: documentVersionId } },
                signer: { connect: { id: userId } },

                // Data Visual
                pageNumber: rest.pageNumber,
                positionX: parseFloat(rest.positionX),
                positionY: parseFloat(rest.positionY),
                width: parseFloat(rest.width || 0),
                height: parseFloat(rest.height || 0),
                signatureImageUrl: rest.signatureImageUrl || "",
                method: rest.method || "canvas",
                status: rest.status || "draft",

                // [FIX] Data Audit & Security (PENTING)
                ipAddress: rest.ipAddress || null,
                userAgent: rest.userAgent || null,
                accessCode: rest.accessCode || null,

                // ✅ Use signedAt from payload if provided, otherwise use current time
                signedAt: rest.signedAt || new Date(),
            },
            include: {
                signer: { select: { id: true, name: true, email: true } },
            },
        });
    }

    /**
     * [READ] Find One by ID
     */
    async findById(id) {
        return this.prisma.signatureGroup.findUnique({
            where: { id },
            include: {
                signer: true,
                documentVersion: {
                    include: {
                        document: {
                            include: {
                                owner: true // ✅ Include document owner for verification
                            }
                        }
                    }
                },
            },
        });
    }

    /**
     * [READ] Find Specific User's Signature in a Version
     */
    async findBySignerAndVersion(userId, documentVersionId) {
        return this.prisma.signatureGroup.findFirst({
            where: { signerId: userId, documentVersionId: documentVersionId },
        });
    }

    /**
     * [READ] Get All Signatures for a Version
     */
    async findAllByVersionId(documentVersionId) {
        return this.prisma.signatureGroup.findMany({
            where: { documentVersionId: documentVersionId },
            orderBy: { signedAt: "asc" },
            include: {
                signer: {
                    select: { id: true, name: true, email: true }
                }
            },
        });
    }

    /**
     * [UPDATE]
     * [FIXED] Update ipAddress, userAgent, accessCode dan WAKTU (signedAt).
     */
    async update(id, data) {
        try {
            return await this.prisma.signatureGroup.update({
                where: { id },
                data: {
                    positionX: data.positionX !== undefined ? parseFloat(data.positionX) : undefined,
                    positionY: data.positionY !== undefined ? parseFloat(data.positionY) : undefined,
                    width: data.width !== undefined ? parseFloat(data.width) : undefined,
                    height: data.height !== undefined ? parseFloat(data.height) : undefined,
                    pageNumber: data.pageNumber,
                    signatureImageUrl: data.signatureImageUrl,
                    method: data.method,
                    status: data.status,
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                    accessCode: data.accessCode,
                    retryCount: data.retryCount,
                    lockedUntil: data.lockedUntil,
                    // ✅ Use signedAt from payload if provided, otherwise set on final/ipAddress
                    signedAt: data.signedAt || ((data.status === 'final' || data.ipAddress) ? new Date() : undefined)
                },
                include: {
                    signer: { select: { id: true, name: true, email: true } },
                },
            });
        } catch (error) {
            if (error.code === "P2025") return null;
            throw error;
        }
    }

    /**
     * [DELETE] Single
     */
    async delete(id) {
        return this.prisma.signatureGroup.deleteMany({
            where: { id },
        });
    }

    /**
     * [DELETE] Many Drafts (Cleanup)
     */
    async deleteDrafts(documentId, userId) {
        return this.prisma.signatureGroup.deleteMany({
            where: {
                signerId: userId,
                status: "draft",
                documentVersion: {
                    documentId: documentId,
                },
            },
        });
    }

    /**
     * [BARU - REQUIRED FOR ROLLBACK]
     */
    async deleteBySignerAndVersion(userId, documentVersionId) {
        const whereCondition = {
            documentVersionId: documentVersionId,
        };

        if (userId) {
            whereCondition.signerId = userId;
        }

        return this.prisma.signatureGroup.deleteMany({
            where: whereCondition,
        });
    }
}