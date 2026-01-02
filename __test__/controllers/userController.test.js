import { createUserController } from "../../src/controllers/userController.js";
import { jest } from "@jest/globals";

describe("UserController", () => {
  let mockUserService;
  let userController;
  let req;
  let res;
  let next;

  beforeEach(() => {
    // 1. Mock Service
    mockUserService = {
      getMyProfile: jest.fn(),
      getFullUserProfileData: jest.fn(),
      updateUserProfileWithNewPicture: jest.fn(),
      updateUserProfileWithOldPicture: jest.fn(),
      updateUserProfile: jest.fn(),
      getUserProfilePictures: jest.fn(),
      deleteUserProfilePicture: jest.fn(),
      getUserQuota: jest.fn(),
    };

    // 2. Inisialisasi Controller dengan Mock Service
    userController = createUserController(mockUserService);

    // 3. Mock Response (res)
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // 4. Mock Next
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // GET MY PROFILE
  // ==========================================================================
  describe("getMyProfile", () => {
    it("Harus mengembalikan status 200 dan data profil user", async () => {
      req = { user: { id: "user-123" } };
      const mockUser = {
        id: "user-123",
        name: "John Doe",
        email: "john@test.com",
        profilePictureUrl: "https://storage.example.com/photo.jpg",
      };
      mockUserService.getMyProfile.mockResolvedValue(mockUser);

      await userController.getMyProfile(req, res, next);

      expect(mockUserService.getMyProfile).toHaveBeenCalledWith("user-123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        data: mockUser,
      });
    });

    it("Harus menggunakan userId dari req.user", async () => {
      req = { user: { id: "different-user-456" } };
      const mockUser = { id: "different-user-456", name: "Jane" };
      mockUserService.getMyProfile.mockResolvedValue(mockUser);

      await userController.getMyProfile(req, res, next);

      expect(mockUserService.getMyProfile).toHaveBeenCalledWith("different-user-456");
    });
  });

  // ==========================================================================
  // UPDATE MY PROFILE
  // ==========================================================================
  describe("updateMyProfile", () => {
    it("Harus mengembalikan data saat ini jika tidak ada perubahan", async () => {
      req = {
        user: { id: "user-123" },
        body: {},
        file: undefined,
      };
      const mockData = {
        user: { id: "user-123", name: "John" },
        profilePictures: [],
      };
      mockUserService.getFullUserProfileData.mockResolvedValue(mockData);

      await userController.updateMyProfile(req, res, next);

      expect(mockUserService.getFullUserProfileData).toHaveBeenCalledWith("user-123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        message: "Tidak ada data yang diubah.",
        data: mockData,
      });
    });

    it("Harus upload foto baru jika ada file", async () => {
      const mockFile = {
        fieldname: "profilePicture",
        originalname: "photo.jpg",
        buffer: Buffer.from("fake-image"),
        mimetype: "image/jpeg",
      };
      req = {
        user: { id: "user-123" },
        body: { name: "Updated Name" },
        file: mockFile,
      };
      const mockUpdatedData = {
        user: { id: "user-123", name: "Updated Name", profilePictureUrl: "https://new-url.jpg" },
        profilePictures: [{ id: "pic-1", url: "https://new-url.jpg" }],
      };
      mockUserService.updateUserProfileWithNewPicture.mockResolvedValue(mockUpdatedData);

      await userController.updateMyProfile(req, res, next);

      expect(mockUserService.updateUserProfileWithNewPicture).toHaveBeenCalledWith("user-123", { name: "Updated Name" }, mockFile);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        message: "Profil berhasil diperbarui",
        data: mockUpdatedData,
      });
    });

    it("Harus menggunakan foto lama jika ada profilePictureId", async () => {
      req = {
        user: { id: "user-123" },
        body: { profilePictureId: "old-pic-456", name: "New Name" },
        file: undefined,
      };
      const mockUpdatedData = {
        user: { id: "user-123", name: "New Name" },
        profilePictures: [{ id: "old-pic-456", url: "https://old-photo.jpg" }],
      };
      mockUserService.updateUserProfileWithOldPicture.mockResolvedValue(mockUpdatedData);

      await userController.updateMyProfile(req, res, next);

      expect(mockUserService.updateUserProfileWithOldPicture).toHaveBeenCalledWith("user-123", { name: "New Name" }, "old-pic-456");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("Harus update data teks saja jika tidak ada file atau profilePictureId", async () => {
      req = {
        user: { id: "user-123" },
        body: { name: "Only Text Update", phoneNumber: "08123456789" },
      };
      // Tidak ada req.file (properti tidak ada, bukan null)
      const mockUser = { id: "user-123", name: "Only Text Update", phoneNumber: "08123456789" };
      const mockPictures = [{ id: "pic-1", url: "https://existing.jpg" }];

      mockUserService.updateUserProfile.mockResolvedValue(mockUser);
      mockUserService.getUserProfilePictures.mockResolvedValue(mockPictures);

      // Await the promise returned by asyncHandler
      await new Promise((resolve) => {
        res.json = jest.fn().mockImplementation(() => {
          resolve();
        });
        res.status = jest.fn().mockReturnValue(res);
        userController.updateMyProfile(req, res, next);
      });

      // Periksa apakah service dipanggil
      expect(mockUserService.updateUserProfile).toHaveBeenCalledWith("user-123", {
        name: "Only Text Update",
        phoneNumber: "08123456789",
      });
      expect(mockUserService.getUserProfilePictures).toHaveBeenCalledWith("user-123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        message: "Profil berhasil diperbarui",
        data: { user: mockUser, profilePictures: mockPictures },
      });
    });

    it("Harus memprioritaskan file upload daripada profilePictureId jika keduanya ada", async () => {
      const mockFile = { originalname: "new.jpg", buffer: Buffer.from("img") };
      req = {
        user: { id: "user-123" },
        body: { profilePictureId: "old-id", name: "Test" },
        file: mockFile,
      };
      const mockUpdatedData = { user: {}, profilePictures: [] };
      mockUserService.updateUserProfileWithNewPicture.mockResolvedValue(mockUpdatedData);

      await userController.updateMyProfile(req, res, next);

      // File upload diprioritaskan
      expect(mockUserService.updateUserProfileWithNewPicture).toHaveBeenCalled();
      expect(mockUserService.updateUserProfileWithOldPicture).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET PROFILE PICTURES
  // ==========================================================================
  describe("getProfilePictures", () => {
    it("Harus mengembalikan daftar foto profil user", async () => {
      req = { user: { id: "user-123" } };
      const mockPictures = [
        { id: "pic-1", url: "https://photo1.jpg", isActive: true },
        { id: "pic-2", url: "https://photo2.jpg", isActive: false },
      ];
      mockUserService.getUserProfilePictures.mockResolvedValue(mockPictures);

      await userController.getProfilePictures(req, res, next);

      expect(mockUserService.getUserProfilePictures).toHaveBeenCalledWith("user-123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        message: "Daftar foto profil berhasil diambil",
        data: mockPictures,
      });
    });

    it("Harus mengembalikan array kosong jika tidak ada foto", async () => {
      req = { user: { id: "user-456" } };
      mockUserService.getUserProfilePictures.mockResolvedValue([]);

      await userController.getProfilePictures(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        message: "Daftar foto profil berhasil diambil",
        data: [],
      });
    });
  });

  // ==========================================================================
  // DELETE PROFILE PICTURE
  // ==========================================================================
  describe("deleteProfilePicture", () => {
    it("Harus menghapus foto profil dan mengembalikan data terbaru", async () => {
      req = {
        user: { id: "user-123" },
        params: { pictureId: "pic-to-delete" },
      };
      const mockResult = {
        user: { id: "user-123", profilePictureUrl: null },
        profilePictures: [],
      };
      mockUserService.deleteUserProfilePicture.mockResolvedValue(mockResult);

      await userController.deleteProfilePicture(req, res, next);

      expect(mockUserService.deleteUserProfilePicture).toHaveBeenCalledWith("user-123", "pic-to-delete");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        message: "Foto profil berhasil dihapus dari history",
        data: mockResult,
      });
    });

    it("Harus menggunakan pictureId dari params", async () => {
      req = {
        user: { id: "user-789" },
        params: { pictureId: "specific-pic-id-999" },
      };
      const mockResult = { user: {}, profilePictures: [] };
      mockUserService.deleteUserProfilePicture.mockResolvedValue(mockResult);

      await userController.deleteProfilePicture(req, res, next);

      expect(mockUserService.deleteUserProfilePicture).toHaveBeenCalledWith("user-789", "specific-pic-id-999");
    });
  });

  // ==========================================================================
  // GET MY QUOTA
  // ==========================================================================
  describe("getMyQuota", () => {
    it("Harus mengembalikan data quota user FREE tier", async () => {
      req = { user: { id: "user-123" } };
      const mockQuota = {
        tier: "FREE",
        documentsUsed: 5,
        documentsLimit: 10,
        signaturesUsed: 20,
        signaturesLimit: 50,
        storageUsedMB: 25,
        storageLimitMB: 100,
      };
      mockUserService.getUserQuota.mockResolvedValue(mockQuota);

      await userController.getMyQuota(req, res, next);

      expect(mockUserService.getUserQuota).toHaveBeenCalledWith("user-123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        data: mockQuota,
      });
    });

    it("Harus mengembalikan data quota user PREMIUM tier", async () => {
      req = { user: { id: "premium-user-456" } };
      const mockQuota = {
        tier: "PREMIUM",
        documentsUsed: 100,
        documentsLimit: -1, // unlimited
        signaturesUsed: 500,
        signaturesLimit: -1,
        storageUsedMB: 500,
        storageLimitMB: 10000,
      };
      mockUserService.getUserQuota.mockResolvedValue(mockQuota);

      await userController.getMyQuota(req, res, next);

      expect(mockUserService.getUserQuota).toHaveBeenCalledWith("premium-user-456");
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        data: mockQuota,
      });
    });

    it("Harus menggunakan userId dari req.user", async () => {
      req = { user: { id: "another-user-id" } };
      mockUserService.getUserQuota.mockResolvedValue({ tier: "FREE" });

      await userController.getMyQuota(req, res, next);

      expect(mockUserService.getUserQuota).toHaveBeenCalledWith("another-user-id");
    });
  });
});
