import { jest } from "@jest/globals";
import { createGroupSignatureController } from "../../src/controllers/groupSignatureController.js";

describe("GroupSignatureController", () => {
  let controller;
  let mockGroupSignatureService;
  let mockGroupService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Mock service
    mockGroupSignatureService = {
      signDocument: jest.fn(),
      saveDraft: jest.fn(),
      updateDraftPosition: jest.fn(),
      deleteDraft: jest.fn(),
    };

    // Mock groupService untuk finalizeGroupDocument
    mockGroupService = {
      finalizeGroupDocument: jest.fn(),
    };

    // Create controller instance
    controller = createGroupSignatureController(mockGroupSignatureService, mockGroupService);

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
      originalUrl: "/api/group-signatures/test",
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
  // SIGN DOCUMENT
  // ==========================================================================
  describe("signDocument", () => {
    it("Harus return 400 jika documentId tidak ada", async () => {
      mockReq.params = {};
      mockReq.body = { signatureImageUrl: "data:image/png;base64,..." };

      await controller.signDocument(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "documentId wajib diisi.",
      });
    });

    it("Harus return 400 jika signatureImageUrl tidak ada", async () => {
      mockReq.params = { documentId: "doc-123" };
      mockReq.body = {};

      await controller.signDocument(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Data gambar tanda tangan wajib diisi.",
      });
    });

    it("Harus berhasil sign document dan return 200", async () => {
      mockReq.params = { documentId: "doc-123" };
      mockReq.body = {
        id: "sig-uuid",
        signatureImageUrl: "data:image/png;base64,...",
        positionX: 100,
        positionY: 200,
        pageNumber: 1,
        width: 150,
        height: 50,
        method: "draw",
      };

      mockGroupSignatureService.signDocument.mockResolvedValue({
        message: "Tanda tangan berhasil disimpan",
        isComplete: false,
        remainingSigners: 2,
        readyToFinalize: false,
      });

      await controller.signDocument(mockReq, mockRes, mockNext);

      expect(mockGroupSignatureService.signDocument).toHaveBeenCalledWith(
        "user-123",
        "doc-123",
        expect.objectContaining({
          id: "sig-uuid",
          signatureImageUrl: "data:image/png;base64,...",
          positionX: 100,
          positionY: 200,
          pageNumber: 1,
          width: 150,
          height: 50,
          method: "draw",
        }),
        expect.objectContaining({
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0 Test Browser",
        }),
        mockReq
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Tanda tangan berhasil disimpan",
        data: {
          isComplete: false,
          remainingSigners: 2,
          readyToFinalize: false,
        },
      });
    });

    it("Harus menggunakan documentId dari body jika tidak ada di params", async () => {
      mockReq.params = {};
      mockReq.body = {
        documentId: "doc-from-body",
        signatureImageUrl: "data:image/png;base64,...",
      };

      mockGroupSignatureService.signDocument.mockResolvedValue({
        message: "Success",
        isComplete: true,
        remainingSigners: 0,
        readyToFinalize: true,
      });

      await controller.signDocument(mockReq, mockRes, mockNext);

      expect(mockGroupSignatureService.signDocument).toHaveBeenCalledWith("user-123", "doc-from-body", expect.anything(), expect.anything(), mockReq);
    });

    it("Harus propagate error ke asyncHandler jika service gagal", async () => {
      mockReq.params = { documentId: "doc-123" };
      mockReq.body = { signatureImageUrl: "data:image/png;base64,..." };

      const serviceError = new Error("Service Error");
      mockGroupSignatureService.signDocument.mockRejectedValue(serviceError);

      // asyncHandler akan catch error dan pass ke next
      // Error tetap thrown dari controller, dihandle oleh asyncHandler
      try {
        await controller.signDocument(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toBe("Service Error");
      }
    });

    it("Harus menggunakan req.ip jika x-forwarded-for tidak ada", async () => {
      mockReq.headers = { "user-agent": "Test" };
      mockReq.params = { documentId: "doc-123" };
      mockReq.body = { signatureImageUrl: "data:image/png;base64,..." };

      mockGroupSignatureService.signDocument.mockResolvedValue({
        message: "Success",
        isComplete: false,
        remainingSigners: 1,
        readyToFinalize: false,
      });

      await controller.signDocument(mockReq, mockRes, mockNext);

      expect(mockGroupSignatureService.signDocument).toHaveBeenCalledWith(
        "user-123",
        "doc-123",
        expect.anything(),
        expect.objectContaining({
          ipAddress: "127.0.0.1",
        }),
        mockReq
      );
    });

    it("Harus mengambil IP pertama dari x-forwarded-for jika ada multiple IPs", async () => {
      mockReq.headers = {
        "x-forwarded-for": "10.0.0.1, 192.168.1.1, 172.16.0.1",
        "user-agent": "Test",
      };
      mockReq.params = { documentId: "doc-123" };
      mockReq.body = { signatureImageUrl: "data:image/png;base64,..." };

      mockGroupSignatureService.signDocument.mockResolvedValue({
        message: "Success",
        isComplete: false,
        remainingSigners: 1,
        readyToFinalize: false,
      });

      await controller.signDocument(mockReq, mockRes, mockNext);

      expect(mockGroupSignatureService.signDocument).toHaveBeenCalledWith(
        "user-123",
        "doc-123",
        expect.anything(),
        expect.objectContaining({
          ipAddress: "10.0.0.1",
        }),
        mockReq
      );
    });
  });

  // ==========================================================================
  // SAVE DRAFT
  // ==========================================================================
  describe("saveDraft", () => {
    it("Harus return 400 jika documentId tidak ada di params", async () => {
      mockReq.params = {};
      mockReq.body = { signatureImageUrl: "data:image/png;base64,..." };

      await controller.saveDraft(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Document ID wajib ada.",
      });
    });

    it("Harus berhasil save draft dan return 201", async () => {
      mockReq.params = { documentId: "doc-123" };
      mockReq.body = {
        id: "draft-uuid",
        signatureImageUrl: "data:image/png;base64,...",
        pageNumber: 1,
        positionX: 100,
        positionY: 200,
        width: 150,
        height: 50,
        method: "upload",
      };

      const mockResult = {
        id: "draft-uuid",
        documentId: "doc-123",
        signatureImageUrl: "data:image/png;base64,...",
        pageNumber: 1,
        positionX: 100,
        positionY: 200,
        width: 150,
        height: 50,
      };

      mockGroupSignatureService.saveDraft.mockResolvedValue(mockResult);

      await controller.saveDraft(mockReq, mockRes, mockNext);

      expect(mockGroupSignatureService.saveDraft).toHaveBeenCalledWith(
        "user-123",
        "doc-123",
        expect.objectContaining({
          id: "draft-uuid",
          signatureImageUrl: "data:image/png;base64,...",
          pageNumber: 1,
          positionX: 100,
          positionY: 200,
          width: 150,
          height: 50,
          method: "upload",
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0 Test Browser",
        })
      );

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Draft tanda tangan tersimpan.",
        data: mockResult,
      });
    });

    it("Harus propagate error ke asyncHandler jika service gagal", async () => {
      mockReq.params = { documentId: "doc-123" };
      mockReq.body = { signatureImageUrl: "data:image/png;base64,..." };

      const serviceError = new Error("Draft Save Failed");
      mockGroupSignatureService.saveDraft.mockRejectedValue(serviceError);

      try {
        await controller.saveDraft(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toBe("Draft Save Failed");
      }
    });
  });

  // ==========================================================================
  // UPDATE DRAFT POSITION
  // ==========================================================================
  describe("updateDraftPosition", () => {
    it("Harus return 400 jika signatureId tidak ada", async () => {
      mockReq.params = {};
      mockReq.body = { positionX: 100, positionY: 200 };

      await controller.updateDraftPosition(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Signature ID wajib ada.",
      });
    });

    it("Harus berhasil update position dan return 200", async () => {
      mockReq.params = { signatureId: "sig-123" };
      mockReq.body = {
        positionX: 150,
        positionY: 250,
        width: 200,
        height: 75,
        pageNumber: 2,
      };

      const mockResult = {
        id: "sig-123",
        positionX: 150,
        positionY: 250,
        width: 200,
        height: 75,
        pageNumber: 2,
      };

      mockGroupSignatureService.updateDraftPosition.mockResolvedValue(mockResult);

      await controller.updateDraftPosition(mockReq, mockRes, mockNext);

      expect(mockGroupSignatureService.updateDraftPosition).toHaveBeenCalledWith("sig-123", {
        positionX: 150,
        positionY: 250,
        width: 200,
        height: 75,
        pageNumber: 2,
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Posisi tanda tangan diperbarui.",
        data: mockResult,
      });
    });

    it("Harus return 200 dengan pesan khusus jika result null (tidak ditemukan)", async () => {
      mockReq.params = { signatureId: "sig-not-found" };
      mockReq.body = { positionX: 100, positionY: 200 };

      mockGroupSignatureService.updateDraftPosition.mockResolvedValue(null);

      await controller.updateDraftPosition(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Posisi diupdate (atau data tidak ditemukan).",
      });
    });

    it("Harus ignore width/height jika tidak valid (0 atau negatif)", async () => {
      mockReq.params = { signatureId: "sig-123" };
      mockReq.body = {
        positionX: 100,
        positionY: 200,
        width: 0,
        height: -50,
        pageNumber: 1,
      };

      mockGroupSignatureService.updateDraftPosition.mockResolvedValue({ id: "sig-123" });

      await controller.updateDraftPosition(mockReq, mockRes, mockNext);

      expect(mockGroupSignatureService.updateDraftPosition).toHaveBeenCalledWith("sig-123", {
        positionX: 100,
        positionY: 200,
        width: undefined,
        height: undefined,
        pageNumber: 1,
      });
    });

    it("Harus propagate error ke asyncHandler jika service gagal", async () => {
      mockReq.params = { signatureId: "sig-123" };
      mockReq.body = { positionX: 100 };

      const serviceError = new Error("Update Failed");
      mockGroupSignatureService.updateDraftPosition.mockRejectedValue(serviceError);

      try {
        await controller.updateDraftPosition(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toBe("Update Failed");
      }
    });
  });

  // ==========================================================================
  // DELETE DRAFT
  // ==========================================================================
  describe("deleteDraft", () => {
    it("Harus return 400 jika signatureId tidak ada", async () => {
      mockReq.params = {};

      await controller.deleteDraft(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Signature ID wajib ada.",
      });
    });

    it("Harus berhasil delete draft dan return 200", async () => {
      mockReq.params = { signatureId: "sig-123" };

      mockGroupSignatureService.deleteDraft.mockResolvedValue(true);

      await controller.deleteDraft(mockReq, mockRes, mockNext);

      expect(mockGroupSignatureService.deleteDraft).toHaveBeenCalledWith("sig-123");

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Draft tanda tangan dihapus.",
      });
    });

    it("Harus propagate error ke asyncHandler jika service gagal", async () => {
      mockReq.params = { signatureId: "sig-123" };

      const serviceError = new Error("Delete Failed");
      mockGroupSignatureService.deleteDraft.mockRejectedValue(serviceError);

      try {
        await controller.deleteDraft(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toBe("Delete Failed");
      }
    });
  });

  // ==========================================================================
  // FINALIZE GROUP DOCUMENT
  // ==========================================================================
  describe("finalizeGroupDocument", () => {
    it("Harus return 400 jika groupId tidak ada", async () => {
      mockReq.body = { documentId: "doc-123" };

      await controller.finalizeGroupDocument(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Group ID dan Document ID wajib ada.",
      });
    });

    it("Harus return 400 jika documentId tidak ada", async () => {
      mockReq.body = { groupId: "group-123" };

      await controller.finalizeGroupDocument(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Group ID dan Document ID wajib ada.",
      });
    });

    it("Harus return 400 jika keduanya tidak ada", async () => {
      mockReq.body = {};

      await controller.finalizeGroupDocument(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Group ID dan Document ID wajib ada.",
      });
    });

    it("Harus berhasil finalize dan return 200", async () => {
      mockReq.body = { groupId: "group-123", documentId: "doc-123" };

      mockGroupService.finalizeGroupDocument.mockResolvedValue({
        message: "Dokumen grup berhasil difinalisasi.",
        url: "https://storage/signed-doc.pdf",
        accessCode: "ABC123",
      });

      await controller.finalizeGroupDocument(mockReq, mockRes, mockNext);

      expect(mockGroupService.finalizeGroupDocument).toHaveBeenCalledWith("group-123", "doc-123", "user-123");

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen grup berhasil difinalisasi.",
        data: {
          url: "https://storage/signed-doc.pdf",
          accessCode: "ABC123",
        },
      });
    });

    it("Harus propagate error ke asyncHandler jika service gagal", async () => {
      mockReq.body = { groupId: "group-123", documentId: "doc-123" };

      const serviceError = new Error("Finalize Failed");
      mockGroupService.finalizeGroupDocument.mockRejectedValue(serviceError);

      try {
        await controller.finalizeGroupDocument(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toBe("Finalize Failed");
      }
    });
  });

  // ==========================================================================
  // HELPER: getRealIpAddress
  // ==========================================================================
  describe("getRealIpAddress (via signDocument)", () => {
    beforeEach(() => {
      mockReq.params = { documentId: "doc-123" };
      mockReq.body = { signatureImageUrl: "data:image/png;base64,..." };
      mockGroupSignatureService.signDocument.mockResolvedValue({
        message: "Success",
        isComplete: false,
        remainingSigners: 1,
        readyToFinalize: false,
      });
    });

    it("Harus gunakan x-forwarded-for jika ada", async () => {
      mockReq.headers = {
        "x-forwarded-for": "203.0.113.195",
        "user-agent": "Test",
      };

      await controller.signDocument(mockReq, mockRes, mockNext);

      expect(mockGroupSignatureService.signDocument).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({ ipAddress: "203.0.113.195" }), expect.anything());
    });

    it("Harus gunakan req.ip jika x-forwarded-for tidak ada", async () => {
      mockReq.headers = { "user-agent": "Test" };
      mockReq.ip = "10.0.0.5";

      await controller.signDocument(mockReq, mockRes, mockNext);

      expect(mockGroupSignatureService.signDocument).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({ ipAddress: "10.0.0.5" }), expect.anything());
    });

    it("Harus gunakan connection.remoteAddress sebagai fallback terakhir", async () => {
      mockReq.headers = { "user-agent": "Test" };
      mockReq.ip = undefined;
      mockReq.connection = { remoteAddress: "192.168.0.100" };

      await controller.signDocument(mockReq, mockRes, mockNext);

      expect(mockGroupSignatureService.signDocument).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({ ipAddress: "192.168.0.100" }), expect.anything());
    });
  });
});
