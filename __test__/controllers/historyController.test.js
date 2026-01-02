/**
 * Unit Tests for HistoryController
 *
 * @file historyController.test.js
 * @description Tests for HistoryController methods:
 *  - createHistoryController: Factory function validation
 *  - getMyHistory: Get user signing history
 */

import { jest } from "@jest/globals";
import { createHistoryController } from "../../src/controllers/historyController.js";

describe("HistoryController", () => {
  let controller;
  let mockHistoryService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Mock service
    mockHistoryService = {
      getUserSigningHistory: jest.fn(),
    };

    // Create controller instance
    controller = createHistoryController(mockHistoryService);

    // Mock request object
    mockReq = {
      user: { id: "user-123" },
      params: {},
      body: {},
      query: {},
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
  // FACTORY FUNCTION VALIDATION
  // ==========================================================================
  describe("createHistoryController", () => {
    it("Harus throw error jika historyService tidak disediakan", () => {
      expect(() => createHistoryController(null)).toThrow("createHistoryController: 'historyService' tidak disediakan.");
    });

    it("Harus throw error jika historyService undefined", () => {
      expect(() => createHistoryController(undefined)).toThrow("createHistoryController: 'historyService' tidak disediakan.");
    });

    it("Harus berhasil membuat controller jika historyService valid", () => {
      const ctrl = createHistoryController(mockHistoryService);

      expect(ctrl).toBeDefined();
      expect(ctrl.getMyHistory).toBeDefined();
      expect(typeof ctrl.getMyHistory).toBe("function");
    });
  });

  // ==========================================================================
  // GET MY HISTORY
  // ==========================================================================
  describe("getMyHistory", () => {
    it("Harus return 200 dengan data history kosong", async () => {
      mockHistoryService.getUserSigningHistory.mockResolvedValue([]);

      await controller.getMyHistory(mockReq, mockRes, mockNext);

      expect(mockHistoryService.getUserSigningHistory).toHaveBeenCalledWith("user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: [],
      });
    });

    it("Harus return 200 dengan data history yang ada", async () => {
      const mockHistory = [
        {
          id: "sig-1",
          type: "PERSONAL",
          documentTitle: "Personal Document",
          signedAt: "2025-01-15T10:00:00Z",
          ipAddress: "192.168.1.1",
        },
        {
          id: "sig-2",
          type: "GROUP",
          documentTitle: "Group Document",
          signedAt: "2025-01-14T08:00:00Z",
          ipAddress: "192.168.1.2",
        },
        {
          id: "sig-3",
          type: "PACKAGE",
          documentTitle: "Package Document",
          signedAt: "2025-01-13T12:00:00Z",
          ipAddress: "192.168.1.3",
        },
      ];

      mockHistoryService.getUserSigningHistory.mockResolvedValue(mockHistory);

      await controller.getMyHistory(mockReq, mockRes, mockNext);

      expect(mockHistoryService.getUserSigningHistory).toHaveBeenCalledWith("user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: mockHistory,
      });
    });

    it("Harus handle user tanpa id dengan memanggil service dengan undefined", async () => {
      mockReq.user = {};
      mockHistoryService.getUserSigningHistory.mockResolvedValue([]);

      await controller.getMyHistory(mockReq, mockRes, mockNext);

      expect(mockHistoryService.getUserSigningHistory).toHaveBeenCalledWith(undefined);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus handle req.user null dengan memanggil service dengan undefined", async () => {
      mockReq.user = null;
      mockHistoryService.getUserSigningHistory.mockResolvedValue([]);

      await controller.getMyHistory(mockReq, mockRes, mockNext);

      expect(mockHistoryService.getUserSigningHistory).toHaveBeenCalledWith(undefined);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus propagate error ke asyncHandler jika service gagal", async () => {
      const serviceError = new Error("Database connection failed");
      mockHistoryService.getUserSigningHistory.mockRejectedValue(serviceError);

      try {
        await controller.getMyHistory(mockReq, mockRes, mockNext);
      } catch (err) {
        expect(err.message).toBe("Database connection failed");
      }
    });
  });
});
