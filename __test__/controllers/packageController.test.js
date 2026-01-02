/**
 * Unit Tests for PackageController
 *
 * @file packageController.test.js
 * @description Tests for PackageController methods:
 *  - createPackage: Create signature package with multiple documents
 *  - getPackageDetails: Get full package information
 *  - signPackage: Sign all documents in a package
 */

import { jest } from "@jest/globals";
import { createPackageController } from "../../src/controllers/packageController.js";
import CommonError from "../../src/errors/CommonError.js";

describe("PackageController", () => {
  let packageController;
  let mockPackageService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock services
    mockPackageService = {
      createPackage: jest.fn(),
      getPackageDetails: jest.fn(),
      signPackage: jest.fn(),
    };

    packageController = createPackageController(mockPackageService);

    // Mock request/response
    mockReq = {
      user: { id: "user-123" },
      params: {},
      body: {},
      query: {},
      headers: {},
      ip: "192.168.1.1",
      connection: { remoteAddress: "192.168.1.1" },
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

  describe("createPackage", () => {
    beforeEach(() => {
      mockReq.body = {
        documentIds: ["doc-1", "doc-2", "doc-3"],
        title: "Paket Kontrak Kerjasama",
      };
    });

    it("Harus berhasil membuat paket baru dengan array dokumen", async () => {
      const mockPackage = {
        id: "pkg-123",
        title: "Paket Kontrak Kerjasama",
        documentIds: ["doc-1", "doc-2", "doc-3"],
        userId: "user-123",
        createdAt: new Date(),
      };

      mockPackageService.createPackage.mockResolvedValue(mockPackage);

      await runController(packageController.createPackage);

      expect(mockPackageService.createPackage).toHaveBeenCalledWith("user-123", "Paket Kontrak Kerjasama", ["doc-1", "doc-2", "doc-3"]);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Paket berhasil dibuat.",
        data: mockPackage,
      });
    });

    it("Harus return 400 ketika documentIds tidak diisi", async () => {
      mockReq.body = { documentIds: null, title: "Paket Test" };

      try {
        await runController(packageController.createPackage);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(400);
        expect(error.message).toContain("documentIds");
      }
    });

    it("Harus return 400 ketika documentIds bukan array", async () => {
      mockReq.body = {
        documentIds: "doc-1",
        title: "Paket Test",
      };

      try {
        await runController(packageController.createPackage);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(400);
      }
    });

    it("Harus return 400 ketika documentIds array kosong", async () => {
      mockReq.body = {
        documentIds: [],
        title: "Paket Test",
      };

      try {
        await runController(packageController.createPackage);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(400);
      }
    });

    it("Harus return 400 ketika documentIds undefined", async () => {
      mockReq.body = { title: "Paket Test" };

      try {
        await runController(packageController.createPackage);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(400);
      }
    });
  });

  describe("getPackageDetails", () => {
    beforeEach(() => {
      mockReq.params = { packageId: "pkg-123" };
    });

    it("Harus return 200 dengan detail paket lengkap", async () => {
      const mockPackageDetails = {
        id: "pkg-123",
        title: "Paket Kontrak",
        userId: "user-123",
        documents: [
          { id: "doc-1", title: "Kontrak.pdf", status: "signed" },
          { id: "doc-2", title: "Lampiran.pdf", status: "pending" },
        ],
        status: "in-progress",
        createdAt: new Date(),
      };

      mockPackageService.getPackageDetails.mockResolvedValue(mockPackageDetails);

      await runController(packageController.getPackageDetails);

      expect(mockPackageService.getPackageDetails).toHaveBeenCalledWith("pkg-123", "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: mockPackageDetails,
      });
    });

    it("Harus handle error ketika paket tidak ditemukan", async () => {
      const error = new Error("Paket tidak ditemukan");
      error.statusCode = 404;
      mockPackageService.getPackageDetails.mockRejectedValue(error);

      try {
        await runController(packageController.getPackageDetails);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(404);
      }
    });

    it("Harus return 200 untuk paket dengan single dokumen", async () => {
      const mockPackageDetails = {
        id: "pkg-456",
        title: "Paket Single",
        userId: "user-123",
        documents: [{ id: "doc-5", title: "Single.pdf", status: "pending" }],
        status: "pending",
      };

      mockPackageService.getPackageDetails.mockResolvedValue(mockPackageDetails);

      await runController(packageController.getPackageDetails);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: mockPackageDetails,
      });
    });
  });

  describe("signPackage", () => {
    beforeEach(() => {
      mockReq.params = { packageId: "pkg-123" };
      mockReq.body = {
        signatures: [
          {
            documentId: "doc-1",
            signatureImage: "data:image/png;base64,iVBORw0KGgo=",
            x: 100,
            y: 150,
          },
          {
            documentId: "doc-2",
            signatureImage: "data:image/png;base64,iVBORw0KGgo=",
            x: 120,
            y: 170,
          },
        ],
      };
    });

    it("Harus berhasil menandatangani semua dokumen dalam paket", async () => {
      const mockResult = {
        packageId: "pkg-123",
        signedDocuments: ["doc-1", "doc-2"],
        timestamp: new Date(),
        ipAddress: "192.168.1.1",
      };

      mockPackageService.signPackage.mockResolvedValue(mockResult);

      await runController(packageController.signPackage);

      expect(mockPackageService.signPackage).toHaveBeenCalledWith("pkg-123", "user-123", mockReq.body.signatures, "192.168.1.1", mockReq);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Paket berhasil ditandatangani.",
        data: mockResult,
      });
    });

    it("Harus return 400 ketika signatures tidak diisi", async () => {
      mockReq.body = { signatures: null };

      try {
        await runController(packageController.signPackage);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(400);
        expect(error.message).toContain("signatures");
      }
    });

    it("Harus return 400 ketika signatures bukan array", async () => {
      mockReq.body = {
        signatures: {
          documentId: "doc-1",
          signatureImage: "data:image/png;base64,iVBORw0KGgo=",
        },
      };

      try {
        await runController(packageController.signPackage);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(400);
      }
    });

    it("Harus return 400 ketika signatures array kosong", async () => {
      mockReq.body = { signatures: [] };

      try {
        await runController(packageController.signPackage);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(400);
      }
    });

    it("Harus extract IP address dari x-forwarded-for header", async () => {
      mockReq.headers["x-forwarded-for"] = "203.0.113.45, 198.51.100.178";

      const mockResult = {
        packageId: "pkg-123",
        signedDocuments: ["doc-1", "doc-2"],
      };
      mockPackageService.signPackage.mockResolvedValue(mockResult);

      await runController(packageController.signPackage);

      expect(mockPackageService.signPackage).toHaveBeenCalledWith(
        "pkg-123",
        "user-123",
        mockReq.body.signatures,
        "203.0.113.45", // First IP dari x-forwarded-for
        mockReq
      );
    });

    it("Harus fallback ke req.ip jika x-forwarded-for tidak ada", async () => {
      delete mockReq.headers["x-forwarded-for"];
      mockReq.ip = "10.0.0.1";

      const mockResult = {
        packageId: "pkg-123",
        signedDocuments: ["doc-1", "doc-2"],
      };
      mockPackageService.signPackage.mockResolvedValue(mockResult);

      await runController(packageController.signPackage);

      expect(mockPackageService.signPackage).toHaveBeenCalledWith("pkg-123", "user-123", mockReq.body.signatures, "10.0.0.1", mockReq);
    });

    it("Harus fallback ke connection.remoteAddress jika ip undefined", async () => {
      delete mockReq.headers["x-forwarded-for"];
      mockReq.ip = undefined;
      mockReq.connection.remoteAddress = "::ffff:127.0.0.1";

      const mockResult = {
        packageId: "pkg-123",
        signedDocuments: ["doc-1", "doc-2"],
      };
      mockPackageService.signPackage.mockResolvedValue(mockResult);

      await runController(packageController.signPackage);

      expect(mockPackageService.signPackage).toHaveBeenCalledWith("pkg-123", "user-123", mockReq.body.signatures, "::ffff:127.0.0.1", mockReq);
    });

    it("Harus handle single signature dalam array", async () => {
      mockReq.body = {
        signatures: [
          {
            documentId: "doc-1",
            signatureImage: "data:image/png;base64,iVBORw0KGgo=",
            x: 100,
            y: 150,
          },
        ],
      };

      const mockResult = {
        packageId: "pkg-123",
        signedDocuments: ["doc-1"],
      };
      mockPackageService.signPackage.mockResolvedValue(mockResult);

      await runController(packageController.signPackage);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Paket berhasil ditandatangani.",
        data: mockResult,
      });
    });

    it("Harus trim whitespace dari x-forwarded-for values", async () => {
      mockReq.headers["x-forwarded-for"] = " 203.0.113.45 , 198.51.100.178 ";

      const mockResult = {
        packageId: "pkg-123",
        signedDocuments: ["doc-1", "doc-2"],
      };
      mockPackageService.signPackage.mockResolvedValue(mockResult);

      await runController(packageController.signPackage);

      // Harus trim leading whitespace dari first IP
      expect(mockPackageService.signPackage).toHaveBeenCalledWith("pkg-123", "user-123", mockReq.body.signatures, "203.0.113.45", mockReq);
    });
  });

  describe("createPackageController - Initialization", () => {
    it("Harus throw error ketika packageService tidak diberikan", () => {
      expect(() => createPackageController(null)).toThrow("createPackageController: 'packageService' tidak disediakan.");
    });

    it("Harus throw error ketika packageService undefined", () => {
      expect(() => createPackageController(undefined)).toThrow("createPackageController: 'packageService' tidak disediakan.");
    });

    it("Harus membuat controller dengan valid packageService", () => {
      const controller = createPackageController(mockPackageService);
      expect(controller).toHaveProperty("createPackage");
      expect(controller).toHaveProperty("getPackageDetails");
      expect(controller).toHaveProperty("signPackage");
    });
  });
});
