import crypto from "crypto";
import DocumentError from "../errors/DocumentError.js"; // <-- Impor error kustom
import CommonError from "../errors/CommonError.js";   // <-- Impor error umum jika perlu

/**
 * @description Kelas layanan untuk menangani semua logika bisnis yang terkait dengan dokumen.
 */
export class DocumentService {
    /**
     * @param {object} documentRepository - Repository untuk operasi dokumen.
     * @param {object} versionRepository - Repository untuk operasi versi dokumen.
     * @param {object} signatureRepository - Repository untuk operasi tanda tangan.
     * @param {object} fileStorage - Layanan untuk interaksi dengan cloud storage.
     * @param {object} pdfService - Layanan untuk operasi terkait PDF.
     */
    constructor(documentRepository, versionRepository, signatureRepository, fileStorage, pdfService) {
        if (!documentRepository || !versionRepository || !signatureRepository || !fileStorage || !pdfService) {
            // Ini adalah error konfigurasi server, jadi InternalServerError lebih tepat.
            throw CommonError.InternalServerError("Dependensi untuk DocumentService tidak lengkap.");
        }
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.signatureRepository = signatureRepository;
        this.fileStorage = fileStorage;
        this.pdfService = pdfService;
    }

    /**
     * @description Membuat dokumen baru. Memvalidasi duplikasi konten dan mendelegasikannya ke repository.
     * @param {string} userId - ID pengguna yang mengunggah.
     * @param {object} file - Objek file dari multer (mengandung buffer).
     * @param {string} title - Judul dokumen.
     * @returns {Promise<object>} Dokumen yang baru dibuat.
     */
    async createDocument(userId, file, title) {
        // Validasi input (`!file`, `!title`) sudah ditangani oleh middleware validator.
        const fileBuffer = file.buffer;
        const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

        const existingVersion = await this.versionRepository.findByUserAndHash(userId, hash);
        if (existingVersion) {
            // Gunakan error spesifik untuk pelanggaran aturan bisnis.
            throw DocumentError.DuplicateDocument();
        }

        const publicUrl = await this.fileStorage.uploadDocument(file, userId);

        return this.documentRepository.createWithFirstVersion(userId, title, publicUrl, hash);
    }

    /**
     * @description Mengambil semua dokumen milik pengguna.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<Array<object>>} Daftar dokumen.
     */
    async getAllDocuments(userId) {
        // Asumsi userId selalu ada dari authMiddleware.
        return this.documentRepository.findAllByUserId(userId);
    }

    /**
     * @description Mengambil detail satu dokumen dan memvalidasi kepemilikan.
     * @param {string} documentId - ID dokumen.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<object>} Detail dokumen.
     * @throws {DocumentError.NotFound} Jika dokumen tidak ditemukan atau bukan milik pengguna.
     */
    async getDocumentById(documentId, userId) {
        const document = await this.documentRepository.findById(documentId, userId);
        if (!document) {
            throw DocumentError.NotFound("Dokumen tidak ditemukan atau Anda tidak memiliki akses.");
        }
        return document;
    }

    /**
     * @description Memperbarui metadata dokumen (misalnya, judul).
     * @param {string} documentId - ID dokumen.
     * @param {string} userId - ID pengguna.
     * @param {object} updates - Objek berisi data pembaruan, misal: { title: "Judul Baru" }.
     * @returns {Promise<object>} Dokumen yang telah diperbarui.
     */
    async updateDocument(documentId, userId, updates) {
        await this.getDocumentById(documentId, userId); // Memastikan kepemilikan sebelum update.

        const dataToUpdate = {};
        if (updates && updates.title) {
            dataToUpdate.title = updates.title;
        }

        if (Object.keys(dataToUpdate).length === 0) {
            // Jika tidak ada data valid untuk diupdate, kembalikan dokumen saat ini.
            return this.getDocumentById(documentId, userId);
        }

        return this.documentRepository.update(documentId, dataToUpdate);
    }

    /**
     * @description Menghapus dokumen, semua versinya, dan file-filenya di storage.
     * @param {string} documentId - ID dokumen.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<{message: string}>} Pesan konfirmasi.
     */
    async deleteDocument(documentId, userId) {
        await this.getDocumentById(documentId, userId); // Memastikan kepemilikan.

        const allVersions = await this.versionRepository.findAllByDocumentId(documentId);
        for (const version of allVersions) {
            await this.fileStorage.deleteFile(version.url);
        }

        await this.documentRepository.deleteById(documentId);
        return { message: "Dokumen dan semua riwayatnya berhasil dihapus." };
    }

    /**
     * @description Mengambil semua riwayat versi dari satu dokumen.
     * @param {string} documentId - ID dokumen.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<Array<object>>} Daftar versi dokumen.
     */
    async getDocumentHistory(documentId, userId) {
        await this.getDocumentById(documentId, userId); // Memastikan kepemilikan.
        return this.versionRepository.findAllByDocumentId(documentId);
    }

    /**
     * @description Mengganti versi aktif ke versi lama dari riwayat.
     * @param {string} documentId - ID dokumen.
     * @param {string} versionId - ID versi yang akan dijadikan aktif.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<object>} Dokumen yang telah diperbarui.
     */
    async useOldVersion(documentId, versionId, userId) {
        await this.getDocumentById(documentId, userId); // Memastikan kepemilikan.

        const version = await this.versionRepository.findById(versionId, { include: { signaturesPersonal: true } });
        if (!version || version.documentId !== documentId) {
            throw DocumentError.VersionNotFound("Versi tidak valid untuk dokumen ini.");
        }

        const isTargetVersionSigned = version.signaturesPersonal?.length > 0;
        const newStatus = isTargetVersionSigned ? "completed" : "draft";

        return this.documentRepository.update(documentId, {
            currentVersionId: versionId,
            status: newStatus,
            signedFileUrl: isTargetVersionSigned ? version.url : null,
        });
    }

    /**
     * @description Menghapus satu versi spesifik dari riwayat.
     * @param {string} documentId - ID dokumen.
     * @param {string} versionId - ID versi yang akan dihapus.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<{message: string}>} Pesan konfirmasi.
     */
    async deleteVersion(documentId, versionId, userId) {
        const document = await this.getDocumentById(documentId, userId); // Memastikan kepemilikan.

        if (document.currentVersion.id === versionId) {
            throw DocumentError.DeleteVersionError("Tidak dapat menghapus versi yang sedang aktif. Ganti ke versi lain terlebih dahulu.");
        }

        const versionToDelete = await this.versionRepository.findById(versionId);
        if (!versionToDelete || versionToDelete.documentId !== documentId) {
            throw DocumentError.VersionNotFound("Versi tidak ditemukan dalam riwayat dokumen ini.");
        }

        await this.fileStorage.deleteFile(versionToDelete.url);
        await this.versionRepository.deleteById(versionId);

        return { message: "Versi dokumen berhasil dihapus." };
    }
}