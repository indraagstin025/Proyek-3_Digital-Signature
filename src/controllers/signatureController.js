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
     * @description [PERSONAL] Menambahkan tanda tangan digital ke dokumen secara mandiri.
     * * **Proses Kode:**
     * 1. Menerima body dengan data signature (single atau batch array).
     * 2. Mendukung dua format input:
     * - Single signature: documentVersionId, method, signatureImageUrl, positionX, positionY, pageNumber, displayQrCode
     * - Batch signatures: array signatures dengan format sama.
     * 3. Mendeteksi IP Address pengguna untuk audit trail.
     * 4. Memanggil `signatureService.addPersonalSignature` untuk bubuhkan tanda tangan ke PDF.
     * 5. Mengembalikan dokumen yang sudah ditandatangani dengan signature metadata.
     * * @route   POST /api/signatures/personal
     * @param {import("express").Request} req - Body: signatures (array atau single), documentVersionId, signatureImageUrl, dll.
     * @param {import("express").Response} res - Response object.
     * @throws {CommonError.Unauthorized} Jika user tidak authenticated.
     * @throws {CommonError.BadRequest} Jika data signature tidak lengkap.
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
     * @description [PUBLIC] Verifikasi tanda tangan dengan QR Code scanning.
     * * **Proses Kode:**
     * 1. Menerima `signatureId` dari parameter URL (hasil scanning QR).
     * 2. Melakukan pencarian di 3 service secara berurutan:
     * - signatureService (personal signatures)
     * - packageService (package signatures)
     * - groupSignatureService (group signatures)
     * 3. Jika ditemukan dan dokumen TERKUNCI (isLocked: true), return status kunci dengan message.
     * 4. Jika tidak terkunci, return requireUpload: true untuk meminta user upload file fisik.
     * 5. Return documentTitle, verificationStatus, dan metadata untuk frontend.
     * * @route   GET /api/signatures/verify/:signatureId
     * @param {import("express").Request} req - Params: signatureId (dari QR Code).
     * @param {import("express").Response} res - Response object.
     * @throws {SignatureError.NotFound} Jika signature tidak ditemukan di semua service.
     * @note PUBLIC endpoint - tidak perlu authentication.
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
            type: verificationDetails.type,
            lockedUntil: verificationDetails.lockedUntil,
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
          verificationStatus: verificationDetails.verificationStatus,
        },
      });
    }),

    /**
     * @description [PUBLIC] Membuka kunci dokumen dengan PIN/Access Code.
     * * **Proses Kode:**
     * 1. Menerima `signatureId` dan `accessCode` (PIN) dari request.
     * 2. Validasi bahwa accessCode tidak kosong.
     * 3. Melakukan pencarian dan verifikasi di 3 service secara berurutan:
     * - signatureService (personal), packageService, groupSignatureService.
     * 4. Fail-fast logic: Jika error 400 (PIN salah) atau 403 (forbidden), langsung throw error.
     * 5. Jika verifikasi sukses, return data dengan isLocked: false, requireUpload: true.
     * 6. Jika tidak ditemukan di semua service, return 401 dengan message "Kode Akses salah".
     * * @route   POST /api/signatures/verify/:signatureId/unlock
     * @param {import("express").Request} req - Params: signatureId, Body: accessCode (string PIN).
     * @param {import("express").Response} res - Response object.
     * @throws {SignatureError} Jika PIN salah atau akses ditolak.
     * @note PUBLIC endpoint - tidak perlu authentication.
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
          message: "Kode Akses salah atau Dokumen tidak ditemukan.",
        });
      }

      // SUKSES
      return res.status(200).json({
        status: "success",
        message: "Akses diberikan.",
        data: {
          ...verificationResult,
          isLocked: false,
          requireUpload: true,
        },
      });
    }),

    /**
     * @description [PUBLIC] Verifikasi file PDF manual dengan hash comparison.
     * * **Proses Kode:**
     * 1. Menerima `signatureId`, `accessCode` (optional), dan file PDF dari FormData.
     * 2. Validasi bahwa signatureId dan uploadedFileBuffer (file) tidak kosong.
     * 3. Melakukan pencarian dan verifikasi di 3 service secara berurutan:
     * - signatureService.verifyUploadedFile(signatureId, buffer, accessCode)
     * - packageService.verifyUploadedPackageFile(...)
     * - groupSignatureService.verifyUploadedFile(...)
     * 4. Jika service return isLocked: true (PIN salah/belum input), return data dengan isLocked flag.
     * 5. Jika tidak terkunci, bandingkan hash dokumen uploaded dengan arsip:
     * - isValid/isHashMatch: true -> return success
     * - isValid/isHashMatch: false -> return INVALID (Hash Mismatch)
     * 6. Jika tidak ditemukan di semua service, throw NotFound error.
     * * @route   POST /api/signatures/verify-file
     * @param {import("express").Request} req - FormData: signatureId, accessCode, file (Buffer).
     * @param {import("express").Response} res - Response object.
     * @throws {SignatureError.NotFound} Jika signature tidak ditemukan.
     * @throws {LastError} Jika ada error specific dari service (misal: group belum finalized).
     * @note PUBLIC endpoint - tidak perlu authentication. Support multipart/form-data.
     */
    verifyUploadedSignature: asyncHandler(async (req, res, next) => {
      // 1. Ambil accessCode juga dari body (dikirim frontend via FormData)
      const { signatureId, accessCode } = req.body;
      const uploadedFileBuffer = req.file?.buffer;

      if (!signatureId) return res.status(400).json({ status: "fail", message: "ID tanda tangan wajib diberikan." });
      if (!uploadedFileBuffer) return res.status(400).json({ status: "fail", message: "File PDF wajib diunggah." });

      let verificationDetails = null;
      let lastError = null;

      // 2. Teruskan 'accessCode' ke parameter ketiga di setiap service

      // A. Cek Personal
      try {
        verificationDetails = await signatureService.verifyUploadedFile(signatureId, uploadedFileBuffer, accessCode);
      } catch (error) {
        lastError = error;
      }

      // B. Cek Package
      if (!verificationDetails && packageService) {
        try {
          verificationDetails = await packageService.verifyUploadedPackageFile(signatureId, uploadedFileBuffer, accessCode);
        } catch (pkgError) {}
      }

      // C. Cek Group
      if (!verificationDetails && groupSignatureService) {
        try {
          verificationDetails = await groupSignatureService.verifyUploadedFile(signatureId, uploadedFileBuffer, accessCode);
        } catch (e) {
          if (e.message && e.message.includes("belum difinalisasi")) lastError = e;
        }
      }

      if (!verificationDetails) {
        if (lastError) throw lastError;
        throw SignatureError.NotFound(signatureId);
      }

      // [LOGIC PENTING] 3. Cek Status Locked dari Service
      if (verificationDetails.isLocked) {
        // Jika service bilang terkunci (karena PIN salah atau belum diinput),
        // Beritahu frontend agar memunculkan form PIN.
        return res.status(200).json({
          status: "success",
          data: verificationDetails, // Frontend baca: isLocked: true
        });
      }

      // 4. Jika Tidak Terkunci (PIN Benar), Validasi Hash
      const isValid = verificationDetails.isValid || verificationDetails.isHashMatch;

      if (!isValid) {
        return res.status(200).json({
          status: "success",
          data: {
            isValid: false,
            verificationStatus: "INVALID (Hash Mismatch)",
            message: "Dokumen berbeda dengan arsip sistem.",
            documentTitle: verificationDetails.documentTitle,
          },
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
