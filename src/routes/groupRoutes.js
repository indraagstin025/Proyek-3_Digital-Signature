import express from "express";
import { body, param } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { uploadDocument } from "../middleware/uploadMiddleware.js";

/**
 * @description Membuat routes Express untuk fitur Grup.
 * @param {object} groupController - Instance dari controller grup.
 * @returns {express.Router} Router Express yang siap digunakan.
 */
export default (groupController) => {
    const router = express.Router();

    // 🔒 Middleware Auth berlaku untuk semua route di bawah ini
    router.use(authMiddleware);

    // ==========================================
    // 1. GROUP MANAGEMENT (CRUD)
    // ==========================================

    router.route("/")
        .post(
            // Membuat Grup Baru
            body("name").trim().notEmpty().withMessage("Nama grup tidak boleh kosong."),
            validate,
            groupController.createGroup
        )
        .get(
            // Mengambil Daftar Grup User
            groupController.getAllUserGroups
        );

    router.route("/:groupId")
        .get(
            // Detail Grup
            param("groupId").isInt({ min: 1 }).withMessage("ID Grup harus berupa angka."),
            validate,
            groupController.getGroupById
        )
        .put(
            // Update Nama Grup
            [
                param("groupId").isInt({ min: 1 }).withMessage("ID Grup harus berupa angka."),
                body("name").trim().notEmpty().withMessage("Nama grup tidak boleh kosong."),
            ],
            validate,
            groupController.updateGroup
        )
        .delete(
            // Hapus Grup (Permanen)
            param("groupId").isInt({ min: 1 }).withMessage("ID Grup harus berupa angka."),
            validate,
            groupController.deleteGroup
        );

    // ==========================================
    // 2. MEMBER MANAGEMENT
    // ==========================================

    router.delete(
        "/:groupId/members/:userIdToRemove",
        [
            param("groupId").isInt({ min: 1 }).withMessage("ID Grup harus berupa angka."),
            param("userIdToRemove").isUUID().withMessage("ID User tidak valid (UUID)."),
        ],
        validate,
        groupController.removeMember
    );

    // ==========================================
    // 3. INVITATION SYSTEM
    // ==========================================

    // Terima Undangan (Join via Token)
    router.post(
        "/invitations/accept",
        body("token").notEmpty().withMessage("Token undangan wajib diisi."),
        validate,
        groupController.acceptInvitation
    );

    // Buat Undangan Baru (Generate Token)
    router.post(
        "/:groupId/invitations",
        [
            param("groupId").isInt({ min: 1 }).withMessage("ID Grup harus berupa angka."),
            body("role").isIn(["admin_group", "signer", "viewer"]).withMessage("Role tidak valid."),
        ],
        validate,
        groupController.createInvitation
    );

    // ==========================================
    // 4. DOCUMENT MANAGEMENT (GROUP CONTEXT)
    // ==========================================

    // A. Upload Dokumen Baru ke Grup
    router.post(
        "/:groupId/documents/upload",
        [
            param("groupId").isInt({ min: 1 }).withMessage("ID Grup harus berupa angka."),
            uploadDocument.single("file"), // Handle Multipart File
            body("title").notEmpty().withMessage("Judul dokumen wajib diisi."),
            // Validasi signerUserIds dilakukan di controller karena bentuknya FormData string
        ],
        validate,
        groupController.uploadGroupDocument
    );

    // B. Assign (Pindahkan) Dokumen Draft ke Grup
    router.put(
        "/:groupId/documents",
        [
            param("groupId").isInt({ min: 1 }).withMessage("ID Grup harus berupa angka."),
            body("documentId").isUUID().withMessage("ID Dokumen tidak valid."),
        ],
        validate,
        groupController.assignDocumentToGroup
    );

    // C. Unassign (Lepaskan) Dokumen dari Grup - Soft Remove dari list grup
    router.delete(
        "/:groupId/documents/:documentId",
        [
            param("groupId").isInt({ min: 1 }).withMessage("ID Grup harus berupa angka."),
            param("documentId").isUUID().withMessage("ID Dokumen tidak valid."),
        ],
        validate,
        groupController.unassignDocumentFromGroup
    );

    // D. Delete Permanen Dokumen Grup (Hard Delete) - 🔥 ROUTE BARU
    router.delete(
        "/:groupId/documents/:documentId/delete",
        [
            param("groupId").isInt({ min: 1 }).withMessage("ID Grup harus berupa angka."),
            param("documentId").isUUID().withMessage("ID Dokumen tidak valid."),
        ],
        validate,
        groupController.deleteGroupDocument
    );

    // E. Kelola Penanda Tangan (Signers)
    router.put(
        "/:groupId/documents/:documentId/signers",
        [
            param("groupId").isInt({ min: 1 }).withMessage("ID Grup harus berupa angka."),
            param("documentId").isUUID().withMessage("ID Dokumen tidak valid."),
            body("signerUserIds").isArray().withMessage("Data signer harus berupa array ID User."),
        ],
        validate,
        groupController.updateDocumentSigners
    );

    // F. Finalisasi Dokumen (Burn Signature)
    router.post(
        "/:groupId/documents/:documentId/finalize",
        [
            param("groupId").isInt({ min: 1 }).withMessage("ID Grup harus berupa angka."),
            param("documentId").isUUID().withMessage("ID Dokumen tidak valid."),
        ],
        validate,
        groupController.finalizeDocument
    );

    return router;
};