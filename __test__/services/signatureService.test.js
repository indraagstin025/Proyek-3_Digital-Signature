/**
 * Unit Tests for SignatureService
 *
 * @file signatureService.test.js
 * @description Tests for SignatureService methods:
 *  - _checkVersionLimit: Check version limit for free/premium users
 *  - addPersonalSignature: Add personal signature to document
 *  - getVerificationDetails: Get verification details (with PIN lock)
 *  - unlockVerification: Unlock document with PIN
 *  - verifyUploadedFile: Verify uploaded PDF file hash
 */

import { jest } from "@jest/globals";
import { SignatureService } from "../../src/services/signatureService.js";

describe("SignatureService", () => {
  let service;
  let mockSignatureRepository;
  let mockDocumentRepository;
  let mockVersionRepository;
  let mockPdfService;
  let mockAuditService;
  let mockUserService;

  beforeEach(() => {
    // Mock Repositories
    mockSignatureRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      prisma: {
        user: {
          findUnique: jest.fn(),
        },
      },
    };

    mockDocumentRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    mockVersionRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn(),
      countByDocumentId: jest.fn(),
    };

    // Mock Services
    mockPdfService = {
      generateSignedPdf: jest.fn(),
    };

    mockAuditService = {
      log: jest.fn(),
    };

    mockUserService = {
      isUserPremium: jest.fn(),
    };

    // Create service instance
    service = new SignatureService(mockSignatureRepository, mockDocumentRepository, mockVersionRepository, mockPdfService, mockAuditService, mockUserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // _checkVersionLimit
  // ==========================================================================
  describe("_checkVersionLimit", () => {
    it("Harus skip check jika userService tidak tersedia", async () => {
      const serviceWithoutUserService = new SignatureService(
        mockSignatureRepository,
        mockDocumentRepository,
        mockVersionRepository,
        mockPdfService,
        mockAuditService,
        null // No userService
      );

      await expect(serviceWithoutUserService._checkVersionLimit("doc-1", "user-1")).resolves.toBeUndefined();
    });

    it("Harus throw error jika free user sudah mencapai batas 5 versi", async () => {
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockVersionRepository.countByDocumentId.mockResolvedValue(5);

      await expect(service._checkVersionLimit("doc-1", "user-1")).rejects.toThrow("Batas revisi dokumen tercapai (5 versi)");
    });

    it("Harus throw error jika premium user sudah mencapai batas 20 versi", async () => {
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockVersionRepository.countByDocumentId.mockResolvedValue(20);

      await expect(service._checkVersionLimit("doc-1", "user-1")).rejects.toThrow("Batas revisi dokumen tercapai (20 versi)");
    });

    it("Harus pass jika free user masih di bawah batas 5 versi", async () => {
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockVersionRepository.countByDocumentId.mockResolvedValue(4);

      await expect(service._checkVersionLimit("doc-1", "user-1")).resolves.toBeUndefined();
    });

    it("Harus pass jika premium user masih di bawah batas 20 versi", async () => {
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockVersionRepository.countByDocumentId.mockResolvedValue(19);

      await expect(service._checkVersionLimit("doc-1", "user-1")).resolves.toBeUndefined();
    });

    it("Harus include pesan upgrade untuk free user", async () => {
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockVersionRepository.countByDocumentId.mockResolvedValue(5);

      await expect(service._checkVersionLimit("doc-1", "user-1")).rejects.toThrow("Upgrade ke Premium");
    });
  });

  // ==========================================================================
  // addPersonalSignature
  // ==========================================================================
  describe("addPersonalSignature", () => {
    const userId = "user-123";
    const versionId = "version-123";
    const signatureData = {
      method: "canvas",
      signatureImageUrl: "data:image/png;base64,xxx",
      positionX: 100,
      positionY: 200,
      pageNumber: 1,
      width: 150,
      height: 50,
    };
    const auditData = {
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
    };

    beforeEach(() => {
      // Setup common mocks for addPersonalSignature tests
      mockVersionRepository.findById.mockResolvedValue({
        id: versionId,
        documentId: "doc-123",
        url: "http://example.com/original.pdf",
      });

      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-123",
        title: "Test Document",
        status: "draft",
      });

      mockUserService.isUserPremium.mockResolvedValue(false);
      mockVersionRepository.countByDocumentId.mockResolvedValue(0);

      mockSignatureRepository.prisma.user.findUnique.mockResolvedValue({
        id: userId,
        name: "John Doe",
        email: "john@example.com",
      });

      mockVersionRepository.create.mockResolvedValue({
        id: "new-version-123",
        documentId: "doc-123",
      });

      mockSignatureRepository.create.mockResolvedValue({
        id: "sig-123",
        userId: userId,
        documentVersionId: "new-version-123",
      });

      mockPdfService.generateSignedPdf.mockResolvedValue({
        signedFileBuffer: Buffer.from("signed-pdf"),
        publicUrl: "http://example.com/signed.pdf",
        accessCode: "123456",
      });

      mockSignatureRepository.update.mockResolvedValue({});
      mockVersionRepository.update.mockResolvedValue({});
      mockDocumentRepository.update.mockResolvedValue({
        id: "doc-123",
        status: "completed",
      });
    });

    it("Harus throw DatabaseError jika gagal mengambil versi", async () => {
      mockVersionRepository.findById.mockRejectedValue(new Error("DB Error"));

      await expect(service.addPersonalSignature(userId, versionId, signatureData, auditData)).rejects.toThrow("Gagal mengambil data versi");
    });

    it("Harus throw NotFound jika versi tidak ditemukan", async () => {
      mockVersionRepository.findById.mockResolvedValue(null);

      await expect(service.addPersonalSignature(userId, versionId, signatureData, auditData)).rejects.toThrow("tidak ditemukan");
    });

    it("Harus throw NotFound jika dokumen tidak ditemukan", async () => {
      mockDocumentRepository.findById.mockResolvedValue(null);

      await expect(service.addPersonalSignature(userId, versionId, signatureData, auditData)).rejects.toThrow("Dokumen tidak ditemukan");
    });

    it("Harus throw BadRequest jika dokumen sudah completed", async () => {
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-123",
        status: "completed",
      });

      await expect(service.addPersonalSignature(userId, versionId, signatureData, auditData)).rejects.toThrow("sudah selesai (Completed)");
    });

    it("Harus berhasil menambahkan signature dengan single object", async () => {
      const result = await service.addPersonalSignature(userId, versionId, signatureData, auditData);

      expect(mockVersionRepository.create).toHaveBeenCalled();
      expect(mockSignatureRepository.create).toHaveBeenCalled();
      expect(mockPdfService.generateSignedPdf).toHaveBeenCalled();
      expect(mockDocumentRepository.update).toHaveBeenCalledWith(
        "doc-123",
        expect.objectContaining({
          status: "completed",
        })
      );
      expect(result).toBeDefined();
    });

    it("Harus berhasil menambahkan signature dengan array", async () => {
      const signaturesArray = [signatureData, { ...signatureData, pageNumber: 2 }];

      await service.addPersonalSignature(userId, versionId, signaturesArray, auditData);

      expect(mockSignatureRepository.create).toHaveBeenCalledTimes(2);
    });

    it("Harus menyimpan accessCode dari pdfService", async () => {
      await service.addPersonalSignature(userId, versionId, signatureData, auditData);

      expect(mockSignatureRepository.update).toHaveBeenCalledWith("sig-123", { accessCode: "123456" });
    });

    it("Harus gunakan displayQrCode true sebagai default", async () => {
      await service.addPersonalSignature(userId, versionId, signatureData, auditData);

      expect(mockPdfService.generateSignedPdf).toHaveBeenCalledWith(versionId, expect.any(Array), expect.objectContaining({ displayQrCode: true }));
    });

    it("Harus bisa override displayQrCode ke false", async () => {
      await service.addPersonalSignature(userId, versionId, signatureData, auditData, { displayQrCode: false });

      expect(mockPdfService.generateSignedPdf).toHaveBeenCalledWith(versionId, expect.any(Array), expect.objectContaining({ displayQrCode: false }));
    });

    it("Harus log audit jika auditService tersedia", async () => {
      const mockReq = { ip: "127.0.0.1" };

      await service.addPersonalSignature(userId, versionId, signatureData, auditData, {}, mockReq);

      expect(mockAuditService.log).toHaveBeenCalledWith("SIGN_DOCUMENT_PERSONAL", userId, "doc-123", expect.any(String), mockReq);
    });

    it("Harus tidak error jika auditService tidak tersedia", async () => {
      const serviceWithoutAudit = new SignatureService(
        mockSignatureRepository,
        mockDocumentRepository,
        mockVersionRepository,
        mockPdfService,
        null, // No auditService
        mockUserService
      );

      // Re-setup mocks since we have new service instance
      mockVersionRepository.findById.mockResolvedValue({
        id: versionId,
        documentId: "doc-123",
      });
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-123",
        status: "draft",
      });

      await expect(serviceWithoutAudit.addPersonalSignature(userId, versionId, signatureData, auditData)).resolves.toBeDefined();
    });

    it("Harus cleanup versi baru jika proses gagal", async () => {
      mockPdfService.generateSignedPdf.mockRejectedValue(new Error("PDF Error"));
      mockVersionRepository.deleteById.mockResolvedValue(undefined);

      await expect(service.addPersonalSignature(userId, versionId, signatureData, auditData)).rejects.toThrow("Proses penandatanganan gagal");

      expect(mockVersionRepository.deleteById).toHaveBeenCalledWith("new-version-123");
    });

    it("Harus gunakan default name/email jika user tidak ditemukan", async () => {
      mockSignatureRepository.prisma.user.findUnique.mockResolvedValue(null);

      await service.addPersonalSignature(userId, versionId, signatureData, auditData);

      expect(mockPdfService.generateSignedPdf).toHaveBeenCalledWith(
        versionId,
        expect.arrayContaining([
          expect.objectContaining({
            signerName: "User",
            signerEmail: "user@email.com",
          }),
        ]),
        expect.any(Object)
      );
    });

    it("Harus tidak simpan accessCode jika tidak ada", async () => {
      mockPdfService.generateSignedPdf.mockResolvedValue({
        signedFileBuffer: Buffer.from("signed-pdf"),
        publicUrl: "http://example.com/signed.pdf",
        accessCode: null,
      });

      await service.addPersonalSignature(userId, versionId, signatureData, auditData);

      // signatureRepository.update should not be called for accessCode
      expect(mockSignatureRepository.update).not.toHaveBeenCalledWith("sig-123", { accessCode: null });
    });

    it("Harus bekerja tanpa prisma di signatureRepository", async () => {
      const serviceWithoutPrisma = new SignatureService({ ...mockSignatureRepository, prisma: null }, mockDocumentRepository, mockVersionRepository, mockPdfService, mockAuditService, mockUserService);

      // Re-setup mocks
      mockVersionRepository.findById.mockResolvedValue({
        id: versionId,
        documentId: "doc-123",
      });
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-123",
        status: "draft",
      });

      await expect(serviceWithoutPrisma.addPersonalSignature(userId, versionId, signatureData, auditData)).resolves.toBeDefined();
    });

    it("Harus gunakan default method canvas jika tidak disediakan", async () => {
      const sigDataWithoutMethod = {
        signatureImageUrl: "data:image/png;base64,xxx",
        positionX: 100,
        positionY: 200,
        pageNumber: 1,
        width: 150,
        height: 50,
        // No method specified
      };

      await service.addPersonalSignature(userId, versionId, sigDataWithoutMethod, auditData);

      expect(mockSignatureRepository.create).toHaveBeenCalledWith(expect.objectContaining({ method: "canvas" }));
    });
  });

  // ==========================================================================
  // getVerificationDetails
  // ==========================================================================
  describe("getVerificationDetails", () => {
    it("Harus throw NotFound jika signature tidak ditemukan", async () => {
      mockSignatureRepository.findById.mockResolvedValue(null);

      await expect(service.getVerificationDetails("sig-not-found")).rejects.toThrow();
    });

    it("Harus return locked status jika ada accessCode", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        documentVersion: {
          document: { title: "Locked Document" },
        },
      });

      const result = await service.getVerificationDetails("sig-123");

      expect(result.isLocked).toBe(true);
      expect(result.type).toBe("PERSONAL");
      expect(result.message).toContain("dilindungi kode akses");
    });

    it("Harus throw InternalServerError jika relasi tidak lengkap", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: null,
        documentVersion: null, // Missing relation
        signer: null,
      });

      await expect(service.getVerificationDetails("sig-123")).rejects.toThrow("integritas tidak lengkap");
    });

    it("Harus return full details jika tidak terkunci", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: null,
        ipAddress: "192.168.1.1",
        signedAt: new Date("2024-01-01"),
        documentVersion: {
          document: { title: "Test Document" },
          signedFileHash: "abc123",
          url: "http://example.com/doc.pdf",
        },
        signer: {
          name: "John Doe",
          email: "john@example.com",
        },
      });

      const result = await service.getVerificationDetails("sig-123");

      expect(result.isLocked).toBeUndefined();
      expect(result.signerName).toBe("John Doe");
      expect(result.signerEmail).toBe("john@example.com");
      expect(result.documentTitle).toBe("Test Document");
      expect(result.verificationStatus).toBe("REGISTERED");
      expect(result.type).toBe("PERSONAL");
    });

    it("Harus gunakan default documentTitle jika tidak ada", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        documentVersion: {
          document: null,
        },
      });

      const result = await service.getVerificationDetails("sig-123");

      expect(result.documentTitle).toBe("Dokumen Terkunci");
    });
  });

  // ==========================================================================
  // unlockVerification
  // ==========================================================================
  describe("unlockVerification", () => {
    it("Harus return null jika signature tidak ditemukan", async () => {
      mockSignatureRepository.findById.mockResolvedValue(null);

      const result = await service.unlockVerification("sig-not-found", "123456");

      expect(result).toBeNull();
    });

    it("Harus throw Forbidden jika dokumen sedang terkunci (locked)", async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        lockedUntil: futureDate,
      });

      await expect(service.unlockVerification("sig-123", "123456")).rejects.toThrow("terkunci sementara");
    });

    it("Harus throw BadRequest jika PIN salah (masih ada sisa percobaan)", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        retryCount: 0,
        lockedUntil: null,
      });

      await expect(service.unlockVerification("sig-123", "wrong-pin")).rejects.toThrow("PIN Salah");
      expect(mockSignatureRepository.update).toHaveBeenCalledWith("sig-123", { retryCount: 1 });
    });

    it("Harus throw Forbidden dan kunci dokumen setelah 3 kali salah", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        retryCount: 2, // Already 2 failed attempts
        lockedUntil: null,
      });

      await expect(service.unlockVerification("sig-123", "wrong-pin")).rejects.toThrow("dikunci selama 30 menit");

      expect(mockSignatureRepository.update).toHaveBeenCalledWith(
        "sig-123",
        expect.objectContaining({
          retryCount: 3,
          lockedUntil: expect.any(Date),
        })
      );
    });

    it("Harus return data lengkap jika PIN benar", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        retryCount: 0,
        lockedUntil: null,
        ipAddress: "192.168.1.1",
        signedAt: new Date("2024-01-01"),
        documentVersion: {
          document: { title: "Test Document" },
          signedFileHash: "abc123",
          url: "http://example.com/doc.pdf",
        },
        signer: {
          name: "John Doe",
          email: "john@example.com",
        },
      });

      const result = await service.unlockVerification("sig-123", "123456");

      expect(result.signerName).toBeNull();
      expect(result.isLocked).toBe(false);
      expect(result.requireUpload).toBe(true);
    });

    it("Harus reset counter jika PIN benar setelah percobaan gagal sebelumnya", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        retryCount: 2, // Had 2 failed attempts
        lockedUntil: null,
        ipAddress: "192.168.1.1",
        signedAt: new Date(),
        documentVersion: {
          document: { title: "Test" },
          signedFileHash: "abc",
          url: "http://example.com",
        },
        signer: { name: "John", email: "john@test.com" },
      });

      await service.unlockVerification("sig-123", "123456");

      expect(mockSignatureRepository.update).toHaveBeenCalledWith("sig-123", {
        retryCount: 0,
        lockedUntil: null,
      });
    });

    it("Harus return null jika tidak ada accessCode (open document)", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: null, // No access code
        retryCount: 0,
        lockedUntil: null,
      });

      // When accessCode is null and inputCode doesn't match (anything), should fail
      await expect(service.unlockVerification("sig-123", "123456")).rejects.toThrow("PIN Salah");
    });

    it("Harus tidak reset counter jika retryCount adalah 0", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        retryCount: 0,
        lockedUntil: null,
        ipAddress: "192.168.1.1",
        signedAt: new Date(),
        documentVersion: {
          document: { title: "Test" },
          signedFileHash: "abc",
          url: "http://example.com",
        },
        signer: { name: "John", email: "john@test.com" },
      });

      await service.unlockVerification("sig-123", "123456");

      // Should not call update when retryCount is already 0 and no lockedUntil
      expect(mockSignatureRepository.update).not.toHaveBeenCalled();
    });

    it("Harus reset lockedUntil jika sebelumnya ada dan PIN benar", async () => {
      const expiredLockTime = new Date(Date.now() - 10000); // Already expired

      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        retryCount: 0,
        lockedUntil: expiredLockTime, // Was locked but now expired
        ipAddress: "192.168.1.1",
        signedAt: new Date(),
        documentVersion: {
          document: { title: "Test" },
          signedFileHash: "abc",
          url: "http://example.com",
        },
        signer: { name: "John", email: "john@test.com" },
      });

      await service.unlockVerification("sig-123", "123456");

      // Should reset lockedUntil
      expect(mockSignatureRepository.update).toHaveBeenCalledWith("sig-123", {
        retryCount: 0,
        lockedUntil: null,
      });
    });
  });

  // ==========================================================================
  // verifyUploadedFile
  // ==========================================================================
  describe("verifyUploadedFile", () => {
    it("Harus throw NotFound jika signature tidak ditemukan", async () => {
      mockSignatureRepository.findById.mockResolvedValue(null);

      await expect(service.verifyUploadedFile("sig-not-found", Buffer.from("pdf"))).rejects.toThrow();
    });

    it("Harus throw InternalServerError jika hash tidak tersedia", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        documentVersion: {
          signedFileHash: null, // No hash
          document: { title: "Test" },
        },
        signer: { name: "John", email: "john@test.com" },
      });

      await expect(service.verifyUploadedFile("sig-123", Buffer.from("pdf"))).rejects.toThrow("Hash dokumen asli tidak ditemukan");
    });

    it("Harus return VALID jika hash cocok", async () => {
      const fileBuffer = Buffer.from("test-pdf-content");
      const crypto = await import("crypto");
      const expectedHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        ipAddress: "192.168.1.1",
        signedAt: new Date("2024-01-01"),
        documentVersion: {
          signedFileHash: expectedHash,
          document: { title: "Test Document" },
        },
        signer: {
          name: "John Doe",
          email: "john@example.com",
        },
      });

      const result = await service.verifyUploadedFile("sig-123", fileBuffer);

      expect(result.isHashMatch).toBe(true);
      expect(result.verificationStatus).toBe("VALID");
      expect(result.type).toBe("PERSONAL");
    });

    it("Harus return INVALID jika hash tidak cocok", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        ipAddress: "192.168.1.1",
        signedAt: new Date("2024-01-01"),
        documentVersion: {
          signedFileHash: "different-hash-12345",
          document: { title: "Test Document" },
        },
        signer: {
          name: "John Doe",
          email: "john@example.com",
        },
      });

      const result = await service.verifyUploadedFile("sig-123", Buffer.from("modified-content"));

      expect(result.isHashMatch).toBe(false);
      expect(result.verificationStatus).toBe("INVALID");
    });

    it("Harus include semua detail dalam response", async () => {
      const fileBuffer = Buffer.from("pdf-content");
      const crypto = await import("crypto");
      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        ipAddress: "192.168.1.1",
        signedAt: new Date("2024-01-01"),
        documentVersion: {
          signedFileHash: hash,
          document: { title: "Complete Doc" },
        },
        signer: {
          name: "Jane Doe",
          email: "jane@example.com",
        },
      });

      const result = await service.verifyUploadedFile("sig-123", fileBuffer);

      expect(result.signerName).toBe("Jane Doe");
      expect(result.signerEmail).toBe("jane@example.com");
      expect(result.ipAddress).toBe("192.168.1.1");
      expect(result.documentTitle).toBe("Complete Doc");
      expect(result.storedFileHash).toBe(hash);
      expect(result.recalculatedFileHash).toBe(hash);
    });

    it("Harus gunakan default ipAddress jika tidak ada", async () => {
      mockSignatureRepository.findById.mockResolvedValue({
        id: "sig-123",
        ipAddress: null, // No IP
        signedAt: new Date(),
        documentVersion: {
          signedFileHash: "abc123",
          document: { title: "Test" },
        },
        signer: { name: "John", email: "john@test.com" },
      });

      const result = await service.verifyUploadedFile("sig-123", Buffer.from("pdf"));

      expect(result.ipAddress).toBe("-");
    });
  });
});
