import supabaseAdmin, { supabaseBucket } from "../../config/supabaseAdmin.js";
import path from "path";
import crypto from "crypto";
import CommonError from "../../errors/CommonError.js";

/**
 * @class SupabaseFileStorage
 * @description Service untuk manajemen file menggunakan Supabase Storage.
 * Mencakup upload, download, delete, dan utilitas path.
 */
class SupabaseFileStorage {
    /**
     * @description Upload file umum ke Supabase Storage.
     * @param {string} filePath - Path tujuan penyimpanan file di bucket.
     * @param {Buffer} buffer - Buffer file yang akan diupload.
     * @param {string} contentType - MIME type file.
     * @returns {Promise<string>} Relative path file di bucket.
     * @throws {CommonError.SupabaseError}
     */
    async uploadFile(filePath, buffer, contentType) {
        const { error } = await supabaseAdmin.storage
            .from(supabaseBucket)
            .upload(filePath, buffer, { contentType, upsert: true });

        if (error) {
            throw CommonError.SupabaseError(`Gagal mengunggah file generik: ${error.message}`);
        }

        return filePath; // ✅ kembalikan relative path
    }

    /**
     * @description Upload dokumen user ke Supabase Storage (auto-generate nama unik).
     * @param {Express.Multer.File} file - File dokumen yang akan diupload.
     * @param {string} userId - ID pengguna pemilik dokumen.
     * @returns {Promise<string>} Relative path file di bucket.
     * @throws {CommonError.SupabaseError|Error}
     */
    async uploadDocument(file, userId) {
        if (!file || !userId) {
            throw new Error("File dan User ID wajib disediakan.");
        }

        const ext = path.extname(file.originalname);
        const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
        const filePath = `documents/${userId}/${uniqueFileName}`;

        const { error } = await supabaseAdmin.storage
            .from(supabaseBucket)
            .upload(filePath, file.buffer, { contentType: file.mimetype });

        if (error) {
            throw CommonError.SupabaseError(`Gagal mengunggah dokumen: ${error.message}`);
        }

        return filePath; // ✅ kembalikan relative path
    }

    /**
     * @description Generate signed URL untuk akses file private.
     * @param {string} filePath - Relative path file di bucket.
     * @param {number} expiresIn - Masa berlaku dalam detik (default: 60).
     * @param {string} [downloadFilename] - Opsional: Nama file kustom untuk diunduh.
     * @returns {Promise<string>} Signed URL.
     * @throws {CommonError.SupabaseError}
     */
    async getSignedUrl(filePath, expiresIn = 60, downloadFilename = null) {
        const options = downloadFilename
            ? { transform: {}, download: downloadFilename } // ✅ gunakan nama custom
            : { transform: {} }; // ❌ jangan pakai download:true

        const { data, error } = await supabaseAdmin.storage
            .from(supabaseBucket)
            .createSignedUrl(filePath, expiresIn, options);

        if (error) {
            throw CommonError.SupabaseError(`Gagal generate signed URL: ${error.message}`);
        }

        return data.signedUrl;
    }



    /**
     * @description Download file dan mengembalikannya sebagai buffer.
     * @param {string} filePath - Relative path file di bucket.
     * @returns {Promise<Buffer>} Buffer file.
     * @throws {CommonError.SupabaseError|CommonError.InternalServerError}
     */
    async downloadFileAsBuffer(filePath) {
        const { data, error } = await supabaseAdmin.storage
            .from(supabaseBucket)
            .download(filePath);

        if (error) {
            throw CommonError.SupabaseError(`Gagal mengunduh file: ${error.message}`);
        }

        const buffer = Buffer.from(await data.arrayBuffer());
        return buffer;
    }

    /**
     * @description Menghapus file berdasarkan relative path.
     * @param {string} filePath - Relative path file di bucket.
     * @returns {Promise<void>}
     */
    async deleteFile(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            console.warn("deleteFile dipanggil dengan filePath yang tidak valid.");
            return;
        }

        const { error } = await supabaseAdmin.storage
            .from(supabaseBucket)
            .remove(filePath);
        if (error) {
            throw CommonError.SupabaseError(`Supabase gagal menghapus file: ${error.message}`);
        }
    }

    /**
     * @description Upload foto profil user ke Supabase Storage.
     * @param {Express.Multer.File} file - File gambar profil.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<string>} Relative path file di bucket.
     * @throws {CommonError.SupabaseError|Error}
     */
    async uploadProfilePicture(file, userId) {
        if (!file) throw new Error("File tidak ditemukan.");
        const ext = path.extname(file.originalname);
        const fileName = `profile-pictures/${userId}/${Date.now()}${ext}`;

        const { error } = await supabaseAdmin.storage
            .from(supabaseBucket)
            .upload(fileName, file.buffer, { contentType: file.mimetype });

        if (error) {
            throw CommonError.SupabaseError(`Upload profile gagal: ${error.message}`);
        }

        return fileName; // ✅ kembalikan relative path
    }

}

export default SupabaseFileStorage;