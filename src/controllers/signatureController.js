import asyncHandler from "../utils/asyncHandler.js";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";

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

export const createSignatureController = (documentService, signatureService, packageService, groupSignatureService) => {
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
        return res.status(400).json({ status: "fail", message: "Data tanda tangan tidak ditemukan." });
      }

      const documentVersionId = signaturesToProcess[0].documentVersionId;
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
     * [UPDATED] Menangani status LOCKED (PIN).
     * @route   GET /api/signatures/verify/:signatureId
     */
    getSignatureVerification: asyncHandler(async (req, res, next) => {
      const { signatureId } = req.params;
      let verificationDetails = null;

      // 1. Cek Personal
      try {
        verificationDetails = await signatureService.getVerificationDetails(signatureId);
      } catch (e) {}

      // 2. Cek Package
      if (!verificationDetails && packageService) {
        try {
          const pkg = await packageService.getPackageSignatureVerificationDetails(signatureId);
          if (pkg) verificationDetails = pkg;
        } catch (e) {}
      }

      // 3. Cek Group
      if (!verificationDetails && groupSignatureService) {
        try {
          const grp = await groupSignatureService.getVerificationDetails(signatureId);
          if (grp) verificationDetails = grp;
        } catch (e) {}
      }

      if (!verificationDetails) {
        throw SignatureError.NotFound(signatureId);
      }

      // [FIX] Cek apakah terkunci PIN?
      if (verificationDetails.isLocked) {
        return res.status(200).json({
          status: "success",
          data: {
            isLocked: true,
            signatureId: signatureId,
            message: verificationDetails.message || "Dokumen dilindungi kode akses.",
            documentTitle: verificationDetails.documentTitle, // Hanya judul
            type: verificationDetails.type
          },
        });
      }

      // Jika Tidak Terkunci (Normal)
      return res.status(200).json({
        status: "success",
        data: {
          requireUpload: true,
          isLocked: false,
          signatureId: signatureId,
          documentTitle: verificationDetails.documentTitle,
          message: "QR Code terdaftar. Silakan unggah dokumen fisik untuk verifikasi.",
          verificationStatus: verificationDetails.verificationStatus
        },
      });
    }),

    /**
     * @description [PUBLIC] Membuka Kunci Dokumen dengan PIN.
     * @route   POST /api/signatures/verify/:signatureId/unlock
     */
    unlockSignatureVerification: asyncHandler(async (req, res, next) => {
      const { signatureId } = req.params;
      const { accessCode } = req.body;

      console.log(`\n🔍 [DEBUG] Request Unlock ID: ${signatureId} | PIN: ${accessCode}`);

      if (!accessCode) {
        return res.status(400).json({ status: "fail", message: "Kode Akses (PIN) wajib diisi." });
      }

      let verificationResult = null;

      // --- 1. CEK PERSONAL SERVICE ---
      try {
        console.log("🔍 [DEBUG] Cek Personal Service...");
        verificationResult = await signatureService.unlockVerification(signatureId, accessCode);
        if (verificationResult) console.log("✅ [DEBUG] Ketemu di Personal!");
      } catch (e) {
        console.log(`⚠️ [DEBUG] Error di Personal: ${e.statusCode} - ${e.message}`);

        // [FAIL FAST] Jika errornya adalah PIN SALAH (400) atau TERKUNCI (403),
        // artinya dokumen KETEMU tapi akses ditolak. JANGAN cari di tempat lain.
        if (e.statusCode === 403 || e.statusCode === 400) {
          console.log("🛑 [DEBUG] Stop pencarian. Melempar error keamanan ke Frontend.");
          throw e;
        }
      }

      // --- 2. CEK PACKAGE SERVICE (Hanya jika belum ketemu) ---
      if (!verificationResult && packageService) {
        try {
          console.log("🔍 [DEBUG] Cek Package Service...");
          verificationResult = await packageService.unlockVerification(signatureId, accessCode);
          if (verificationResult) console.log("✅ [DEBUG] Ketemu di Package!");
        } catch (e) {
          console.log(`⚠️ [DEBUG] Error di Package: ${e.statusCode} - ${e.message}`);
          if (e.statusCode === 403 || e.statusCode === 400) {
            console.log("🛑 [DEBUG] Stop pencarian. Melempar error keamanan.");
            throw e;
          }
        }
      }

      // --- 3. CEK GROUP SERVICE (Hanya jika belum ketemu) ---
      if (!verificationResult && groupSignatureService) {
        try {
          console.log("🔍 [DEBUG] Cek Group Service...");
          verificationResult = await groupSignatureService.unlockVerification(signatureId, accessCode);
          if (verificationResult) console.log("✅ [DEBUG] Ketemu di Group!");
        } catch (e) {
          console.log(`⚠️ [DEBUG] Error di Group: ${e.statusCode} - ${e.message}`);
          if (e.statusCode === 403 || e.statusCode === 400) {
            console.log("🛑 [DEBUG] Stop pencarian. Melempar error keamanan.");
            throw e;
          }
        }
      }

      // --- 4. HASIL AKHIR ---
      if (!verificationResult) {
        console.log("❌ [DEBUG] Dokumen tidak ditemukan di semua service (404/401).");
        return res.status(401).json({
          status: "fail",
          message: "Kode Akses salah atau Dokumen tidak ditemukan."
        });
      }

      // SUKSES
      return res.status(200).json({
        status: "success",
        message: "Akses diberikan.",
        data: {
          ...verificationResult,
          isLocked: false,
          requireUpload: true
        }
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

      // [DEBUG LOG]
      console.log("🔍 Checking Services:");
      console.log("- Personal Service:", !!signatureService);
      console.log("- Package Service:", !!packageService);
      console.log("- Group Service:", !!groupSignatureService);

      let verificationDetails = null;
      let lastError = null;

      // 1. Cek Personal
      try {
        verificationDetails = await signatureService.verifyUploadedFile(signatureId, uploadedFileBuffer);
      } catch (error) { lastError = error; }

      // 2. Cek Package
      if (!verificationDetails && packageService) {
        try {
          verificationDetails = await packageService.verifyUploadedPackageFile(signatureId, uploadedFileBuffer);
        } catch (pkgError) {}
      }

      // 3. Cek Group
      if (!verificationDetails && groupSignatureService) {
        try {
          console.log("➡️ Trying Group Service...");
          verificationDetails = await groupSignatureService.verifyUploadedFile(signatureId, uploadedFileBuffer);
        } catch (e) {
          console.log("❌ Group Service Error:", e.message);
          if(e.message && e.message.includes("belum difinalisasi")) lastError = e;
        }
      }

      if (!verificationDetails) {
        if (lastError) throw lastError;
        throw SignatureError.NotFound(signatureId);
      }

      const isValid = verificationDetails.isValid || verificationDetails.isHashMatch; // Support format lama/baru

      if (!isValid) {
        return res.status(200).json({
          status: "success",
          data: {
            isValid: false,
            verificationStatus: "INVALID (Hash Mismatch)",
            message: "Dokumen berbeda dengan arsip sistem.",
            documentTitle: verificationDetails.documentTitle,
          }
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Verifikasi Berhasil.",
        data: verificationDetails,
      });
    }),
  };
};