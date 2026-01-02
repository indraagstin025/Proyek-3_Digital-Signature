import { jest } from "@jest/globals";
import { UserService } from "../../src/services/userService.js";
import UserError from "../../src/errors/UserError.js";
import CommonError from "../../src/errors/CommonError.js";

describe("UserService", () => {
  let userService;
  let mockUserRepository;
  let mockFileStorage;

  beforeEach(() => {
    // Mock Repository
    mockUserRepository = {
      findById: jest.fn(),
      update: jest.fn(),
      findProfilePictureByHash: jest.fn(),
      createProfilePicture: jest.fn(),
      deactivateOtherProfilePictures: jest.fn(),
      findProfilePictureById: jest.fn(),
      setProfilePictureActive: jest.fn(),
      findAllProfilePictures: jest.fn(),
      deleteProfilePicture: jest.fn(),
      getUserUsageStats: jest.fn(),
    };

    // Mock File Storage
    mockFileStorage = {
      getPublicUrl: jest.fn(),
      uploadProfilePicture: jest.fn(),
      deleteFile: jest.fn(),
    };

    userService = new UserService(mockUserRepository, mockFileStorage);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================
  describe("constructor", () => {
    it("Harus throw error jika userRepository tidak disediakan", () => {
      expect(() => new UserService(null, mockFileStorage)).toThrow(CommonError);
      expect(() => new UserService(null, mockFileStorage)).toThrow("Dependensi untuk UserService tidak lengkap.");
    });

    it("Harus throw error jika fileStorage tidak disediakan", () => {
      expect(() => new UserService(mockUserRepository, null)).toThrow(CommonError);
    });

    it("Harus berhasil membuat instance jika semua dependensi tersedia", () => {
      const service = new UserService(mockUserRepository, mockFileStorage);
      expect(service).toBeInstanceOf(UserService);
    });
  });

  // ==========================================================================
  // IS USER PREMIUM
  // ==========================================================================
  describe("isUserPremium", () => {
    it("Harus return false jika user tidak ditemukan", async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await userService.isUserPremium("user-123");

      expect(result).toBe(false);
    });

    it("Harus return false jika userStatus bukan PREMIUM", async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: "user-123",
        userStatus: "FREE",
        premiumUntil: null,
      });

      const result = await userService.isUserPremium("user-123");

      expect(result).toBe(false);
    });

    it("Harus return false jika premiumUntil tidak ada", async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: "user-123",
        userStatus: "PREMIUM",
        premiumUntil: null,
      });

      const result = await userService.isUserPremium("user-123");

      expect(result).toBe(false);
    });

    it("Harus return false jika premium sudah expired", async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Kemarin

      mockUserRepository.findById.mockResolvedValue({
        id: "user-123",
        userStatus: "PREMIUM",
        premiumUntil: expiredDate.toISOString(),
      });

      const result = await userService.isUserPremium("user-123");

      expect(result).toBe(false);
    });

    it("Harus return true jika PREMIUM dan belum expired", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 hari lagi

      mockUserRepository.findById.mockResolvedValue({
        id: "user-123",
        userStatus: "PREMIUM",
        premiumUntil: futureDate.toISOString(),
      });

      const result = await userService.isUserPremium("user-123");

      expect(result).toBe(true);
    });
  });

  // ==========================================================================
  // GET MY PROFILE
  // ==========================================================================
  describe("getMyProfile", () => {
    it("Harus throw UserError jika user tidak ditemukan", async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.getMyProfile("user-not-found")).rejects.toThrow(UserError);
    });

    it("Harus mengembalikan user dengan profilePictureUrl yang sudah dikonversi", async () => {
      const mockUser = {
        id: "user-123",
        name: "John Doe",
        email: "john@test.com",
        profilePictureUrl: "avatars/user-123/photo.jpg",
      };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockFileStorage.getPublicUrl.mockReturnValue("https://storage.example.com/avatars/user-123/photo.jpg");

      const result = await userService.getMyProfile("user-123");

      expect(mockFileStorage.getPublicUrl).toHaveBeenCalledWith("avatars/user-123/photo.jpg");
      expect(result.profilePictureUrl).toBe("https://storage.example.com/avatars/user-123/photo.jpg");
    });

    it("Harus mengembalikan user tanpa konversi jika profilePictureUrl kosong", async () => {
      const mockUser = {
        id: "user-123",
        name: "Jane Doe",
        profilePictureUrl: null,
      };
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await userService.getMyProfile("user-123");

      expect(mockFileStorage.getPublicUrl).not.toHaveBeenCalled();
      expect(result.profilePictureUrl).toBeNull();
    });
  });

  // ==========================================================================
  // UPDATE USER PROFILE
  // ==========================================================================
  describe("updateUserProfile", () => {
    it("Harus mengembalikan profil tanpa update jika tidak ada data yang diubah", async () => {
      const mockUser = { id: "user-123", name: "John" };
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await userService.updateUserProfile("user-123", {});

      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it("Harus hanya update field yang diizinkan", async () => {
      const mockUser = { id: "user-123", name: "Updated", phoneNumber: "08123456789" };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(mockUser);

      await userService.updateUserProfile("user-123", {
        name: "Updated",
        phoneNumber: "08123456789",
        email: "hacker@evil.com", // Tidak boleh diupdate
        password: "newpass123", // Tidak boleh diupdate
      });

      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        name: "Updated",
        phoneNumber: "08123456789",
      });
    });

    it("Harus bisa update semua field yang diizinkan", async () => {
      const mockUser = { id: "user-123" };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(mockUser);

      await userService.updateUserProfile("user-123", {
        name: "New Name",
        phoneNumber: "08123456789",
        title: "Software Engineer",
        address: "Jakarta",
      });

      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        name: "New Name",
        phoneNumber: "08123456789",
        title: "Software Engineer",
        address: "Jakarta",
      });
    });
  });

  // ==========================================================================
  // UPDATE USER PROFILE WITH NEW PICTURE
  // ==========================================================================
  describe("updateUserProfileWithNewPicture", () => {
    const mockFile = {
      buffer: Buffer.from("fake-image-data"),
      originalname: "photo.jpg",
      mimetype: "image/jpeg",
    };

    it("Harus throw error jika file tidak valid", async () => {
      // CommonError.BadRequest digunakan untuk validasi input file
      await expect(userService.updateUserProfileWithNewPicture("user-123", {}, null)).rejects.toThrow(CommonError.BadRequest("File untuk diunggah tidak valid atau tidak ada."));
      await expect(userService.updateUserProfileWithNewPicture("user-123", {}, {})).rejects.toThrow(CommonError.BadRequest("File untuk diunggah tidak valid atau tidak ada."));
    });

    it("Harus throw error jika foto sudah pernah diupload (duplicate)", async () => {
      mockUserRepository.findProfilePictureByHash.mockResolvedValue({ id: "existing-pic" });

      await expect(userService.updateUserProfileWithNewPicture("user-123", {}, mockFile)).rejects.toThrow(UserError);
    });

    it("Harus throw error jika upload ke storage gagal", async () => {
      mockUserRepository.findProfilePictureByHash.mockResolvedValue(null);
      mockFileStorage.uploadProfilePicture.mockResolvedValue(null);

      await expect(userService.updateUserProfileWithNewPicture("user-123", {}, mockFile)).rejects.toThrow(CommonError);
      await expect(userService.updateUserProfileWithNewPicture("user-123", {}, mockFile)).rejects.toThrow("Layanan penyimpanan file gagal.");
    });

    it("Harus berhasil upload foto baru dan update profil", async () => {
      mockUserRepository.findProfilePictureByHash.mockResolvedValue(null);
      mockFileStorage.uploadProfilePicture.mockResolvedValue("avatars/user-123/new-photo.jpg");
      mockUserRepository.createProfilePicture.mockResolvedValue({
        id: "pic-new",
        url: "avatars/user-123/new-photo.jpg",
        isActive: true,
      });
      mockUserRepository.deactivateOtherProfilePictures.mockResolvedValue(true);
      mockUserRepository.update.mockResolvedValue({});

      // Mock getFullUserProfileData
      const mockFullData = {
        user: { id: "user-123", name: "John", profilePictureUrl: "https://storage.example.com/new-photo.jpg" },
        profilePictures: [],
      };
      mockUserRepository.findById.mockResolvedValue(mockFullData.user);
      mockUserRepository.findAllProfilePictures.mockResolvedValue([]);
      mockFileStorage.getPublicUrl.mockReturnValue("https://storage.example.com/new-photo.jpg");

      const result = await userService.updateUserProfileWithNewPicture("user-123", { name: "John" }, mockFile);

      expect(mockFileStorage.uploadProfilePicture).toHaveBeenCalledWith(mockFile, "user-123");
      expect(mockUserRepository.createProfilePicture).toHaveBeenCalled();
      expect(mockUserRepository.deactivateOtherProfilePictures).toHaveBeenCalledWith("user-123", "pic-new");
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("profilePictures");
    });
  });

  // ==========================================================================
  // UPDATE USER PROFILE WITH OLD PICTURE
  // ==========================================================================
  describe("updateUserProfileWithOldPicture", () => {
    it("Harus throw error jika foto tidak ditemukan", async () => {
      mockUserRepository.findProfilePictureById.mockResolvedValue(null);

      await expect(userService.updateUserProfileWithOldPicture("user-123", {}, "pic-not-found")).rejects.toThrow(UserError);
    });

    it("Harus berhasil menggunakan foto lama dan update profil", async () => {
      const mockPicture = {
        id: "pic-old",
        url: "avatars/user-123/old-photo.jpg",
        isActive: false,
      };
      mockUserRepository.findProfilePictureById.mockResolvedValue(mockPicture);
      mockUserRepository.deactivateOtherProfilePictures.mockResolvedValue(true);
      mockUserRepository.setProfilePictureActive.mockResolvedValue(true);
      mockUserRepository.update.mockResolvedValue({});

      // Mock getFullUserProfileData
      const mockUser = { id: "user-123", profilePictureUrl: "avatars/user-123/old-photo.jpg" };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findAllProfilePictures.mockResolvedValue([mockPicture]);
      mockFileStorage.getPublicUrl.mockReturnValue("https://storage.example.com/old-photo.jpg");

      const result = await userService.updateUserProfileWithOldPicture("user-123", { name: "Updated" }, "pic-old");

      expect(mockUserRepository.findProfilePictureById).toHaveBeenCalledWith("user-123", "pic-old");
      expect(mockUserRepository.deactivateOtherProfilePictures).toHaveBeenCalledWith("user-123", "pic-old");
      expect(mockUserRepository.setProfilePictureActive).toHaveBeenCalledWith("pic-old");
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("profilePictures");
    });
  });

  // ==========================================================================
  // GET USER PROFILE PICTURES
  // ==========================================================================
  describe("getUserProfilePictures", () => {
    it("Harus mengembalikan array kosong jika tidak ada foto", async () => {
      mockUserRepository.findAllProfilePictures.mockResolvedValue([]);

      const result = await userService.getUserProfilePictures("user-123");

      expect(result).toEqual([]);
    });

    it("Harus mengembalikan null jika repository return null", async () => {
      mockUserRepository.findAllProfilePictures.mockResolvedValue(null);

      const result = await userService.getUserProfilePictures("user-123");

      expect(result).toEqual([]);
    });

    it("Harus mengembalikan foto dengan URL yang sudah dikonversi", async () => {
      const mockPictures = [
        { id: "pic-1", url: "avatars/photo1.jpg", isActive: true },
        { id: "pic-2", url: "avatars/photo2.jpg", isActive: false },
      ];
      mockUserRepository.findAllProfilePictures.mockResolvedValue(mockPictures);
      mockFileStorage.getPublicUrl.mockReturnValueOnce("https://storage.example.com/photo1.jpg").mockReturnValueOnce("https://storage.example.com/photo2.jpg");

      const result = await userService.getUserProfilePictures("user-123");

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe("https://storage.example.com/photo1.jpg");
      expect(result[1].url).toBe("https://storage.example.com/photo2.jpg");
    });
  });

  // ==========================================================================
  // DELETE USER PROFILE PICTURE
  // ==========================================================================
  describe("deleteUserProfilePicture", () => {
    it("Harus throw error jika foto tidak ditemukan", async () => {
      mockUserRepository.findProfilePictureById.mockResolvedValue(null);

      await expect(userService.deleteUserProfilePicture("user-123", "pic-not-found")).rejects.toThrow(UserError);
    });

    it("Harus throw error jika mencoba menghapus foto yang aktif", async () => {
      mockUserRepository.findProfilePictureById.mockResolvedValue({
        id: "pic-active",
        url: "avatars/photo.jpg",
        isActive: true,
      });

      await expect(userService.deleteUserProfilePicture("user-123", "pic-active")).rejects.toThrow(UserError);
    });

    it("Harus berhasil menghapus foto yang tidak aktif", async () => {
      const mockPicture = {
        id: "pic-inactive",
        url: "avatars/old-photo.jpg",
        isActive: false,
      };
      mockUserRepository.findProfilePictureById.mockResolvedValue(mockPicture);
      mockFileStorage.deleteFile.mockResolvedValue(true);
      mockUserRepository.deleteProfilePicture.mockResolvedValue(true);

      // Mock getFullUserProfileData
      const mockUser = { id: "user-123", profilePictureUrl: "avatars/current.jpg" };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findAllProfilePictures.mockResolvedValue([]);
      mockFileStorage.getPublicUrl.mockReturnValue("https://storage.example.com/current.jpg");

      const result = await userService.deleteUserProfilePicture("user-123", "pic-inactive");

      expect(mockFileStorage.deleteFile).toHaveBeenCalledWith("avatars/old-photo.jpg");
      expect(mockUserRepository.deleteProfilePicture).toHaveBeenCalledWith("user-123", "pic-inactive");
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("profilePictures");
    });
  });

  // ==========================================================================
  // GET FULL USER PROFILE DATA
  // ==========================================================================
  describe("getFullUserProfileData", () => {
    it("Harus mengembalikan user dan profilePictures", async () => {
      const mockUser = { id: "user-123", name: "John", profilePictureUrl: null };
      const mockPictures = [{ id: "pic-1", url: "avatars/photo.jpg" }];

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findAllProfilePictures.mockResolvedValue(mockPictures);
      mockFileStorage.getPublicUrl.mockReturnValue("https://storage.example.com/photo.jpg");

      const result = await userService.getFullUserProfileData("user-123");

      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("profilePictures");
      expect(result.user.id).toBe("user-123");
    });
  });

  // ==========================================================================
  // GET USER QUOTA
  // ==========================================================================
  describe("getUserQuota", () => {
    it("Harus throw error jika user tidak ditemukan", async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.getUserQuota("user-not-found")).rejects.toThrow(UserError);
    });

    it("Harus mengembalikan quota untuk user FREE", async () => {
      const mockUser = {
        id: "user-123",
        userStatus: "FREE",
        premiumUntil: null,
      };
      const mockUsage = {
        ownedGroupsCount: 1,
        personalDocsCount: 5,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.getUserUsageStats.mockResolvedValue(mockUsage);

      const result = await userService.getUserQuota("user-123");

      expect(result.userStatus).toBe("FREE");
      expect(result.isPremiumActive).toBe(false);
      expect(result.limits.maxFileSize).toBe(10 * 1024 * 1024); // 10MB
      expect(result.limits.maxFileSizeLabel).toBe("10 MB");
      expect(result.limits.maxOwnedGroups).toBe(1);
      expect(result.usage.ownedGroups).toBe(1);
    });

    it("Harus mengembalikan quota untuk user PREMIUM aktif", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const mockUser = {
        id: "user-456",
        userStatus: "PREMIUM",
        premiumUntil: futureDate.toISOString(),
      };
      const mockUsage = {
        ownedGroupsCount: 5,
        personalDocsCount: 50,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.getUserUsageStats.mockResolvedValue(mockUsage);

      const result = await userService.getUserQuota("user-456");

      expect(result.userStatus).toBe("PREMIUM");
      expect(result.isPremiumActive).toBe(true);
      expect(result.limits.maxFileSize).toBe(50 * 1024 * 1024); // 50MB
      expect(result.limits.maxFileSizeLabel).toBe("50 MB");
      expect(result.limits.maxOwnedGroups).toBe(10);
      expect(result.limits.maxMembersPerGroup).toBe(999);
    });

    it("Harus menghitung quotaPercentages dengan benar", async () => {
      const mockUser = { id: "user-123", userStatus: "FREE", premiumUntil: null };
      const mockUsage = { ownedGroupsCount: 1, personalDocsCount: 10 };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.getUserUsageStats.mockResolvedValue(mockUsage);

      const result = await userService.getUserQuota("user-123");

      // FREE tier: maxOwnedGroups = 1, usage = 1 -> 100%
      expect(result.quotaPercentages.ownedGroups).toBe(100);
    });

    it("Harus menangani usage stats yang kosong/null", async () => {
      const mockUser = { id: "user-123", userStatus: "FREE", premiumUntil: null };
      const mockUsage = {}; // Empty usage

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.getUserUsageStats.mockResolvedValue(mockUsage);

      const result = await userService.getUserQuota("user-123");

      expect(result.usage.ownedGroups).toBe(0);
      expect(result.usage.totalPersonalDocuments).toBe(0);
      expect(result.quotaPercentages.ownedGroups).toBe(0);
    });
  });
});
