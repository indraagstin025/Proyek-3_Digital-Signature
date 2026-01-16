/**
 * Unit Tests for PackageService
 *
 * @file packageService.test.js
 * @description Tests for PackageService methods:
 *  - constructor: Validate dependency injection
 *  - createPackage: Create package with documents
 *  - getPackageDetails: Get package details
 *  - signPackage: Sign all documents in package
 *  - getPackageSignatureVerificationDetails: QR verification with PIN
 *  - unlockVerification: Unlock with PIN + rate limiting
 *  - verifyUploadedPackageFile: Verify uploaded file hash
 */

import { jest } from "@jest/globals";
import { PackageService } from "../../src/services/packageService.js";

describe("PackageService", () => {
  let service;
  let mockPackageRepository;
  let mockDocumentRepository;
  let mockVersionRepository;
  let mockPdfService;
  let mockAuditService;
  let mockUserService;

  beforeEach(() => {
    // Mock Repositories
    mockPackageRepository = {
      createPackageWithDocuments: jest.fn(),
      findPackageById: jest.fn(),
      createPackageSignatures: jest.fn(),
      updateSignature: jest.fn(),
      updatePackageDocumentVersion: jest.fn(),
      updatePackageStatus: jest.fn(),
      deleteSignaturesByIds: jest.fn(),
      findPackageSignatureById: jest.fn(),
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
      create: jest.fn(),
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
    service = new PackageService(mockPackageRepository, mockDocumentRepository, mockVersionRepository, mockPdfService, mockAuditService, mockUserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================
  describe("constructor", () => {
    it("Harus throw error jika packageRepository tidak ada", () => {
      expect(() => {
        new PackageService(null, mockDocumentRepository, mockVersionRepository, mockPdfService, mockAuditService, mockUserService);
      }).toThrow("PackageService: Repository, Services, dan UserService wajib diberikan.");
    });

    it("Harus throw error jika documentRepository tidak ada", () => {
      expect(() => {
        new PackageService(mockPackageRepository, null, mockVersionRepository, mockPdfService, mockAuditService, mockUserService);
      }).toThrow("PackageService: Repository, Services, dan UserService wajib diberikan.");
    });

    it("Harus throw error jika versionRepository tidak ada", () => {
      expect(() => {
        new PackageService(mockPackageRepository, mockDocumentRepository, null, mockPdfService, mockAuditService, mockUserService);
      }).toThrow("PackageService: Repository, Services, dan UserService wajib diberikan.");
    });

    it("Harus throw error jika pdfService tidak ada", () => {
      expect(() => {
        new PackageService(mockPackageRepository, mockDocumentRepository, mockVersionRepository, null, mockAuditService, mockUserService);
      }).toThrow("PackageService: Repository, Services, dan UserService wajib diberikan.");
    });

    it("Harus throw error jika auditService tidak ada", () => {
      expect(() => {
        new PackageService(mockPackageRepository, mockDocumentRepository, mockVersionRepository, mockPdfService, null, mockUserService);
      }).toThrow("PackageService: Repository, Services, dan UserService wajib diberikan.");
    });

    it("Harus throw error jika userService tidak ada", () => {
      expect(() => {
        new PackageService(mockPackageRepository, mockDocumentRepository, mockVersionRepository, mockPdfService, mockAuditService, null);
      }).toThrow("PackageService: Repository, Services, dan UserService wajib diberikan.");
    });

    it("Harus berhasil instantiate jika semua dependency ada", () => {
      const svc = new PackageService(mockPackageRepository, mockDocumentRepository, mockVersionRepository, mockPdfService, mockAuditService, mockUserService);
      expect(svc).toBeInstanceOf(PackageService);
    });
  });

  // ==========================================================================
  // CREATE PACKAGE
  // ==========================================================================
  describe("createPackage", () => {
    const userId = "user-123";
    const title = "Test Package";
    const documentIds = ["doc-1", "doc-2"];

    beforeEach(() => {
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockDocumentRepository.findById.mockImplementation((docId) => {
        return Promise.resolve({
          id: docId,
          title: `Document ${docId}`,
          currentVersionId: `ver-${docId}`,
          status: "draft",
        });
      });
      mockPackageRepository.createPackageWithDocuments.mockResolvedValue({
        id: "pkg-123",
        title: title,
        status: "pending",
      });
    });

    it("Harus throw PremiumRequired jika free user melebihi batas 3 dokumen", async () => {
      const tooManyDocs = ["doc-1", "doc-2", "doc-3", "doc-4"];

      await expect(service.createPackage(userId, title, tooManyDocs)).rejects.toThrow("Maksimal 3 dokumen per paket");
    });

    it("Harus throw PremiumRequired jika premium user melebihi batas 20 dokumen", async () => {
      mockUserService.isUserPremium.mockResolvedValue(true);
      const tooManyDocs = Array.from({ length: 21 }, (_, i) => `doc-${i + 1}`);

      await expect(service.createPackage(userId, title, tooManyDocs)).rejects.toThrow("Maksimal 20 dokumen per paket");
    });

    it("Harus include pesan upgrade untuk free user", async () => {
      const tooManyDocs = ["doc-1", "doc-2", "doc-3", "doc-4"];

      await expect(service.createPackage(userId, title, tooManyDocs)).rejects.toThrow("Upgrade ke Premium");
    });

    it("Harus throw NotFound jika dokumen tidak ditemukan", async () => {
      mockDocumentRepository.findById.mockResolvedValueOnce(null);

      await expect(service.createPackage(userId, title, documentIds)).rejects.toThrow();
    });

    it("Harus throw InvalidVersion jika dokumen tidak memiliki currentVersionId", async () => {
      mockDocumentRepository.findById.mockResolvedValueOnce({
        id: "doc-1",
        title: "Doc 1",
        currentVersionId: null,
        status: "draft",
      });

      await expect(service.createPackage(userId, title, documentIds)).rejects.toThrow("Tidak memiliki versi aktif");
    });

    it("Harus throw BadRequest jika dokumen sudah completed", async () => {
      mockDocumentRepository.findById.mockResolvedValueOnce({
        id: "doc-1",
        title: "Doc 1",
        currentVersionId: "ver-1",
        status: "completed",
      });

      await expect(service.createPackage(userId, title, documentIds)).rejects.toThrow("sudah selesai");
    });

    it("Harus throw BadRequest jika tidak ada dokumen valid", async () => {
      await expect(service.createPackage(userId, title, [])).rejects.toThrow();
    });

    it("Harus berhasil membuat package dengan dokumen valid", async () => {
      const result = await service.createPackage(userId, title, documentIds);

      expect(mockPackageRepository.createPackageWithDocuments).toHaveBeenCalledWith(userId, title, ["ver-doc-1", "ver-doc-2"]);
      expect(result.id).toBe("pkg-123");
    });

    it("Premium user harus bisa membuat package dengan lebih dari 3 dokumen", async () => {
      mockUserService.isUserPremium.mockResolvedValue(true);
      const fiveDocs = ["doc-1", "doc-2", "doc-3", "doc-4", "doc-5"];

      await service.createPackage(userId, title, fiveDocs);

      expect(mockPackageRepository.createPackageWithDocuments).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET PACKAGE DETAILS
  // ==========================================================================
  describe("getPackageDetails", () => {
    it("Harus memanggil repository dengan parameter yang benar", async () => {
      mockPackageRepository.findPackageById.mockResolvedValue({ id: "pkg-123" });

      const result = await service.getPackageDetails("pkg-123", "user-123");

      expect(mockPackageRepository.findPackageById).toHaveBeenCalledWith("pkg-123", "user-123");
      expect(result.id).toBe("pkg-123");
    });
  });

  // ==========================================================================
  // SIGN PACKAGE
  // ==========================================================================
  describe("signPackage", () => {
    const packageId = "pkg-123";
    const userId = "user-123";
    const userIpAddress = "192.168.1.1";
    const signaturesPayload = [
      {
        packageDocId: "pkg-doc-1",
        signatureImageUrl: "data:image/png;base64,xxx",
        pageNumber: 1,
        positionX: 100,
        positionY: 200,
        width: 150,
        height: 50,
        displayQrCode: true,
      },
    ];

    const mockPackage = {
      id: packageId,
      status: "pending",
      documents: [
        {
          id: "pkg-doc-1",
          docVersion: {
            id: "ver-1",
            document: { id: "doc-1", title: "Test Document" },
          },
        },
      ],
    };

    beforeEach(() => {
      mockPackageRepository.findPackageById.mockResolvedValue(mockPackage);
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockVersionRepository.countByDocumentId.mockResolvedValue(0);
      mockPackageRepository.prisma.user.findUnique.mockResolvedValue({
        id: userId,
        name: "John Doe",
        email: "john@example.com",
      });
      mockPackageRepository.createPackageSignatures.mockResolvedValue([{ id: "sig-1" }]);
      mockPdfService.generateSignedPdf.mockResolvedValue({
        signedFileBuffer: Buffer.from("signed-pdf"),
        publicUrl: "http://example.com/signed.pdf",
        accessCode: "123456",
      });
      mockVersionRepository.create.mockResolvedValue({ id: "new-ver-1" });
      mockPackageRepository.updateSignature.mockResolvedValue({});
      mockPackageRepository.updatePackageDocumentVersion.mockResolvedValue({});
      mockDocumentRepository.update.mockResolvedValue({});
      mockPackageRepository.updatePackageStatus.mockResolvedValue({});
    });

    it("Harus throw BadRequest jika paket sudah completed", async () => {
      mockPackageRepository.findPackageById.mockResolvedValue({
        ...mockPackage,
        status: "completed",
      });

      await expect(service.signPackage(packageId, userId, signaturesPayload, userIpAddress)).rejects.toThrow("sudah selesai");
    });

    it("Harus berhasil sign package dan return completed status", async () => {
      const result = await service.signPackage(packageId, userId, signaturesPayload, userIpAddress);

      expect(result.packageId).toBe(packageId);
      expect(result.status).toBe("completed");
      expect(result.success).toContain("doc-1");
      expect(result.failed).toHaveLength(0);
    });

    it("Harus menyimpan accessCode ke DB jika ada", async () => {
      await service.signPackage(packageId, userId, signaturesPayload, userIpAddress);

      expect(mockPackageRepository.updateSignature).toHaveBeenCalledWith("sig-1", { accessCode: "123456" });
    });

    it("Harus tidak simpan accessCode jika tidak ada", async () => {
      mockPdfService.generateSignedPdf.mockResolvedValue({
        signedFileBuffer: Buffer.from("signed-pdf"),
        publicUrl: "http://example.com/signed.pdf",
        accessCode: null,
      });

      await service.signPackage(packageId, userId, signaturesPayload, userIpAddress);

      // updateSignature should not be called for accessCode
      expect(mockPackageRepository.updateSignature).not.toHaveBeenCalledWith("sig-1", { accessCode: null });
    });

    it("Harus throw error jika dokumen mencapai batas versi", async () => {
      mockVersionRepository.countByDocumentId.mockResolvedValue(5);

      const result = await service.signPackage(packageId, userId, signaturesPayload, userIpAddress);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain("batas revisi");
    });

    it("Harus rollback signature jika PDF generation gagal", async () => {
      mockPdfService.generateSignedPdf.mockRejectedValue(new Error("PDF Error"));

      const result = await service.signPackage(packageId, userId, signaturesPayload, userIpAddress);

      expect(mockPackageRepository.deleteSignaturesByIds).toHaveBeenCalledWith(["sig-1"]);
      expect(result.failed).toHaveLength(1);
    });

    it("Harus return partial_failure jika ada dokumen yang gagal", async () => {
      mockPdfService.generateSignedPdf.mockRejectedValue(new Error("PDF Error"));

      const result = await service.signPackage(packageId, userId, signaturesPayload, userIpAddress);

      expect(result.status).toBe("partial_failure");
    });

    it("Harus log audit jika auditService tersedia", async () => {
      const mockReq = { ip: "127.0.0.1" };

      await service.signPackage(packageId, userId, signaturesPayload, userIpAddress, mockReq);

      expect(mockAuditService.log).toHaveBeenCalledWith("SIGN_PACKAGE", userId, packageId, expect.any(String), mockReq);
    });

    it("Harus gunakan default name/email jika user tidak ditemukan", async () => {
      mockPackageRepository.prisma.user.findUnique.mockResolvedValue(null);

      await service.signPackage(packageId, userId, signaturesPayload, userIpAddress);

      expect(mockPdfService.generateSignedPdf).toHaveBeenCalledWith(
        "ver-1",
        expect.arrayContaining([
          expect.objectContaining({
            signerName: "User",
            signerEmail: "user@email.com",
          }),
        ]),
        expect.any(Object)
      );
    });

    it("Harus handle jika tidak ada konfigurasi signature untuk dokumen", async () => {
      const emptyPayload = [{ packageDocId: "non-existent" }];

      const result = await service.signPackage(packageId, userId, emptyPayload, userIpAddress);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain("Tidak ada konfigurasi");
    });

    it("Harus handle jika createPackageSignatures return null", async () => {
      mockPackageRepository.createPackageSignatures.mockResolvedValue(null);

      const result = await service.signPackage(packageId, userId, signaturesPayload, userIpAddress);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain("Database gagal");
    });

    it("Harus bekerja tanpa prisma di repository", async () => {
      const serviceWithoutPrisma = new PackageService({ ...mockPackageRepository, prisma: null }, mockDocumentRepository, mockVersionRepository, mockPdfService, mockAuditService, mockUserService);

      mockPackageRepository.findPackageById.mockResolvedValue(mockPackage);

      const result = await serviceWithoutPrisma.signPackage(packageId, userId, signaturesPayload, userIpAddress);

      expect(result.success).toContain("doc-1");
    });

    it("Harus gunakan displayQrCode true sebagai default", async () => {
      const payloadWithoutQr = [{ ...signaturesPayload[0], displayQrCode: undefined }];

      await service.signPackage(packageId, userId, payloadWithoutQr, userIpAddress);

      expect(mockPdfService.generateSignedPdf).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ displayQrCode: true }));
    });
  });

  // ==========================================================================
  // GET PACKAGE SIGNATURE VERIFICATION DETAILS
  // ==========================================================================
  describe("getPackageSignatureVerificationDetails", () => {
    it("Harus return null jika signature tidak ditemukan", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue(null);

      const result = await service.getPackageSignatureVerificationDetails("sig-not-found");

      expect(result).toBeNull();
    });

    it("Harus return locked status jika ada accessCode", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        packageDocument: {
          docVersion: {
            document: { title: "Locked Document" },
          },
        },
      });

      const result = await service.getPackageSignatureVerificationDetails("sig-123");

      expect(result.isLocked).toBe(true);
      expect(result.type).toBe("PACKAGE");
      expect(result.message).toContain("dilindungi kode akses");
    });

    it("Harus return null jika data tidak lengkap (no docVersion)", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: null,
        packageDocument: { docVersion: null },
        signer: { name: "John" },
      });

      const result = await service.getPackageSignatureVerificationDetails("sig-123");

      expect(result).toBeNull();
    });

    it("Harus return null jika data tidak lengkap (no signer)", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: null,
        packageDocument: {
          docVersion: { signedFileHash: "abc123", document: { title: "Test" } },
        },
        signer: null,
      });

      const result = await service.getPackageSignatureVerificationDetails("sig-123");

      expect(result).toBeNull();
    });

    it("Harus return null jika data tidak lengkap (no hash)", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: null,
        packageDocument: {
          docVersion: { signedFileHash: null, hash: null, document: { title: "Test" } },
        },
        signer: { name: "John", email: "john@test.com" },
      });

      const result = await service.getPackageSignatureVerificationDetails("sig-123");

      expect(result).toBeNull();
    });

    it("Harus return full details jika tidak terkunci", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: null,
        ipAddress: "192.168.1.1",
        createdAt: new Date("2024-01-01"),
        packageDocument: {
          docVersion: {
            signedFileHash: "abc123",
            url: "http://example.com/doc.pdf",
            document: { title: "Test Document" },
          },
        },
        signer: {
          name: "John Doe",
          email: "john@example.com",
        },
      });

      const result = await service.getPackageSignatureVerificationDetails("sig-123");

      expect(result.signerName).toBe("John Doe");
      expect(result.documentTitle).toBe("Test Document");
      expect(result.verificationStatus).toBe("REGISTERED");
      expect(result.type).toBe("PACKAGE");
    });

    it("Harus gunakan hash sebagai fallback jika signedFileHash tidak ada", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: null,
        ipAddress: "192.168.1.1",
        createdAt: new Date(),
        packageDocument: {
          docVersion: {
            signedFileHash: null,
            hash: "fallback-hash",
            url: "http://example.com",
            document: { title: "Test" },
          },
        },
        signer: { name: "John", email: "john@test.com" },
      });

      const result = await service.getPackageSignatureVerificationDetails("sig-123");

      expect(result.storedFileHash).toBe("fallback-hash");
    });

    it("Harus gunakan default documentTitle jika tidak ada", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        packageDocument: {
          docVersion: {
            document: null,
          },
        },
      });

      const result = await service.getPackageSignatureVerificationDetails("sig-123");

      expect(result.documentTitle).toBe("Dokumen Terkunci");
    });
  });

  // ==========================================================================
  // UNLOCK VERIFICATION
  // ==========================================================================
  describe("unlockVerification", () => {
    it("Harus return null jika signature tidak ditemukan", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue(null);

      const result = await service.unlockVerification("sig-not-found", "123456");

      expect(result).toBeNull();
    });

    it("Harus throw Forbidden jika dokumen sedang terkunci", async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);

      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        lockedUntil: futureDate,
      });

      await expect(service.unlockVerification("sig-123", "123456")).rejects.toThrow("terkunci sementara");
    });

    it("Harus throw BadRequest jika PIN salah (masih ada sisa percobaan)", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        retryCount: 0,
        lockedUntil: null,
      });

      await expect(service.unlockVerification("sig-123", "wrong-pin")).rejects.toThrow("PIN Salah");
      expect(mockPackageRepository.updateSignature).toHaveBeenCalledWith("sig-123", { retryCount: 1 });
    });

    it("Harus throw Forbidden dan kunci dokumen setelah 3 kali salah", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        retryCount: 2,
        lockedUntil: null,
      });

      await expect(service.unlockVerification("sig-123", "wrong-pin")).rejects.toThrow("dikunci selama 30 menit");

      expect(mockPackageRepository.updateSignature).toHaveBeenCalledWith(
        "sig-123",
        expect.objectContaining({
          retryCount: 3,
          lockedUntil: expect.any(Date),
        })
      );
    });

    it("Harus return data lengkap jika PIN benar", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        retryCount: 0,
        lockedUntil: null,
        ipAddress: "192.168.1.1",
        createdAt: new Date("2024-01-01"),
        packageDocument: {
          docVersion: {
            signedFileHash: "abc123",
            url: "http://example.com/doc.pdf",
            document: { title: "Test Document" },
          },
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

    it("Harus reset counter jika PIN benar setelah percobaan gagal", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        retryCount: 2,
        lockedUntil: null,
        ipAddress: "192.168.1.1",
        createdAt: new Date(),
        packageDocument: {
          docVersion: {
            signedFileHash: "abc",
            url: "http://example.com",
            document: { title: "Test" },
          },
        },
        signer: { name: "John", email: "john@test.com" },
      });

      await service.unlockVerification("sig-123", "123456");

      expect(mockPackageRepository.updateSignature).toHaveBeenCalledWith("sig-123", {
        retryCount: 0,
        lockedUntil: null,
      });
    });

    it("Harus tidak reset counter jika retryCount sudah 0", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: "123456",
        retryCount: 0,
        lockedUntil: null,
        ipAddress: "192.168.1.1",
        createdAt: new Date(),
        packageDocument: {
          docVersion: {
            signedFileHash: "abc",
            url: "http://example.com",
            document: { title: "Test" },
          },
        },
        signer: { name: "John", email: "john@test.com" },
      });

      await service.unlockVerification("sig-123", "123456");

      expect(mockPackageRepository.updateSignature).not.toHaveBeenCalled();
    });

    it("Harus throw BadRequest jika accessCode null tapi inputCode ada", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        accessCode: null,
        retryCount: 0,
        lockedUntil: null,
      });

      await expect(service.unlockVerification("sig-123", "123456")).rejects.toThrow("PIN Salah");
    });
  });

  // ==========================================================================
  // VERIFY UPLOADED PACKAGE FILE
  // ==========================================================================
  describe("verifyUploadedPackageFile", () => {
    it("Harus return null jika signature tidak ditemukan", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue(null);

      const result = await service.verifyUploadedPackageFile("sig-not-found", Buffer.from("pdf"));

      expect(result).toBeNull();
    });

    it("Harus return null jika hash tidak tersedia", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        packageDocument: {
          docVersion: { signedFileHash: null, hash: null },
        },
        signer: { name: "John", email: "john@test.com" },
      });

      const result = await service.verifyUploadedPackageFile("sig-123", Buffer.from("pdf"));

      expect(result).toBeNull();
    });

    it("Harus return VALID jika hash cocok", async () => {
      const fileBuffer = Buffer.from("test-pdf-content");
      const crypto = await import("crypto");
      const expectedHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        ipAddress: "192.168.1.1",
        createdAt: new Date("2024-01-01"),
        packageDocument: {
          docVersion: {
            signedFileHash: expectedHash,
            document: { title: "Test Document" },
          },
        },
        signer: {
          name: "John Doe",
          email: "john@example.com",
        },
      });

      const result = await service.verifyUploadedPackageFile("sig-123", fileBuffer);

      expect(result.isHashMatch).toBe(true);
      expect(result.verificationStatus).toBe("VALID");
      expect(result.type).toBe("PACKAGE");
    });

    it("Harus return INVALID jika hash tidak cocok", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        ipAddress: "192.168.1.1",
        createdAt: new Date(),
        packageDocument: {
          docVersion: {
            signedFileHash: "different-hash",
            document: { title: "Test" },
          },
        },
        signer: { name: "John", email: "john@test.com" },
      });

      const result = await service.verifyUploadedPackageFile("sig-123", Buffer.from("modified-content"));

      expect(result.isHashMatch).toBe(false);
      expect(result.verificationStatus).toBe("INVALID");
    });

    it("Harus gunakan hash sebagai fallback untuk signedFileHash", async () => {
      const fileBuffer = Buffer.from("test-content");
      const crypto = await import("crypto");
      const expectedHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        ipAddress: "192.168.1.1",
        createdAt: new Date(),
        packageDocument: {
          docVersion: {
            signedFileHash: null,
            hash: expectedHash, // Fallback
            document: { title: "Test" },
          },
        },
        signer: { name: "John", email: "john@test.com" },
      });

      const result = await service.verifyUploadedPackageFile("sig-123", fileBuffer);

      expect(result.isHashMatch).toBe(true);
      expect(result.storedFileHash).toBe(expectedHash);
    });

    it("Harus gunakan default ipAddress jika tidak ada", async () => {
      mockPackageRepository.findPackageSignatureById.mockResolvedValue({
        id: "sig-123",
        ipAddress: null,
        createdAt: new Date(),
        packageDocument: {
          docVersion: {
            signedFileHash: "abc123",
            document: { title: "Test" },
          },
        },
        signer: { name: "John", email: "john@test.com" },
      });

      const result = await service.verifyUploadedPackageFile("sig-123", Buffer.from("pdf"));

      expect(result.ipAddress).toBe("-");
    });
  });
});
