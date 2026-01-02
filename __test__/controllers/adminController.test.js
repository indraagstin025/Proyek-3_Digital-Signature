import { createAdminController } from "../../src/controllers/adminController.js";
import { jest } from "@jest/globals";

describe("AdminController", () => {
  let mockAdminService;
  let adminController;
  let req;
  let res;
  let next;

  beforeEach(async () => {
    mockAdminService = {
      getAllUsers: jest.fn(),
      createNewUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      getDashboardStats: jest.fn(),
      getAllAuditLogs: jest.fn(),
      getAllDocuments: jest.fn(),
      forceDeleteDocument: jest.fn(),
    };

    adminController = createAdminController(mockAdminService);

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getAllUsers", () => {
    it("Harus mengembalikan status 200 dan daftar user", async () => {
      req = {};
      const mockUsers = [
        { id: 1, name: "User A", email: "a@test.com" },
        { id: 2, name: "User B", email: "b@test.com" },
      ];
      mockAdminService.getAllUsers.mockResolvedValue(mockUsers);

      await adminController.getAllUsers(req, res, next);

      expect(mockAdminService.getAllUsers).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: mockUsers,
      });
    });

    it("Harus mengembalikan count 0 jika tidak ada user", async () => {
      req = {};
      mockAdminService.getAllUsers.mockResolvedValue([]);

      await adminController.getAllUsers(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      });
    });
  });

  describe("createUser", () => {
    it("Harus memanggil service createNewUser dengan adminId dan req, return status 201", async () => {
      req = {
        body: {
          email: "new@test.com",
          password: "Pass",
          name: "New User",
          isSuperAdmin: false,
        },
        user: { id: "admin-123" },
      };

      const mockCreatedUser = {
        id: 3,
        email: "new@test.com",
        name: "New User",
        isSuperAdmin: false,
      };
      mockAdminService.createNewUser.mockResolvedValue(mockCreatedUser);

      await adminController.createUser(req, res, next);

      expect(mockAdminService.createNewUser).toHaveBeenCalledWith(
        {
          email: "new@test.com",
          password: "Pass",
          name: "New User",
          isSuperAdmin: false,
        },
        "admin-123",
        req
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "User berhasil dibuat oleh admin.",
        data: mockCreatedUser,
      });
    });

    it("Harus menangani pembuatan user dengan isSuperAdmin true", async () => {
      req = {
        body: {
          email: "superadmin@test.com",
          password: "SuperPass123",
          name: "Super Admin",
          isSuperAdmin: true,
        },
        user: { id: "admin-123" },
      };

      const mockSuperAdmin = {
        id: 4,
        email: "superadmin@test.com",
        name: "Super Admin",
        isSuperAdmin: true,
      };
      mockAdminService.createNewUser.mockResolvedValue(mockSuperAdmin);

      await adminController.createUser(req, res, next);

      expect(mockAdminService.createNewUser).toHaveBeenCalledWith(expect.objectContaining({ isSuperAdmin: true }), "admin-123", req);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("updateUser", () => {
    it("Harus memanggil service updateUser dan return status 200", async () => {
      req = {
        params: { userId: "user-123" },
        body: { name: "Updated Name" },
      };

      const mockUpdatedUser = { id: "user-123", name: "Updated Name", email: "old@test.com" };
      mockAdminService.updateUser.mockResolvedValue(mockUpdatedUser);

      await adminController.updateUser(req, res, next);

      expect(mockAdminService.updateUser).toHaveBeenCalledWith("user-123", { name: "Updated Name" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "User berhasil diperbaharui.",
        data: mockUpdatedUser,
      });
    });

    it("Harus bisa update multiple fields", async () => {
      req = {
        params: { userId: "user-456" },
        body: { name: "New Name", email: "newemail@test.com", isSuperAdmin: true },
      };

      const mockUpdatedUser = {
        id: "user-456",
        name: "New Name",
        email: "newemail@test.com",
        isSuperAdmin: true,
      };
      mockAdminService.updateUser.mockResolvedValue(mockUpdatedUser);

      await adminController.updateUser(req, res, next);

      expect(mockAdminService.updateUser).toHaveBeenCalledWith("user-456", {
        name: "New Name",
        email: "newemail@test.com",
        isSuperAdmin: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deleteUser", () => {
    it("Harus memanggil service deleteUser dengan userId, adminId, dan req", async () => {
      req = {
        params: { userId: "user-to-delete" },
        user: { id: "admin-123" },
      };

      mockAdminService.deleteUser.mockResolvedValue();

      await adminController.deleteUser(req, res, next);

      expect(mockAdminService.deleteUser).toHaveBeenCalledWith("user-to-delete", "admin-123", req);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "User dengan ID user-to-delete berhasil dihapus",
      });
    });

    it("Harus menampilkan userId yang benar di pesan response", async () => {
      req = {
        params: { userId: "specific-user-id-999" },
        user: { id: "admin-456" },
      };

      mockAdminService.deleteUser.mockResolvedValue();

      await adminController.deleteUser(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "User dengan ID specific-user-id-999 berhasil dihapus",
      });
    });
  });

  describe("getDashboardSummary", () => {
    it("Harus mengembalikan status 200 dan data statistik dashboard", async () => {
      req = {};
      const mockSummary = {
        totalUsers: 100,
        totalDocuments: 500,
        totalSignatures: 1200,
        premiumUsers: 25,
      };
      mockAdminService.getDashboardStats.mockResolvedValue(mockSummary);

      await adminController.getDashboardSummary(req, res, next);

      expect(mockAdminService.getDashboardStats).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSummary,
      });
    });

    it("Harus mengembalikan data kosong jika tidak ada statistik", async () => {
      req = {};
      const mockEmptySummary = {
        totalUsers: 0,
        totalDocuments: 0,
        totalSignatures: 0,
        premiumUsers: 0,
      };
      mockAdminService.getDashboardStats.mockResolvedValue(mockEmptySummary);

      await adminController.getDashboardSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockEmptySummary,
      });
    });
  });

  describe("getAuditLogs", () => {
    it("Harus mengembalikan audit logs dengan pagination default (page 1, limit 10)", async () => {
      req = { query: {} };
      const mockResult = {
        data: [
          { id: 1, action: "CREATE_USER", adminId: "admin-1" },
          { id: 2, action: "DELETE_USER", adminId: "admin-1" },
        ],
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      };
      mockAdminService.getAllAuditLogs.mockResolvedValue(mockResult);

      await adminController.getAuditLogs(req, res, next);

      expect(mockAdminService.getAllAuditLogs).toHaveBeenCalledWith(1, 10);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.data,
        pagination: mockResult.meta,
      });
    });

    it("Harus menggunakan page dan limit dari query string", async () => {
      req = { query: { page: "3", limit: "25" } };
      const mockResult = {
        data: [],
        meta: { page: 3, limit: 25, total: 50, totalPages: 2 },
      };
      mockAdminService.getAllAuditLogs.mockResolvedValue(mockResult);

      await adminController.getAuditLogs(req, res, next);

      expect(mockAdminService.getAllAuditLogs).toHaveBeenCalledWith(3, 25);
    });

    it("Harus menggunakan default jika query page/limit tidak valid", async () => {
      req = { query: { page: "abc", limit: "xyz" } };
      const mockResult = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      mockAdminService.getAllAuditLogs.mockResolvedValue(mockResult);

      await adminController.getAuditLogs(req, res, next);

      expect(mockAdminService.getAllAuditLogs).toHaveBeenCalledWith(1, 10);
    });
  });

  describe("getAllDocuments", () => {
    it("Harus mengembalikan status 200 dan daftar dokumen", async () => {
      req = {};
      const mockDocuments = [
        { id: "doc-1", title: "Document 1", ownerId: "user-1" },
        { id: "doc-2", title: "Document 2", ownerId: "user-2" },
        { id: "doc-3", title: "Document 3", ownerId: "user-1" },
      ];
      mockAdminService.getAllDocuments.mockResolvedValue(mockDocuments);

      await adminController.getAllDocuments(req, res, next);

      expect(mockAdminService.getAllDocuments).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 3,
        data: mockDocuments,
      });
    });

    it("Harus mengembalikan count 0 jika tidak ada dokumen", async () => {
      req = {};
      mockAdminService.getAllDocuments.mockResolvedValue([]);

      await adminController.getAllDocuments(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      });
    });
  });

  describe("forceDeleteDocument", () => {
    it("Harus memanggil service forceDeleteDocument dengan parameter yang benar", async () => {
      req = {
        params: { documentId: "doc-123" },
        body: { reason: "Konten tidak pantas" },
        user: { id: "admin-456" },
      };
      mockAdminService.forceDeleteDocument.mockResolvedValue();

      await adminController.forceDeleteDocument(req, res, next);

      expect(mockAdminService.forceDeleteDocument).toHaveBeenCalledWith("admin-456", "doc-123", "Konten tidak pantas", req);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Dokumen berhasil dihapus secara paksa demi keamanan/moderasi.",
      });
    });

    it("Harus tetap berfungsi jika reason tidak disediakan", async () => {
      req = {
        params: { documentId: "doc-789" },
        body: {},
        user: { id: "admin-111" },
      };
      mockAdminService.forceDeleteDocument.mockResolvedValue();

      await adminController.forceDeleteDocument(req, res, next);

      expect(mockAdminService.forceDeleteDocument).toHaveBeenCalledWith("admin-111", "doc-789", undefined, req);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("triggerPremiumExpiryCheck", () => {
    it.todo("Harus menjalankan cron job premium expiry dan return hasil");
    it.todo("Harus mencetak log dengan admin ID yang benar");
  });
});
