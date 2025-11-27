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

  async getMyProfile(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw UserError.NotFound();
    }

    if (user.profilePictureUrl) {
      const signedUrl = await this.fileStorage.getSignedUrl(user.profilePictureUrl, 3600);
      user.profilePictureUrl = signedUrl;
    }

    return user;
  }

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

  async getUserProfilePictures(userId) {
    const picturesFromDb = await this.userRepository.findAllProfilePictures(userId);

    if (!picturesFromDb || picturesFromDb.length === 0) {
      return [];
    }

    const picturesWithSignedUrls = await Promise.all(
      picturesFromDb.map(async (picture) => {
        const signedUrl = await this.fileStorage.getSignedUrl(picture.url);
        return {
          ...picture,
          url: signedUrl,
        };
      })
    );

    return picturesWithSignedUrls;
  }

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

  async getFullUserProfileData(userId) {
    const userProfile = await this.getMyProfile(userId);
    const pictureHistory = await this.getUserProfilePictures(userId);

    return {
      user: userProfile,
      profilePictures: pictureHistory,
    };
  }
}
