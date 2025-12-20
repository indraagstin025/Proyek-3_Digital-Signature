import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { uploadPdfForVerification } from "../middleware/uploadMiddleware.js";

export default (signatureController) => {
    const router = express.Router();

    /**
     * @route   POST /api/signatures/personal
     * @desc    [PERSONAL] Menambahkan tanda tangan mandiri ke sebuah versi dokumen.
     * @access  Private
     */
    router.post(
        "/personal",
        authMiddleware,
        signatureController.addPersonalSignature
    );

    // =================================================================
    //  👇 PUBLIC VERIFICATION ROUTES 👇
    // =================================================================

    /**
     * @route   GET /api/signatures/verify/:signatureId
     * @desc    Verifikasi detail tanda tangan dari ID uniknya (QR Code).
     * @access  Public
     */
    router.get(
        "/verify/:signatureId",
        signatureController.getSignatureVerification
    );

    /**
     * @route   POST /api/signatures/verify-file
     * @desc    Verifikasi integritas file PDF (Upload Manual).
     * @access  Public
     */
    router.post(
        "/verify-file",
        uploadPdfForVerification.single("file"),
        signatureController.verifyUploadedSignature
    );

    return router;
};