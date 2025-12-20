import asyncHandler from "../utils/asyncHandler.js";
import SignatureError from "../errors/SignatureError.js";

/**
 * Helper IP Address
 */
const getRealIpAddress = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor && typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.connection.remoteAddress;
};

export const createSignatureController = (documentService, signatureService, packageService) => {
  return {
    /**
     * @description [PERSONAL] Menambahkan tanda tangan mandiri.
     * @route   POST /api/signatures/personal
     */
    addPersonalSignature: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "fail", message: "Unauthorized: User ID tidak terdeteksi." });
      }

      let signaturesToProcess = [];

      // Handle Single or Batch
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
        return res.status(400).json({ status: "fail", message: "Data tanda tangan tidak ditemukan atau format salah." });
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
     * @description [PUBLIC] Verifikasi tanda tangan by ID (Scan QR).
     * @route   GET /api/signatures/verify/:signatureId
     */
    getSignatureVerification: asyncHandler(async (req, res, next) => {
      const { signatureId } = req.params;
      let verificationDetails = null;
      let errorFromPersonal = null;

      // 1. Cek di Signature Service (Personal/Group)
      try {
        verificationDetails = await signatureService.getVerificationDetails(signatureId);
      } catch (error) {
        errorFromPersonal = error;
      }

      // 2. Cek di Package Service (Fallback)
      if (!verificationDetails && packageService) {
        try {
          const pkgResult = await packageService.getPackageSignatureVerificationDetails(signatureId);
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
        data: verificationDetails,
      });
    }),

    /**
     * @description [PUBLIC] Verifikasi upload file manual.
     * @route   POST /api/signatures/verify-file
     */
    verifyUploadedSignature: asyncHandler(async (req, res, next) => {
      const { signatureId } = req.body;
      const uploadedFileBuffer = req.file?.buffer;

      if (!signatureId) return res.status(400).json({ status: "fail", message: "ID tanda tangan wajib diberikan." });
      if (!uploadedFileBuffer) return res.status(400).json({ status: "fail", message: "File PDF wajib diunggah." });

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