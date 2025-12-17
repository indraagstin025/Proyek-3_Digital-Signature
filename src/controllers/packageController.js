import asyncHandler from "../utils/asyncHandler.js";
import CommonError from "../errors/CommonError.js";

/**
 * Membuat instance PackageController dengan dependency injection.
 * @param {import('../services/PackageService.js').PackageService} packageService - Instance logika bisnis untuk paket dokumen.
 * @returns {object} Kumpulan method controller untuk manajemen paket tanda tangan.
 */
export const createPackageController = (packageService) => {
  if (!packageService) {
    throw new Error("createPackageController: 'packageService' tidak disediakan.");
  }

  return {
    /**
     * @description Membuat paket baru (envelope) yang berisi beberapa dokumen untuk ditandatangani sekaligus.
     * * **Proses Kode:**
     * 1. Menerima `documentIds` (array ID dokumen) dan `title` paket dari body request.
     * 2. Memvalidasi bahwa `documentIds` adalah array dan tidak kosong.
     * 3. Memanggil `packageService.createPackage` untuk mengelompokkan dokumen-dokumen tersebut menjadi satu entitas paket.
     * 4. Mengembalikan data paket yang baru dibuat.
     * * @route   POST /api/packages
     * @param {import("express").Request} req - Body: documentIds (Array), title.
     * @param {import("express").Response} res - Response object.
     */
    createPackage: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const { documentIds, title } = req.body;

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        throw CommonError.BadRequest("Array 'documentIds' (berisi ID dokumen) wajib diisi.");
      }

      const newPackage = await packageService.createPackage(userId, title, documentIds);

      return res.status(201).json({
        status: "success",
        message: "Paket berhasil dibuat.",
        data: newPackage,
      });
    }),

    /**
     * @description Mengambil detail lengkap sebuah paket.
     * * **Proses Kode:**
     * 1. Mengambil `packageId` dari parameter URL.
     * 2. Memanggil `packageService.getPackageDetails` untuk mendapatkan metadata paket beserta list dokumen di dalamnya.
     * 3. Mengembalikan data detail paket.
     * * @route   GET /api/packages/:packageId
     * @param {import("express").Request} req - Params: packageId.
     * @param {import("express").Response} res - Response object.
     */
    getPackageDetails: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const { packageId } = req.params;

      const packageDetails = await packageService.getPackageDetails(packageId, userId);

      return res.status(200).json({
        status: "success",
        data: packageDetails,
      });
    }),

    /**
     * @description Memproses tanda tangan untuk semua dokumen di dalam paket sekaligus.
     * * **Proses Kode:**
     * 1. Menerima data `signatures` (array objek tanda tangan) dari body request.
     * 2. Mendeteksi **IP Address** pengguna secara akurat (mendukung proxy/load balancer via header `x-forwarded-for`).
     * 3. Memanggil `packageService.signPackage` untuk:
     * - Membubuhkan tanda tangan ke setiap dokumen PDF dalam paket.
     * - Menyimpan riwayat audit trail (termasuk IP Address).
     * 4. Mengembalikan status keberhasilan.
     * @route   POST /api/packages/:packageId/sign
     * @param {import("express").Request} req - Params: packageId, Body: signatures (Array).
     * @param {import("express").Response} res - Response object.
     */
    signPackage: asyncHandler(async (req, res, next) => {
        const userId = req.user?.id;
        const { packageId } = req.params;
        const { signatures } = req.body;

        if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
            throw CommonError.BadRequest("Array 'signatures' (berisi data TTD) wajib diisi.");
        }

        const getRealIpAddress = (req) => {
            const forwardedFor = req.headers["x-forwarded-for"];
            if (forwardedFor && typeof forwardedFor === "string") {
                return forwardedFor.split(",")[0].trim();
            }
            return req.ip || req.connection.remoteAddress;
        };

        const userIpAddress = getRealIpAddress(req);
        const result = await packageService.signPackage(
            packageId,
            userId,
            signatures,
            userIpAddress,
            req 
        );

        return res.status(200).json({
            status: "success",
            message: "Paket berhasil ditandatangani.",
            data: result,
        });
    }),
  };
};
