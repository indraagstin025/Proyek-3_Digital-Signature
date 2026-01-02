import { jest } from "@jest/globals";

import { AdminService } from "../../src/services/adminService.js";

describe("AdminService", () => {
  let adminService;
  let mockAdminRepository;
  let mockAuditService;

  beforeEach(() => {
    mockAdminRepository = {
      findAllUsers: jest.fn(),
      createUser: jest.fn(),
      updateUserById: jest.fn(),
      deleteUserById: jest.fn(),
      getSystemStats: jest.fn(),
      getTrafficStats: jest.fn(),
      findAllDocuments: jest.fn(),
      forceDeleteDocument: jest.fn(),
    };

    mockAuditService = {
      log: jest.fn(),
      getAllLogs: jest.fn(),
    };

    adminService = new AdminService(mockAdminRepository, mockAuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getAllUsers", () => {
    it("Harus memanggil repository.findAllUsers dan mengembalikan hasilnya", async () => {
      const mockUsers = [
        { id: 1, name: "User A", email: "a@test.com" },
        { id: 2, name: "User B", email: "b@test.com" },
      ];
      mockAdminRepository.findAllUsers.mockResolvedValue(mockUsers);

      const result = await adminService.getAllUsers();

      expect(mockAdminRepository.findAllUsers).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });

    it("Harus mengembalikan array kosong jika tidak ada user", async () => {
      mockAdminRepository.findAllUsers.mockResolvedValue([]);

      const result = await adminService.getAllUsers();

      expect(result).toEqual([]);
    });
  });

  describe("createNewUser", () => {
    const mockReq = { ip: "127.0.0.1", headers: { "user-agent": "test" } };

    it("Harus mengubah email menjadi lowercase sebelum disimpan ke repository", async () => {
      const rawUserData = {
        email: "TEST@Example.COM",
        name: "Test User",
        password: "password123",
        isSuperAdmin: false,
      };

      const expectedNormalizedData = {
        ...rawUserData,
        email: "test@example.com",
      };

      const mockCreatedUser = { id: 1, ...expectedNormalizedData };
      mockAdminRepository.createUser.mockResolvedValue(mockCreatedUser);

      const result = await adminService.createNewUser(rawUserData, "admin-123", mockReq);

      expect(mockAdminRepository.createUser).toHaveBeenCalledWith(expectedNormalizedData);
      expect(result).toEqual(mockCreatedUser);
    });

    it("Harus mencatat audit log setelah user dibuat", async () => {
      const userData = { email: "new@test.com", name: "New User", password: "pass123" };
      const adminId = "admin-456";
      const mockCreatedUser = { id: "user-new-123", email: "new@test.com", name: "New User" };

      mockAdminRepository.createUser.mockResolvedValue(mockCreatedUser);

      await adminService.createNewUser(userData, adminId, mockReq);

      expect(mockAuditService.log).toHaveBeenCalledWith("CREATE_USER", adminId, mockCreatedUser.id, `Admin membuat user baru: ${mockCreatedUser.email}`, mockReq);
    });

    it("Harus tetap berhasil jika auditService tidak tersedia (null)", async () => {
      const serviceWithoutAudit = new AdminService(mockAdminRepository, null);
      const userData = { email: "test@test.com", name: "Test", password: "pass" };
      const mockCreatedUser = { id: 1, email: "test@test.com", name: "Test" };

      mockAdminRepository.createUser.mockResolvedValue(mockCreatedUser);

      const result = await serviceWithoutAudit.createNewUser(userData, "admin-1", mockReq);

      expect(result).toEqual(mockCreatedUser);
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it("Harus menangani email dengan spasi dan mengonversi ke lowercase", async () => {
      const userData = { email: "  User@TEST.com  ", name: "User", password: "pass" };
      const mockCreatedUser = { id: 1, email: "  user@test.com  ", name: "User" };

      mockAdminRepository.createUser.mockResolvedValue(mockCreatedUser);

      await adminService.createNewUser(userData, "admin-1", mockReq);

      expect(mockAdminRepository.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "  user@test.com  " }));
    });
  });

  describe("updateUser", () => {
    it("Harus memanggil repository.updateUserById dengan parameter yang benar", async () => {
      const userId = "user-123";
      const updateData = { name: "Updated Name" };
      const mockUpdatedUser = { id: userId, ...updateData };

      mockAdminRepository.updateUserById.mockResolvedValue(mockUpdatedUser);

      const result = await adminService.updateUser(userId, updateData);

      expect(mockAdminRepository.updateUserById).toHaveBeenCalledWith(userId, updateData);
      expect(result).toEqual(mockUpdatedUser);
    });

    it("Harus bisa update multiple fields sekaligus", async () => {
      const userId = "user-456";
      const updateData = { name: "New Name", email: "new@email.com", isSuperAdmin: true };
      const mockUpdatedUser = { id: userId, ...updateData };

      mockAdminRepository.updateUserById.mockResolvedValue(mockUpdatedUser);

      const result = await adminService.updateUser(userId, updateData);

      expect(mockAdminRepository.updateUserById).toHaveBeenCalledWith(userId, updateData);
      expect(result).toEqual(mockUpdatedUser);
    });

    it("Harus mengembalikan null jika user tidak ditemukan", async () => {
      mockAdminRepository.updateUserById.mockResolvedValue(null);

      const result = await adminService.updateUser("non-existent-id", { name: "Test" });

      expect(result).toBeNull();
    });
  });

  describe("deleteUser", () => {
    const mockReq = { ip: "192.168.1.1", headers: {} };

    it("Harus memanggil repository.deleteUserById dengan ID yang benar", async () => {
      const userId = "user-delete-id";
      const adminId = "admin-123";
      mockAdminRepository.deleteUserById.mockResolvedValue(true);

      await adminService.deleteUser(userId, adminId, mockReq);

      expect(mockAdminRepository.deleteUserById).toHaveBeenCalledWith(userId);
    });

    it("Harus mencatat audit log setelah user dihapus", async () => {
      const userId = "user-to-delete";
      const adminId = "admin-789";
      mockAdminRepository.deleteUserById.mockResolvedValue(true);

      await adminService.deleteUser(userId, adminId, mockReq);

      expect(mockAuditService.log).toHaveBeenCalledWith("DELETE_USER", adminId, userId, "Admin menghapus user permanen.", mockReq);
    });

    it("Harus tetap berhasil jika auditService tidak tersedia", async () => {
      const serviceWithoutAudit = new AdminService(mockAdminRepository, null);
      mockAdminRepository.deleteUserById.mockResolvedValue(true);

      const result = await serviceWithoutAudit.deleteUser("user-1", "admin-1", mockReq);

      expect(result).toBe(true);
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe("getDashboardStats", () => {
    it("Harus mengembalikan data statistik dengan format yang benar", async () => {
      const mockStats = {
        totalUsers: 100,
        totalDocuments: 500,
        totalGroups: 25,
        totalSignatures: 1200,
      };
      const mockTrafficLogs = [{ createdAt: new Date().setHours(10, 0, 0, 0) }, { createdAt: new Date().setHours(10, 30, 0, 0) }, { createdAt: new Date().setHours(14, 0, 0, 0) }];

      mockAdminRepository.getSystemStats.mockResolvedValue(mockStats);
      mockAdminRepository.getTrafficStats.mockResolvedValue(mockTrafficLogs);

      const result = await adminService.getDashboardStats();

      expect(mockAdminRepository.getSystemStats).toHaveBeenCalled();
      expect(mockAdminRepository.getTrafficStats).toHaveBeenCalled();
      expect(result).toHaveProperty("counts");
      expect(result).toHaveProperty("traffic");
      expect(result).toHaveProperty("trends");
      expect(result.counts).toEqual({
        users: 100,
        documents: 500,
        groups: 25,
        verifications: 1200,
      });
    });

    it("Harus menghasilkan traffic data dengan 24 jam lengkap", async () => {
      mockAdminRepository.getSystemStats.mockResolvedValue({
        totalUsers: 0,
        totalDocuments: 0,
        totalGroups: 0,
        totalSignatures: 0,
      });
      mockAdminRepository.getTrafficStats.mockResolvedValue([]);

      const result = await adminService.getDashboardStats();

      expect(result.traffic).toHaveLength(24);
      expect(result.traffic[0]).toHaveProperty("name", "00:00");
      expect(result.traffic[0]).toHaveProperty("requests", 0);
      expect(result.traffic[23]).toHaveProperty("name", "23:00");
    });

    it("Harus menghitung traffic per jam dengan benar", async () => {
      const now = new Date();
      const mockTrafficLogs = [{ createdAt: new Date(now.setHours(9, 15, 0, 0)) }, { createdAt: new Date(now.setHours(9, 45, 0, 0)) }, { createdAt: new Date(now.setHours(9, 59, 0, 0)) }, { createdAt: new Date(now.setHours(15, 0, 0, 0)) }];

      mockAdminRepository.getSystemStats.mockResolvedValue({
        totalUsers: 10,
        totalDocuments: 20,
        totalGroups: 5,
        totalSignatures: 50,
      });
      mockAdminRepository.getTrafficStats.mockResolvedValue(mockTrafficLogs);

      const result = await adminService.getDashboardStats();

      const hour9 = result.traffic.find((t) => t.name === "09:00");
      expect(hour9.requests).toBe(3);

      const hour15 = result.traffic.find((t) => t.name === "15:00");
      expect(hour15.requests).toBe(1);
    });
  });

  describe("getAllDocuments", () => {
    it("Harus memanggil repository.findAllDocuments dan mengembalikan hasilnya", async () => {
      const mockDocuments = [
        { id: "doc-1", title: "Document 1", ownerId: "user-1" },
        { id: "doc-2", title: "Document 2", ownerId: "user-2" },
      ];
      mockAdminRepository.findAllDocuments.mockResolvedValue(mockDocuments);

      const result = await adminService.getAllDocuments();

      expect(mockAdminRepository.findAllDocuments).toHaveBeenCalled();
      expect(result).toEqual(mockDocuments);
    });

    it("Harus mengembalikan array kosong jika tidak ada dokumen", async () => {
      mockAdminRepository.findAllDocuments.mockResolvedValue([]);

      const result = await adminService.getAllDocuments();

      expect(result).toEqual([]);
    });
  });

  describe("getAllAuditLogs", () => {
    it("Harus memanggil auditService.getAllLogs dengan page dan limit", async () => {
      const mockLogs = {
        data: [
          { id: 1, action: "CREATE_USER", adminId: "admin-1" },
          { id: 2, action: "DELETE_USER", adminId: "admin-1" },
        ],
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      };
      mockAuditService.getAllLogs.mockResolvedValue(mockLogs);

      const result = await adminService.getAllAuditLogs(1, 10);

      expect(mockAuditService.getAllLogs).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(mockLogs);
    });

    it("Harus meneruskan pagination yang berbeda ke auditService", async () => {
      const mockLogs = { data: [], meta: { page: 5, limit: 50, total: 200, totalPages: 4 } };
      mockAuditService.getAllLogs.mockResolvedValue(mockLogs);

      const result = await adminService.getAllAuditLogs(5, 50);

      expect(mockAuditService.getAllLogs).toHaveBeenCalledWith(5, 50);
      expect(result.meta.page).toBe(5);
      expect(result.meta.limit).toBe(50);
    });
  });

  describe("forceDeleteDocument", () => {
    const mockReq = { ip: "10.0.0.1", headers: { "user-agent": "admin-browser" } };

    it("Harus memanggil repository.forceDeleteDocument dengan documentId", async () => {
      const adminId = "admin-123";
      const documentId = "doc-to-delete";
      const reason = "Konten tidak pantas";

      mockAdminRepository.forceDeleteDocument.mockResolvedValue(true);

      await adminService.forceDeleteDocument(adminId, documentId, reason, mockReq);

      expect(mockAdminRepository.forceDeleteDocument).toHaveBeenCalledWith(documentId);
    });

    it("Harus mencatat audit log dengan alasan penghapusan", async () => {
      const adminId = "admin-456";
      const documentId = "doc-123";
      const reason = "Melanggar kebijakan";

      mockAdminRepository.forceDeleteDocument.mockResolvedValue(true);

      await adminService.forceDeleteDocument(adminId, documentId, reason, mockReq);

      expect(mockAuditService.log).toHaveBeenCalledWith("FORCE_DELETE_DOCUMENT", adminId, documentId, `Admin menghapus paksa dokumen. Alasan: ${reason}`, mockReq);
    });

    it("Harus menggunakan placeholder jika reason tidak disediakan", async () => {
      const adminId = "admin-789";
      const documentId = "doc-456";

      mockAdminRepository.forceDeleteDocument.mockResolvedValue(true);

      await adminService.forceDeleteDocument(adminId, documentId, undefined, mockReq);

      expect(mockAuditService.log).toHaveBeenCalledWith("FORCE_DELETE_DOCUMENT", adminId, documentId, "Admin menghapus paksa dokumen. Alasan: _", mockReq);
    });

    it("Harus tetap berhasil jika auditService tidak tersedia", async () => {
      const serviceWithoutAudit = new AdminService(mockAdminRepository, null);
      mockAdminRepository.forceDeleteDocument.mockResolvedValue(true);

      const result = await serviceWithoutAudit.forceDeleteDocument("admin-1", "doc-1", "test", mockReq);

      expect(result).toBe(true);
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it("Harus mengembalikan hasil dari repository", async () => {
      const deleteResult = { deleted: true, documentId: "doc-999" };
      mockAdminRepository.forceDeleteDocument.mockResolvedValue(deleteResult);

      const result = await adminService.forceDeleteDocument("admin-1", "doc-999", "test", mockReq);

      expect(result).toEqual(deleteResult);
    });
  });
});
