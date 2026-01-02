import { jest } from "@jest/globals";
import { createGroupController } from "../../src/controllers/groupController.js";
import GroupError from "../../src/errors/GroupError.js";

describe("GroupController", () => {
  let groupController;
  let mockGroupService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGroupService = {
      createGroup: jest.fn(),
      getAllUserGroups: jest.fn(),
      getGroupById: jest.fn(),
      updateGroup: jest.fn(),
      deleteGroup: jest.fn(),
      createInvitation: jest.fn(),
      acceptInvitation: jest.fn(),
      removeMember: jest.fn(),
      assignDocumentToGroup: jest.fn(),
      unassignDocumentFromGroup: jest.fn(),
      uploadGroupDocument: jest.fn(),
      updateGroupDocumentSigners: jest.fn(),
      deleteGroupDocument: jest.fn(),
      finalizeGroupDocument: jest.fn(),
    };

    groupController = createGroupController(mockGroupService);

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

      mockNext = jest.fn((error) => {
        if (error) reject(error);
      });

      const result = controllerMethod(mockReq, mockRes, mockNext);
      if (result && typeof result.then === "function") {
        result.catch(reject);
      }
    });
  };

  describe("createGroup", () => {
    it("Harus berhasil membuat grup baru", async () => {
      mockReq.body = { name: "Grup Test" };
      const mockGroup = { id: 1, name: "Grup Test", adminId: "user-123" };
      mockGroupService.createGroup.mockResolvedValue(mockGroup);

      await runController(groupController.createGroup);

      expect(mockGroupService.createGroup).toHaveBeenCalledWith("user-123", "Grup Test");
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Grup berhasil dibuat.",
        data: mockGroup,
      });
    });

    it("Harus throw error jika service gagal", async () => {
      mockReq.body = { name: "Grup Test" };
      mockGroupService.createGroup.mockRejectedValue(GroupError.BadRequest("Nama grup tidak boleh kosong"));

      await expect(runController(groupController.createGroup)).rejects.toThrow(GroupError);
    });
  });

  describe("getAllUserGroups", () => {
    it("Harus mengembalikan semua grup user", async () => {
      const mockGroups = [
        { id: 1, name: "Grup A" },
        { id: 2, name: "Grup B" },
      ];
      mockGroupService.getAllUserGroups.mockResolvedValue(mockGroups);

      await runController(groupController.getAllUserGroups);

      expect(mockGroupService.getAllUserGroups).toHaveBeenCalledWith("user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: mockGroups,
      });
    });

    it("Harus mengembalikan array kosong jika tidak ada grup", async () => {
      mockGroupService.getAllUserGroups.mockResolvedValue([]);

      await runController(groupController.getAllUserGroups);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: [],
      });
    });
  });

  describe("getGroupById", () => {
    it("Harus mengembalikan detail grup berdasarkan ID", async () => {
      mockReq.params.groupId = "1";
      const mockGroup = { id: 1, name: "Grup Test", members: [] };
      mockGroupService.getGroupById.mockResolvedValue(mockGroup);

      await runController(groupController.getGroupById);

      expect(mockGroupService.getGroupById).toHaveBeenCalledWith(1, "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: mockGroup,
      });
    });

    it("Harus throw BadRequest jika groupId bukan angka valid", async () => {
      mockReq.params.groupId = "abc";

      await expect(runController(groupController.getGroupById)).rejects.toThrow(GroupError.BadRequest("Format ID Grup tidak valid. Harap gunakan Angka."));
    });

    it("Harus throw error jika grup tidak ditemukan", async () => {
      mockReq.params.groupId = "999";
      mockGroupService.getGroupById.mockRejectedValue(GroupError.NotFound("Grup tidak ditemukan."));

      await expect(runController(groupController.getGroupById)).rejects.toThrow(GroupError);
    });
  });

  describe("updateGroup", () => {
    it("Harus berhasil update nama grup", async () => {
      mockReq.params.groupId = "1";
      mockReq.body = { name: "Nama Baru" };
      const updatedGroup = { id: 1, name: "Nama Baru" };
      mockGroupService.updateGroup.mockResolvedValue(updatedGroup);

      await runController(groupController.updateGroup);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(1, "user-123", "Nama Baru");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Nama grup berhasil diperbarui.",
        data: updatedGroup,
      });
    });

    it("Harus throw BadRequest jika name tidak disertakan", async () => {
      mockReq.params.groupId = "1";
      mockReq.body = {};

      await expect(runController(groupController.updateGroup)).rejects.toThrow(GroupError.BadRequest("Properti 'name' wajib diisi."));
    });

    it("Harus throw BadRequest jika groupId tidak valid", async () => {
      mockReq.params.groupId = "invalid";
      mockReq.body = { name: "Test" };

      await expect(runController(groupController.updateGroup)).rejects.toThrow(GroupError);
    });
  });

  describe("deleteGroup", () => {
    it("Harus berhasil menghapus grup", async () => {
      mockReq.params.groupId = "1";
      mockGroupService.deleteGroup.mockResolvedValue(true);

      await runController(groupController.deleteGroup);

      expect(mockGroupService.deleteGroup).toHaveBeenCalledWith(1, "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Grup berhasil dihapus.",
      });
    });

    it("Harus throw error jika user bukan admin", async () => {
      mockReq.params.groupId = "1";
      mockGroupService.deleteGroup.mockRejectedValue(GroupError.UnauthorizedAccess("Hanya admin yang dapat menghapus grup."));

      await expect(runController(groupController.deleteGroup)).rejects.toThrow(GroupError);
    });
  });

  describe("createInvitation", () => {
    it("Harus berhasil membuat undangan", async () => {
      mockReq.params.groupId = "1";
      mockReq.body = { role: "viewer" };
      const mockInvitation = { id: "inv-123", token: "abc123", role: "viewer" };
      mockGroupService.createInvitation.mockResolvedValue(mockInvitation);

      await runController(groupController.createInvitation);

      expect(mockGroupService.createInvitation).toHaveBeenCalledWith(1, "user-123", "viewer");
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Link undangan berhasil dibuat.",
        data: {
          ...mockInvitation,
          invitationLink: expect.stringContaining("abc123"),
        },
      });
    });

    it("Harus throw BadRequest jika role tidak disertakan", async () => {
      mockReq.params.groupId = "1";
      mockReq.body = {};

      await expect(runController(groupController.createInvitation)).rejects.toThrow(GroupError.BadRequest("Properti 'role' wajib diisi (cth: 'viewer' atau 'editor')."));
    });
  });

  describe("acceptInvitation", () => {
    it("Harus berhasil menerima undangan", async () => {
      mockReq.body = { token: "valid-token" };
      const mockMember = { id: "member-123", groupId: 1, userId: "user-123", role: "viewer" };
      mockGroupService.acceptInvitation.mockResolvedValue(mockMember);

      await runController(groupController.acceptInvitation);

      expect(mockGroupService.acceptInvitation).toHaveBeenCalledWith("valid-token", "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Berhasil bergabung dengan grup.",
        data: mockMember,
      });
    });

    it("Harus throw BadRequest jika token tidak disertakan", async () => {
      mockReq.body = {};

      await expect(runController(groupController.acceptInvitation)).rejects.toThrow(GroupError.BadRequest("Token undangan wajib diisi."));
    });

    it("Harus throw error jika undangan tidak valid", async () => {
      mockReq.body = { token: "invalid-token" };
      mockGroupService.acceptInvitation.mockRejectedValue(GroupError.InvalidInvitation("Undangan tidak valid atau telah kedaluwarsa."));

      await expect(runController(groupController.acceptInvitation)).rejects.toThrow(GroupError);
    });

    it("Harus throw error jika sudah menjadi anggota", async () => {
      mockReq.body = { token: "valid-token" };
      mockGroupService.acceptInvitation.mockRejectedValue(GroupError.AlreadyMember("Anda sudah menjadi anggota grup ini."));

      await expect(runController(groupController.acceptInvitation)).rejects.toThrow(GroupError);
    });
  });

  describe("removeMember", () => {
    it("Harus berhasil mengeluarkan anggota dari grup", async () => {
      mockReq.params.groupId = "1";
      mockReq.params.userIdToRemove = "member-456";
      mockGroupService.removeMember.mockResolvedValue(true);

      await runController(groupController.removeMember);

      expect(mockGroupService.removeMember).toHaveBeenCalledWith(1, "user-123", "member-456");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Anggota berhasil dikeluarkan dari grup.",
      });
    });

    it("Harus throw error jika bukan admin", async () => {
      mockReq.params.groupId = "1";
      mockReq.params.userIdToRemove = "member-456";
      mockGroupService.removeMember.mockRejectedValue(GroupError.UnauthorizedAccess("Hanya admin yang dapat mengeluarkan anggota."));

      await expect(runController(groupController.removeMember)).rejects.toThrow(GroupError);
    });
  });

  describe("assignDocumentToGroup", () => {
    it("Harus berhasil menambahkan dokumen ke grup", async () => {
      mockReq.params.groupId = "1";
      mockReq.body = { documentId: "doc-123", signerUserIds: ["user-456"] };
      const updatedDoc = { id: "doc-123", groupId: 1 };
      mockGroupService.assignDocumentToGroup.mockResolvedValue(updatedDoc);

      await runController(groupController.assignDocumentToGroup);

      expect(mockGroupService.assignDocumentToGroup).toHaveBeenCalledWith("doc-123", 1, "user-123", ["user-456"]);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen berhasil dimasukkan ke grup.",
        data: updatedDoc,
      });
    });

    it("Harus throw BadRequest jika documentId tidak disertakan", async () => {
      mockReq.params.groupId = "1";
      mockReq.body = {};

      await expect(runController(groupController.assignDocumentToGroup)).rejects.toThrow(GroupError.BadRequest("Properti 'documentId' wajib diisi."));
    });
  });

  describe("unassignDocumentFromGroup", () => {
    it("Harus berhasil melepaskan dokumen dari grup", async () => {
      mockReq.params.groupId = "1";
      mockReq.params.documentId = "doc-123";
      mockGroupService.unassignDocumentFromGroup.mockResolvedValue(true);

      await runController(groupController.unassignDocumentFromGroup);

      expect(mockGroupService.unassignDocumentFromGroup).toHaveBeenCalledWith(1, "doc-123", "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen berhasil dilepaskan dari grup.",
      });
    });
  });

  describe("uploadGroupDocument", () => {
    it("Harus berhasil upload dokumen grup", async () => {
      mockReq.params.groupId = "1";
      mockReq.file = { buffer: Buffer.from("pdf"), originalname: "test.pdf" };
      mockReq.body = { title: "Dokumen Test", signerUserIds: JSON.stringify(["user-456", "user-789"]) };
      const newDoc = { id: "doc-123", title: "Dokumen Test" };
      mockGroupService.uploadGroupDocument.mockResolvedValue(newDoc);

      await runController(groupController.uploadGroupDocument);

      expect(mockGroupService.uploadGroupDocument).toHaveBeenCalledWith("user-123", 1, mockReq.file, "Dokumen Test", ["user-456", "user-789"]);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen grup berhasil dibuat dan permintaan tanda tangan telah dikirim.",
        data: newDoc,
      });
    });

    it("Harus throw BadRequest jika file tidak ada", async () => {
      mockReq.params.groupId = "1";
      mockReq.file = null;
      mockReq.body = { title: "Test", signerUserIds: ["user-456"] };

      await expect(runController(groupController.uploadGroupDocument)).rejects.toThrow(GroupError.BadRequest("File dokumen wajib diunggah."));
    });

    it("Harus throw BadRequest jika signerUserIds kosong", async () => {
      mockReq.params.groupId = "1";
      mockReq.file = { buffer: Buffer.from("pdf") };
      mockReq.body = { title: "Test", signerUserIds: "[]" };

      await expect(runController(groupController.uploadGroupDocument)).rejects.toThrow(GroupError.BadRequest("Minimal harus ada 1 anggota yang dipilih untuk tanda tangan."));
    });

    it("Harus throw BadRequest jika signerUserIds format tidak valid", async () => {
      mockReq.params.groupId = "1";
      mockReq.file = { buffer: Buffer.from("pdf") };
      mockReq.body = { title: "Test", signerUserIds: "invalid-json" };

      await expect(runController(groupController.uploadGroupDocument)).rejects.toThrow(GroupError.BadRequest("Format signerUserIds tidak valid (harus JSON Array)."));
    });

    it("Harus handle signerUserIds sebagai array langsung", async () => {
      mockReq.params.groupId = "1";
      mockReq.file = { buffer: Buffer.from("pdf") };
      mockReq.body = { title: "Test", signerUserIds: ["user-456"] };
      mockGroupService.uploadGroupDocument.mockResolvedValue({ id: "doc-123" });

      await runController(groupController.uploadGroupDocument);

      expect(mockGroupService.uploadGroupDocument).toHaveBeenCalledWith("user-123", 1, mockReq.file, "Test", ["user-456"]);
    });
  });

  describe("updateDocumentSigners", () => {
    it("Harus berhasil update daftar penanda tangan", async () => {
      mockReq.params.groupId = "1";
      mockReq.params.documentId = "doc-123";
      mockReq.body = { signerUserIds: ["user-456", "user-789"] };
      const updatedDoc = { id: "doc-123", signers: [] };
      mockGroupService.updateGroupDocumentSigners.mockResolvedValue(updatedDoc);

      await runController(groupController.updateDocumentSigners);

      expect(mockGroupService.updateGroupDocumentSigners).toHaveBeenCalledWith(1, "doc-123", "user-123", ["user-456", "user-789"]);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Daftar penanda tangan diperbarui.",
        data: updatedDoc,
      });
    });
  });

  describe("deleteGroupDocument", () => {
    it("Harus berhasil menghapus dokumen grup", async () => {
      mockReq.params.groupId = "1";
      mockReq.params.documentId = "doc-123";
      mockGroupService.deleteGroupDocument.mockResolvedValue(true);

      await runController(groupController.deleteGroupDocument);

      expect(mockGroupService.deleteGroupDocument).toHaveBeenCalledWith(1, "doc-123", "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen berhasil dihapus permanen.",
      });
    });
  });

  describe("finalizeDocument", () => {
    it("Harus berhasil finalisasi dokumen", async () => {
      mockReq.params.groupId = "1";
      mockReq.params.documentId = "doc-123";
      const result = {
        url: "https://storage.example.com/signed.pdf",
        accessCode: "123456",
        document: { id: "doc-123", status: "completed" },
      };
      mockGroupService.finalizeGroupDocument.mockResolvedValue(result);

      await runController(groupController.finalizeDocument);

      expect(mockGroupService.finalizeGroupDocument).toHaveBeenCalledWith(1, "doc-123", "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Dokumen berhasil difinalisasi.",
        data: {
          url: result.url,
          accessCode: result.accessCode,
          document: result.document,
        },
      });
    });

    it("Harus throw error jika belum semua tanda tangan", async () => {
      mockReq.params.groupId = "1";
      mockReq.params.documentId = "doc-123";
      mockGroupService.finalizeGroupDocument.mockRejectedValue(GroupError.BadRequest("Masih ada anggota yang belum tanda tangan."));

      await expect(runController(groupController.finalizeDocument)).rejects.toThrow(GroupError);
    });
  });
});
