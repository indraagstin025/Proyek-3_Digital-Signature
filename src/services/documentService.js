import crypto from "crypto";
import DocumentError from "../errors/DocumentError.js";
import CommonError from "../errors/CommonError.js";
import { isPdfEncrypted } from "../utils/pdfValidator.js";

/**
 * @class DocumentService
 * @description Service untuk mengelola dokumen, termasuk membuat, memperbarui, menghapus,
 * mengelola versi dokumen, serta integrasi dengan tanda tangan digital.
 */
export class DocumentService {
    /**
     * @constructor
     * @param {import('../repositories/documentRepository.js').DocumentRepository} documentRepository - Repository untuk operasi dokumen utama.
     * @param {import('../repositories/versionRepository.js').VersionRepository} versionRepository - Repository untuk mengelola versi dokumen.
     * @param {import('../repositories/signatureRepository.js').SignatureRepository} signatureRepository - Repository untuk tanda tangan dokumen.
     * @param {object} fileStorage - Service untuk penyimpanan file (upload & delete).
     * @param {object} pdfService - Service tambahan untuk manipulasi PDF.
     * @throws {Error} Jika salah satu dependency tidak diberikan.
     */
    constructor(documentRepository, versionRepository, signatureRepository, fileStorage, pdfService) {
        if (!documentRepository || !versionRepository || !signatureRepository || !fileStorage || !pdfService) {
            throw new Error("Semua repository dan service harus disediakan.");
        }
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.signatureRepository = signatureRepository;
        this.fileStorage = fileStorage;
        this.pdfService = pdfService;
    }

    /**
     * @private
     * @description Validasi file yang diunggah. Saat ini mengecek enkripsi pada PDF.
     * @param {object} file - Objek file dari multer.
     * @throws {DocumentError|CommonError} Jika file tidak valid.
     */
    async _validateFile(file) {
        if (file.mimetype !== 'application/pdf') {
            return;
        }

        try {
            const isEncrypted = await isPdfEncrypted(file.buffer);
            if (isEncrypted) {
                throw DocumentError.EncryptedFileNotAllowed();
            }
        } catch (error) {

            if (error instanceof DocumentError) {
                throw error;
            }

            throw CommonError.BadRequest(error.message);
        }
    }

    /**
     * @function createDocument
     * @description Membuat dokumen baru beserta versi pertamanya.
     * @param {string} userId - ID pengguna yang mengunggah dokumen.
     * @param {object} file - File dokumen yang diunggah (buffer, mimetype, dll).
     * @param {string} title - Judul dokumen.
     * @returns {Promise<object>} Dokumen baru yang berhasil dibuat.
     */
    async createDocument(userId, file, title) {
        if (!file) {
            throw new Error("File dokumen wajib diunggah.");
        }

        await this._validateFile(file);

        const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

        const existingVersion = await this.versionRepository.findByUserAndHash(userId, hash);
        if (existingVersion) {
            throw DocumentError.AlreadyExists();
        }

        const filePath = await this.fileStorage.uploadDocument(file, userId);
        return this.documentRepository.createWithFirstVersion(userId, title, filePath, hash);
    }

    /**
     * @function getAllDocuments
     * @description Mengambil semua dokumen milik user.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<object[]>} Daftar dokumen milik user.
     */
    async getAllDocuments(userId) {
        if (!userId) throw new Error("ID user tidak ditemukan.");
        return this.documentRepository.findAllByUserId(userId);
    }

    /**
     * @function getDocumentById
     * @description Mengambil dokumen berdasarkan ID (dengan validasi kepemilikan).
     * @param {string} documentId - ID dokumen.
     * @param {string} userId - ID pengguna pemilik dokumen.
     * @returns {Promise<object>} Dokumen yang ditemukan.
     */
    async getDocumentById(documentId, userId) {
        const document = await this.documentRepository.findById(documentId);
        if (!document) {
            throw DocumentError.NotFound(documentId);
        }
        if (document.userId !== userId) {
            throw DocumentError.UnauthorizedAccess();
        }
        return document;
    }

    /**
     * @function updateDocument
     * @description Memperbarui data dokumen (misalnya judul).
     * @param {string} documentId - ID dokumen.
     * @param {string} userId - ID pengguna.
     * @param {object} updates - Data update (contoh: { title }).
     * @returns {Promise<object>} Dokumen yang sudah diperbarui.
     */
    async updateDocument(documentId, userId, updates) {
        const document = await this.getDocumentById(documentId, userId);

        const dataToUpdate = {};
        if (updates && updates.title) {
            dataToUpdate.title = updates.title;
        }

        if (Object.keys(dataToUpdate).length === 0) {
            return document;
        }

        return this.documentRepository.update(documentId, dataToUpdate);
    }

    /**
     * @function deleteDocument
     * @description Menghapus dokumen beserta semua versinya dari database dan storage.
     * @param {string} documentId - ID dokumen.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<{message: string}>} Pesan konfirmasi penghapusan.
     */
    async deleteDocument(documentId, userId) {
        const document = await this.getDocumentById(documentId, userId);

        const allVersions = await this.versionRepository.findAllByDocumentId(document.id);
        for (const version of allVersions) {
            await this.fileStorage.deleteFile(version.url);
        }
        await this.documentRepository.deleteById(document.id);
        return { message: "Dokumen dan semua riwayatnya berhasil dihapus." };
    }

    /**
     * @function getDocumentHistory
     * @description Mengambil semua riwayat versi dari sebuah dokumen.
     * @param {string} documentId - ID dokumen.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<object[]>} Daftar versi dokumen.
     */
    async getDocumentHistory(documentId, userId) {
        await this.getDocumentById(documentId, userId);
        return this.versionRepository.findAllByDocumentId(documentId);
    }

    /**
     * @function useOldVersion
     * @description Menggunakan versi lama dari dokumen sebagai versi aktif.
     * @param {string} documentId - ID dokumen.
     * @param {string} versionId - ID versi lama yang akan digunakan.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<object>} Dokumen dengan versi yang diperbarui.
     */
    async useOldVersion(documentId, versionId, userId) {
        await this.getDocumentById(documentId, userId);

        const version = await this.versionRepository.findById(versionId, {
            include: { signaturesPersonal: true },
        });

        if (!version || version.documentId !== documentId) {
            throw DocumentError.InvalidVersion(versionId, documentId);
        }

        const isTargetVersionSigned = version.signaturesPersonal && version.signaturesPersonal.length > 0;
        const newStatus = isTargetVersionSigned ? "completed" : "draft";

        return this.documentRepository.update(documentId, {
            currentVersionId: versionId,
            status: newStatus,
            signedFileUrl: isTargetVersionSigned ? version.url : null,
        });
    }

    /**
     * @function deleteVersion
     * @description Menghapus salah satu versi dokumen (selain versi aktif).
     * @param {string} documentId - ID dokumen.
     * @param {string} versionId - ID versi dokumen yang akan dihapus.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<{message: string}>} Pesan konfirmasi penghapusan versi.
     */
    async deleteVersion(documentId, versionId, userId) {
        const document = await this.getDocumentById(documentId, userId);

        if (document.currentVersion.id === versionId) {
            throw DocumentError.DeleteActiveVersionFailed();
        }

        const versionToDelete = await this.versionRepository.findById(versionId);
        if (!versionToDelete || versionToDelete.documentId !== documentId) {
            throw DocumentError.InvalidVersion(versionId, documentId);
        }

        await this.fileStorage.deleteFile(versionToDelete.url);
        await this.versionRepository.deleteById(versionId);
        return { message: "Versi dokumen berhasil dihapus." };
    }

    /**
     * @function getVersionFileUrl
     * @description Mendapatkan signed URL untuk sebuah versi dokumen spesifik setelah validasi.
     * @param {string} documentId - ID dokumen.
     * @param {string} versionId - ID versi.
     * @param {string} userId - ID pengguna untuk validasi kepemilikan.
     * @returns {Promise<string>} Signed URL yang valid untuk diakses.
     */
    async getVersionFileUrl(documentId, versionId, userId) {
        await this.getDocumentById(documentId, userId);

        const version = await this.versionRepository.findById(versionId);

        if (!version || version.documentId !== documentId) {
            throw DocumentError.InvalidVersion(versionId, documentId);
        }

        return this.fileStorage.getSignedUrl(version.url, 60);
    }
}
