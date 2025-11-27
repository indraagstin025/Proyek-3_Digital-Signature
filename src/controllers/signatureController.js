import asyncHandler from "../utils/asyncHandler.js";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";

/**
 * Helper internal untuk mendapatkan IP Address pengguna.
 * Mendukung deteksi di balik proxy (seperti Vercel/Railway/Cloudflare) menggunakan header x-forwarded-for.
 * @param {import('express').Request} req - Express Request object.
 * @returns {string} IP Address pengguna (IPv4/IPv6).
 */
const getRealIpAddress = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor && typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.connection.remoteAddress;
};

/**
 * Membuat instance SignatureController dengan Dependency Injection.
 * Controller ini menangani logika penandatanganan dokumen dan verifikasi keasliannya.
 *
 * @param {import('../services/documentService.js').DocumentService} documentService - Service untuk manajemen dokumen.
 * @param {import('../services/signatureService.js').SignatureService} signatureService - Service untuk tanda tangan personal (Single/Batch).
 * @param {import('../services/packageService.js').PackageService} packageService - Service untuk tanda tangan paket (Digunakan sebagai fallback verifikasi).
 * @returns {object} Kumpulan method controller untuk rute signature.
 */
export const createSignatureController = (documentService, signatureService, packageService) => {
  return {
    /**
     * @description Menambahkan tanda tangan digital ke dokumen (Mendukung Batch/Multiple Signatures).
     * * **Proses Kode:**
     * 1. Mengambil `userId` dari token.
     * 2. Mengecek format body request:
     * - Jika array (`req.body.signatures`), anggap sebagai Batch Signing.
     * - Jika objek biasa, bungkus menjadi array (untuk dukungan backward compatibility).
     * 3. Validasi keberadaan data tanda tangan.
     * 4. Mengekstrak konfigurasi global (seperti `displayQrCode`) dari item pertama.
     * 5. Mengambil IP Address dan User-Agent untuk keperluan Audit Trail.
     * 6. Memanggil `signatureService.addPersonalSignature` dengan mengirimkan array signature.
     * 7. Mengembalikan dokumen yang telah diperbarui (signed).
     * * @route   POST /api/signatures/personal
     * @param {import("express").Request} req - Body: signatures (Array) atau field signature tunggal.
     * @param {import("express").Response} res - Response object.
     */
    addPersonalSignature: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;

      let signaturesToProcess = [];

      if (req.body.signatures && Array.isArray(req.body.signatures)) {
        signaturesToProcess = req.body.signatures;
      } else {
        const { documentVersionId, method, signatureImageUrl, positionX, positionY, pageNumber, width, height, displayQrCode } = req.body;
        if (documentVersionId) {
          signaturesToProcess.push({
            documentVersionId,
            method,
            signatureImageUrl,
            positionX,
            positionY,
            pageNumber,
            width,
            height,
            displayQrCode,
          });
        }
      }

      if (signaturesToProcess.length === 0) {
        return res.status(400).json({
          status: "fail",
          message: "Data tanda tangan tidak ditemukan.",
        });
      }

      const documentVersionId = signaturesToProcess[0].documentVersionId;
      const displayQrCode = signaturesToProcess[0].displayQrCode ?? true;

      const auditData = {
        ipAddress: getRealIpAddress(req),
        userAgent: req.headers["user-agent"],
      };

      const updatedDocument = await signatureService.addPersonalSignature(userId, documentVersionId, signaturesToProcess, auditData, { displayQrCode });

      return res.status(200).json({
        status: "success",
        message: "Dokumen berhasil ditandatangani.",
        data: updatedDocument,
      });
    }),

    /**
     * @description Memverifikasi tanda tangan berdasarkan Signature ID (Scan QR Code).
     * * **Proses Kode (Strategi Fallback):**
     * 1. **Cek Personal:** Mencoba mencari ID tanda tangan di service `signatureService` (Tanda tangan mandiri).
     * 2. **Cek Paket (Fallback):** Jika tidak ditemukan/gagal di Personal, mencoba mencari di `packageService` (Tanda tangan via amplop/paket).
     * 3. **Evaluasi:**
     * - Jika ditemukan di salah satu service, kembalikan detail verifikasi.
     * - Jika tidak ditemukan di keduanya, lempar error `NotFound`.
     * * @route   GET /api/signatures/:signatureId/verify
     * @param {import("express").Request} req - Params: signatureId.
     * @param {import("express").Response} res - Response object.
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
        } catch (pkgError) {}
      }

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
     * @description Memverifikasi integritas file PDF yang diunggah secara manual (Compare Hash).
     * * **Proses Kode:**
     * 1. Menerima `signatureId` dan file buffer dari `req.file`.
     * 2. Menggunakan strategi Fallback yang sama dengan scan QR:
     * - Cek hash file di `signatureService` (Personal).
     * - Jika tidak cocok/gagal, cek hash file di `packageService`.
     * 3. Mengembalikan status valid jika hash file yang diunggah cocok dengan hash database.
     * * @route   POST /api/signatures/verify-file
     * @param {import("express").Request} req - Body: signatureId, File: req.file.
     * @param {import("express").Response} res - Response object.
     */
    verifyUploadedSignature: asyncHandler(async (req, res, next) => {
      const { signatureId } = req.body;
      const uploadedFileBuffer = req.file?.buffer;

      if (!signatureId) {
        return res.status(400).json({ status: "fail", message: "ID tanda tangan wajib diberikan." });
      }

      if (!uploadedFileBuffer) {
        return res.status(400).json({ status: "fail", message: "File PDF wajib diunggah untuk verifikasi." });
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
        } catch (pkgError) {}
      }

      if (!verificationDetails) {
        if (errorFromPersonal) throw errorFromPersonal;
        throw SignatureError.NotFound(signatureId);
      }

      return res.status(200).json({
        status: "success",
        message: "Verifikasi file berhasil dilakukan. Dokumen Valid.",
        data: verificationDetails,
      });
    }),
  };
};
