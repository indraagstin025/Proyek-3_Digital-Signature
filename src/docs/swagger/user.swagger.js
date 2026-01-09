/**
 * @swagger
 * tags:
 *   - name: User
 *     description: Endpoint untuk manajemen profil dan quota user
 *
 * /api/users/me:
 *   get:
 *     tags:
 *       - User
 *     summary: Ambil profil user saat ini
 *     description: Mendapatkan data profil user yang sedang login beserta avatar yang sudah di-format
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profil user berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 *                     profilePictureUrl:
 *                       type: string
 *                       format: uri
 *                       description: Formatted avatar URL (dengan signed URL jika dari storage)
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 *   put:
 *     tags:
 *       - User
 *     summary: Perbarui profil user
 *     description: |
 *       Update data profil user (fullName, phoneNumber) dan/atau upload foto profil baru.
 *       Support 3 skenario: upload foto baru, gunakan foto lama dari history, atau update teks saja.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "John Doe Updated"
 *                 description: Nama lengkap (optional)
 *               phoneNumber:
 *                 type: string
 *                 example: "+6281234567890"
 *                 description: Nomor telepon (optional)
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *                 description: File gambar profil baru (jpg/png, max 5MB, optional)
 *               profilePictureId:
 *                 type: string
 *                 description: ID foto lama dari history untuk digunakan kembali (optional, mutually exclusive dengan profilePicture)
 *     responses:
 *       200:
 *         description: Profil user berhasil diperbarui
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Profil berhasil diperbarui"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       description: Data user yang diupdate
 *                     profilePictures:
 *                       type: array
 *                       description: History foto profil dengan formatted URL
 *       400:
 *         description: Validasi gagal
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/users/me/pictures:
 *   get:
 *     tags:
 *       - User
 *     summary: Ambil history foto profil
 *     description: Mendapatkan semua foto profil yang pernah diupload dengan URL yang sudah di-format
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: History foto berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Daftar foto profil berhasil diambil"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       url:
 *                         type: string
 *                         format: uri
 *                         description: Formatted avatar URL
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/users/me/pictures/{pictureId}:
 *   delete:
 *     tags:
 *       - User
 *     summary: Hapus foto profil dari history
 *     description: Menghapus salah satu foto dari history foto profil dan update profil utama jika perlu
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: pictureId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "picture_id_123"
 *         description: ID foto profil di history
 *     responses:
 *       200:
 *         description: Foto berhasil dihapus dari history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Foto profil berhasil dihapus dari history"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     profilePictures:
 *                       type: array
 *       404:
 *         description: Foto tidak ditemukan
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/users/me/quota:
 *   get:
 *     tags:
 *       - User
 *     summary: Ambil informasi quota/limit user
 *     description: Mendapatkan informasi batas penggunaan fitur user (dokumen, tanda tangan, storage, dll)
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Informasi quota berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     maxDocuments:
 *                       type: integer
 *                       description: Batas maksimal dokumen
 *                     usedDocuments:
 *                       type: integer
 *                       description: Dokumen yang sudah digunakan
 *                     maxSignatures:
 *                       type: integer
 *                       description: Batas maksimal tanda tangan
 *                     usedSignatures:
 *                       type: integer
 *                       description: Tanda tangan yang sudah digunakan
 *                     storageQuota:
 *                       type: integer
 *                       description: Total storage dalam bytes
 *                     usedStorage:
 *                       type: integer
 *                       description: Storage yang sudah digunakan dalam bytes
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/users/me/tour-progress:
 *   patch:
 *     tags:
 *       - User
 *     summary: Perbarui status panduan/tour user
 *     description: Menyimpan progres tour/tutorial pengguna untuk tracking onboarding
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tourKey
 *             properties:
 *               tourKey:
 *                 type: string
 *                 example: "document_creation_tour"
 *                 description: Identifier unik untuk tour/panduan yang diselesaikan
 *     responses:
 *       200:
 *         description: Status panduan berhasil diperbarui
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Tour 'document_creation_tour' berhasil disimpan."
 *                 data:
 *                   type: object
 *       400:
 *         description: Validasi gagal (tourKey tidak diisi)
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 */

export default {};
