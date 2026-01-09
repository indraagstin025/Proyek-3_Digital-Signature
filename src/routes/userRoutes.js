import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { checkAdminRole } from "../middleware/roleMiddleware.js";
import { userValidation } from "../validators/userValidator.js";
import { validate } from "../middleware/validate.js";
import { uploadImage } from "../middleware/uploadMiddleware.js";

export default (userController, adminController) => {
  const router = express.Router();

  /**
   * @route   GET /api/users/me
   * @desc    Ambil profil user yang sedang login
   */
  router.get("/me", authMiddleware, userController.getMyProfile);

  /**
   * @route   PUT /api/users/me
   * @desc    Perbarui profil user yang sedang login (data, upload baru, atau pakai foto lama)
   */
  router.put("/me", authMiddleware, uploadImage.single("profilePicture"), userValidation.updateProfile, validate, userController.updateMyProfile);

  /**
   * @route   GET /api/users/me/quota
   * @desc    Ambil informasi quota/limit user (untuk Soft Lock UI di Frontend)
   */
  router.get("/me/quota", authMiddleware, userController.getMyQuota);

  /**
   * @route   GET /api/users/me/pictures
   * @desc    Ambil semua history foto profil user (dengan Signed URL segar)
   */
  router.get("/me/pictures", authMiddleware, userController.getProfilePictures);

  /**
   * @route   DELETE /api/users/me/pictures/:pictureId
   * @desc    Hapus salah satu foto profil dari history
   */
  router.delete("/me/pictures/:pictureId", authMiddleware, userValidation.pictureIdParam, validate, userController.deleteProfilePicture);

  /**
   * @route   GET /api/users/all-users
   * @desc    Ambil semua user (hanya admin)
   */
  router.get("/all-users", authMiddleware, checkAdminRole, adminController.getAllUsers);

  /**
   * @route   PATCH /api/users/me/tour-progress
   * @desc    Simpan status panduan pengguna (selesai)
   */
  router.patch(
      "/me/tour-progress",
      authMiddleware,
      userController.updateTourProgress
  );

  return router;
};
