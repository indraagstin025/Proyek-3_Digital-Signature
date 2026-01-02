/**
 * Unit Tests for AuditService
 *
 * @file auditService.test.js
 * @description Tests for AuditService methods:
 *  - constructor: Dependency injection
 *  - log: Create audit log entry
 *  - getAllLogs: Retrieve paginated logs
 */

import { jest } from "@jest/globals";
import { AuditService } from "../../src/services/auditService.js";

describe("AuditService", () => {
  let service;
  let mockAuditRepository;

  beforeEach(() => {
    mockAuditRepository = {
      createLog: jest.fn(),
      findAllLogs: jest.fn(),
    };

    service = new AuditService(mockAuditRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================
  describe("constructor", () => {
    it("Harus berhasil instantiate dengan repository", () => {
      const svc = new AuditService(mockAuditRepository);
      expect(svc).toBeInstanceOf(AuditService);
      expect(svc.auditRepository).toBe(mockAuditRepository);
    });
  });

  // ==========================================================================
  // LOG
  // ==========================================================================
  describe("log", () => {
    const action = "CREATE_USER";
    const actorId = "admin-123";
    const targetId = "user-456";
    const description = "Admin created new user";

    it("Harus memanggil repository dengan data lengkap termasuk IP dan UserAgent dari request", async () => {
      const mockReq = {
        headers: {
          "x-forwarded-for": "192.168.1.100",
          "user-agent": "Mozilla/5.0 Chrome/120",
        },
        socket: {
          remoteAddress: "127.0.0.1",
        },
      };

      mockAuditRepository.createLog.mockResolvedValue({ id: "log-1" });

      await service.log(action, actorId, targetId, description, mockReq);

      expect(mockAuditRepository.createLog).toHaveBeenCalledWith({
        action,
        actorId,
        targetId: "user-456",
        description,
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 Chrome/120",
      });
    });

    it("Harus gunakan socket.remoteAddress jika x-forwarded-for tidak ada", async () => {
      const mockReq = {
        headers: {
          "user-agent": "Mozilla/5.0",
        },
        socket: {
          remoteAddress: "10.0.0.1",
        },
      };

      mockAuditRepository.createLog.mockResolvedValue({ id: "log-1" });

      await service.log(action, actorId, targetId, description, mockReq);

      expect(mockAuditRepository.createLog).toHaveBeenCalledWith({
        action,
        actorId,
        targetId: "user-456",
        description,
        ipAddress: "10.0.0.1",
        userAgent: "Mozilla/5.0",
      });
    });

    it("Harus handle jika req null (tidak ada request object)", async () => {
      mockAuditRepository.createLog.mockResolvedValue({ id: "log-1" });

      await service.log(action, actorId, targetId, description, null);

      expect(mockAuditRepository.createLog).toHaveBeenCalledWith({
        action,
        actorId,
        targetId: "user-456",
        description,
        ipAddress: null,
        userAgent: null,
      });
    });

    it("Harus handle jika req tidak diberikan (default parameter)", async () => {
      mockAuditRepository.createLog.mockResolvedValue({ id: "log-1" });

      await service.log(action, actorId, targetId, description);

      expect(mockAuditRepository.createLog).toHaveBeenCalledWith({
        action,
        actorId,
        targetId: "user-456",
        description,
        ipAddress: null,
        userAgent: null,
      });
    });

    it("Harus convert targetId ke string jika bukan null", async () => {
      mockAuditRepository.createLog.mockResolvedValue({ id: "log-1" });

      await service.log(action, actorId, 12345, description);

      expect(mockAuditRepository.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "12345",
        })
      );
    });

    it("Harus set targetId null jika targetId tidak ada", async () => {
      mockAuditRepository.createLog.mockResolvedValue({ id: "log-1" });

      await service.log(action, actorId, null, description);

      expect(mockAuditRepository.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: null,
        })
      );
    });

    it("Harus set targetId null jika targetId undefined", async () => {
      mockAuditRepository.createLog.mockResolvedValue({ id: "log-1" });

      await service.log(action, actorId, undefined, description);

      expect(mockAuditRepository.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: null,
        })
      );
    });

    it("Harus return result dari repository", async () => {
      const expectedResult = { id: "log-1", action, createdAt: new Date() };
      mockAuditRepository.createLog.mockResolvedValue(expectedResult);

      const result = await service.log(action, actorId, targetId, description);

      expect(result).toEqual(expectedResult);
    });

    it("Harus log berbagai action types", async () => {
      mockAuditRepository.createLog.mockResolvedValue({ id: "log-1" });

      const actions = ["CREATE_USER", "DELETE_USER", "UPDATE_USER", "SIGN_DOCUMENT", "SIGN_PACKAGE", "DELETE_DOCUMENT", "ADMIN_LOGIN"];

      for (const actionType of actions) {
        await service.log(actionType, actorId, targetId, `Action: ${actionType}`);
      }

      expect(mockAuditRepository.createLog).toHaveBeenCalledTimes(actions.length);
    });

    it("Harus handle empty string targetId sebagai string kosong", async () => {
      mockAuditRepository.createLog.mockResolvedValue({ id: "log-1" });

      await service.log(action, actorId, "", description);

      expect(mockAuditRepository.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: null, // Empty string is falsy, so it becomes null
        })
      );
    });
  });

  // ==========================================================================
  // GET ALL LOGS
  // ==========================================================================
  describe("getAllLogs", () => {
    it("Harus memanggil repository dengan page dan limit", async () => {
      const mockLogs = {
        logs: [
          { id: "log-1", action: "CREATE_USER" },
          { id: "log-2", action: "DELETE_USER" },
        ],
        total: 2,
      };
      mockAuditRepository.findAllLogs.mockResolvedValue(mockLogs);

      const result = await service.getAllLogs(1, 10);

      expect(mockAuditRepository.findAllLogs).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(mockLogs);
    });

    it("Harus handle pagination berbeda", async () => {
      mockAuditRepository.findAllLogs.mockResolvedValue({ logs: [], total: 0 });

      await service.getAllLogs(5, 25);

      expect(mockAuditRepository.findAllLogs).toHaveBeenCalledWith(5, 25);
    });

    it("Harus return empty array jika tidak ada logs", async () => {
      mockAuditRepository.findAllLogs.mockResolvedValue({ logs: [], total: 0 });

      const result = await service.getAllLogs(1, 10);

      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("Harus return data dari repository tanpa modifikasi", async () => {
      const mockData = {
        logs: [
          {
            id: "log-1",
            action: "SIGN_DOCUMENT",
            actorId: "user-123",
            targetId: "doc-456",
            description: "User signed document",
            ipAddress: "192.168.1.1",
            userAgent: "Chrome",
            createdAt: new Date("2024-01-01"),
          },
        ],
        total: 100,
        page: 1,
        limit: 10,
      };
      mockAuditRepository.findAllLogs.mockResolvedValue(mockData);

      const result = await service.getAllLogs(1, 10);

      expect(result).toBe(mockData);
    });
  });
});
