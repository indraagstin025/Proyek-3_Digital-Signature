import asyncHandler from "../utils/asyncHandler.js";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";

/**
 * Helper lokal untuk mendapatkan IP Address pengguna.
 * Mendukung proxy (x-forwarded-for) untuk lingkungan production (Vercel/Railway).
 * * @param {import('express').Request} req - Express Request object.
 * @returns {string} IP Address pengguna.
 */
const getRealIpAddress = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor && typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0].trim();
    }
    return req.ip || req.connection.remoteAddress;
};

/**
 * Membuat instance SignatureController dengan Dependency Injection.
 * Controller ini menangani logika penandatanganan personal dan verifikasi ganda (Personal & Paket).
 *
 * @param {import('../services/documentService.js').DocumentService} documentService - Service untuk manajemen dokumen.
 * @param {import('../services/signatureService.js').SignatureService} signatureService - Service untuk tanda tangan personal.
 * @param {import('../services/packageService.js').PackageService} packageService - Service untuk tanda tangan paket (opsional/wajib untuk fallback).
 * @returns {object} Objek berisi handler Express untuk rute signature.
 */
export const createSignatureController = (documentService, signatureService, packageService) => {
    return {
        /**
         * Menambahkan tanda tangan pribadi (Personal Signature) pada sebuah versi dokumen.
         * Mengambil data posisi, ukuran, dan gambar tanda tangan dari body request.
         * * @route POST /api/signatures/personal
         * @access Private (Logged in user)
         * @throws {CommonError.BadRequest} Jika input tidak valid.
         */
        addPersonalSignature: asyncHandler(async (req, res, next) => {
            const userId = req.user?.id;
            const {
                documentVersionId,
                method,
                signatureImageUrl,
                positionX,
                positionY,
                pageNumber,
                width,
                height,
                displayQrCode = true
            } = req.body;

            // Validasi kelengkapan input
            if (!documentVersionId || !signatureImageUrl || positionX == null || positionY == null || !pageNumber || !width || !height) {
                return res.status(400).json({
                    status: "fail",
                    code: "INVALID_INPUT",
                    message: "Data tidak lengkap. Pastikan semua informasi (termasuk posisi dan ukuran) terkirim.",
                });
            }

            const signatureData = {
                method,
                signatureImageUrl,
                positionX,
                positionY,
                pageNumber,
                width,
                height,
            };

            const auditData = {
                ipAddress: getRealIpAddress(req),
                userAgent: req.headers["user-agent"],
            };

            const options = { displayQrCode };

            const updatedDocument = await signatureService.addPersonalSignature(
                userId,
                documentVersionId,
                signatureData,
                auditData,
                options
            );

            return res.status(200).json({
                status: "success",
                message: "Dokumen berhasil ditandatangani.",
                data: updatedDocument,
            });
        }),

        /**
         * Memverifikasi validitas tanda tangan berdasarkan ID uniknya (Scan QR Code).
         * * Metode ini menerapkan strategi **Fallback**:
         * 1. Mencoba mencari ID di layanan Tanda Tangan Personal (`SignatureService`).
         * 2. Jika tidak ditemukan (NotFound), mencoba mencari di layanan Paket (`PackageService`).
         * 3. Jika tidak ditemukan di keduanya, melempar error NotFound.
         * * @route GET /api/signatures/verify/:signatureId
         * @access Public
         * @throws {SignatureError.NotFound} Jika ID tidak ditemukan di kedua layanan.
         */
        getSignatureVerification: asyncHandler(async (req, res, next) => {
            const { signatureId } = req.params;
            let verificationDetails = null;
            let errorFromPersonal = null;

            try {
                verificationDetails = await signatureService.getVerificationDetails(signatureId);
            } catch (error) {
                errorFromPersonal = error;
            }

            if (!verificationDetails && packageService) {
                try {
                    const pkgResult = await packageService.getPackageSignatureVerificationDetails(signatureId);
                    if (pkgResult) {
                        verificationDetails = pkgResult;
                    }
                } catch (pkgError) {

                }
            }

            // 3. Evaluasi Hasil Akhir
            if (!verificationDetails) {
                if (errorFromPersonal) {
                    throw errorFromPersonal;
                }
                throw SignatureError.NotFound(signatureId);
            }

            return res.status(200).json({
                status: "success",
                data: verificationDetails,
            });
        }),

        /**
         * Memverifikasi integritas dokumen PDF yang diunggah secara manual.
         * Membandingkan Hash file yang diunggah dengan Hash yang tersimpan di database.
         * * Sama seperti verifikasi QR, metode ini juga mengecek ke Personal dan Package.
         * * @route POST /api/signatures/verify-file
         * @access Public (Requires Multer middleware)
         * @throws {CommonError.BadRequest} Jika ID atau File tidak disertakan.
         */
        verifyUploadedSignature: asyncHandler(async (req, res, next) => {
            const { signatureId } = req.body;
            const uploadedFileBuffer = req.file?.buffer;

            if (!signatureId) {
                return res.status(400).json({ status: 'fail', message: 'ID tanda tangan wajib diberikan.' });
            }

            if (!uploadedFileBuffer) {
                return res.status(400).json({ status: 'fail', message: 'File PDF wajib diunggah untuk verifikasi.' });
            }

            let verificationDetails = null;
            let errorFromPersonal = null;

            try {
                verificationDetails = await signatureService.verifyUploadedFile(signatureId, uploadedFileBuffer);
            } catch (error) {
                errorFromPersonal = error;
            }

            if (!verificationDetails && packageService) {
                try {
                    const pkgResult = await packageService.verifyUploadedPackageFile(signatureId, uploadedFileBuffer);
                    if (pkgResult) {
                        verificationDetails = pkgResult;
                    }
                } catch (pkgError) {

                }
            }

            if (!verificationDetails) {
                if (errorFromPersonal) throw errorFromPersonal;
                throw SignatureError.NotFound(signatureId);
            }

            return res.status(200).json({
                status: 'success',
                message: 'Verifikasi file berhasil dilakukan.',
                data: verificationDetails,
            });
        }),
    };
};