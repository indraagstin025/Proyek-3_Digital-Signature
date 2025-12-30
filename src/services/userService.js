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
    // 1. Ambil data user dari Repo (Repo sudah diupdate untuk select status & tanggal)
    const user = await this.userRepository.findById(userId);

    if (!user) return false;

    // 2. Cek apakah status di DB adalah PREMIUM
    if (user.userStatus !== 'PREMIUM') return false;

    // 3. Cek Tanggal Expired
    if (!user.premiumUntil) return false;

    const now = new Date();
    const premiumUntil = new Date(user.premiumUntil);

    // Jika waktu sekarang sudah melewati batas premium -> Return False
    if (now > premiumUntil) {
      return false;
    }

    // Lolos semua cek
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

    if (user.profilePictureUrl) {
      // Menggunakan getPublicUrl (Sync) - Link Bersih
      user.profilePictureUrl = this.fileStorage.getPublicUrl(user.profilePictureUrl);
    }

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
      throw CommonError.InvalidInput("File untuk diunggah tidak valid atau tidak ada.");
    }

    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const existingPicture = await this.userRepository.findProfilePictureByHash(userId, hash);

    // Opsional: Jika ingin mengizinkan upload ulang foto yang sama
    if (existingPicture) {
      throw UserError.DuplicateProfilePicture();
    }

    // 1. Upload ke FileStorage (Bucket 'avatar')
    const filePath = await this.fileStorage.uploadProfilePicture(file, userId);
    if (!filePath) {
      throw CommonError.ServiceUnavailable("Layanan penyimpanan file gagal.");
    }

    // 2. Simpan Path ke Database (Tabel ProfilePictures)
    const newPicture = await this.userRepository.createProfilePicture(userId, {
      url: filePath,
      hash,
      isActive: true,
    });

    // 3. Set foto lain jadi tidak aktif
    await this.userRepository.deactivateOtherProfilePictures(userId, newPicture.id);

    // 4. Update URL aktif di tabel User
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

    // Mapping ke Public URL (Sync)
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

    // Hapus file fisik di Supabase
    await this.fileStorage.deleteFile(picture.url);

    // Hapus record di Database
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
}