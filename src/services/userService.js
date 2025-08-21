// src/services/userService.js

export class UserService {
    constructor(userRepository) {
        if (!userRepository) {
            throw new Error('UserRepository harus disediakan.');
        }
        this.userRepository = userRepository;
    }

    async getMyProfile(userId) {
        return this.userRepository.findById(userId);
    }

    async getAllUsers() {
        return this.userRepository.findAll();
    }

    async createUser(userData) {
        // Logika bisnis tambahan (jika ada) bisa diletakkan di sini.
        return this.userRepository.createUser(userData);
    }
}