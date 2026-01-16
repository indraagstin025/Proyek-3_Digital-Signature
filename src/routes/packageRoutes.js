import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

/**
 * Membuat router untuk endpoint terkait Signing Package.
 * @param {object} packageController - Instance controller yang sudah di-inject service.
 * @returns {express.Router}
 */
export const createPackageRoutes = (packageController) => {
  const router = express.Router();

  /**
   * @route   POST /api/packages
   * @desc    Membuat paket (amplop) baru dari beberapa dokumen.
   * @access  Private
   */
  router.post("/", authMiddleware, packageController.createPackage);

  /**
   * @route   GET /api/packages/:packageId
   * @desc    Mengambil detail paket untuk wizard penandatanganan.
   * @access  Private
   */
  router.get("/:packageId", authMiddleware, packageController.getPackageDetails);


  /**
   * @route   GET /api/packages
   * @desc    Get all packages.
   * @access  Private
   */
  // IMPORTANT: This must come BEFORE the /:packageId route
  router.get("/", authMiddleware, packageController.getAllPackages);

  /**
   * @route   POST /api/packages/:packageId/sign
   * @desc    Menyelesaikan & menandatangani semua dokumen dalam paket.
   * @access  Private
   */
  router.post("/:packageId/sign", authMiddleware, packageController.signPackage);

  return router;
};
