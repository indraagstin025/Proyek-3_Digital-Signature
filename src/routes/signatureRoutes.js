import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { uploadPdfForVerification } from "../middleware/uploadMiddleware.js";

export default (signatureController) => {
    const router = express.Router();

    /**
     * @route   POST /api/signatures/personal
     * @desc    Menambahkan tanda tangan mandiri ke sebuah versi dokumen.
     * @access  Private
     */
    router.post("/personal", authMiddleware, signatureController.addPersonalSignature);

    /**
     * @route   GET /api/signatures/verify/:signatureId
     * @desc    Verifikasi detail tanda tangan dari ID uniknya (QR Code).
     * @access  Public
     */
    router.get("/verify/:signatureId", signatureController.getSignatureVerification);

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

    /**
     * @route   POST /api/signatures/group
     * @desc    Finalisasi tanda tangan grup (Burn to PDF).
     * @access  Private
     */
    router.post(
        "/group",
        authMiddleware,
        signatureController.addGroupSignature
    );

    // =================================================================
    //  👇 NEW ROUTES FOR REALTIME DRAFT & DRAG-AND-DROP PERSISTENCE 👇
    // =================================================================

    /**
     * @route   POST /api/signatures/draft/:documentId
     * @desc    Simpan Draft Tanda Tangan (Saat Drop Awal).
     * @access  Private
     */
    router.post(
        "/draft/:documentId",
        authMiddleware,
        signatureController.saveDraft
    );

    /**
     * @route   PATCH /api/signatures/:signatureId/position
     * @desc    Update posisi & ukuran tanda tangan (Saat Drag/Resize).
     * @access  Private
     */
    router.patch(
        "/:signatureId/position",
        authMiddleware,
        signatureController.updatePosition
    );

    /**
     * @route   DELETE /api/signatures/:signatureId
     * @desc    Hapus draft tanda tangan.
     * @access  Private
     */
    router.delete(
        "/:signatureId",
        authMiddleware,
        signatureController.deleteSignature
    );

    return router;
};