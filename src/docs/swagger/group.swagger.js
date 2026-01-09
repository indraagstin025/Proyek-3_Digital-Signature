/**
 * @swagger
 * tags:
 *   - name: Groups
 *     description: Endpoint untuk manajemen grup user dan kolaborasi dokumen
 *
 * /api/groups:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Buat grup baru
 *     description: Membuat grup baru untuk kolaborasi (user pembuat otomatis menjadi admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Tim Legal"
 *                 description: Nama grup yang akan dibuat
 *     responses:
 *       201:
 *         description: Grup berhasil dibuat
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
 *                   example: "Grup berhasil dibuat."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validasi gagal (name kosong atau invalid)
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Server error
 *
 *   get:
 *     tags:
 *       - Groups
 *     summary: Ambil daftar grup user
 *     description: Mendapatkan daftar semua grup yang diikuti user saat ini
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daftar grup berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       memberCount:
 *                         type: integer
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Server error
 *
 * /api/groups/{groupId}:
 *   get:
 *     tags:
 *       - Groups
 *     summary: Ambil detail grup
 *     description: Mendapatkan detail lengkap grup beserta daftar anggota dan dokumennya
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID grup yang akan diambil
 *     responses:
 *       200:
 *         description: Detail grup berhasil diambil
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
 *                       type: integer
 *                     name:
 *                       type: string
 *                     members:
 *                       type: array
 *                       items:
 *                         type: object
 *                     documents:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Format ID grup tidak valid
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: User bukan anggota grup
 *       404:
 *         description: Grup tidak ditemukan
 *       500:
 *         description: Server error
 *
 *   put:
 *     tags:
 *       - Groups
 *     summary: Update nama grup
 *     description: Memperbarui nama grup (hanya admin/owner yang dapat update)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Tim Legal Baru"
 *                 description: Nama grup yang baru
 *     responses:
 *       200:
 *         description: Grup berhasil diperbarui
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
 *                   example: "Nama grup berhasil diperbarui."
 *                 data:
 *                   type: object
 *       400:
 *         description: Validasi gagal (name kosong atau ID invalid)
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: Hanya admin/owner yang dapat mengupdate grup
 *       404:
 *         description: Grup tidak ditemukan
 *       500:
 *         description: Server error
 *
 *   delete:
 *     tags:
 *       - Groups
 *     summary: Hapus grup
 *     description: Menghapus grup secara permanen (hanya owner yang dapat menghapus)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Grup berhasil dihapus
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
 *                   example: "Grup berhasil dihapus."
 *       400:
 *         description: Format ID tidak valid
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: Hanya owner yang dapat menghapus grup
 *       404:
 *         description: Grup tidak ditemukan
 *       500:
 *         description: Server error
 *
 * /api/groups/{groupId}/invitations:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Buat link undangan
 *     description: Membuat tautan undangan (invitation link) untuk bergabung ke grup
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [member, admin, viewer, editor]
 *                 example: "member"
 *                 description: Role untuk member yang menerima undangan
 *     responses:
 *       201:
 *         description: Link undangan berhasil dibuat
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
 *                   example: "Link undangan berhasil dibuat."
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: Token unik undangan
 *                     invitationLink:
 *                       type: string
 *                       example: "http://localhost:5173/join?token=abc123xyz"
 *       400:
 *         description: Validasi gagal (role kosong atau ID invalid)
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: Hanya admin yang dapat membuat undangan
 *       404:
 *         description: Grup tidak ditemukan
 *       500:
 *         description: Server error
 *
 * /api/groups/invitations/accept:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Terima undangan
 *     description: Menerima undangan dan menambahkan user ke dalam grup
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: "abc123xyz"
 *                 description: Token undangan dari link
 *     responses:
 *       201:
 *         description: Berhasil bergabung dengan grup
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
 *                   example: "Berhasil bergabung dengan grup."
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     groupId:
 *                       type: integer
 *                     role:
 *                       type: string
 *       400:
 *         description: Validasi gagal (token kosong atau invalid)
 *       401:
 *         description: Token tidak valid
 *       404:
 *         description: Token tidak ditemukan atau expired
 *       409:
 *         description: User sudah menjadi anggota grup
 *       500:
 *         description: Server error
 *
 * /api/groups/{groupId}/members/{userIdToRemove}:
 *   delete:
 *     tags:
 *       - Groups
 *     summary: Keluarkan anggota dari grup
 *     description: Mengeluarkan anggota dari grup (hanya admin yang dapat melakukan ini)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *       - name: userIdToRemove
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: "user_123"
 *         description: ID user yang akan dikeluarkan
 *     responses:
 *       200:
 *         description: Anggota berhasil dikeluarkan
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
 *                   example: "Anggota berhasil dikeluarkan dari grup."
 *       400:
 *         description: Format ID tidak valid
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: Hanya admin yang dapat mengeluarkan anggota
 *       404:
 *         description: Grup atau member tidak ditemukan
 *       500:
 *         description: Server error
 *
 * /api/groups/{groupId}/documents:
 *   put:
 *     tags:
 *       - Groups
 *     summary: Bagikan dokumen ke grup
 *     description: Menambahkan/membagikan dokumen pribadi ke dalam grup dan menentukan penanda tangan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *             properties:
 *               documentId:
 *                 type: string
 *                 example: "doc_456"
 *                 description: ID dokumen yang akan dibagikan
 *               signerUserIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["user_1", "user_2"]
 *                 description: Daftar user ID yang harus menandatangani
 *     responses:
 *       200:
 *         description: Dokumen berhasil dimasukkan ke grup
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
 *                   example: "Dokumen berhasil dimasukkan ke grup."
 *                 data:
 *                   type: object
 *       400:
 *         description: Validasi gagal (documentId kosong atau format invalid)
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: User bukan owner dokumen atau admin grup
 *       404:
 *         description: Grup atau dokumen tidak ditemukan
 *       500:
 *         description: Server error
 *
 *   delete:
 *     tags:
 *       - Groups
 *     summary: Lepas dokumen dari grup
 *     description: Melepaskan dokumen dari grup (mengembalikan menjadi privat)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *       - name: documentId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         example: "doc_456"
 *     responses:
 *       200:
 *         description: Dokumen berhasil dilepaskan dari grup
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
 *                   example: "Dokumen berhasil dilepaskan dari grup."
 *       400:
 *         description: Format ID tidak valid
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: User bukan owner dokumen atau admin grup
 *       404:
 *         description: Grup atau dokumen tidak ditemukan
 *       500:
 *         description: Server error
 *
 * /api/groups/{groupId}/documents/upload:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Upload dokumen ke grup
 *     description: Upload dokumen baru ke grup dan menentukan siapa yang harus tanda tangan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - signerUserIds
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Kontrak Kerja"
 *                 description: Judul dokumen
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File PDF dokumen (max 50MB)
 *               signerUserIds:
 *                 type: string
 *                 example: '["user_1", "user_2"]'
 *                 description: JSON Array dari user IDs yang harus menandatangani
 *     responses:
 *       201:
 *         description: Dokumen grup berhasil dibuat
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
 *                   example: "Dokumen grup berhasil dibuat dan permintaan tanda tangan telah dikirim."
 *                 data:
 *                   type: object
 *       400:
 *         description: Validasi gagal (file tidak diunggah, signerUserIds kosong, atau format invalid)
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: User bukan admin grup
 *       404:
 *         description: Grup tidak ditemukan
 *       500:
 *         description: Server error
 *
 * /api/groups/{groupId}/documents/{documentId}/signers:
 *   patch:
 *     tags:
 *       - Groups
 *     summary: Update penanda tangan dokumen
 *     description: Mengupdate list penanda tangan (tambah/hapus) di tengah proses signing
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: "doc_789"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signerUserIds
 *             properties:
 *               signerUserIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["user_1", "user_2", "user_3"]
 *                 description: Daftar user ID penanda tangan yang baru
 *     responses:
 *       200:
 *         description: Daftar penanda tangan berhasil diperbarui
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
 *                   example: "Daftar penanda tangan diperbarui."
 *                 data:
 *                   type: object
 *       400:
 *         description: Validasi gagal (signerUserIds kosong atau format invalid)
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: User bukan admin grup
 *       404:
 *         description: Grup atau dokumen tidak ditemukan
 *       500:
 *         description: Server error
 *
 * /api/groups/{groupId}/documents/{documentId}:
 *   delete:
 *     tags:
 *       - Groups
 *     summary: Hapus dokumen grup
 *     description: Menghapus dokumen grup secara permanen
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: "doc_789"
 *     responses:
 *       200:
 *         description: Dokumen berhasil dihapus permanen
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
 *                   example: "Dokumen berhasil dihapus permanen."
 *       400:
 *         description: Format ID tidak valid
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: User bukan owner dokumen atau admin grup
 *       404:
 *         description: Grup atau dokumen tidak ditemukan
 *       500:
 *         description: Server error
 *
 * /api/groups/{groupId}/documents/{documentId}/finalize:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Finalisasi dokumen signing
 *     description: Menyelesaikan proses signing dokumen grup dan menghasilkan final PDF dengan access code
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: "doc_789"
 *     responses:
 *       200:
 *         description: Dokumen berhasil difinalisasi
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
 *                   example: "Dokumen berhasil difinalisasi."
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       description: URL ke file PDF final yang sudah ditandatangani
 *                     accessCode:
 *                       type: string
 *                       example: "ABC123"
 *                       description: Kode akses (PIN) untuk berbagi dokumen
 *                     document:
 *                       type: object
 *                       description: Data dokumen yang sudah difinalisasi
 *       400:
 *         description: Validasi gagal (ID invalid atau belum semua yang tanda tangan)
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: User bukan owner dokumen atau admin grup
 *       404:
 *         description: Grup atau dokumen tidak ditemukan
 *       500:
 *         description: Server error
 */

export default {};
