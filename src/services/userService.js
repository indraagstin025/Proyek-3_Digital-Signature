import crypto from "crypto";
import UserError from "../errors/UserError.js";
import CommonError from "../errors/CommonError.js";

export class UserService {
  constructor(userRepository, fileStorage) {
    if (!userRepository || !fileStorage) {
      throw CommonError.InternalServerError("Dependensi untuk UserService tidak lengkap.");
    }
    this.userRepository = userRepository;
    this.fileStorage = fileStorage;
  }

  /**
   * [BARU] Helper Centralized untuk cek status Premium.
   * Method ini akan dipanggil oleh service lain (Document/Group/Package)
   * untuk menentukan limitasi fitur.
   * * @param {string} userId
   * @returns {Promise<boolean>} true jika PREMIUM dan BELUM EXPIRED.
   */
  async isUserPremium(userId) {
    const user = await this.userRepository.findById(userId);

    if (!user) return false;

    if (user.userStatus !== "PREMIUM") return false;

    if (!user.premiumUntil) return false;

    const now = new Date();
    const premiumUntil = new Date(user.premiumUntil);

    if (now > premiumUntil) {
      return false;
    }

    return true;
  }

  /**
   * Mengambil profil user login.
   * Mengubah path file menjadi Public URL bersih.
   * [NOTE] Data 'userStatus' dan 'premiumUntil' otomatis terbawa karena
   * update pada PrismaUserRepository.
   */
  async getMyProfile(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw UserError.NotFound();
    }

    // [REMOVE]: Formatting dipindahkan ke Controller/Helper agar terpusat
    // if (user.profilePictureUrl) { ... }

    return user;
  }

  /**
   * Update data teks user (Tanpa ganti foto).
   */
  async updateUserProfile(userId, profileData) {
    const allowedUpdates = {};
    if (profileData.name !== undefined) allowedUpdates.name = profileData.name;
    if (profileData.phoneNumber !== undefined) allowedUpdates.phoneNumber = profileData.phoneNumber;
    if (profileData.title !== undefined) allowedUpdates.title = profileData.title;
    if (profileData.address !== undefined) allowedUpdates.address = profileData.address;

    if (Object.keys(allowedUpdates).length === 0) {
      return this.getMyProfile(userId);
    }

    await this.userRepository.update(userId, allowedUpdates);

    return this.getMyProfile(userId);
  }

  /**
   * Upload foto baru ke bucket 'avatar' (Public) dan update profil.
   */
  async updateUserProfileWithNewPicture(userId, profileData, file) {
    const allowedUpdates = {};
    if (profileData.name !== undefined) allowedUpdates.name = profileData.name;
    if (profileData.phoneNumber !== undefined) allowedUpdates.phoneNumber = profileData.phoneNumber;
    if (profileData.title !== undefined) allowedUpdates.title = profileData.title;
    if (profileData.address !== undefined) allowedUpdates.address = profileData.address;

    if (!file || !file.buffer) {
      throw CommonError.BadRequest("File untuk diunggah tidak valid atau tidak ada.");
    }

    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const existingPicture = await this.userRepository.findProfilePictureByHash(userId, hash);

    if (existingPicture) {
      throw UserError.DuplicateProfilePicture();
    }

    const filePath = await this.fileStorage.uploadProfilePicture(file, userId);
    if (!filePath) {
      throw CommonError.ServiceUnavailable("Layanan penyimpanan file gagal.");
    }

    const newPicture = await this.userRepository.createProfilePicture(userId, {
      url: filePath,
      hash,
      isActive: true,
    });

    await this.userRepository.deactivateOtherProfilePictures(userId, newPicture.id);

    allowedUpdates.profilePictureUrl = newPicture.url;

    await this.userRepository.update(userId, allowedUpdates);

    return this.getFullUserProfileData(userId);
  }

  /**
   * Menggunakan kembali foto lama dari history.
   */
  async updateUserProfileWithOldPicture(userId, profileData, profilePictureId) {
    const picture = await this.userRepository.findProfilePictureById(userId, profilePictureId);
    if (!picture) {
      throw UserError.PictureNotFound();
    }

    await this.userRepository.deactivateOtherProfilePictures(userId, picture.id);
    await this.userRepository.setProfilePictureActive(picture.id);

    const allowedUpdates = { ...profileData };
    allowedUpdates.profilePictureUrl = picture.url;

    await this.userRepository.update(userId, allowedUpdates);

    return this.getFullUserProfileData(userId);
  }

  /**
   * Mengambil history foto profil dengan URL Public.
   */
  async getUserProfilePictures(userId) {
    const picturesFromDb = await this.userRepository.findAllProfilePictures(userId);

    if (!picturesFromDb || picturesFromDb.length === 0) {
      return [];
    }

    const picturesWithPublicUrls = picturesFromDb.map((picture) => {
      return {
        ...picture,
        url: this.fileStorage.getPublicUrl(picture.url),
      };
    });

    return picturesWithPublicUrls;
  }

  /**
   * Menghapus foto profil dari storage dan database.
   */
  async deleteUserProfilePicture(userId, pictureId) {
    const picture = await this.userRepository.findProfilePictureById(userId, pictureId);
    if (!picture) {
      throw UserError.PictureNotFound();
    }
    if (picture.isActive) {
      throw UserError.CannotDeleteActivePicture();
    }

    await this.fileStorage.deleteFile(picture.url);

    await this.userRepository.deleteProfilePicture(userId, pictureId);

    return this.getFullUserProfileData(userId);
  }

  /**
   * Helper untuk mengambil data lengkap (User + History Foto).
   */
  async getFullUserProfileData(userId) {
    const userProfile = await this.getMyProfile(userId);
    const pictureHistory = await this.getUserProfilePictures(userId);

    return {
      user: userProfile,
      profilePictures: pictureHistory,
    };
  }

  /**
   * [QUOTA] Mengambil informasi quota dan usage untuk user.
   * Digunakan oleh Frontend untuk menampilkan limit & progress bar.
   * @param {string} userId
   * @returns {Promise<Object>} Quota info dengan limits dan current usage
   */
  async getUserQuota(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw UserError.NotFound();

    const isPremium = await this.isUserPremium(userId);

    const limits = {
      maxFileSize: isPremium ? 50 * 1024 * 1024 : 10 * 1024 * 1024,
      maxFileSizeLabel: isPremium ? "50 MB" : "10 MB",
      maxVersionsPerDocument: isPremium ? 20 : 5,
      maxOwnedGroups: isPremium ? 10 : 1,
      maxMembersPerGroup: isPremium ? 999 : 5,
      maxDocsPerGroup: isPremium ? 100 : 10,
      maxDocsPerPackage: isPremium ? 20 : 3,
    };

    const usage = await this.userRepository.getUserUsageStats(userId);

    return {
      userStatus: user.userStatus,
      premiumUntil: user.premiumUntil,
      isPremiumActive: isPremium,
      limits,
      usage: {
        ownedGroups: usage.ownedGroupsCount || 0,
        totalPersonalDocuments: usage.personalDocsCount || 0,
      },

      quotaPercentages: {
        ownedGroups: Math.round(((usage.ownedGroupsCount || 0) / limits.maxOwnedGroups) * 100),
      },
    };
  }

  /**
   * [BARU] Update status Tour Progress user.
   * @param {string} userId
   * @param {string} tourKey - ID unik untuk tour (misal: 'dashboard_intro')
   */
  async updateTourProgress(userId, tourKey) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw UserError.NotFound();

    const currentProgress = user.tourProgress || {};

    const newProgress = {
      ...currentProgress,
      [tourKey]: true,
    };

    await this.userRepository.update(userId, {
      tourProgress: newProgress,
    });

    return newProgress;
  }
}
