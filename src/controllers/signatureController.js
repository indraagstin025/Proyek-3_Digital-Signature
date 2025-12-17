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
     * @route   POST /api/signatures/personal
     */
    addPersonalSignature: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          status: "fail",
          message: "Unauthorized: User ID tidak terdeteksi.",
        });
      }

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
          message: "Data tanda tangan tidak ditemukan atau format salah.",
        });
      }

      const documentVersionId = signaturesToProcess[0].documentVersionId;
      if (!documentVersionId) {
        return res.status(400).json({ status: "fail", message: "Document Version ID wajib ada." });
      }

      const displayQrCode = signaturesToProcess[0].displayQrCode ?? true;

      const auditData = {
        ipAddress: getRealIpAddress(req),
        userAgent: req.headers["user-agent"],
      };

      const updatedDocument = await signatureService.addPersonalSignature(userId, documentVersionId, signaturesToProcess, auditData, { displayQrCode }, req);

      return res.status(200).json({
        status: "success",
        message: "Dokumen berhasil ditandatangani.",
        data: updatedDocument,
      });
    }),

    /**
     * @description Memverifikasi tanda tangan berdasarkan Signature ID (Scan QR Code).
     * @route   GET /api/signatures/:signatureId/verify
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
     * @route   POST /api/signatures/verify-file
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

    /**
     * @description Menambahkan tanda tangan pada dokumen GRUP (Finalisasi).
     * @route   POST /api/signatures/group
     */
    addGroupSignature: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id, documentId, signatureImageUrl, positionX, positionY, pageNumber, width, height, method } = req.body;

      if (!documentId) return res.status(400).json({ status: "fail", message: "documentId wajib diisi." });
      if (!signatureImageUrl) return res.status(400).json({ status: "fail", message: "Data gambar tanda tangan wajib diisi." });

      const auditData = {
        ipAddress: getRealIpAddress(req),
        userAgent: req.headers["user-agent"],
      };

      const signatureData = {
        id,
        signatureImageUrl,
        positionX,
        positionY,
        pageNumber,
        width,
        height,
        method,
      };

      const result = await signatureService.addGroupSignature(userId, documentId, signatureData, auditData, req);

      return res.status(200).json({
        status: "success",
        message: result.message,
        data: {
          isComplete: result.isComplete,
          remainingSigners: result.remainingSigners,
          readyToFinalize: result.readyToFinalize,
        },
      });
    }),

    /**
     * @description Menyimpan Draft Tanda Tangan (Saat Drop Awal).
     * Tidak mengubah status user menjadi SIGNED, hanya menyimpan visual & koordinat ke DB.
     * @route   POST /api/signatures/draft/:documentId
     */
    saveDraft: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const { documentId } = req.params;

      const { id, signatureImageUrl, pageNumber, positionX, positionY, width, height, method } = req.body;

      if (!documentId) return res.status(400).json({ status: "fail", message: "Document ID wajib ada." });

      const signatureData = {
        id,
        signatureImageUrl,
        pageNumber,
        positionX,
        positionY,
        width,
        height,
        method,
        ipAddress: getRealIpAddress(req),
        userAgent: req.headers["user-agent"],
      };

      const result = await signatureService.saveDraftSignature(userId, documentId, signatureData);

      return res.status(201).json({
        status: "success",
        message: "Draft tanda tangan tersimpan.",
        data: result,
      });
    }),

    /**
     * @description Update posisi tanda tangan (Saat Drag/Resize).
     * @route   PATCH /api/signatures/:signatureId/position
     */
    updatePosition: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const { signatureId } = req.params;
      const { positionX, positionY, width, height, pageNumber, signatureImageUrl, method } = req.body;

      if (!signatureId) return res.status(400).json({ status: "fail", message: "Signature ID wajib ada." });

      const safeWidth = width && width > 0 ? width : undefined;
      const safeHeight = height && height > 0 ? height : undefined;

      const result = await signatureService.updateSignaturePosition(userId, signatureId, {
        positionX,
        positionY,
        width: safeWidth,
        height: safeHeight,
        pageNumber,
        signatureImageUrl,
        method,
      });

      return res.status(200).json({
        status: "success",
        message: "Posisi tanda tangan diperbarui.",
        data: result,
      });
    }),

    /**
     * @description Menghapus tanda tangan draft (Tombol X di Frontend).
     * @route   DELETE /api/signatures/:signatureId
     */
    deleteSignature: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const { signatureId } = req.params;

      if (!signatureId) {
        return res.status(400).json({ status: "fail", message: "Signature ID wajib ada." });
      }

      await signatureService.deleteSignature(userId, signatureId);

      return res.status(200).json({
        status: "success",
        message: "Draft tanda tangan dihapus (atau sudah tidak ada).",
      });
    }),
  };
};
