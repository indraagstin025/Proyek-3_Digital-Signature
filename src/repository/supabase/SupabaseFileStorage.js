import path from 'path';
import crypto from 'crypto';
import CommonError from '../../errors/CommonError.js';
import {FileStorage} from '../interface/FileStorage.js';

/**
 * @description Implementasi FileStorage menggunakan Supabase.
 * @implements {FileStorage}
 */
class SupabaseFileStorage extends FileStorage {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient - Instance SupabaseClient yang diinjeksi.
     */
    constructor(supabaseClient) {
        super();
        if (!supabaseClient) {
            throw new CommonError.InternalServerError('Supabase client harus disediakan.');
        }
        this.supabase = supabaseClient;
        this.bucketName = process.env.SUPABASE_BUCKET_NAME || 'digital_signature';
    }

    /**
     * @description Mengunggah file dokumen baru.
     * @param {object} file - Objek file dari multer.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<string>} URL publik dari file yang diunggah.
     * @throws {CommonError.StorageError} Jika upload gagal.
     */
    async uploadDocument(file, userId) {
        const ext = path.extname(file.originalname);
        const uniqueFileName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
        const filePath = `documents/${userId}/${uniqueFileName}`;

        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .upload(filePath, file.buffer, { contentType: file.mimetype });

            if (error) throw error;

            const { data: { publicUrl } } = this.supabase.storage.from(this.bucketName).getPublicUrl(data.path);
            return publicUrl;
        } catch (error) {
            throw CommonError.StorageError(`Gagal mengunggah dokumen: ${error.message}`);
        }
    }

    /**
     * @description Mengunggah foto profil baru.
     * @param {object} file - Objek file dari multer.
     * @param {string} userId - ID pengguna.
     * @returns {Promise<string>} URL publik dari foto profil.
     * @throws {CommonError.StorageError} Jika upload gagal.
     */
    async uploadProfilePicture(file, userId) {
        const ext = path.extname(file.originalname);
        const fileName = `profile-pictures/${userId}/${Date.now()}${ext}`;

        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true }); // Upsert true untuk menimpa foto lama

            if (error) throw error;

            const { data: { publicUrl } } = this.supabase.storage.from(this.bucketName).getPublicUrl(data.path);
            return publicUrl;
        } catch (error) {
            throw CommonError.StorageError(`Gagal mengunggah foto profil: ${error.message}`);
        }
    }

    /**
     * @description Mengunduh file dari storage sebagai Buffer.
     * @param {string} publicUrl - URL publik lengkap dari file.
     * @returns {Promise<Buffer>} Buffer dari file yang diunduh.
     * @throws {CommonError.StorageError} Jika download gagal.
     */
    async downloadFileAsBuffer(publicUrl) {
        const filePath = this._getFilePathFromUrl(publicUrl);
        if (!filePath) {
            throw CommonError.StorageError('Gagal mengekstrak path dari URL untuk diunduh.');
        }

        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .download(decodeURIComponent(filePath));

            if (error) throw error;

            return Buffer.from(await data.arrayBuffer());
        } catch (error) {
            throw CommonError.StorageError(`Gagal mengunduh file: ${error.message}`);
        }
    }

    /**
     * @description Menghapus file dari Supabase storage berdasarkan URL.
     * @param {string} publicUrl - URL publik file yang akan dihapus.
     * @returns {Promise<void>}
     */
    async deleteFile(publicUrl) {
        if (!publicUrl) return;

        try {
            const filePath = this._getFilePathFromUrl(publicUrl);
            if (!filePath) {
                console.warn(`URL tidak valid, proses hapus file dilewati: ${publicUrl}`);
                return;
            }

            const { error } = await this.supabase.storage
                .from(this.bucketName)
                .remove([decodeURIComponent(filePath)]);

            if (error && error.statusCode !== '404') {
                throw error;
            }
        } catch (error) {
            console.error(`Gagal menghapus file di Supabase [NON-BLOCKING]: ${error.message}`);
        }
    }

    /**
     * @description Helper privat untuk mengekstrak path file dari URL.
     * @param {string} publicUrl
     * @returns {string|null}
     * @private
     */
    _getFilePathFromUrl(publicUrl) {
        try {
            const url = new URL(publicUrl);
            const pathParts = url.pathname.split(`/${this.bucketName}/`);
            return pathParts[1] || null;
        } catch (e) {
            console.error('URL tidak valid:', publicUrl);
            return null;
        }
    }
}

export default SupabaseFileStorage;