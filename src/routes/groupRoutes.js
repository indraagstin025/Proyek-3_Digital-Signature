import express from "express";
import { body, param } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";

/**
 * @description Membuat routes Express untuk fitur Grup.
 * @param {object} groupController - Instance dari controller grup.
 * @returns {express.Router} Router Express yang siap digunakan.
 */
export default (groupController) => {
  const router = express.Router();

  router.use(authMiddleware);

  router.route("/").post(body("name").notEmpty().withMessage("Nama grup tidak boleh kosong."), validate, groupController.createGroup).get(groupController.getAllUserGroups);

  router.post("/invitations/accept", body("token").notEmpty().withMessage("Token undangan wajib diisi."), validate, groupController.acceptInvitation);

  router
    .route("/:groupId")
    .get(param("groupId").isInt({ min: 1 }).withMessage("Format ID Grup harus angka (integer)."), validate, groupController.getGroupById)

    .put(param("groupId").isInt({ min: 1 }).withMessage("Format ID Grup harus angka (integer)."), body("name").notEmpty().withMessage("Nama grup tidak boleh kosong."), validate, groupController.updateGroup)

    .delete(param("groupId").isInt({ min: 1 }).withMessage("Format ID Grup harus angka (integer)."), validate, groupController.deleteGroup);

  router.post(
    "/:groupId/invitations",
    param("groupId").isInt({ min: 1 }).withMessage("Format ID Grup harus angka (integer)."),
    body("role").isIn(["admin_group", "signer", "viewer"]).withMessage("Role tidak valid. Pilih 'admin_group', 'signer', atau 'viewer'."),
    validate,
    groupController.createInvitation
  );

  router.put(
    "/:groupId/documents",
    param("groupId").isInt({ min: 1 }).withMessage("Format ID Grup harus angka (integer)."),
    body("documentId").isUUID().withMessage("Format documentId harus UUID."),
    validate,
    groupController.assignDocumentToGroup
  );

  router.delete(
    "/:groupId/members/:userIdToRemove",
    param("groupId").isInt({ min: 1 }).withMessage("Format ID Grup harus angka (integer)."),
    param("userIdToRemove").isUUID().withMessage("Format userIdToRemove harus UUID."),
    validate,
    groupController.removeMember
  );

  router.delete(
    "/:groupId/documents/:documentId",
    param("groupId").isInt({ min: 1 }).withMessage("Format ID Grup harus angka (integer)."),
    param("documentId").isUUID().withMessage("Format documentId harus UUID."),
    validate,
    groupController.unassignDocumentFromGroup
  );

  return router;
};
