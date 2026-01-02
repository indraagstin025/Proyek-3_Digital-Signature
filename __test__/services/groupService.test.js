import { jest } from "@jest/globals";
import { GroupService } from "../../src/services/groupService.js";
import GroupError from "../../src/errors/GroupError.js";
import CommonError from "../../src/errors/CommonError.js";
import DocumentError from "../../src/errors/DocumentError.js";

describe("GroupService", () => {
  let groupService;

  // Mocks for repositories and services
  let mockGroupRepository;
  let mockGroupMemberRepository;
  let mockGroupInvitationRepository;
  let mockDocumentRepository;
  let mockFileStorage;
  let mockGroupDocumentSignerRepository;
  let mockVersionRepository;
  let mockPdfService;
  let mockGroupSignatureRepository;
  let mockIo;
  let mockUserService;

  beforeEach(() => {
    // 1. Setup Mocks
    mockGroupRepository = {
      createWithAdmin: jest.fn(),
      countByAdminId: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn(),
      prisma: {}, // Dummy object if needed
    };

    mockGroupMemberRepository = {
      findByGroupAndUser: jest.fn(),
      countByGroupId: jest.fn(),
      createFromInvitation: jest.fn(),
      deleteById: jest.fn(),
      findAllByUserId: jest.fn(),
    };

    mockGroupInvitationRepository = {
      create: jest.fn(),
      findByToken: jest.fn(),
    };

    mockDocumentRepository = {
      findById: jest.fn(),
      countByGroupId: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      createGroupDocument: jest.fn(),
      deleteById: jest.fn(),
    };

    mockFileStorage = {
      uploadDocument: jest.fn(),
    };

    mockGroupDocumentSignerRepository = {
      createSigners: jest.fn(),
      deleteDrafts: jest.fn(),
      deletePendingSignersByGroupAndUser: jest.fn(),
      deleteSpecificSigner: jest.fn(),
      deleteByDocumentId: jest.fn(),
      countPendingSigners: jest.fn(),
    };

    mockVersionRepository = {
      countByDocumentId: jest.fn(),
      create: jest.fn(),
    };

    mockPdfService = {
      generateSignedPdf: jest.fn(),
    };

    mockGroupSignatureRepository = {
      deleteDrafts: jest.fn(),
      findAllByVersionId: jest.fn(),
      update: jest.fn(),
    };

    // Mock Socket.IO (Chaining: io.to().emit())
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    // Mock UserService
    mockUserService = {
      isUserPremium: jest.fn(),
    };

    // 2. Instantiate Service
    groupService = new GroupService(
      mockGroupRepository,
      mockGroupMemberRepository,
      mockGroupInvitationRepository,
      mockDocumentRepository,
      mockFileStorage,
      mockGroupDocumentSignerRepository,
      mockVersionRepository,
      mockPdfService,
      mockGroupSignatureRepository,
      mockIo,
      mockUserService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================
  describe("constructor", () => {
    it("Harus throw error jika dependensi utama hilang", () => {
      expect(() => new GroupService(null, mockGroupMemberRepository)).toThrow("Repository utama dan FileStorage harus disediakan.");
    });

    it("Harus berhasil membuat instance jika semua dependensi ada", () => {
      expect(groupService).toBeInstanceOf(GroupService);
    });
  });

  // ==========================================================================
  // CREATE GROUP
  // ==========================================================================
  describe("createGroup", () => {
    it("Harus throw error jika nama grup kosong", async () => {
      await expect(groupService.createGroup("admin-1", "")).rejects.toThrow(GroupError);
    });

    it("Harus throw error jika nama grup hanya whitespace", async () => {
      await expect(groupService.createGroup("admin-1", "   ")).rejects.toThrow(GroupError);
    });

    it("Harus throw error jika user FREE mencapai limit grup (1)", async () => {
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockGroupRepository.countByAdminId.mockResolvedValue(1);

      await expect(groupService.createGroup("admin-1", "My Group")).rejects.toThrow(CommonError);
      expect(mockGroupRepository.createWithAdmin).not.toHaveBeenCalled();
    });

    it("Harus throw error jika user PREMIUM mencapai limit grup (10)", async () => {
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockGroupRepository.countByAdminId.mockResolvedValue(10);

      await expect(groupService.createGroup("admin-1", "My Group")).rejects.toThrow(CommonError);
    });

    it("Harus berhasil membuat grup jika user FREE belum mencapai limit", async () => {
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockGroupRepository.countByAdminId.mockResolvedValue(0);
      mockGroupRepository.createWithAdmin.mockResolvedValue({ id: 1, name: "My Group" });

      const result = await groupService.createGroup("admin-1", "My Group");

      expect(result).toEqual({ id: 1, name: "My Group" });
    });

    it("Harus berhasil membuat grup jika user PREMIUM (limit 10)", async () => {
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockGroupRepository.countByAdminId.mockResolvedValue(5); // Masih di bawah 10
      mockGroupRepository.createWithAdmin.mockResolvedValue({ id: 2, name: "Premium Group" });

      const result = await groupService.createGroup("admin-1", "Premium Group");

      expect(result).toEqual({ id: 2, name: "Premium Group" });
    });

    it("Harus throw error jika database gagal saat create", async () => {
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockGroupRepository.countByAdminId.mockResolvedValue(0);
      mockGroupRepository.createWithAdmin.mockRejectedValue(new Error("DB Connection Failed"));

      await expect(groupService.createGroup("admin-1", "My Group")).rejects.toThrow(/Gagal membuat grup/);
    });
  });

  // ==========================================================================
  // GET GROUP BY ID
  // ==========================================================================
  describe("getGroupById", () => {
    it("Harus throw UnauthorizedAccess jika user bukan anggota", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);

      await expect(groupService.getGroupById(1, "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus throw NotFound jika grup tidak ditemukan di repo", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ id: "member-1" });
      mockGroupRepository.findById.mockResolvedValue(null);

      await expect(groupService.getGroupById(999, "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus mengembalikan data grup jika valid", async () => {
      const mockGroup = { id: 1, name: "Test Group" };
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ id: "member-1" });
      mockGroupRepository.findById.mockResolvedValue(mockGroup);

      const result = await groupService.getGroupById(1, "user-1");
      expect(result).toEqual(mockGroup);
    });
  });

  // ==========================================================================
  // CREATE INVITATION
  // ==========================================================================
  describe("createInvitation", () => {
    it("Harus throw UnauthorizedAccess jika inviter bukan admin_group", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });

      await expect(groupService.createInvitation(1, "user-1", "member")).rejects.toThrow(GroupError);
    });

    it("Harus throw Forbidden jika Owner Grup FREE dan anggota sudah penuh (5)", async () => {
      // Inviter adalah admin grup, tapi Owner grup adalah user FREE
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-1" });
      mockUserService.isUserPremium.mockResolvedValue(false); // Owner Free
      mockGroupMemberRepository.countByGroupId.mockResolvedValue(5);

      await expect(groupService.createInvitation(1, "user-1", "member")).rejects.toThrow(CommonError);
    });

    it("Harus berhasil membuat undangan jika semua valid", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-1" });
      mockUserService.isUserPremium.mockResolvedValue(true); // Owner Premium
      mockGroupInvitationRepository.create.mockResolvedValue({ token: "abc-123" });

      const result = await groupService.createInvitation(1, "user-1", "member");
      expect(result).toHaveProperty("token", "abc-123");
    });
  });

  // ==========================================================================
  // ACCEPT INVITATION
  // ==========================================================================
  describe("acceptInvitation", () => {
    const mockToken = "valid-token";
    const mockInvitation = { groupId: 1, status: "active", expiresAt: new Date(Date.now() + 10000) };

    it("Harus throw InvalidInvitation jika token tidak ditemukan", async () => {
      mockGroupInvitationRepository.findByToken.mockResolvedValue(null);
      await expect(groupService.acceptInvitation("invalid", "user-2")).rejects.toThrow(GroupError);
    });

    it("Harus throw AlreadyMember jika user sudah ada di grup", async () => {
      mockGroupInvitationRepository.findByToken.mockResolvedValue(mockInvitation);
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ id: "existing" });

      await expect(groupService.acceptInvitation(mockToken, "user-2")).rejects.toThrow(GroupError);
    });

    it("Harus throw Forbidden jika grup FREE penuh saat accept (Race Condition check)", async () => {
      mockGroupInvitationRepository.findByToken.mockResolvedValue(mockInvitation);
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);

      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-free" });
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockGroupMemberRepository.countByGroupId.mockResolvedValue(5); // Sudah penuh

      await expect(groupService.acceptInvitation(mockToken, "user-2")).rejects.toThrow(CommonError);
    });

    it("Harus throw InvalidInvitation jika status bukan active", async () => {
      const expiredInvitation = { groupId: 1, status: "used", expiresAt: new Date(Date.now() + 10000) };
      mockGroupInvitationRepository.findByToken.mockResolvedValue(expiredInvitation);
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-premium" });
      mockUserService.isUserPremium.mockResolvedValue(true);

      await expect(groupService.acceptInvitation(mockToken, "user-2")).rejects.toThrow(GroupError);
      await expect(groupService.acceptInvitation(mockToken, "user-2")).rejects.toThrow(/kedaluwarsa/);
    });

    it("Harus throw InvalidInvitation jika undangan sudah expired", async () => {
      const expiredInvitation = { groupId: 1, status: "active", expiresAt: new Date(Date.now() - 10000) }; // Past date
      mockGroupInvitationRepository.findByToken.mockResolvedValue(expiredInvitation);
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-premium" });
      mockUserService.isUserPremium.mockResolvedValue(true);

      await expect(groupService.acceptInvitation(mockToken, "user-2")).rejects.toThrow(GroupError);
    });

    it("Harus throw error jika createFromInvitation gagal", async () => {
      mockGroupInvitationRepository.findByToken.mockResolvedValue(mockInvitation);
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-premium" });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockGroupMemberRepository.createFromInvitation.mockRejectedValue(new Error("DB Error"));

      await expect(groupService.acceptInvitation(mockToken, "user-2")).rejects.toThrow(/Gagal bergabung dengan grup/);
    });

    it("Harus berhasil join dan emit socket event", async () => {
      mockGroupInvitationRepository.findByToken.mockResolvedValue(mockInvitation);
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null); // Belum member
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-premium" });
      mockUserService.isUserPremium.mockResolvedValue(true);

      mockGroupMemberRepository.createFromInvitation.mockResolvedValue({ id: "new-mem" });
      // Mock full member data return
      mockGroupMemberRepository.findByGroupAndUser.mockReturnValueOnce(null).mockReturnValueOnce({ user: { name: "Budi" } });

      await groupService.acceptInvitation(mockToken, "user-2");

      expect(mockGroupMemberRepository.createFromInvitation).toHaveBeenCalled();
      expect(mockIo.to).toHaveBeenCalledWith("group_1");
      expect(mockIo.emit).toHaveBeenCalledWith("group_member_update", expect.anything());
    });

    it("Harus berhasil join tanpa socket jika io tidak ada", async () => {
      // Create service tanpa io
      const serviceNoIo = new GroupService(
        mockGroupRepository,
        mockGroupMemberRepository,
        mockGroupInvitationRepository,
        mockDocumentRepository,
        mockFileStorage,
        mockGroupDocumentSignerRepository,
        mockVersionRepository,
        mockPdfService,
        mockGroupSignatureRepository,
        null, // No IO
        mockUserService
      );

      mockGroupInvitationRepository.findByToken.mockResolvedValue(mockInvitation);
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-premium" });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockGroupMemberRepository.createFromInvitation.mockResolvedValue({ id: "new-mem" });

      const result = await serviceNoIo.acceptInvitation(mockToken, "user-2");
      expect(result).toEqual({ id: "new-mem" });
    });
  });

  // ==========================================================================
  // ASSIGN DOCUMENT TO GROUP
  // ==========================================================================
  describe("assignDocumentToGroup", () => {
    it("Harus throw DocumentError jika dokumen tidak ditemukan", async () => {
      mockDocumentRepository.findById.mockResolvedValue(null);
      await expect(groupService.assignDocumentToGroup("doc-1", 1, "user-1")).rejects.toThrow(DocumentError);
    });

    it("Harus throw BadRequest jika dokumen sudah completed", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ status: "completed" });
      await expect(groupService.assignDocumentToGroup("doc-1", 1, "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus throw BadRequest jika dokumen sudah archived", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ status: "archived" });
      await expect(groupService.assignDocumentToGroup("doc-1", 1, "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus throw UnauthorizedAccess jika user bukan member grup", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ status: "draft" });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);
      await expect(groupService.assignDocumentToGroup("doc-1", 1, "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus throw Forbidden jika storage grup penuh (FREE max 10)", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ status: "draft" });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ id: "mem-1" });
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-1", name: "Grup A" });
      mockUserService.isUserPremium.mockResolvedValue(false); // Free limit 10
      mockDocumentRepository.countByGroupId.mockResolvedValue(10);

      await expect(groupService.assignDocumentToGroup("doc-1", 1, "user-1")).rejects.toThrow(CommonError);
    });

    it("Harus throw Forbidden jika storage grup penuh (PREMIUM max 100)", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ status: "draft" });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ id: "mem-1" });
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-1", name: "Grup A" });
      mockUserService.isUserPremium.mockResolvedValue(true); // Premium limit 100
      mockDocumentRepository.countByGroupId.mockResolvedValue(100);

      await expect(groupService.assignDocumentToGroup("doc-1", 1, "user-1")).rejects.toThrow(CommonError);
    });

    it("Harus berhasil assign dan set status 'pending' jika ada signer", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", title: "Kontrak", status: "draft" });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ id: "mem-1", user: { name: "Test" } });
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-1", name: "Grup Test" });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockDocumentRepository.countByGroupId.mockResolvedValue(5);

      mockDocumentRepository.update.mockResolvedValue({});

      await groupService.assignDocumentToGroup("doc-1", 1, "user-1", ["signer-1"]);

      expect(mockGroupDocumentSignerRepository.createSigners).toHaveBeenCalledWith("doc-1", ["signer-1"]);
      expect(mockDocumentRepository.update).toHaveBeenCalledWith("doc-1", { groupId: 1, status: "pending" });
    });

    it("Harus berhasil assign dan set status 'draft' jika tanpa signer", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", title: "Kontrak", status: "draft" });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ id: "mem-1", user: { name: "Test" } });
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-1", name: "Grup Test" });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockDocumentRepository.countByGroupId.mockResolvedValue(5);

      mockDocumentRepository.update.mockResolvedValue({ id: "doc-1", groupId: 1 });

      await groupService.assignDocumentToGroup("doc-1", 1, "user-1", []);

      expect(mockGroupDocumentSignerRepository.createSigners).not.toHaveBeenCalled();
      expect(mockDocumentRepository.update).toHaveBeenCalledWith("doc-1", { groupId: 1, status: "draft" });
    });

    it("Harus emit socket event setelah assign", async () => {
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", title: "Kontrak", status: "draft" });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ id: "mem-1", user: { name: "Admin" } });
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-1", name: "Grup Test" });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockDocumentRepository.countByGroupId.mockResolvedValue(5);
      mockDocumentRepository.update.mockResolvedValue({});

      await groupService.assignDocumentToGroup("doc-1", 1, "user-1", []);

      expect(mockIo.to).toHaveBeenCalledWith("group_1");
      expect(mockIo.emit).toHaveBeenCalledWith("group_document_update", expect.objectContaining({ action: "new_document" }));
    });

    it("Harus tetap berhasil tanpa socket jika io tidak ada", async () => {
      const serviceNoIo = new GroupService(
        mockGroupRepository,
        mockGroupMemberRepository,
        mockGroupInvitationRepository,
        mockDocumentRepository,
        mockFileStorage,
        mockGroupDocumentSignerRepository,
        mockVersionRepository,
        mockPdfService,
        mockGroupSignatureRepository,
        null,
        mockUserService
      );

      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", title: "Kontrak", status: "draft" });
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ id: "mem-1" });
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-1" });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockDocumentRepository.countByGroupId.mockResolvedValue(5);
      mockDocumentRepository.update.mockResolvedValue({ id: "doc-1" });

      const result = await serviceNoIo.assignDocumentToGroup("doc-1", 1, "user-1", []);
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // REMOVE MEMBER (KICK)
  // ==========================================================================
  describe("removeMember", () => {
    it("Harus throw UnauthorizedAccess jika requester bukan member", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);
      await expect(groupService.removeMember(1, "requester", "target")).rejects.toThrow(GroupError);
    });

    it("Harus throw UnauthorizedAccess jika requester bukan admin", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" }); // Requester
      await expect(groupService.removeMember(1, "requester", "target")).rejects.toThrow(GroupError);
    });

    it("Harus throw NotFound jika target tidak ada di grup", async () => {
      mockGroupMemberRepository.findByGroupAndUser
        .mockResolvedValueOnce({ role: "admin_group" }) // Requester
        .mockResolvedValueOnce(null); // Target not found

      await expect(groupService.removeMember(1, "admin", "target")).rejects.toThrow(GroupError);
    });

    it("Harus throw NotFound jika grup tidak ditemukan", async () => {
      mockGroupMemberRepository.findByGroupAndUser
        .mockResolvedValueOnce({ role: "admin_group" }) // Requester
        .mockResolvedValueOnce({ id: "target-mem" }); // Target

      mockGroupRepository.findById.mockResolvedValue(null);

      await expect(groupService.removeMember(1, "admin", "target")).rejects.toThrow(GroupError);
    });

    it("Harus throw BadRequest jika mencoba kick owner utama", async () => {
      mockGroupMemberRepository.findByGroupAndUser
        .mockResolvedValueOnce({ role: "admin_group" }) // Requester
        .mockResolvedValueOnce({ id: "target-mem" }); // Target

      mockGroupRepository.findById.mockResolvedValue({ adminId: "target" }); // Target is owner

      await expect(groupService.removeMember(1, "requester", "target")).rejects.toThrow(GroupError);
    });

    it("Harus membersihkan draft, signer pending, lalu hapus member", async () => {
      mockGroupMemberRepository.findByGroupAndUser
        .mockResolvedValueOnce({ role: "admin_group" }) // Requester
        .mockResolvedValueOnce({ id: "target-mem-id", user: { name: "Bad User" } }); // Target

      // Group with one document
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-real", documents: [{ id: "doc-A" }] });

      await groupService.removeMember(1, "admin", "target-user");

      // Verify cleanup
      expect(mockGroupSignatureRepository.deleteDrafts).toHaveBeenCalledWith("doc-A", "target-user");
      expect(mockGroupDocumentSignerRepository.deletePendingSignersByGroupAndUser).toHaveBeenCalledWith(1, "target-user");

      // Verify delete
      expect(mockGroupMemberRepository.deleteById).toHaveBeenCalledWith("target-mem-id");

      // Verify socket
      expect(mockIo.emit).toHaveBeenCalledWith("group_member_update", expect.objectContaining({ action: "kicked" }));
    });

    it("Harus tetap berhasil jika cleanup draft gagal (warning only)", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValueOnce({ role: "admin_group" }).mockResolvedValueOnce({ id: "target-mem-id", user: { name: "User" } });

      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-real", documents: [{ id: "doc-A" }] });
      mockGroupSignatureRepository.deleteDrafts.mockRejectedValue(new Error("Cleanup failed"));

      // Should not throw, just warn
      await groupService.removeMember(1, "admin", "target-user");

      expect(mockGroupMemberRepository.deleteById).toHaveBeenCalledWith("target-mem-id");
    });

    it("Harus handle grup tanpa dokumen", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValueOnce({ role: "admin_group" }).mockResolvedValueOnce({ id: "target-mem-id" });

      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-real", documents: [] });

      await groupService.removeMember(1, "admin", "target-user");

      expect(mockGroupSignatureRepository.deleteDrafts).not.toHaveBeenCalled();
      expect(mockGroupMemberRepository.deleteById).toHaveBeenCalledWith("target-mem-id");
    });

    it("Harus tetap berhasil tanpa socket jika io tidak ada", async () => {
      const serviceNoIo = new GroupService(
        mockGroupRepository,
        mockGroupMemberRepository,
        mockGroupInvitationRepository,
        mockDocumentRepository,
        mockFileStorage,
        mockGroupDocumentSignerRepository,
        mockVersionRepository,
        mockPdfService,
        mockGroupSignatureRepository,
        null,
        mockUserService
      );

      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValueOnce({ role: "admin_group" }).mockResolvedValueOnce({ id: "target-mem-id" });

      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-real", documents: [] });

      await serviceNoIo.removeMember(1, "admin", "target-user");
      expect(mockGroupMemberRepository.deleteById).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // UPLOAD GROUP DOCUMENT
  // ==========================================================================
  describe("uploadGroupDocument", () => {
    const mockFile = { mimetype: "application/pdf", size: 1000, buffer: Buffer.from("pdf") };

    it("Harus throw UnauthorizedAccess jika bukan member grup", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);
      await expect(groupService.uploadGroupDocument("u1", 1, mockFile, "T", [])).rejects.toThrow(GroupError);
    });

    it("Harus throw BadRequest jika bukan PDF", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({});
      const badFile = { mimetype: "image/png" };
      await expect(groupService.uploadGroupDocument("u1", 1, badFile, "T", [])).rejects.toThrow(CommonError);
    });

    it("Harus throw BadRequest jika file terlalu besar untuk user FREE (max 10MB)", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({});
      mockUserService.isUserPremium.mockResolvedValue(false); // Max 10MB
      const hugeFile = { mimetype: "application/pdf", size: 11 * 1024 * 1024 };

      await expect(groupService.uploadGroupDocument("u1", 1, hugeFile, "T", [])).rejects.toThrow(CommonError);
    });

    it("Harus throw BadRequest jika file terlalu besar untuk user PREMIUM (max 50MB)", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({});
      mockUserService.isUserPremium.mockResolvedValue(true); // Max 50MB
      const hugeFile = { mimetype: "application/pdf", size: 51 * 1024 * 1024 };

      await expect(groupService.uploadGroupDocument("u1", 1, hugeFile, "T", [])).rejects.toThrow(CommonError);
    });

    it("Harus throw Forbidden jika storage grup penuh (FREE max 10)", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({});
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-free" });
      mockDocumentRepository.countByGroupId.mockResolvedValue(10);

      await expect(groupService.uploadGroupDocument("u1", 1, mockFile, "T", [])).rejects.toThrow(CommonError);
    });

    it("Harus throw Forbidden jika storage grup penuh (PREMIUM max 100)", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({});
      mockUserService.isUserPremium
        .mockResolvedValueOnce(true) // Uploader is premium
        .mockResolvedValueOnce(true); // Admin is premium
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-premium" });
      mockDocumentRepository.countByGroupId.mockResolvedValue(100);

      await expect(groupService.uploadGroupDocument("u1", 1, mockFile, "T", [])).rejects.toThrow(CommonError);
    });

    it("Harus berhasil upload dan create document dengan signers", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ group: { name: "G" }, user: { name: "Uploader" } });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner" });
      mockDocumentRepository.countByGroupId.mockResolvedValue(0);
      mockFileStorage.uploadDocument.mockResolvedValue("path/to/pdf");
      mockDocumentRepository.createGroupDocument.mockResolvedValue({ id: "new-doc" });

      await groupService.uploadGroupDocument("u1", 1, mockFile, "Title", ["signer1"]);

      expect(mockFileStorage.uploadDocument).toHaveBeenCalled();
      expect(mockDocumentRepository.createGroupDocument).toHaveBeenCalled();
      expect(mockIo.emit).toHaveBeenCalledWith("group_document_update", expect.objectContaining({ action: "new_document" }));
    });

    it("Harus berhasil upload tanpa signers", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ group: { name: "G" } });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner" });
      mockDocumentRepository.countByGroupId.mockResolvedValue(0);
      mockFileStorage.uploadDocument.mockResolvedValue("path/to/pdf");
      mockDocumentRepository.createGroupDocument.mockResolvedValue({ id: "new-doc" });

      await groupService.uploadGroupDocument("u1", 1, mockFile, "Title", []);

      expect(mockDocumentRepository.createGroupDocument).toHaveBeenCalled();
    });

    it("Harus tetap berhasil tanpa socket jika io tidak ada", async () => {
      const serviceNoIo = new GroupService(
        mockGroupRepository,
        mockGroupMemberRepository,
        mockGroupInvitationRepository,
        mockDocumentRepository,
        mockFileStorage,
        mockGroupDocumentSignerRepository,
        mockVersionRepository,
        mockPdfService,
        mockGroupSignatureRepository,
        null,
        mockUserService
      );

      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ group: { name: "G" } });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner" });
      mockDocumentRepository.countByGroupId.mockResolvedValue(0);
      mockFileStorage.uploadDocument.mockResolvedValue("path/to/pdf");
      mockDocumentRepository.createGroupDocument.mockResolvedValue({ id: "new-doc" });

      const result = await serviceNoIo.uploadGroupDocument("u1", 1, mockFile, "Title", []);
      expect(result).toEqual({ id: "new-doc" });
    });
  });

  // ==========================================================================
  // FINALIZE GROUP DOCUMENT
  // ==========================================================================
  describe("finalizeGroupDocument", () => {
    it("Harus throw UnauthorizedAccess jika bukan anggota grup", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);
      await expect(groupService.finalizeGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus throw NotFound jika dokumen tidak valid", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue(null);

      await expect(groupService.finalizeGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(CommonError);
    });

    it("Harus throw NotFound jika dokumen tidak punya currentVersion", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({ userId: "user-1", currentVersion: null });

      await expect(groupService.finalizeGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(CommonError);
    });

    it("Harus throw UnauthorizedAccess jika bukan Admin atau Owner Dokumen", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });
      mockDocumentRepository.findFirst.mockResolvedValue({ userId: "other-user", currentVersion: {} }); // Not owner

      await expect(groupService.finalizeGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus throw BadRequest jika masih ada pending signers", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({ userId: "user-1", currentVersion: {}, status: "pending" });
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(1);

      await expect(groupService.finalizeGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(CommonError);
      await expect(groupService.finalizeGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(/belum tanda tangan/);
    });

    it("Harus throw BadRequest jika dokumen sudah completed", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({ userId: "user-1", currentVersion: {}, status: "completed" });
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(0);

      await expect(groupService.finalizeGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(CommonError);
    });

    it("Harus throw Forbidden jika limit versi tercapai (FREE max 5)", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({ userId: "user-1", currentVersion: { id: "v1" }, status: "pending" });
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(0);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner-free" });
      mockUserService.isUserPremium.mockResolvedValue(false);
      mockVersionRepository.countByDocumentId.mockResolvedValue(5);

      await expect(groupService.finalizeGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(CommonError);
    });

    it("Harus throw error jika tidak ada tanda tangan", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({ userId: "user-1", currentVersion: { id: "v1" }, status: "pending" });
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(0);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner" });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockVersionRepository.countByDocumentId.mockResolvedValue(1);
      mockGroupSignatureRepository.findAllByVersionId.mockResolvedValue([]);

      await expect(groupService.finalizeGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(/Tidak ada tanda tangan/);
    });

    it("Harus berhasil finalize: generate PDF, update version, update doc", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({
        userId: "user-1",
        currentVersion: { id: "v1" },
        status: "pending",
      });
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(0);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner" });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockVersionRepository.countByDocumentId.mockResolvedValue(1);

      // Mock signatures found
      mockGroupSignatureRepository.findAllByVersionId.mockResolvedValue([{ id: "sig1", positionX: 10, signer: { name: "Test", email: "test@test.com" } }]);

      // Mock PDF Service
      mockPdfService.generateSignedPdf.mockResolvedValue({
        signedFileBuffer: Buffer.from("signed"),
        publicUrl: "http://pdf",
        accessCode: "123456",
      });

      mockVersionRepository.create.mockResolvedValue({ id: "v2" });
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", status: "completed" }); // Final fetch

      const result = await groupService.finalizeGroupDocument(1, "doc-1", "user-1");

      expect(mockPdfService.generateSignedPdf).toHaveBeenCalled();
      expect(mockVersionRepository.create).toHaveBeenCalled();
      expect(mockDocumentRepository.update).toHaveBeenCalledWith("doc-1", expect.objectContaining({ status: "completed" }));
      expect(result.accessCode).toBe("123456");
    });

    it("Harus berhasil finalize tanpa accessCode", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({
        userId: "user-1",
        currentVersion: { id: "v1" },
        status: "pending",
      });
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(0);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner" });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockVersionRepository.countByDocumentId.mockResolvedValue(1);
      mockGroupSignatureRepository.findAllByVersionId.mockResolvedValue([{ id: "sig1", positionX: 10 }]);
      mockPdfService.generateSignedPdf.mockResolvedValue({
        signedFileBuffer: Buffer.from("signed"),
        publicUrl: "http://pdf",
        accessCode: null,
      });
      mockVersionRepository.create.mockResolvedValue({ id: "v2" });
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", status: "completed" });

      const result = await groupService.finalizeGroupDocument(1, "doc-1", "user-1");

      expect(mockGroupSignatureRepository.update).not.toHaveBeenCalled();
      expect(result.accessCode).toBeNull();
    });

    it("Harus berhasil finalize oleh owner dokumen (bukan admin)", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });
      mockDocumentRepository.findFirst.mockResolvedValue({
        userId: "user-1", // User is owner
        currentVersion: { id: "v1" },
        status: "pending",
      });
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(0);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner" });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockVersionRepository.countByDocumentId.mockResolvedValue(1);
      mockGroupSignatureRepository.findAllByVersionId.mockResolvedValue([{ id: "sig1", positionX: 10 }]);
      mockPdfService.generateSignedPdf.mockResolvedValue({
        signedFileBuffer: Buffer.from("signed"),
        publicUrl: "http://pdf",
        accessCode: "123",
      });
      mockVersionRepository.create.mockResolvedValue({ id: "v2" });
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", status: "completed" });

      const result = await groupService.finalizeGroupDocument(1, "doc-1", "user-1");
      expect(result.document.status).toBe("completed");
    });

    it("Harus tetap berhasil tanpa socket jika io tidak ada", async () => {
      const serviceNoIo = new GroupService(
        mockGroupRepository,
        mockGroupMemberRepository,
        mockGroupInvitationRepository,
        mockDocumentRepository,
        mockFileStorage,
        mockGroupDocumentSignerRepository,
        mockVersionRepository,
        mockPdfService,
        mockGroupSignatureRepository,
        null,
        mockUserService
      );

      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({
        userId: "user-1",
        currentVersion: { id: "v1" },
        status: "pending",
      });
      mockGroupDocumentSignerRepository.countPendingSigners.mockResolvedValue(0);
      mockGroupRepository.findById.mockResolvedValue({ adminId: "owner" });
      mockUserService.isUserPremium.mockResolvedValue(true);
      mockVersionRepository.countByDocumentId.mockResolvedValue(1);
      mockGroupSignatureRepository.findAllByVersionId.mockResolvedValue([{ id: "sig1", positionX: 10 }]);
      mockPdfService.generateSignedPdf.mockResolvedValue({
        signedFileBuffer: Buffer.from("signed"),
        publicUrl: "http://pdf",
        accessCode: "123",
      });
      mockVersionRepository.create.mockResolvedValue({ id: "v2" });
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", status: "completed" });

      const result = await serviceNoIo.finalizeGroupDocument(1, "doc-1", "user-1");
      expect(result.url).toBe("http://pdf");
    });
  });

  // ==========================================================================
  // DELETE GROUP DOCUMENT
  // ==========================================================================
  describe("deleteGroupDocument", () => {
    it("Harus throw UnauthorizedAccess jika bukan anggota grup", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);

      await expect(groupService.deleteGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus throw NotFound jika dokumen tidak ditemukan di grup", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue(null);

      await expect(groupService.deleteGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus throw UnauthorizedAccess jika user member biasa (bukan admin/owner doc)", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });
      mockDocumentRepository.findFirst.mockResolvedValue({ userId: "other-guy" });

      await expect(groupService.deleteGroupDocument(1, "doc-1", "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus berhasil menghapus dokumen jika user adalah Admin Grup", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({ id: "doc-1", title: "Deleted Doc" });

      // Mock method delete di repo
      mockDocumentRepository.deleteById = jest.fn().mockResolvedValue(true);

      await groupService.deleteGroupDocument(1, "doc-1", "admin-1");

      expect(mockDocumentRepository.deleteById).toHaveBeenCalledWith("doc-1");
      expect(mockIo.emit).toHaveBeenCalledWith("group_document_update", expect.objectContaining({ action: "removed_document" }));
    });

    it("Harus berhasil menghapus dokumen jika user adalah Owner Dokumen", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member", user: { name: "Doc Owner" } });
      mockDocumentRepository.findFirst.mockResolvedValue({ id: "doc-1", title: "My Doc", userId: "owner-1" });
      mockDocumentRepository.deleteById = jest.fn().mockResolvedValue(true);

      await groupService.deleteGroupDocument(1, "doc-1", "owner-1");

      expect(mockDocumentRepository.deleteById).toHaveBeenCalledWith("doc-1");
    });

    it("Harus menggunakan fallback delete jika deleteById tidak ada", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({ id: "doc-1", title: "Deleted Doc" });

      // Hapus deleteById agar fallback dijalankan
      delete mockDocumentRepository.deleteById;
      mockDocumentRepository.prisma = {
        document: {
          delete: jest.fn().mockResolvedValue(true),
        },
      };

      await groupService.deleteGroupDocument(1, "doc-1", "admin-1");

      expect(mockDocumentRepository.prisma.document.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
    });

    it("Harus menggunakan fallback .delete() jika tidak ada prisma", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({ id: "doc-1", title: "Deleted Doc" });

      // Hapus deleteById dan prisma
      delete mockDocumentRepository.deleteById;
      delete mockDocumentRepository.prisma;
      mockDocumentRepository.delete = jest.fn().mockResolvedValue(true);

      await groupService.deleteGroupDocument(1, "doc-1", "admin-1");

      expect(mockDocumentRepository.delete).toHaveBeenCalledWith("doc-1");
    });

    it("Harus tetap berhasil tanpa socket jika io tidak ada", async () => {
      // Create service tanpa io
      const serviceNoIo = new GroupService(
        mockGroupRepository,
        mockGroupMemberRepository,
        mockGroupInvitationRepository,
        mockDocumentRepository,
        mockFileStorage,
        mockGroupDocumentSignerRepository,
        mockVersionRepository,
        mockPdfService,
        mockGroupSignatureRepository,
        null, // No IO
        mockUserService
      );

      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({ id: "doc-1", title: "Test" });
      mockDocumentRepository.deleteById = jest.fn().mockResolvedValue(true);

      await serviceNoIo.deleteGroupDocument(1, "doc-1", "admin-1");

      expect(mockDocumentRepository.deleteById).toHaveBeenCalledWith("doc-1");
    });
  });

  // ==========================================================================
  // UPDATE GROUP DOCUMENT SIGNERS
  // ==========================================================================
  describe("updateGroupDocumentSigners", () => {
    it("Harus throw UnauthorizedAccess jika bukan anggota grup", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);

      await expect(groupService.updateGroupDocumentSigners(1, "doc-1", "user-1", [])).rejects.toThrow(GroupError);
    });

    it("Harus throw NotFound jika dokumen tidak ditemukan", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findById.mockResolvedValue(null);

      await expect(groupService.updateGroupDocumentSigners(1, "doc-1", "admin", [])).rejects.toThrow(GroupError);
    });

    it("Harus throw NotFound jika dokumen tidak ada di grup ini", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", groupId: 999 }); // Wrong group

      await expect(groupService.updateGroupDocumentSigners(1, "doc-1", "admin", [])).rejects.toThrow(GroupError);
    });

    it("Harus throw UnauthorizedAccess jika bukan admin atau owner dokumen", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", groupId: 1, userId: "other-owner" });

      await expect(groupService.updateGroupDocumentSigners(1, "doc-1", "user-1", [])).rejects.toThrow(GroupError);
    });

    it("Harus throw BadRequest jika dokumen sudah completed", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", groupId: 1, userId: "owner", status: "completed", signerRequests: [] });

      await expect(groupService.updateGroupDocumentSigners(1, "doc-1", "admin", [])).rejects.toThrow(CommonError);
    });

    it("Harus throw BadRequest jika dokumen sudah archived", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findById.mockResolvedValue({ id: "doc-1", groupId: 1, userId: "owner", status: "archived", signerRequests: [] });

      await expect(groupService.updateGroupDocumentSigners(1, "doc-1", "admin", [])).rejects.toThrow(CommonError);
    });

    it("Harus throw BadRequest jika mencoba menghapus user yang sudah SIGNED", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-1",
        groupId: 1,
        userId: "owner",
        status: "pending",
        signerRequests: [{ userId: "u1", status: "SIGNED", user: { name: "A" } }],
      });

      // Mencoba menghapus u1 (tidak ada di list baru)
      await expect(groupService.updateGroupDocumentSigners(1, "doc-1", "admin", ["u2"])).rejects.toThrow(CommonError);
    });

    it("Harus berhasil update signers dan ubah status draft ke pending", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-1",
        groupId: 1,
        userId: "owner",
        status: "draft",
        signerRequests: [],
      });

      // Menambah u1, u2
      await groupService.updateGroupDocumentSigners(1, "doc-1", "admin", ["u1", "u2"]);

      expect(mockGroupDocumentSignerRepository.createSigners).toHaveBeenCalledWith("doc-1", ["u1", "u2"]);
      expect(mockDocumentRepository.update).toHaveBeenCalledWith("doc-1", { status: "pending" }); // Draft -> Pending
    });

    it("Harus berhasil update signers dan ubah status pending ke draft jika signer kosong", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-1",
        groupId: 1,
        userId: "owner",
        status: "pending",
        signerRequests: [{ userId: "u1", status: "PENDING" }],
      });

      // Hapus semua signer
      await groupService.updateGroupDocumentSigners(1, "doc-1", "admin", []);

      expect(mockGroupDocumentSignerRepository.deleteSpecificSigner).toHaveBeenCalledWith("doc-1", "u1");
      expect(mockDocumentRepository.update).toHaveBeenCalledWith("doc-1", { status: "draft" }); // Pending -> Draft
    });

    it("Harus berhasil update jika user adalah owner dokumen (bukan admin)", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-1",
        groupId: 1,
        userId: "owner-1", // user is owner
        status: "draft",
        signerRequests: [],
      });

      await groupService.updateGroupDocumentSigners(1, "doc-1", "owner-1", ["u1"]);

      expect(mockGroupDocumentSignerRepository.createSigners).toHaveBeenCalledWith("doc-1", ["u1"]);
    });

    it("Harus emit socket event setelah update signers", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-1",
        groupId: 1,
        userId: "owner",
        status: "draft",
        signerRequests: [],
      });

      await groupService.updateGroupDocumentSigners(1, "doc-1", "admin", ["u1"]);

      expect(mockIo.to).toHaveBeenCalledWith("group_1");
      expect(mockIo.emit).toHaveBeenCalledWith("group_document_update", expect.objectContaining({ action: "signer_update" }));
    });

    it("Harus tidak update status jika sudah sama", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-1",
        groupId: 1,
        userId: "owner",
        status: "pending",
        signerRequests: [{ userId: "u1", status: "PENDING" }],
      });

      // Replace u1 with u2, status tetap pending
      await groupService.updateGroupDocumentSigners(1, "doc-1", "admin", ["u2"]);

      // Status tidak berubah, update tidak dipanggil untuk status
      expect(mockDocumentRepository.update).not.toHaveBeenCalled();
    });

    it("Harus tetap berhasil tanpa socket jika io tidak ada", async () => {
      const serviceNoIo = new GroupService(
        mockGroupRepository,
        mockGroupMemberRepository,
        mockGroupInvitationRepository,
        mockDocumentRepository,
        mockFileStorage,
        mockGroupDocumentSignerRepository,
        mockVersionRepository,
        mockPdfService,
        mockGroupSignatureRepository,
        null,
        mockUserService
      );

      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findById.mockResolvedValue({
        id: "doc-1",
        groupId: 1,
        userId: "owner",
        status: "draft",
        signerRequests: [],
      });

      await serviceNoIo.updateGroupDocumentSigners(1, "doc-1", "admin", ["u1"]);
      expect(mockGroupDocumentSignerRepository.createSigners).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // UNASSIGN DOCUMENT
  // ==========================================================================
  describe("unassignDocumentFromGroup", () => {
    it("Harus throw UnauthorizedAccess jika bukan anggota grup", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);

      await expect(groupService.unassignDocumentFromGroup(1, "doc-1", "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus throw NotFound jika dokumen tidak ada di grup", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue(null);

      await expect(groupService.unassignDocumentFromGroup(1, "doc-1", "admin")).rejects.toThrow(GroupError);
    });

    it("Harus throw UnauthorizedAccess jika bukan admin atau owner dokumen", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });
      mockDocumentRepository.findFirst.mockResolvedValue({ id: "doc-1", groupId: 1, userId: "other-user" });

      await expect(groupService.unassignDocumentFromGroup(1, "doc-1", "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus berhasil unassign jika user adalah owner dokumen", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });
      mockDocumentRepository.findFirst.mockResolvedValue({ id: "doc-1", groupId: 1, userId: "owner-1", title: "Test" });

      await groupService.unassignDocumentFromGroup(1, "doc-1", "owner-1");

      expect(mockGroupDocumentSignerRepository.deleteByDocumentId).toHaveBeenCalledWith("doc-1");
      expect(mockDocumentRepository.update).toHaveBeenCalledWith("doc-1", { groupId: null, status: "draft" });
    });

    it("Harus berhasil unassign, hapus signers, dan reset ke draft", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({ id: "doc-1", groupId: 1, userId: "owner", title: "Test Doc" });

      await groupService.unassignDocumentFromGroup(1, "doc-1", "admin");

      expect(mockGroupDocumentSignerRepository.deleteByDocumentId).toHaveBeenCalledWith("doc-1");
      expect(mockDocumentRepository.update).toHaveBeenCalledWith("doc-1", { groupId: null, status: "draft" });
      expect(mockIo.emit).toHaveBeenCalledWith("group_document_update", expect.objectContaining({ action: "removed_document" }));
    });

    it("Harus tetap berhasil tanpa socket jika io tidak ada", async () => {
      const serviceNoIo = new GroupService(
        mockGroupRepository,
        mockGroupMemberRepository,
        mockGroupInvitationRepository,
        mockDocumentRepository,
        mockFileStorage,
        mockGroupDocumentSignerRepository,
        mockVersionRepository,
        mockPdfService,
        mockGroupSignatureRepository,
        null,
        mockUserService
      );

      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockDocumentRepository.findFirst.mockResolvedValue({ id: "doc-1", groupId: 1, userId: "owner", title: "Test" });

      await serviceNoIo.unassignDocumentFromGroup(1, "doc-1", "admin");
      expect(mockDocumentRepository.update).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // UPDATE GROUP
  // ==========================================================================
  describe("updateGroup", () => {
    it("Harus throw UnauthorizedAccess jika user bukan anggota", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue(null);

      await expect(groupService.updateGroup(1, "user-1", "New Name")).rejects.toThrow(GroupError);
    });

    it("Harus throw UnauthorizedAccess jika user bukan admin_group", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "member" });

      await expect(groupService.updateGroup(1, "user-1", "New Name")).rejects.toThrow(GroupError);
    });

    it("Harus berhasil update nama grup dan emit socket event", async () => {
      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockGroupRepository.update.mockResolvedValue({ id: 1, name: "New Name" });

      const result = await groupService.updateGroup(1, "admin-1", "New Name");

      expect(mockGroupRepository.update).toHaveBeenCalledWith(1, { name: "New Name" });
      expect(mockIo.emit).toHaveBeenCalledWith("group_info_update", expect.objectContaining({ action: "update_info" }));
      expect(result).toEqual({ id: 1, name: "New Name" });
    });

    it("Harus berhasil update tanpa socket jika io tidak ada", async () => {
      const serviceNoIo = new GroupService(
        mockGroupRepository,
        mockGroupMemberRepository,
        mockGroupInvitationRepository,
        mockDocumentRepository,
        mockFileStorage,
        mockGroupDocumentSignerRepository,
        mockVersionRepository,
        mockPdfService,
        mockGroupSignatureRepository,
        null,
        mockUserService
      );

      mockGroupMemberRepository.findByGroupAndUser.mockResolvedValue({ role: "admin_group" });
      mockGroupRepository.update.mockResolvedValue({ id: 1, name: "New Name" });

      const result = await serviceNoIo.updateGroup(1, "admin-1", "New Name");
      expect(result).toEqual({ id: 1, name: "New Name" });
    });
  });

  // ==========================================================================
  // DELETE GROUP
  // ==========================================================================
  describe("deleteGroup", () => {
    it("Harus throw NotFound jika grup tidak ditemukan", async () => {
      mockGroupRepository.findById.mockResolvedValue(null);

      await expect(groupService.deleteGroup(1, "user-1")).rejects.toThrow(GroupError);
    });

    it("Harus throw UnauthorizedAccess jika user bukan owner grup", async () => {
      mockGroupRepository.findById.mockResolvedValue({ id: 1, adminId: "real-owner" });

      await expect(groupService.deleteGroup(1, "other-user")).rejects.toThrow(GroupError);
    });

    it("Harus berhasil menghapus grup jika user adalah owner", async () => {
      mockGroupRepository.findById.mockResolvedValue({ id: 1, adminId: "owner-1" });
      mockGroupRepository.deleteById.mockResolvedValue(true);

      await groupService.deleteGroup(1, "owner-1");

      expect(mockGroupRepository.deleteById).toHaveBeenCalledWith(1);
    });
  });

  // ==========================================================================
  // GET ALL USER GROUPS
  // ==========================================================================
  describe("getAllUserGroups", () => {
    it("Harus mengembalikan array kosong jika user tidak punya grup", async () => {
      mockGroupMemberRepository.findAllByUserId.mockResolvedValue([]);

      const result = await groupService.getAllUserGroups("user-1");

      expect(result).toEqual([]);
    });

    it("Harus mengembalikan daftar grup dengan info lengkap", async () => {
      mockGroupMemberRepository.findAllByUserId.mockResolvedValue([
        {
          group: {
            id: 1,
            name: "Group A",
            _count: { documents: 5, members: 3 },
            admin: { userStatus: "PREMIUM" },
          },
        },
        {
          group: {
            id: 2,
            name: "Group B",
            _count: { documents: 0, members: 1 },
            admin: { userStatus: "FREE" },
          },
        },
      ]);

      const result = await groupService.getAllUserGroups("user-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        name: "Group A",
        docs_count: 5,
        members_count: 3,
        adminStatus: "PREMIUM",
      });
      expect(result[1]).toEqual({
        id: 2,
        name: "Group B",
        docs_count: 0,
        members_count: 1,
        adminStatus: "FREE",
      });
    });

    it("Harus filter membership tanpa group (null)", async () => {
      mockGroupMemberRepository.findAllByUserId.mockResolvedValue([
        { group: null }, // Invalid/deleted group
        {
          group: {
            id: 1,
            name: "Valid Group",
            _count: { documents: 1, members: 2 },
            admin: { userStatus: "FREE" },
          },
        },
      ]);

      const result = await groupService.getAllUserGroups("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Valid Group");
    });

    it("Harus handle missing _count dengan default 0", async () => {
      mockGroupMemberRepository.findAllByUserId.mockResolvedValue([
        {
          group: {
            id: 1,
            name: "Group No Count",
            admin: { userStatus: "FREE" },
          },
        },
      ]);

      const result = await groupService.getAllUserGroups("user-1");

      expect(result[0].docs_count).toBe(0);
      expect(result[0].members_count).toBe(0);
    });

    it("Harus handle missing admin dengan default FREE", async () => {
      mockGroupMemberRepository.findAllByUserId.mockResolvedValue([
        {
          group: {
            id: 1,
            name: "Group No Admin",
            _count: { documents: 1, members: 1 },
          },
        },
      ]);

      const result = await groupService.getAllUserGroups("user-1");

      expect(result[0].adminStatus).toBe("FREE");
    });
  });
});
