import crypto from "crypto";

export class UserService {
    constructor(userRepository, fileStorage) {
        if (!userRepository) throw new Error("UserRepository harus disediakan.");
        if (!fileStorage) throw new Error("FileStorage harus disediakan.");

        this.userRepository = userRepository;
        this.fileStorage = fileStorage;
    }

    // ------------------- Ambil profil -------------------
    async getMyProfile(userId) {
        return this.userRepository.findById(userId);
    }

    // ------------------- Update data user tanpa foto -------------------
    async updateUserProfile(userId, profileData) {
        const allowedUpdates = {};
        if (profileData.name !== undefined) allowedUpdates.name = profileData.name;
        if (profileData.phoneNumber !== undefined) allowedUpdates.phoneNumber = profileData.phoneNumber;
        if (profileData.title !== undefined) allowedUpdates.title = profileData.title;
        if (profileData.address !== undefined) allowedUpdates.address = profileData.address;

        if (Object.keys(allowedUpdates).length === 0) {
            return this.userRepository.findById(userId);
        }

        return this.userRepository.update(userId, allowedUpdates);
    }

    async updateUserProfileWithNewPicture(userId, profileData, file) {
        try {
            // 1️⃣ Validasi userId
            if (!userId || typeof userId !== "string" || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
                throw new Error("ID user tidak valid. Pastikan Anda sudah login.");
            }

            console.log("[DEBUG] userId valid:", userId);

            // 2️⃣ Siapkan data profil yang boleh diupdate
            const allowedUpdates = {};
            if (profileData.name !== undefined) allowedUpdates.name = profileData.name;
            if (profileData.phoneNumber !== undefined) allowedUpdates.phoneNumber = profileData.phoneNumber;
            if (profileData.title !== undefined) allowedUpdates.title = profileData.title;
            if (profileData.address !== undefined) allowedUpdates.address = profileData.address;

            // 3️⃣ Ambil buffer file
            const fileBuffer = file.buffer || Buffer.from(await file.arrayBuffer());
            if (!Buffer.isBuffer(fileBuffer)) {
                throw new Error("File yang diupload tidak valid.");
            }
            console.log("[DEBUG] File buffer length:", fileBuffer.length);

            // 4️⃣ Buat hash SHA-256
            const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
            console.log("[DEBUG] Generated hash:", hash);

            // 5️⃣ Cek apakah foto sudah ada di history
            const existingPicture = await this.userRepository.findProfilePictureByHash(userId, hash);
            if (existingPicture) {
                throw new Error("Foto ini sudah pernah diupload, gunakan foto lama dari history.");
            }
            console.log("[DEBUG] Foto belum ada di history, siap untuk upload");

            // 6️⃣ Upload ke Supabase
            const publicUrl = await this.fileStorage.uploadProfilePicture(file, userId);
            if (!publicUrl || typeof publicUrl !== "string") {
                throw new Error("Gagal mengunggah foto ke storage.");
            }
            console.log("[DEBUG] publicUrl:", publicUrl);

            // 7️⃣ Simpan ke database dengan UUID valid
            console.log("[DEBUG] Membuat record UserProfilePicture dengan data:", {
                userId,
                url: publicUrl,
                hash,
                isActive: true,
            });

            const newPicture = await this.userRepository.createProfilePicture(userId, {
                url: publicUrl,
                hash,
                isActive: true,
            });

            if (!newPicture || !newPicture.id) {
                throw new Error("Gagal menyimpan data foto di database.");
            }
            console.log("[DEBUG] Foto berhasil dibuat di database, id:", newPicture.id);

            // 8️⃣ Nonaktifkan foto lain
            await this.userRepository.deactivateOtherProfilePictures(userId, newPicture.id);

            // 9️⃣ Update user.profilePictureUrl
            allowedUpdates.profilePictureUrl = newPicture.url;

            // 🔟 Update user
            const updatedUser = await this.userRepository.update(userId, allowedUpdates);
            console.log("[DEBUG] Profil user berhasil diperbarui:", updatedUser);

            return updatedUser;

        } catch (error) {
            console.error("[ERROR] updateUserProfileWithNewPicture:", error);
            throw error;
        }
    }


    // ------------------- Update dengan foto lama dari history -------------------
    async updateUserProfileWithOldPicture(userId, profileData, profilePictureId) {
        const allowedUpdates = {};
        if (profileData.name !== undefined) allowedUpdates.name = profileData.name;
        if (profileData.phoneNumber !== undefined) allowedUpdates.phoneNumber = profileData.phoneNumber;
        if (profileData.title !== undefined) allowedUpdates.title = profileData.title;
        if (profileData.address !== undefined) allowedUpdates.address = profileData.address;

        const picture = await this.userRepository.findProfilePictureById(userId, profilePictureId);
        if (!picture) throw new Error("Foto profil tidak ditemukan atau bukan milik Anda.");

        await this.userRepository.deactivateOtherProfilePictures(userId, picture.id);
        await this.userRepository.setProfilePictureActive(picture.id);

        allowedUpdates.profilePictureUrl = picture.url;

        return this.userRepository.update(userId, allowedUpdates);
    }

    // ------------------- Ambil semua foto history -------------------
    async getUserProfilePictures(userId) {
        return this.userRepository.findAllProfilePictures(userId);
    }

    // ------------------- Hapus foto dari history -------------------
    async deleteUserProfilePicture(userId, pictureId) {
        const picture = await this.userRepository.findProfilePictureById(userId, pictureId);
        if (!picture) throw new Error("Foto profil tidak ditemukan atau bukan milik Anda.");

        // Hapus file dari Supabase
        await this.fileStorage.deleteFile(picture.url);

        // Hapus record di database dengan transaksi
        await this.userRepository.deletePictureInTransaction(userId, pictureId, picture.isActive);

        return { success: true };
    }
}
