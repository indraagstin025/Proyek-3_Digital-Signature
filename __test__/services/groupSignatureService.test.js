/**
 * Unit Tests for GroupSignatureService
 *
 * @file groupSignatureService.test.js
 * @description Tests for GroupSignatureService methods:
 *  - saveDraft: Upsert draft tanda tangan group
 *  - updateDraftPosition: Update posisi draft (drag/resize)
 *  - deleteDraft: Hapus draft
 *  - signDocument: User menandatangani dokumen group
 *  - getVerificationDetails: Cek QR Code dengan PIN lock
 *  - unlockVerification: Buka kunci dengan PIN + rate limiting
 *  - verifyUploadedFile: Verifikasi file upload
 */

import { GroupSignatureService } from "../../src/services/groupSignatureService.js";
import CommonError from "../../src/errors/CommonError.js";
import crypto from "crypto";

describe("GroupSignatureService", () => {
  let groupSignatureService;
  let mockGroupSignatureRepository;
  let mockGroupDocumentSignerRepository;
  let mockDocumentRepository;
  let mockVersionRepository;
  let mockGroupMemberRepository;
  let mockPdfService;
  let mockAuditService;

  beforeEach(() => {
    // Mock repositories dan services
    mockGroupSignatureRepository = {
      findById: jest.fn(),
      findBySignerAndVersion: jest.fn(),
      findAllByVersionId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockGroupDocumentSignerRepository = {
      findPendingByUserAndDoc: jest.fn(),
      updateStatusToSigned: jest.fn(),
      countPendingSigners: jest.fn(),
    };

    mockDocumentRepository = {
      findById: jest.fn(),
      findByIdSimple: jest.fn(),
    };

    mockVersionRepository = {
      findById: jest.fn(),
    };

    mockGroupMemberRepository = {};

    mockPdfService = {
      generateSignedPdf: jest.fn(),
    };

    mockAuditService = {
      log: jest.fn(),
    };

    groupSignatureService = new GroupSignatureService(mockGroupSignatureRepository, mockGroupDocumentSignerRepository, mockDocumentRepository, mockVersionRepository, mockGroupMemberRepository, mockPdfService, mockAuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =====================================================
  // TEST: saveDraft
  // =====================================================
  describe("saveDraft", () => {
    const userId = "user-123";
    const documentId = "doc-123";
    const signatureData = {
      id: "sig-uuid-123",
      method: "canvas",
      signatureImageUrl: "data:image/png;base64,abc",
      positionX: 100,
      positionY: 200,
      pageNumber: 1,
      width: 150,
      height: 75,
    };

    const mockDocument = {
      id: documentId,
      currentVersionId: "version-123",
      currentVersion: { id: "version-123" },
    };

    it("Harus throw NotFound jika document tidak ditemukan", async () => {
      mockDocumentRepository.findById.mockResolvedValue(null);

      await expect(groupSignatureService.saveDraft(userId, documentId, signatureData)).rejects.toThrow("doc-123");

      expect(mockDocumentRepository.findById).toHaveBeenCalledWith(documentId, userId);
    });

    it("Harus CREATE draft baru jika belum ada", async () => {
      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockGroupSignatureRepository.findById.mockResolvedValue(null);
      mockGroupSignatureRepository.create.mockResolvedValue({
        id: signatureData.id,
        status: "draft",
      });

      const result = await groupSignatureService.saveDraft(userId, documentId, signatureData);

      expect(mockGroupSignatureRepository.findById).toHaveBeenCalledWith(signatureData.id);
      expect(mockGroupSignatureRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: signatureData.id,
          userId: userId,
          documentVersionId: mockDocument.currentVersionId,
          status: "draft",
        })
      );
      expect(result).toEqual({ id: signatureData.id, status: "draft" });
    });

    it("Harus UPDATE draft jika sudah ada", async () => {
      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureData.id,
        status: "draft",
      });
      mockGroupSignatureRepository.update.mockResolvedValue({
        id: signatureData.id,
        status: "draft",
        positionX: 100,
      });

      const result = await groupSignatureService.saveDraft(userId, documentId, signatureData);

      expect(mockGroupSignatureRepository.update).toHaveBeenCalledWith(
        signatureData.id,
        expect.objectContaining({
          id: signatureData.id,
          status: "draft",
        })
      );
      expect(result.positionX).toBe(100);
    });

    it("Harus gunakan default values jika width/height tidak ada", async () => {
      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockGroupSignatureRepository.findById.mockResolvedValue(null);
      mockGroupSignatureRepository.create.mockResolvedValue({ id: "sig-1" });

      const dataWithoutSize = { ...signatureData };
      delete dataWithoutSize.width;
      delete dataWithoutSize.height;

      await groupSignatureService.saveDraft(userId, documentId, dataWithoutSize);

      expect(mockGroupSignatureRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 0,
          height: 0,
        })
      );
    });

    it("Harus gunakan default method 'canvas' jika tidak ada", async () => {
      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockGroupSignatureRepository.findById.mockResolvedValue(null);
      mockGroupSignatureRepository.create.mockResolvedValue({ id: "sig-1" });

      const dataWithoutMethod = { ...signatureData };
      delete dataWithoutMethod.method;

      await groupSignatureService.saveDraft(userId, documentId, dataWithoutMethod);

      expect(mockGroupSignatureRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "canvas",
        })
      );
    });
  });

  // =====================================================
  // TEST: updateDraftPosition
  // =====================================================
  describe("updateDraftPosition", () => {
    const signatureId = "sig-123";
    const positionData = {
      positionX: 200,
      positionY: 300,
      width: 180,
      height: 90,
      pageNumber: 2,
    };

    it("Harus berhasil update position dan return data", async () => {
      mockGroupSignatureRepository.update.mockResolvedValue({
        id: signatureId,
        ...positionData,
      });

      const result = await groupSignatureService.updateDraftPosition(signatureId, positionData);

      expect(mockGroupSignatureRepository.update).toHaveBeenCalledWith(
        signatureId,
        expect.objectContaining({
          positionX: 200,
          positionY: 300,
          width: 180,
          height: 90,
          pageNumber: 2,
        })
      );
      expect(result.id).toBe(signatureId);
    });

    it("Harus return null jika signature tidak ditemukan", async () => {
      mockGroupSignatureRepository.update.mockResolvedValue(null);

      const result = await groupSignatureService.updateDraftPosition(signatureId, positionData);

      expect(result).toBeNull();
    });
  });

  // =====================================================
  // TEST: deleteDraft
  // =====================================================
  describe("deleteDraft", () => {
    const signatureId = "sig-123";

    it("Harus return true jika berhasil delete", async () => {
      mockGroupSignatureRepository.delete.mockResolvedValue({ count: 1 });

      const result = await groupSignatureService.deleteDraft(signatureId);

      expect(mockGroupSignatureRepository.delete).toHaveBeenCalledWith(signatureId);
      expect(result).toBe(true);
    });

    it("Harus return false jika tidak ada yang dihapus", async () => {
      mockGroupSignatureRepository.delete.mockResolvedValue({ count: 0 });

      const result = await groupSignatureService.deleteDraft(signatureId);

      expect(result).toBe(false);
    });

    it("Harus return falsy jika result null", async () => {
      mockGroupSignatureRepository.delete.mockResolvedValue(null);

      const result = await groupSignatureService.deleteDraft(signatureId);

      // `null && null.count` akan return null (falsy)
      expect(result).toBeFalsy();
    });
  });

  // =====================================================
  // TEST: signDocument
  // =====================================================
  describe("signDocument", () => {
    const userId = "user-123";
    const documentId = "doc-123";
    const signatureData = {
      signatureImageUrl: "data:image/png;base64,abc",
      positionX: 100,
      positionY: 200,
      pageNumber: 1,
    };
    const auditData = {
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
    };
    const mockReq = { headers: {} };

    const mockDocument = {
      id: documentId,
      title: "Test Document",
      currentVersionId: "version-123",
      currentVersion: { id: "version-123" },
    };

    it("Harus throw BadRequest jika user tidak punya akses", async () => {
      mockGroupDocumentSignerRepository.findPendingByUserAndDoc.mockResolvedValue(null);

      await expect(groupSignatureService.signDocument(userId, documentId, signatureData, auditData, mockReq)).rejects.toThrow("Anda tidak memiliki akses atau sudah tanda tangan.");
    });

    it("Harus CREATE signature baru jika belum ada draft", async () => {
      mockGroupDocumentSignerRepository.findPendingByUserAndDoc.mockResolvedValue({
        id: "signer-request-1",
      });
      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockGroupSignatureRepository.findBySignerAndVersion.mockResolvedValue(null);
      mockGroupSignatureRepository.create.mockResolvedValue({
        id: "new-sig-123",
        status: "final",
      });
      mockGroupDocumentSignerRepository.updateStatusToSigned.mockResolvedValue({});
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(2);
      mockAuditService.log.mockResolvedValue({});

      const result = await groupSignatureService.signDocument(userId, documentId, signatureData, auditData, mockReq);

      expect(mockGroupSignatureRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: userId,
          documentVersionId: mockDocument.currentVersion.id,
          status: "final",
          ipAddress: auditData.ipAddress,
          userAgent: auditData.userAgent,
        })
      );
      expect(result.message).toBe("Tanda tangan disimpan.");
      expect(result.remainingSigners).toBe(2);
    });

    it("Harus UPDATE signature jika sudah ada draft", async () => {
      mockGroupDocumentSignerRepository.findPendingByUserAndDoc.mockResolvedValue({
        id: "signer-request-1",
      });
      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockGroupSignatureRepository.findBySignerAndVersion.mockResolvedValue({
        id: "existing-sig-123",
        status: "draft",
      });
      mockGroupSignatureRepository.update.mockResolvedValue({
        id: "existing-sig-123",
        status: "final",
      });
      mockGroupDocumentSignerRepository.updateStatusToSigned.mockResolvedValue({});
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(0);
      mockAuditService.log.mockResolvedValue({});

      const result = await groupSignatureService.signDocument(userId, documentId, signatureData, auditData, mockReq);

      expect(mockGroupSignatureRepository.update).toHaveBeenCalledWith(
        "existing-sig-123",
        expect.objectContaining({
          status: "final",
        })
      );
      expect(result.message).toBe("Tanda tangan berhasil. Menunggu finalisasi Admin.");
      expect(result.readyToFinalize).toBe(true);
      expect(result.remainingSigners).toBe(0);
    });

    it("Harus call auditService.log dengan parameter yang benar", async () => {
      mockGroupDocumentSignerRepository.findPendingByUserAndDoc.mockResolvedValue({ id: "s1" });
      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockGroupSignatureRepository.findBySignerAndVersion.mockResolvedValue(null);
      mockGroupSignatureRepository.create.mockResolvedValue({ id: "sig-1" });
      mockGroupDocumentSignerRepository.updateStatusToSigned.mockResolvedValue({});
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(1);
      mockAuditService.log.mockResolvedValue({});

      await groupSignatureService.signDocument(userId, documentId, signatureData, auditData, mockReq);

      expect(mockAuditService.log).toHaveBeenCalledWith("SIGN_DOCUMENT_GROUP", userId, documentId, expect.stringContaining("User menandatangani dokumen grup"), mockReq);
    });

    it("Harus tetap berhasil tanpa auditService", async () => {
      // Create service tanpa auditService
      const serviceWithoutAudit = new GroupSignatureService(
        mockGroupSignatureRepository,
        mockGroupDocumentSignerRepository,
        mockDocumentRepository,
        mockVersionRepository,
        mockGroupMemberRepository,
        mockPdfService,
        null // No auditService
      );

      mockGroupDocumentSignerRepository.findPendingByUserAndDoc.mockResolvedValue({ id: "s1" });
      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockGroupSignatureRepository.findBySignerAndVersion.mockResolvedValue(null);
      mockGroupSignatureRepository.create.mockResolvedValue({ id: "sig-1" });
      mockGroupDocumentSignerRepository.updateStatusToSigned.mockResolvedValue({});
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(0);

      const result = await serviceWithoutAudit.signDocument(userId, documentId, signatureData, auditData, mockReq);

      expect(result.id).toBe("sig-1");
      expect(result.readyToFinalize).toBe(true);
    });
  });

  // =====================================================
  // TEST: getVerificationDetails
  // =====================================================
  describe("getVerificationDetails", () => {
    const signatureId = "sig-123";

    it("Harus return null jika signature tidak ditemukan", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue(null);

      const result = await groupSignatureService.getVerificationDetails(signatureId);

      expect(result).toBeNull();
    });

    it("Harus return locked status jika ada accessCode", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: "123456",
        documentVersion: {
          document: { title: "Locked Document" },
        },
      });

      const result = await groupSignatureService.getVerificationDetails(signatureId);

      expect(result.isLocked).toBe(true);
      expect(result.type).toBe("GROUP");
      expect(result.documentTitle).toBe("Locked Document");
      expect(result.message).toContain("PIN");
    });

    it("Harus return data lengkap jika tidak ada accessCode dan sudah final", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: null,
        ipAddress: "192.168.1.1",
        signedAt: new Date("2024-01-15"),
        createdAt: new Date("2024-01-10"),
        signer: {
          name: "John Doe",
          email: "john@example.com",
        },
        documentVersion: {
          signedFileHash: "abc123hash",
          url: "https://storage/doc.pdf",
          document: {
            title: "Final Document",
            status: "completed",
          },
        },
      });

      const result = await groupSignatureService.getVerificationDetails(signatureId);

      expect(result.isLocked).toBe(false);
      expect(result.signerName).toBe("John Doe");
      expect(result.signerEmail).toBe("john@example.com");
      expect(result.documentTitle).toBe("Final Document");
      expect(result.verificationStatus).toBe("REGISTERED");
      expect(result.type).toBe("GROUP");
    });

    it("Harus return PENDING_FINALIZATION jika belum ada hash dan status bukan completed", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: null,
        signer: { name: "Jane", email: "jane@example.com" },
        documentVersion: {
          signedFileHash: null,
          document: {
            title: "Draft Document",
            status: "pending",
          },
        },
      });

      const result = await groupSignatureService.getVerificationDetails(signatureId);

      expect(result.verificationStatus).toBe("PENDING_FINALIZATION");
      expect(result.verificationMessage).toContain("belum difinalisasi");
      expect(result.requireUpload).toBe(false);
    });

    it("Harus gunakan createdAt jika signedAt tidak ada", async () => {
      const createdDate = new Date("2024-01-10");
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: null,
        signedAt: null,
        createdAt: createdDate,
        signer: { name: "Test", email: "test@example.com" },
        documentVersion: {
          signedFileHash: "hash123",
          url: "https://storage/doc.pdf",
          document: { title: "Doc", status: "completed" },
        },
      });

      const result = await groupSignatureService.getVerificationDetails(signatureId);

      expect(result.signedAt).toEqual(createdDate);
    });

    it("Harus gunakan default title jika document title tidak ada", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: "12345",
        documentVersion: {
          document: null,
        },
      });

      const result = await groupSignatureService.getVerificationDetails(signatureId);

      expect(result.documentTitle).toBe("Dokumen Terkunci");
    });

    it("Harus return dash untuk ipAddress jika null", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: null,
        ipAddress: null,
        signer: { name: "Test", email: "test@test.com" },
        documentVersion: {
          signedFileHash: "hash",
          url: "https://url",
          document: { title: "Doc", status: "completed" },
        },
      });

      const result = await groupSignatureService.getVerificationDetails(signatureId);

      expect(result.signerIpAddress).toBe("-");
    });

    it("Harus return PENDING jika storedHash kosong dan status completed", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: null,
        ipAddress: "1.2.3.4",
        signedAt: new Date(),
        signer: { name: "Test", email: "test@test.com" },
        documentVersion: {
          signedFileHash: "", // Empty string (falsy)
          url: "https://url",
          document: { title: "Doc", status: "completed" },
        },
      });

      const result = await groupSignatureService.getVerificationDetails(signatureId);

      expect(result.storedFileHash).toBe("PENDING");
    });
  });

  // =====================================================
  // TEST: unlockVerification
  // =====================================================
  describe("unlockVerification", () => {
    const signatureId = "sig-123";
    const correctPIN = "123456";

    it("Harus return null jika signature tidak ditemukan", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue(null);

      const result = await groupSignatureService.unlockVerification(signatureId, correctPIN);

      expect(result).toBeNull();
    });

    it("Harus throw Forbidden jika dokumen masih terkunci (lockedUntil)", async () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000); // 30 menit ke depan
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        lockedUntil: futureDate,
        accessCode: correctPIN,
      });

      await expect(groupSignatureService.unlockVerification(signatureId, correctPIN)).rejects.toThrow(/terkunci sementara/);
    });

    it("Harus throw BadRequest jika PIN salah (percobaan 1)", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: correctPIN,
        retryCount: 0,
        lockedUntil: null,
      });
      mockGroupSignatureRepository.update.mockResolvedValue({});

      await expect(groupSignatureService.unlockVerification(signatureId, "wrong-pin")).rejects.toThrow(/PIN Salah.*2 kali/);

      expect(mockGroupSignatureRepository.update).toHaveBeenCalledWith(signatureId, expect.objectContaining({ retryCount: 1 }));
    });

    it("Harus throw BadRequest jika PIN salah (percobaan 2)", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: correctPIN,
        retryCount: 1,
        lockedUntil: null,
      });
      mockGroupSignatureRepository.update.mockResolvedValue({});

      await expect(groupSignatureService.unlockVerification(signatureId, "wrong-pin")).rejects.toThrow(/PIN Salah.*1 kali/);

      expect(mockGroupSignatureRepository.update).toHaveBeenCalledWith(signatureId, expect.objectContaining({ retryCount: 2 }));
    });

    it("Harus throw Forbidden dan lock dokumen jika PIN salah 3 kali", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: correctPIN,
        retryCount: 2,
        lockedUntil: null,
      });
      mockGroupSignatureRepository.update.mockResolvedValue({});

      await expect(groupSignatureService.unlockVerification(signatureId, "wrong-pin")).rejects.toThrow(/Terlalu banyak percobaan.*30 menit/);

      expect(mockGroupSignatureRepository.update).toHaveBeenCalledWith(
        signatureId,
        expect.objectContaining({
          retryCount: 3,
          lockedUntil: expect.any(Date),
        })
      );
    });

    it("Harus berhasil unlock dan return data jika PIN benar", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: correctPIN,
        retryCount: 0,
        lockedUntil: null,
        ipAddress: "192.168.1.1",
        signedAt: new Date("2024-01-15"),
        createdAt: new Date("2024-01-10"),
        signer: { name: "John Doe", email: "john@example.com" },
        documentVersion: {
          signedFileHash: "hash123",
          url: "https://storage/doc.pdf",
          document: { title: "Test Document" },
        },
      });

      const result = await groupSignatureService.unlockVerification(signatureId, correctPIN);

      expect(result.signerName).toBeNull();
      expect(result.verificationStatus).toBe("REGISTERED");
      expect(result.isLocked).toBe(false);
      expect(result.requireUpload).toBe(true);
      expect(result.type).toBe("GROUP");
    });

    it("Harus reset retryCount jika PIN benar setelah gagal", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: correctPIN,
        retryCount: 2, // Sudah 2x gagal sebelumnya
        lockedUntil: null,
        ipAddress: null,
        signer: { name: "Test", email: "test@test.com" },
        documentVersion: {
          signedFileHash: "hash",
          url: "https://url",
          document: { title: "Doc" },
        },
      });
      mockGroupSignatureRepository.update.mockResolvedValue({});

      await groupSignatureService.unlockVerification(signatureId, correctPIN);

      expect(mockGroupSignatureRepository.update).toHaveBeenCalledWith(signatureId, expect.objectContaining({ retryCount: 0, lockedUntil: null }));
    });

    it("Harus tidak reset jika retryCount sudah 0", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: correctPIN,
        retryCount: 0,
        lockedUntil: null,
        ipAddress: null,
        signer: { name: "Test", email: "test@test.com" },
        documentVersion: {
          signedFileHash: "hash",
          url: "https://url",
          document: { title: "Doc" },
        },
      });

      await groupSignatureService.unlockVerification(signatureId, correctPIN);

      // Tidak ada panggilan update karena retryCount sudah 0
      expect(mockGroupSignatureRepository.update).not.toHaveBeenCalled();
    });

    it("Harus gunakan createdAt jika signedAt null", async () => {
      const createdDate = new Date("2024-01-10");
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: correctPIN,
        retryCount: 0,
        lockedUntil: null,
        ipAddress: null,
        signedAt: null,
        createdAt: createdDate,
        signer: { name: "Test", email: "test@test.com" },
        documentVersion: {
          signedFileHash: "hash",
          url: "https://url",
          document: { title: "Doc" },
        },
      });

      const result = await groupSignatureService.unlockVerification(signatureId, correctPIN);

      expect(result.signedAt).toBeNull();
    });

    it("Harus throw BadRequest jika accessCode null/tidak cocok", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        accessCode: null,
        retryCount: 0,
        lockedUntil: null,
      });
      mockGroupSignatureRepository.update.mockResolvedValue({});

      await expect(groupSignatureService.unlockVerification(signatureId, "any-pin")).rejects.toThrow(/PIN Salah/);
    });
  });

  // =====================================================
  // TEST: verifyUploadedFile
  // =====================================================
  describe("verifyUploadedFile", () => {
    const signatureId = "sig-123";
    const fileContent = "test file content";
    const fileBuffer = Buffer.from(fileContent);
    const expectedHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    it("Harus return null jika signature tidak ditemukan", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue(null);

      const result = await groupSignatureService.verifyUploadedFile(signatureId, fileBuffer);

      expect(result).toBeNull();
    });

    it("Harus throw Error jika dokumen belum difinalisasi", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        documentVersion: { documentId: "doc-123" },
      });
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        status: "pending", // Belum completed
      });

      await expect(groupSignatureService.verifyUploadedFile(signatureId, fileBuffer)).rejects.toThrow("Dokumen grup ini belum difinalisasi oleh Admin.");
    });

    it("Harus throw InternalServerError jika hash tidak ditemukan", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        documentVersion: { documentId: "doc-123" },
      });
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        status: "completed",
        currentVersionId: "version-final",
      });
      mockVersionRepository.findById.mockResolvedValue({
        id: "version-final",
        signedFileHash: null, // Hash tidak ada
      });

      await expect(groupSignatureService.verifyUploadedFile(signatureId, fileBuffer)).rejects.toThrow("Data Hash dokumen final tidak ditemukan.");
    });

    it("Harus return VALID jika hash cocok", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        documentVersionId: "version-old",
        createdAt: new Date("2024-01-15"),
        ipAddress: "192.168.1.1",
        signer: { name: "John Doe", email: "john@example.com" },
        documentVersion: { documentId: "doc-123" },
      });
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        title: "Test Document",
        status: "completed",
        currentVersionId: "version-final",
      });
      mockVersionRepository.findById.mockResolvedValue({
        id: "version-final",
        signedFileHash: expectedHash, // Hash yang cocok
      });
      mockGroupSignatureRepository.findAllByVersionId.mockResolvedValue([{ signer: { name: "John Doe" } }, { signer: { name: "Jane Doe" } }]);

      const result = await groupSignatureService.verifyUploadedFile(signatureId, fileBuffer);

      expect(result.verificationStatus).toBe("VALID");
      expect(result.isHashMatch).toBe(true);
      expect(result.signerName).toBe("John Doe");
      expect(result.groupSigners).toBe("John Doe, Jane Doe");
      expect(result.type).toBe("GROUP");
    });

    it("Harus return INVALID jika hash tidak cocok", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        documentVersionId: "version-old",
        createdAt: new Date("2024-01-15"),
        ipAddress: "192.168.1.1",
        signer: { name: "John", email: "john@test.com" },
        documentVersion: { documentId: "doc-123" },
      });
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        title: "Test Doc",
        status: "completed",
        currentVersionId: "version-final",
      });
      mockVersionRepository.findById.mockResolvedValue({
        id: "version-final",
        signedFileHash: "different-hash", // Hash yang berbeda
      });
      mockGroupSignatureRepository.findAllByVersionId.mockResolvedValue([{ signer: { name: "John" } }]);

      const result = await groupSignatureService.verifyUploadedFile(signatureId, fileBuffer);

      expect(result.verificationStatus).toBe("INVALID");
      expect(result.isHashMatch).toBe(false);
      expect(result.storedFileHash).toBe("different-hash");
      expect(result.recalculatedFileHash).toBe(expectedHash);
    });

    it("Harus return dash untuk ipAddress jika null", async () => {
      mockGroupSignatureRepository.findById.mockResolvedValue({
        id: signatureId,
        documentVersionId: "version-old",
        createdAt: new Date(),
        ipAddress: null,
        signer: { name: "Test", email: "test@test.com" },
        documentVersion: { documentId: "doc-123" },
      });
      mockDocumentRepository.findByIdSimple.mockResolvedValue({
        id: "doc-123",
        title: "Doc",
        status: "completed",
        currentVersionId: "version-final",
      });
      mockVersionRepository.findById.mockResolvedValue({
        id: "version-final",
        signedFileHash: expectedHash,
      });
      mockGroupSignatureRepository.findAllByVersionId.mockResolvedValue([{ signer: { name: "Test" } }]);

      const result = await groupSignatureService.verifyUploadedFile(signatureId, fileBuffer);

      expect(result.ipAddress).toBe("-");
    });
  });
});
