import asyncHandler from "../utils/asyncHandler.js";

/**
 * Membuat objek controller untuk fitur tanda tangan dokumen.
 * Controller ini berfungsi sebagai penghubung antara request dari client
 * dengan service tanda tangan (signatureService) dan dokumen (documentService).
 *
 * @param {import('../services/documentService.js').DocumentService} documentService - Instance dari DocumentService.
 * @param {import('../services/signatureService.js').SignatureService} signatureService - Instance dari SignatureService.
 * @returns {object} - Kumpulan fungsi handler untuk tanda tangan dokumen.
 */
export const createSignatureController = (documentService, signatureService) => {
    return {
        /**
         * Menambahkan tanda tangan pribadi pada sebuah versi dokumen.
         * ... (Docblock tetap sama) ...
         * @route POST /api/signatures/personal
         */
        addPersonalSignature: asyncHandler(async (req, res, next) => {
            const userId = req.user?.id;
            const { documentVersionId, method, signatureImageUrl, positionX, positionY, pageNumber, width, height, displayQrCode = true } = req.body;

            // Validasi input
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
            const getRealIpAddress = (req) => {
                const forwardedFor = req.headers['x-forwarded-for'];
                if (forwardedFor && typeof forwardedFor === 'string') {
                    return forwardedFor.split(',')[0].trim();
                }

                return req.ip || req.connection.remoteAddress;
            };

            const auditData = {
                ipAddress: getRealIpAddress(req),
                userAgent: req.headers["user-agent"],
            };

            const options = { displayQrCode };

            const updatedDocument = await signatureService.addPersonalSignature(userId, documentVersionId, signatureData, auditData, options);

            return res.status(200).json({
                status: "success",
                message: "Dokumen berhasil ditandatangani.",
                data: updatedDocument,
            });
        }),

        /**
         * Verifikasi tanda tangan berdasarkan ID uniknya.
         * ... (Docblock tetap sama) ...
         * @route GET /api/signatures/verify/:signatureId
         */
        getSignatureVerification: asyncHandler(async (req, res, next) => {
            const { signatureId } = req.params;

            const verificationDetails = await signatureService.getVerificationDetails(signatureId);

            return res.status(200).json({
                status: "success",
                data: verificationDetails,
            });
        }),

        /**
         * @route POST /api/signatures/verify-file
         * @desc Menerima dokumen yang diunggah untuk diverifikasi integritasnya
         * @access Public (Membutuhkan Multer/File Upload Middleware)
         */
        verifyUploadedSignature: asyncHandler(async (req, res, next) => {

            const { signatureId } = req.body;
            const uploadedFileBuffer = req.file?.buffer;

            if (!signatureId) {
                return res.status(400).json({
                    status: 'fail',
                    message: 'ID tanda tangan wajib diberikan.'
                });
            }

            if (!uploadedFileBuffer) {
                return res.status(400).json({
                    status: 'fail',
                    message: 'File PDF wajib diunggah untuk verifikasi'
                });
            }

            const verificationDetails = await signatureService.verifyUploadedFile(
                signatureId,
                uploadedFileBuffer
            );

            return res.status(200).json({
                status: 'success',
                message: 'Verifikasi file berhasil dilakukan.',
                data: verificationDetails,
            });
        }),
    };
};