import fileStorage from "../repository/FileStorage.js";


export class UserService {
    constructor(userRepository) {
        if (!userRepository) {
            throw new Error('UserRepository harus disediakan.');
        }
        this.userRepository = userRepository;
        this.fileStorage = fileStorage;
    }

    async getMyProfile(userId) {
        return this.userRepository.findById(userId);
    }

    async getAllUsers() {
        return this.userRepository.findAll();
    }

    async createUser(userData) {
        return this.userRepository.createUser(userData);
    }

    async updateUserProfile(userId, profileData, file) {
        // Logika untuk memfilter field yang boleh diubah oleh pengguna
        const allowedUpdates = {};
        if (profileData.name !== undefined) allowedUpdates.name = profileData.name;
        if (profileData.phoneNumber !== undefined) allowedUpdates.phoneNumber = profileData.phoneNumber;
        if (profileData.title !== undefined) allowedUpdates.title = profileData.title;
        if (profileData.address !== undefined) allowedUpdates.address = profileData.address;

        if (file) {
            const publicUrl = await this.fileStorage.uploadProfilePicture(file, userId);
            allowedUpdates.profilePictureUrl = publicUrl;
        }

        // Validasi agar tidak mengirim objek kosong ke repository
        if (Object.keys(allowedUpdates).length === 0) {
            throw new Error("Tidak ada data valid yang dikirim untuk diperbarui.");
        }

        return this.userRepository.update(userId, allowedUpdates);
    }
}