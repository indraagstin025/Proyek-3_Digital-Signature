import express from "express";
import { body, param } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
// Pastikan path ini sesuai dengan lokasi middleware multer Anda
import { uploadDocument } from "../middleware/uploadMiddleware.js";

/**
 * @description Membuat routes Express untuk fitur Grup.
 * @param {object} groupController - Instance dari controller grup.
 * @returns {express.Router} Router Express yang siap digunakan.
 */
export default (groupController) => {
    const router = express.Router();

    // Middleware Auth berlaku untuk semua route di bawah ini
    router.use(authMiddleware);

    // --- Group Management Routes ---

    router.route("/")
        .post(
            body("name").notEmpty().withMessage("Nama grup tidak boleh kosong."),
            validate,
            groupController.createGroup
        )
        .get(groupController.getAllUserGroups);

    router.route("/:groupId")
        .get(
            param("groupId").isInt({min: 1}).withMessage("Format ID Grup harus angka (integer)."),
            validate,
            groupController.getGroupById
        )
        .put(
            param("groupId").isInt({min: 1}).withMessage("Format ID Grup harus angka (integer)."),
            body("name").notEmpty().withMessage("Nama grup tidak boleh kosong."),
            validate,
            groupController.updateGroup
        )
        .delete(
            param("groupId").isInt({min: 1}).withMessage("Format ID Grup harus angka (integer)."),
            validate,
            groupController.deleteGroup
        );

    // --- Invitation Routes ---

    router.post(
        "/invitations/accept",
        body("token").notEmpty().withMessage("Token undangan wajib diisi."),
        validate,
        groupController.acceptInvitation
    );

    router.post(
        "/:groupId/invitations",
        param("groupId").isInt({min: 1}).withMessage("Format ID Grup harus angka (integer)."),
        body("role").isIn(["admin_group", "signer", "viewer"]).withMessage("Role tidak valid. Pilih 'admin_group', 'signer', atau 'viewer'."),
        validate,
        groupController.createInvitation
    );

    // --- Document Routes (Group Context) ---

    // 1. Upload Dokumen Baru ke Grup (Multipart)
    router.post(
        "/:groupId/documents/upload",
        // Validasi URL
        param("groupId").isInt({min: 1}).withMessage("Format ID Grup harus angka (integer)."),
        // Handle File
        uploadDocument.single("file"),
        // Validasi Body (signerUserIds string/json yang diparsing controller/multer)
        body("signerUserIds").notEmpty().withMessage("Daftar penanda tangan (signerUserIds) wajib dipilih."),
        validate,
        groupController.uploadGroupDocument
    );

    // 2. Assign Dokumen yang SUDAH ADA ke Grup
    router.put(
        "/:groupId/documents",
        param("groupId").isInt({min: 1}).withMessage("Format ID Grup harus angka (integer)."),
        body("documentId").isUUID().withMessage("Format documentId harus UUID."),
        validate,
        groupController.assignDocumentToGroup
    );

    // 3. Unassign (Hapus) Dokumen dari Grup
    router.delete(
        "/:groupId/documents/:documentId",
        param("groupId").isInt({min: 1}).withMessage("Format ID Grup harus angka (integer)."),
        param("documentId").isUUID().withMessage("Format documentId harus UUID."),
        validate,
        groupController.unassignDocumentFromGroup
    );

    // 4. [BARU] Edit Checklist Signer untuk Dokumen yang sudah ada
    router.put(
        "/:groupId/documents/:documentId/signers",
        [
            param("groupId").isInt({min: 1}).withMessage("Format ID Grup harus angka (integer)."),
            param("documentId").isUUID().withMessage("Format documentId harus UUID."),
            body("signerUserIds")
                .isArray()
                .withMessage("signerUserIds harus berupa array ID User."),
        ],
        validate,
        groupController.updateDocumentSigners
    );


    // groupRoutes.js
    // Endpoint Finalisasi (POST)
    router.post(
        "/:groupId/documents/:documentId/finalize",
        param("groupId").isInt(),
        param("documentId").isUUID(),
        validate,
        groupController.finalizeDocument
    );

    // --- Member Management Routes ---

    router.delete(
        "/:groupId/members/:userIdToRemove",
        param("groupId").isInt({ min: 1 }).withMessage("Format ID Grup harus angka (integer)."),
        param("userIdToRemove").isUUID().withMessage("Format userIdToRemove harus UUID."),
        validate,
        groupController.removeMember
    );

    return router;
};