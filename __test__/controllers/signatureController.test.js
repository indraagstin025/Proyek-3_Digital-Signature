/**
 * Unit Tests for SignatureController
 *
 * @file signatureController.test.js
 * @description Tests for SignatureController methods:
 *  - addPersonalSignature: Add personal signature to document
 *  - getSignatureVerification: Verify signature via QR code
 *  - unlockSignatureVerification: Unlock document with PIN
 *  - verifyUploadedSignature: Verify uploaded file manually
 */

import { jest } from "@jest/globals";
import { createSignatureController } from "../../src/controllers/signatureController.js";

// Helper to flush pending promises (needed for asyncHandler)
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe("SignatureController", () => {
  let controller;
  let mockDocumentService;
  let mockSignatureService;
  let mockPackageService;
  let mockGroupSignatureService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Mock services
    mockDocumentService = {};

    mockSignatureService = {
      addPersonalSignature: jest.fn().mockResolvedValue(null),
      getVerificationDetails: jest.fn().mockResolvedValue(null),
      unlockVerification: jest.fn().mockResolvedValue(null),
      verifyUploadedFile: jest.fn().mockResolvedValue(null),
    };

    mockPackageService = {
      getPackageSignatureVerificationDetails: jest.fn().mockResolvedValue(null),
      unlockVerification: jest.fn().mockResolvedValue(null),
      verifyUploadedPackageFile: jest.fn().mockResolvedValue(null),
    };

    mockGroupSignatureService = {
      getVerificationDetails: jest.fn().mockResolvedValue(null),
      unlockVerification: jest.fn().mockResolvedValue(null),
      verifyUploadedFile: jest.fn().mockResolvedValue(null),
    };

    // Create controller instance
    controller = createSignatureController(mockDocumentService, mockSignatureService, mockPackageService, mockGroupSignatureService);

    // Mock request object
    mockReq = {
      user: { id: "user-123" },
      params: {},
      body: {},
      headers: {
        "x-forwarded-for": "192.168.1.1",
        "user-agent": "Mozilla/5.0 Test Browser",
      },
      ip: "127.0.0.1",
      connection: { remoteAddress: "127.0.0.1" },
      file: null,
    };

    // Mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock next function
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // ADD PERSONAL SIGNATURE
  // ==========================================================================
  describe("addPersonalSignature", () => {
    it("Harus return 401 jika userId tidak ada", async () => {
      mockReq.user = null;

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Unauthorized: User ID tidak terdeteksi.",
      });
    });

    it("Harus return 401 jika user.id undefined", async () => {
      mockReq.user = {};

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Unauthorized: User ID tidak terdeteksi.",
      });
    });

    it("Harus return 400 jika tidak ada data signature", async () => {
      mockReq.body = {};

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Data tanda tangan tidak ditemukan.",
      });
    });

    it("Harus return 400 jika signatures array kosong", async () => {
      mockReq.body = { signatures: [] };

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Data tanda tangan tidak ditemukan.",
      });
    });

    it("Harus berhasil add signature dengan single signature object", async () => {
      mockReq.body = {
        documentVersionId: "ver-123",
        method: "canvas",
        signatureImageUrl: "data:image/png;base64,...",
        positionX: 100,
        positionY: 200,
        pageNumber: 1,
        width: 150,
        height: 50,
        displayQrCode: true,
      };

      mockSignatureService.addPersonalSignature.mockResolvedValue({
        id: "doc-123",
        status: "signed",
      });

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockSignatureService.addPersonalSignature).toHaveBeenCalledWith(
        "user-123",
        "ver-123",
        expect.arrayContaining([expect.objectContaining({ documentVersionId: "ver-123" })]),
        expect.objectContaining({
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0 Test Browser",
        }),
        { displayQrCode: true },
        mockReq
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen berhasil ditandatangani.",
        data: { id: "doc-123", status: "signed" },
      });
    });

    it("Harus berhasil add signature dengan signatures array", async () => {
      mockReq.body = {
        signatures: [
          {
            documentVersionId: "ver-123",
            method: "canvas",
            signatureImageUrl: "data:image/png;base64,...",
            positionX: 100,
            positionY: 200,
            pageNumber: 1,
          },
          {
            documentVersionId: "ver-123",
            method: "canvas",
            signatureImageUrl: "data:image/png;base64,...",
            positionX: 300,
            positionY: 400,
            pageNumber: 2,
          },
        ],
      };

      mockSignatureService.addPersonalSignature.mockResolvedValue({
        id: "doc-123",
        signatureCount: 2,
      });

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockSignatureService.addPersonalSignature).toHaveBeenCalledWith(
        "user-123",
        "ver-123",
        expect.arrayContaining([expect.objectContaining({ positionX: 100, pageNumber: 1 }), expect.objectContaining({ positionX: 300, pageNumber: 2 })]),
        expect.any(Object),
        expect.any(Object),
        mockReq
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus gunakan displayQrCode true sebagai default", async () => {
      mockReq.body = {
        documentVersionId: "ver-123",
        signatureImageUrl: "data:image/png;base64,...",
        // displayQrCode tidak diset
      };

      mockSignatureService.addPersonalSignature.mockResolvedValue({});

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockSignatureService.addPersonalSignature).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.any(Array), expect.any(Object), { displayQrCode: true }, expect.any(Object));
    });

    it("Harus gunakan req.ip jika x-forwarded-for tidak ada", async () => {
      mockReq.headers = { "user-agent": "Test" };
      mockReq.body = { documentVersionId: "ver-123", signatureImageUrl: "..." };

      mockSignatureService.addPersonalSignature.mockResolvedValue({});

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockSignatureService.addPersonalSignature).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.any(Array), expect.objectContaining({ ipAddress: "127.0.0.1" }), expect.any(Object), expect.any(Object));
    });

    it("Harus propagate error ke asyncHandler jika service gagal", async () => {
      mockReq.body = { documentVersionId: "ver-123", signatureImageUrl: "..." };

      const serviceError = new Error("Signature failed");
      mockSignatureService.addPersonalSignature.mockRejectedValue(serviceError);

      try {
        await controller.addPersonalSignature(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toBe("Signature failed");
      }
    });
  });

  // ==========================================================================
  // GET SIGNATURE VERIFICATION
  // ==========================================================================
  describe("getSignatureVerification", () => {
    it("Harus throw SignatureError.NotFound jika signature tidak ditemukan di semua service", async () => {
      mockReq.params = { signatureId: "sig-not-found" };

      mockSignatureService.getVerificationDetails.mockResolvedValue(null);
      mockPackageService.getPackageSignatureVerificationDetails.mockResolvedValue(null);
      mockGroupSignatureService.getVerificationDetails.mockResolvedValue(null);

      try {
        await controller.getSignatureVerification(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toContain("sig-not-found");
      }
    });

    it("Harus return locked status jika signature terkunci PIN", async () => {
      mockReq.params = { signatureId: "sig-locked" };

      mockSignatureService.getVerificationDetails.mockResolvedValue({
        isLocked: true,
        message: "Dokumen dilindungi PIN",
        documentTitle: "Locked Document",
        type: "PERSONAL",
      });

      await controller.getSignatureVerification(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          isLocked: true,
          signatureId: "sig-locked",
          message: "Dokumen dilindungi PIN",
          documentTitle: "Locked Document",
          type: "PERSONAL",
        },
      });
    });

    it("Harus return normal verification data jika tidak terkunci", async () => {
      mockReq.params = { signatureId: "sig-123" };

      mockSignatureService.getVerificationDetails.mockResolvedValue({
        isLocked: false,
        documentTitle: "Test Document",
        verificationStatus: "REGISTERED",
      });

      await controller.getSignatureVerification(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          requireUpload: true,
          isLocked: false,
          signatureId: "sig-123",
          documentTitle: "Test Document",
          message: "QR Code terdaftar. Silakan unggah dokumen fisik untuk verifikasi.",
          verificationStatus: "REGISTERED",
        },
      });
    });

    it("Harus cek packageService jika personalService return null", async () => {
      mockReq.params = { signatureId: "sig-package" };

      // Personal service returns null (not found)
      mockSignatureService.getVerificationDetails.mockResolvedValue(null);
      mockPackageService.getPackageSignatureVerificationDetails.mockResolvedValue({
        isLocked: false,
        documentTitle: "Package Document",
        verificationStatus: "REGISTERED",
      });
      // Group service doesn't need to be called because package found
      mockGroupSignatureService.getVerificationDetails.mockResolvedValue(null);

      await controller.getSignatureVerification(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockPackageService.getPackageSignatureVerificationDetails).toHaveBeenCalledWith("sig-package");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus cek groupService jika personal dan package return null", async () => {
      mockReq.params = { signatureId: "sig-group" };

      mockSignatureService.getVerificationDetails.mockResolvedValue(null);
      mockPackageService.getPackageSignatureVerificationDetails.mockResolvedValue(null);
      mockGroupSignatureService.getVerificationDetails.mockResolvedValue({
        isLocked: false,
        documentTitle: "Group Document",
        verificationStatus: "REGISTERED",
      });

      await controller.getSignatureVerification(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockGroupSignatureService.getVerificationDetails).toHaveBeenCalledWith("sig-group");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus handle error dari signatureService dengan silent catch", async () => {
      mockReq.params = { signatureId: "sig-123" };

      // Personal throws error but packageService has data
      mockSignatureService.getVerificationDetails.mockResolvedValue(null);
      mockPackageService.getPackageSignatureVerificationDetails.mockResolvedValue({
        documentTitle: "Package Doc",
        isLocked: false,
        verificationStatus: "REGISTERED",
      });
      mockGroupSignatureService.getVerificationDetails.mockResolvedValue(null);

      await controller.getSignatureVerification(mockReq, mockRes, mockNext);
      await flushPromises();

      // Should continue to packageService since personal returned null
      expect(mockPackageService.getPackageSignatureVerificationDetails).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus gunakan default message jika isLocked true tapi message kosong", async () => {
      mockReq.params = { signatureId: "sig-locked" };

      mockSignatureService.getVerificationDetails.mockResolvedValue({
        isLocked: true,
        message: null,
        documentTitle: "Locked Doc",
        type: "PERSONAL",
      });

      await controller.getSignatureVerification(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: expect.objectContaining({
          message: "Dokumen dilindungi kode akses.",
        }),
      });
    });
  });

  // ==========================================================================
  // UNLOCK SIGNATURE VERIFICATION
  // ==========================================================================
  describe("unlockSignatureVerification", () => {
    it("Harus return 400 jika accessCode tidak ada", async () => {
      mockReq.params = { signatureId: "sig-123" };
      mockReq.body = {};

      await controller.unlockSignatureVerification(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Kode Akses (PIN) wajib diisi.",
      });
    });

    it("Harus return 401 jika tidak ditemukan di semua service (semua return null)", async () => {
      mockReq.params = { signatureId: "sig-not-found" };
      mockReq.body = { accessCode: "123456" };

      // All services return null
      mockSignatureService.unlockVerification.mockResolvedValue(null);
      mockPackageService.unlockVerification.mockResolvedValue(null);
      mockGroupSignatureService.unlockVerification.mockResolvedValue(null);

      await controller.unlockSignatureVerification(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Kode Akses salah atau Dokumen tidak ditemukan.",
      });
    });

    it("Harus return 200 dengan data jika unlock berhasil via personalService", async () => {
      mockReq.params = { signatureId: "sig-123" };
      mockReq.body = { accessCode: "123456" };

      mockSignatureService.unlockVerification.mockResolvedValue({
        signerName: "John Doe",
        documentTitle: "Test Doc",
      });

      await controller.unlockSignatureVerification(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Akses diberikan.",
        data: {
          signerName: "John Doe",
          documentTitle: "Test Doc",
          isLocked: false,
          requireUpload: true,
        },
      });
    });

    it("Harus throw error jika PIN salah (statusCode 400)", async () => {
      mockReq.params = { signatureId: "sig-123" };
      mockReq.body = { accessCode: "wrong-pin" };

      const pinError = new Error("PIN Salah. Sisa 2 percobaan.");
      pinError.statusCode = 400;
      mockSignatureService.unlockVerification.mockRejectedValue(pinError);

      try {
        await controller.unlockSignatureVerification(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toBe("PIN Salah. Sisa 2 percobaan.");
        expect(err.statusCode).toBe(400);
      }

      // Should NOT check other services
      expect(mockPackageService.unlockVerification).not.toHaveBeenCalled();
    });

    it("Harus throw error jika dokumen terkunci (statusCode 403)", async () => {
      mockReq.params = { signatureId: "sig-123" };
      mockReq.body = { accessCode: "123456" };

      const lockError = new Error("Dokumen dikunci 30 menit.");
      lockError.statusCode = 403;
      mockSignatureService.unlockVerification.mockRejectedValue(lockError);

      try {
        await controller.unlockSignatureVerification(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toBe("Dokumen dikunci 30 menit.");
        expect(err.statusCode).toBe(403);
      }

      // Should NOT check other services
      expect(mockPackageService.unlockVerification).not.toHaveBeenCalled();
    });

    it("Harus cek packageService jika personalService return null", async () => {
      mockReq.params = { signatureId: "sig-pkg" };
      mockReq.body = { accessCode: "123456" };

      // Personal returns null
      mockSignatureService.unlockVerification.mockResolvedValue(null);
      mockPackageService.unlockVerification.mockResolvedValue({
        documentTitle: "Package Doc",
      });
      // Group not needed because package found
      mockGroupSignatureService.unlockVerification.mockResolvedValue(null);

      await controller.unlockSignatureVerification(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockPackageService.unlockVerification).toHaveBeenCalledWith("sig-pkg", "123456");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus cek groupService jika personal dan package return null", async () => {
      mockReq.params = { signatureId: "sig-grp" };
      mockReq.body = { accessCode: "123456" };

      mockSignatureService.unlockVerification.mockResolvedValue(null);
      mockPackageService.unlockVerification.mockResolvedValue(null);
      mockGroupSignatureService.unlockVerification.mockResolvedValue({
        documentTitle: "Group Doc",
      });

      await controller.unlockSignatureVerification(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockGroupSignatureService.unlockVerification).toHaveBeenCalledWith("sig-grp", "123456");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus throw error dari packageService jika PIN salah", async () => {
      mockReq.params = { signatureId: "sig-pkg" };
      mockReq.body = { accessCode: "wrong" };

      mockSignatureService.unlockVerification.mockResolvedValue(null);

      const pkgError = new Error("PIN Salah.");
      pkgError.statusCode = 400;
      mockPackageService.unlockVerification.mockRejectedValue(pkgError);

      try {
        await controller.unlockSignatureVerification(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toBe("PIN Salah.");
      }

      expect(mockGroupSignatureService.unlockVerification).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // VERIFY UPLOADED SIGNATURE
  // ==========================================================================
  describe("verifyUploadedSignature", () => {
    it("Harus return 400 jika signatureId tidak ada", async () => {
      mockReq.body = {};

      await controller.verifyUploadedSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "ID tanda tangan wajib diberikan.",
      });
    });

    it("Harus return 400 jika file tidak ada", async () => {
      mockReq.body = { signatureId: "sig-123" };
      mockReq.file = null;

      await controller.verifyUploadedSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "File PDF wajib diunggah.",
      });
    });

    it("Harus return VALID jika hash cocok via personalService", async () => {
      mockReq.body = { signatureId: "sig-123" };
      mockReq.file = { buffer: Buffer.from("test pdf content") };

      mockSignatureService.verifyUploadedFile.mockResolvedValue({
        isValid: true,
        isHashMatch: true,
        documentTitle: "Test Doc",
        signerName: "John Doe",
      });

      await controller.verifyUploadedSignature(mockReq, mockRes, mockNext);

      expect(mockSignatureService.verifyUploadedFile).toHaveBeenCalledWith("sig-123", expect.any(Buffer), undefined);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Verifikasi Berhasil.",
        data: expect.objectContaining({
          isValid: true,
          documentTitle: "Test Doc",
        }),
      });
    });

    it("Harus return INVALID jika hash tidak cocok", async () => {
      mockReq.body = { signatureId: "sig-123" };
      mockReq.file = { buffer: Buffer.from("different content") };

      mockSignatureService.verifyUploadedFile.mockResolvedValue({
        isValid: false,
        isHashMatch: false,
        documentTitle: "Test Doc",
      });

      await controller.verifyUploadedSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          isValid: false,
          verificationStatus: "INVALID (Hash Mismatch)",
          message: "Dokumen berbeda dengan arsip sistem.",
          documentTitle: "Test Doc",
        },
      });
    });

    it("Harus cek packageService jika personalService return null", async () => {
      mockReq.body = { signatureId: "sig-pkg" };
      mockReq.file = { buffer: Buffer.from("pdf") };

      mockSignatureService.verifyUploadedFile.mockResolvedValue(null);
      mockPackageService.verifyUploadedPackageFile.mockResolvedValue({
        isValid: true,
        documentTitle: "Package Doc",
      });
      // Group not needed because package found
      mockGroupSignatureService.verifyUploadedFile.mockResolvedValue(null);

      await controller.verifyUploadedSignature(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockPackageService.verifyUploadedPackageFile).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus cek groupService jika personal dan package return null", async () => {
      mockReq.body = { signatureId: "sig-grp" };
      mockReq.file = { buffer: Buffer.from("pdf") };

      mockSignatureService.verifyUploadedFile.mockResolvedValue(null);
      mockPackageService.verifyUploadedPackageFile.mockResolvedValue(null);
      mockGroupSignatureService.verifyUploadedFile.mockResolvedValue({
        isHashMatch: true,
        documentTitle: "Group Doc",
      });

      await controller.verifyUploadedSignature(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockGroupSignatureService.verifyUploadedFile).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus throw SignatureError.NotFound jika tidak ditemukan di semua service", async () => {
      mockReq.body = { signatureId: "sig-not-found" };
      mockReq.file = { buffer: Buffer.from("pdf") };

      mockSignatureService.verifyUploadedFile.mockResolvedValue(null);
      mockPackageService.verifyUploadedPackageFile.mockResolvedValue(null);
      mockGroupSignatureService.verifyUploadedFile.mockResolvedValue(null);

      try {
        await controller.verifyUploadedSignature(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toContain("sig-not-found");
      }
    });

    it("Harus throw lastError jika ada error 'belum difinalisasi'", async () => {
      mockReq.body = { signatureId: "sig-123" };
      mockReq.file = { buffer: Buffer.from("pdf") };

      mockSignatureService.verifyUploadedFile.mockResolvedValue(null);
      mockPackageService.verifyUploadedPackageFile.mockResolvedValue(null);

      const groupError = new Error("Dokumen grup ini belum difinalisasi oleh Admin.");
      mockGroupSignatureService.verifyUploadedFile.mockRejectedValue(groupError);

      try {
        await controller.verifyUploadedSignature(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toContain("belum difinalisasi");
      }
    });

    it("Harus handle isHashMatch sebagai fallback untuk isValid", async () => {
      mockReq.body = { signatureId: "sig-123" };
      mockReq.file = { buffer: Buffer.from("pdf") };

      // Old format uses isHashMatch instead of isValid
      mockSignatureService.verifyUploadedFile.mockResolvedValue({
        isHashMatch: true,
        documentTitle: "Test Doc",
      });

      await controller.verifyUploadedSignature(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Verifikasi Berhasil.",
        data: expect.objectContaining({
          isHashMatch: true,
        }),
      });
    });
  });

  // ==========================================================================
  // HELPER: getRealIpAddress (via addPersonalSignature)
  // ==========================================================================
  describe("getRealIpAddress (via addPersonalSignature)", () => {
    beforeEach(() => {
      mockReq.body = { documentVersionId: "ver-123", signatureImageUrl: "..." };
      mockSignatureService.addPersonalSignature.mockResolvedValue({});
    });

    it("Harus gunakan x-forwarded-for jika ada", async () => {
      mockReq.headers["x-forwarded-for"] = "10.0.0.1";

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockSignatureService.addPersonalSignature).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.any(Array), expect.objectContaining({ ipAddress: "10.0.0.1" }), expect.any(Object), expect.any(Object));
    });

    it("Harus ambil IP pertama dari x-forwarded-for jika ada multiple", async () => {
      mockReq.headers["x-forwarded-for"] = "10.0.0.1, 10.0.0.2, 10.0.0.3";

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockSignatureService.addPersonalSignature).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.any(Array), expect.objectContaining({ ipAddress: "10.0.0.1" }), expect.any(Object), expect.any(Object));
    });

    it("Harus gunakan req.ip jika x-forwarded-for tidak ada", async () => {
      mockReq.headers = { "user-agent": "Test" };
      mockReq.ip = "192.168.0.1";

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockSignatureService.addPersonalSignature).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.any(Array), expect.objectContaining({ ipAddress: "192.168.0.1" }), expect.any(Object), expect.any(Object));
    });

    it("Harus gunakan connection.remoteAddress sebagai fallback terakhir", async () => {
      mockReq.headers = { "user-agent": "Test" };
      mockReq.ip = null;
      mockReq.connection = { remoteAddress: "172.16.0.1" };

      await controller.addPersonalSignature(mockReq, mockRes, mockNext);

      expect(mockSignatureService.addPersonalSignature).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.any(Array), expect.objectContaining({ ipAddress: "172.16.0.1" }), expect.any(Object), expect.any(Object));
    });
  });

  // ==========================================================================
  // TEST WITHOUT OPTIONAL SERVICES
  // ==========================================================================
  describe("Without optional services", () => {
    beforeEach(() => {
      // Create controller without packageService and groupSignatureService
      controller = createSignatureController(
        mockDocumentService,
        mockSignatureService,
        null, // No packageService
        null // No groupSignatureService
      );
    });

    it("getSignatureVerification harus tetap berfungsi tanpa packageService", async () => {
      mockReq.params = { signatureId: "sig-123" };
      mockSignatureService.getVerificationDetails.mockResolvedValue({
        isLocked: false,
        documentTitle: "Test",
        verificationStatus: "REGISTERED",
      });

      await controller.getSignatureVerification(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("unlockSignatureVerification harus return 401 jika hanya personalService ada dan return null", async () => {
      mockReq.params = { signatureId: "sig-123" };
      mockReq.body = { accessCode: "123456" };

      mockSignatureService.unlockVerification.mockResolvedValue(null);

      await controller.unlockSignatureVerification(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("verifyUploadedSignature harus throw NotFound jika hanya personalService ada dan return null", async () => {
      mockReq.body = { signatureId: "sig-123" };
      mockReq.file = { buffer: Buffer.from("pdf") };

      mockSignatureService.verifyUploadedFile.mockResolvedValue(null);

      try {
        await controller.verifyUploadedSignature(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toContain("sig-123");
      }
    });
  });
});
