import { jest } from "@jest/globals";
import { createDocumentController } from "../../src/controllers/documentController.js";
import CommonError from "../../src/errors/CommonError.js";

// Mock aiService sebelum import controller
jest.mock("../../src/services/aiService.js", () => ({
  aiService: {
    analyzeDocumentContent: jest.fn(),
  },
}));

describe("DocumentController", () => {
  let documentController;
  let mockDocumentService;
  let mockSignatureRepository;
  let mockFileStorage;
  let mockAiService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get the mocked aiService
    const { aiService } = require("../../src/services/aiService.js");
    mockAiService = aiService;

    // Mock services
    mockDocumentService = {
      createDocument: jest.fn(),
      getAllDocuments: jest.fn(),
      getDocumentById: jest.fn(),
      updateDocument: jest.fn(),
      deleteDocument: jest.fn(),
      getDocumentHistory: jest.fn(),
      useOldVersion: jest.fn(),
      deleteVersion: jest.fn(),
      getDocumentFileUrl: jest.fn(),
      getVersionFileUrl: jest.fn(),
    };

    mockSignatureRepository = {};
    mockFileStorage = {};

    documentController = createDocumentController(mockDocumentService, mockSignatureRepository, mockFileStorage);

    // Mock request/response
    mockReq = {
      user: { id: "user-123" },
      params: {},
      body: {},
      query: {},
      file: null,
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  // Helper function untuk menjalankan asyncHandler
  const runController = (controllerMethod) => {
    return new Promise((resolve, reject) => {
      const originalJson = mockRes.json;
      mockRes.json = jest.fn((data) => {
        originalJson.call(mockRes, data);
        resolve(data);
        return mockRes;
      });

      // Override mockNext untuk reject saat ada error
      mockNext = jest.fn((error) => {
        if (error) {
          reject(error);
        }
      });

      const result = controllerMethod(mockReq, mockRes, mockNext);
      if (result && typeof result.then === "function") {
        result
          .then(() => {
            // Jika promise resolve tapi json belum dipanggil, resolve undefined
          })
          .catch(reject);
      }
    });
  };

  describe("createDocument", () => {
    it("Harus berhasil membuat dokumen baru", async () => {
      mockReq.body = { title: "Dokumen Test", type: "kontrak" };
      mockReq.file = { buffer: Buffer.from("pdf-content"), originalname: "test.pdf" };

      const mockDocument = {
        id: "doc-123",
        title: "Dokumen Test",
        type: "kontrak",
        userId: "user-123",
      };
      mockDocumentService.createDocument.mockResolvedValue(mockDocument);

      await runController(documentController.createDocument);

      expect(mockDocumentService.createDocument).toHaveBeenCalledWith("user-123", mockReq.file, "Dokumen Test", "kontrak");
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen berhasil diunggah.",
        data: mockDocument,
      });
    });

    it("Harus throw error jika service gagal", async () => {
      mockReq.body = { title: "Dokumen Test" };
      mockReq.file = { buffer: Buffer.from("pdf-content") };

      mockDocumentService.createDocument.mockRejectedValue(CommonError.BadRequest("Upload gagal"));

      await expect(runController(documentController.createDocument)).rejects.toThrow(CommonError.BadRequest("Upload gagal"));
    });
  });

  describe("getAllDocuments", () => {
    it("Harus mengembalikan semua dokumen user", async () => {
      const mockDocuments = [
        { id: "doc-1", title: "Doc 1" },
        { id: "doc-2", title: "Doc 2" },
      ];
      mockDocumentService.getAllDocuments.mockResolvedValue(mockDocuments);

      await runController(documentController.getAllDocuments);

      expect(mockDocumentService.getAllDocuments).toHaveBeenCalledWith("user-123", "");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: mockDocuments,
      });
    });

    it("Harus mendukung parameter search", async () => {
      mockReq.query.search = "kontrak";
      mockDocumentService.getAllDocuments.mockResolvedValue([]);

      await runController(documentController.getAllDocuments);

      expect(mockDocumentService.getAllDocuments).toHaveBeenCalledWith("user-123", "kontrak");
    });

    it("Harus mengembalikan array kosong jika tidak ada dokumen", async () => {
      mockDocumentService.getAllDocuments.mockResolvedValue([]);

      await runController(documentController.getAllDocuments);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: [],
      });
    });
  });

  describe("getDocumentById", () => {
    it("Harus mengembalikan dokumen berdasarkan ID", async () => {
      mockReq.params.id = "doc-123";

      const mockDocument = { id: "doc-123", title: "Test Doc", userId: "user-123" };
      mockDocumentService.getDocumentById.mockResolvedValue(mockDocument);

      await runController(documentController.getDocumentById);

      expect(mockDocumentService.getDocumentById).toHaveBeenCalledWith("doc-123", "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: mockDocument,
      });
    });

    it("Harus return 401 jika userId tidak ada", async () => {
      mockReq.user = {};
      mockReq.params.id = "doc-123";

      await runController(documentController.getDocumentById);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unauthorized: User ID tidak ditemukan.",
      });
    });

    it("Harus throw error jika dokumen tidak ditemukan", async () => {
      mockReq.params.id = "doc-not-exist";

      mockDocumentService.getDocumentById.mockRejectedValue(CommonError.NotFound("Dokumen tidak ditemukan"));

      await expect(runController(documentController.getDocumentById)).rejects.toThrow(CommonError.NotFound("Dokumen tidak ditemukan"));
    });
  });

  describe("updateDocument", () => {
    it("Harus berhasil update dokumen", async () => {
      mockReq.params.id = "doc-123";
      mockReq.body = { title: "Updated Title" };

      const updatedDoc = { id: "doc-123", title: "Updated Title" };
      mockDocumentService.updateDocument.mockResolvedValue(updatedDoc);

      await runController(documentController.updateDocument);

      expect(mockDocumentService.updateDocument).toHaveBeenCalledWith("doc-123", "user-123", { title: "Updated Title" });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen berhasil diperbaharui.",
        data: updatedDoc,
      });
    });

    it("Harus throw error jika update gagal", async () => {
      mockReq.params.id = "doc-123";
      mockReq.body = { title: "New Title" };

      mockDocumentService.updateDocument.mockRejectedValue(CommonError.Forbidden("Tidak memiliki akses"));

      await expect(runController(documentController.updateDocument)).rejects.toThrow(CommonError.Forbidden("Tidak memiliki akses"));
    });
  });

  describe("deleteDocument", () => {
    it("Harus berhasil menghapus dokumen", async () => {
      mockReq.params.id = "doc-123";
      mockDocumentService.deleteDocument.mockResolvedValue(true);

      await runController(documentController.deleteDocument);

      expect(mockDocumentService.deleteDocument).toHaveBeenCalledWith("doc-123", "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen dan semua riwayatnya berhasil dihapus.",
      });
    });

    it("Harus throw error jika dokumen tidak ditemukan", async () => {
      mockReq.params.id = "doc-not-exist";

      mockDocumentService.deleteDocument.mockRejectedValue(CommonError.NotFound("Dokumen tidak ditemukan"));

      await expect(runController(documentController.deleteDocument)).rejects.toThrow(CommonError.NotFound("Dokumen tidak ditemukan"));
    });
  });

  describe("getDocumentHistory", () => {
    it("Harus mengembalikan riwayat versi dokumen", async () => {
      mockReq.params.documentId = "doc-123";

      const mockHistory = [
        { id: "ver-1", versionNumber: 1, createdAt: new Date() },
        { id: "ver-2", versionNumber: 2, createdAt: new Date() },
      ];
      mockDocumentService.getDocumentHistory.mockResolvedValue(mockHistory);

      await runController(documentController.getDocumentHistory);

      expect(mockDocumentService.getDocumentHistory).toHaveBeenCalledWith("doc-123", "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: mockHistory,
      });
    });

    it("Harus throw error jika dokumen tidak ditemukan", async () => {
      mockReq.params.documentId = "doc-not-exist";

      mockDocumentService.getDocumentHistory.mockRejectedValue(CommonError.NotFound("Dokumen tidak ditemukan"));

      await expect(runController(documentController.getDocumentHistory)).rejects.toThrow(CommonError.NotFound("Dokumen tidak ditemukan"));
    });
  });

  describe("useOldVersion", () => {
    it("Harus berhasil rollback ke versi lama", async () => {
      mockReq.params.documentId = "doc-123";
      mockReq.params.versionId = "ver-1";

      const updatedDoc = { id: "doc-123", currentVersionId: "ver-1" };
      mockDocumentService.useOldVersion.mockResolvedValue(updatedDoc);

      await runController(documentController.useOldVersion);

      expect(mockDocumentService.useOldVersion).toHaveBeenCalledWith("doc-123", "ver-1", "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Versi dokumen berhasil diganti.",
        data: updatedDoc,
      });
    });

    it("Harus throw error jika versi tidak ditemukan", async () => {
      mockReq.params.documentId = "doc-123";
      mockReq.params.versionId = "ver-not-exist";

      mockDocumentService.useOldVersion.mockRejectedValue(CommonError.NotFound("Versi tidak ditemukan"));

      await expect(runController(documentController.useOldVersion)).rejects.toThrow(CommonError.NotFound("Versi tidak ditemukan"));
    });
  });

  describe("deleteVersion", () => {
    it("Harus berhasil menghapus versi dokumen", async () => {
      mockReq.params.documentId = "doc-123";
      mockReq.params.versionId = "ver-2";

      mockDocumentService.deleteVersion.mockResolvedValue(true);

      await runController(documentController.deleteVersion);

      expect(mockDocumentService.deleteVersion).toHaveBeenCalledWith("doc-123", "ver-2", "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Versi dokumen berhasil dihapus.",
      });
    });

    it("Harus throw error jika tidak bisa menghapus versi terakhir", async () => {
      mockReq.params.documentId = "doc-123";
      mockReq.params.versionId = "ver-1";

      mockDocumentService.deleteVersion.mockRejectedValue(CommonError.BadRequest("Tidak dapat menghapus versi satu-satunya"));

      await expect(runController(documentController.deleteVersion)).rejects.toThrow(CommonError.BadRequest("Tidak dapat menghapus versi satu-satunya"));
    });
  });

  describe("getDocumentFile", () => {
    it("Harus mengembalikan signed URL untuk view", async () => {
      mockReq.params.documentId = "doc-123";
      mockReq.query.purpose = "view";

      mockDocumentService.getDocumentFileUrl.mockResolvedValue("https://storage.example.com/signed-url");

      await runController(documentController.getDocumentFile);

      expect(mockDocumentService.getDocumentFileUrl).toHaveBeenCalledWith("doc-123", "user-123", false);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        url: "https://storage.example.com/signed-url",
        mode: "view",
      });
    });

    it("Harus mengembalikan signed URL untuk download", async () => {
      mockReq.params.documentId = "doc-123";
      mockReq.query.purpose = "download";

      mockDocumentService.getDocumentFileUrl.mockResolvedValue("https://storage.example.com/download-url");

      await runController(documentController.getDocumentFile);

      expect(mockDocumentService.getDocumentFileUrl).toHaveBeenCalledWith("doc-123", "user-123", true);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        url: "https://storage.example.com/download-url",
        mode: "download",
      });
    });

    it("Harus throw error jika dokumen tidak ditemukan", async () => {
      mockReq.params.documentId = "doc-not-exist";

      mockDocumentService.getDocumentFileUrl.mockRejectedValue(CommonError.NotFound("Dokumen tidak ditemukan"));

      await expect(runController(documentController.getDocumentFile)).rejects.toThrow(CommonError.NotFound("Dokumen tidak ditemukan"));
    });
  });

  describe("getVersionFile", () => {
    it("Harus mengembalikan signed URL untuk versi tertentu", async () => {
      mockReq.params.documentId = "doc-123";
      mockReq.params.versionId = "ver-1";

      mockDocumentService.getVersionFileUrl.mockResolvedValue("https://storage.example.com/version-url");

      await runController(documentController.getVersionFile);

      expect(mockDocumentService.getVersionFileUrl).toHaveBeenCalledWith("doc-123", "ver-1", "user-123", true);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        url: "https://storage.example.com/version-url",
        expiresIn: 60,
        mode: "download",
      });
    });

    it("Harus throw error jika versi tidak ditemukan", async () => {
      mockReq.params.documentId = "doc-123";
      mockReq.params.versionId = "ver-not-exist";

      mockDocumentService.getVersionFileUrl.mockRejectedValue(CommonError.NotFound("Versi tidak ditemukan"));

      await expect(runController(documentController.getVersionFile)).rejects.toThrow(CommonError.NotFound("Versi tidak ditemukan"));
    });
  });

  describe("analyzeDocument", () => {
    beforeEach(() => {
      mockReq.params.documentId = "doc-123";
    });

    it("Harus return 404 jika dokumen tidak ditemukan", async () => {
      mockDocumentService.getDocumentById.mockResolvedValue(null);

      await runController(documentController.analyzeDocument);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Dokumen tidak ditemukan.",
      });
    });

    it("Harus return 200 ketika analisis berhasil dengan valid URL", async () => {
      const mockDoc = { id: "doc-123", type: "kontrak" };
      const mockUrl = "http://storage.example.com/doc-123.pdf?token=xyz";
      const mockResult = { summary: "Summary", sentiment: "positive" };

      mockDocumentService.getDocumentById.mockResolvedValue(mockDoc);
      mockDocumentService.getDocumentFileUrl.mockResolvedValue(mockUrl);
      mockAiService.analyzeDocumentContent.mockResolvedValue(mockResult);

      await runController(documentController.analyzeDocument);

      expect(mockAiService.analyzeDocumentContent).toHaveBeenCalledWith(mockUrl, "url", "kontrak");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: mockResult,
      });
    });

    it("Harus return 400 ketika AI mengembalikan error", async () => {
      const mockDoc = { id: "doc-123", type: "kontrak" };
      const mockUrl = "http://storage.example.com/doc-123.pdf?token=xyz";
      const mockError = { error: "AI service timeout" };

      mockDocumentService.getDocumentById.mockResolvedValue(mockDoc);
      mockDocumentService.getDocumentFileUrl.mockResolvedValue(mockUrl);
      mockAiService.analyzeDocumentContent.mockResolvedValue(mockError);

      await runController(documentController.analyzeDocument);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "AI service timeout",
      });
    });

    it("Harus return 400 ketika AI mengembalikan null", async () => {
      const mockDoc = { id: "doc-123", type: "kontrak" };
      const mockUrl = "http://storage.example.com/doc-123.pdf?token=xyz";

      mockDocumentService.getDocumentById.mockResolvedValue(mockDoc);
      mockDocumentService.getDocumentFileUrl.mockResolvedValue(mockUrl);
      mockAiService.analyzeDocumentContent.mockResolvedValue(null);

      await runController(documentController.analyzeDocument);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Gagal menganalisis dokumen (AI tidak merespons).",
      });
    });

    it("Harus handle error ketika getDocumentFileUrl gagal", async () => {
      const mockDoc = { id: "doc-123", type: "kontrak" };

      mockDocumentService.getDocumentById.mockResolvedValue(mockDoc);
      mockDocumentService.getDocumentFileUrl.mockRejectedValue(new Error("Storage error"));
      mockAiService.analyzeDocumentContent.mockResolvedValue({ summary: "test" });

      await runController(documentController.analyzeDocument);

      // Harus tetap mencoba memanggil aiService dengan sourceData undefined
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus set NODE_ENV production dan mask URL", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const mockDoc = { id: "doc-123", type: "kontrak" };
      const mockUrl = "http://storage.example.com/doc-123.pdf?token=xyz";
      const mockResult = { summary: "Summary" };

      mockDocumentService.getDocumentById.mockResolvedValue(mockDoc);
      mockDocumentService.getDocumentFileUrl.mockResolvedValue(mockUrl);
      mockAiService.analyzeDocumentContent.mockResolvedValue(mockResult);

      await runController(documentController.analyzeDocument);

      expect(mockRes.status).toHaveBeenCalledWith(200);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("updateDocument - Conditional Branches", () => {
    beforeEach(() => {
      mockReq.params.id = "doc-123";
      mockReq.body = { title: "Updated Title" };
    });

    it("Harus return 200 ketika update dokumen berhasil", async () => {
      const mockUpdatedDoc = { id: "doc-123", title: "Updated Title" };
      mockDocumentService.updateDocument.mockResolvedValue(mockUpdatedDoc);

      await runController(documentController.updateDocument);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen berhasil diperbaharui.",
        data: mockUpdatedDoc,
      });
    });
  });

  describe("deleteDocument - Conditional Branches", () => {
    beforeEach(() => {
      mockReq.params.id = "doc-123";
    });

    it("Harus return 200 ketika delete dokumen berhasil", async () => {
      mockDocumentService.deleteDocument.mockResolvedValue(true);

      await runController(documentController.deleteDocument);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen dan semua riwayatnya berhasil dihapus.",
      });
    });
  });

  describe("getDocumentHistory - Conditional Branches", () => {
    beforeEach(() => {
      mockReq.params.documentId = "doc-123";
    });

    it("Harus return 200 dengan history dokumen", async () => {
      const mockHistory = { id: "doc-123", versions: [] };
      mockDocumentService.getDocumentHistory.mockResolvedValue(mockHistory);

      await runController(documentController.getDocumentHistory);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: mockHistory,
      });
    });
  });

  describe("useOldVersion - Conditional Branches", () => {
    beforeEach(() => {
      mockReq.params.documentId = "doc-123";
      mockReq.params.versionId = "ver-456";
    });

    it("Harus return 200 ketika restore version berhasil", async () => {
      const mockUpdated = { id: "doc-123", title: "Updated" };
      mockDocumentService.useOldVersion.mockResolvedValue(mockUpdated);

      await runController(documentController.useOldVersion);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Versi dokumen berhasil diganti.",
        data: mockUpdated,
      });
    });
  });

  describe("deleteVersion - Conditional Branches", () => {
    beforeEach(() => {
      mockReq.params.documentId = "doc-123";
      mockReq.params.versionId = "ver-456";
    });

    it("Harus return 200 ketika delete version berhasil", async () => {
      mockDocumentService.deleteVersion.mockResolvedValue(true);

      await runController(documentController.deleteVersion);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Versi dokumen berhasil dihapus.",
      });
    });
  });

  describe("getDocumentFile - Conditional Branches", () => {
    beforeEach(() => {
      mockReq.params.documentId = "doc-123";
      mockReq.query = { purpose: "download" };
    });

    it("Harus return 200 dengan signed URL untuk download", async () => {
      const mockUrl = "http://storage.example.com/doc-123.pdf?token=xyz";
      mockDocumentService.getDocumentFileUrl.mockResolvedValue(mockUrl);

      await runController(documentController.getDocumentFile);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        url: mockUrl,
        mode: "download",
      });
    });

    it("Harus return 200 dengan signed URL untuk view", async () => {
      const mockUrl = "http://storage.example.com/doc-123.pdf?token=xyz";
      mockReq.query = { purpose: "view" };
      mockDocumentService.getDocumentFileUrl.mockResolvedValue(mockUrl);

      await runController(documentController.getDocumentFile);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        url: mockUrl,
        mode: "view",
      });
    });
  });
});
