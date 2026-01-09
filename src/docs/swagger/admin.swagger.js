/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Endpoint untuk admin dashboard dan manajemen sistem
 *
 * /api/admin/users:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Ambil daftar semua user
 *     description: Mendapatkan daftar lengkap semua user di sistem
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Daftar user berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 25
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       email:
 *                         type: string
 *                       name:
 *                         type: string
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: Akses ditolak (bukan admin)
 *       500:
 *         description: Server error
 *   post:
 *     tags:
 *       - Admin
 *     summary: Membuat user baru
 *     description: Admin membuat user baru dengan Audit Log tracking
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: "SecurePass123!"
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               isSuperAdmin:
 *                 type: boolean
 *                 example: false
 *                 description: Set true untuk membuat super admin
 *     responses:
 *       201:
 *         description: User berhasil dibuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User berhasil dibuat oleh admin."
 *                 data:
 *                   type: object
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: Akses ditolak (bukan admin)
 *       400:
 *         description: Validasi gagal atau email sudah terdaftar
 *       500:
 *         description: Server error
 *
 * /api/admin/users/{userId}:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update data user
 *     description: Admin memperbarui data user
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID user yang akan diupdate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               isSuperAdmin:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User berhasil diupdate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User berhasil diperbaharui."
 *                 data:
 *                   type: object
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: Akses ditolak
 *       404:
 *         description: User tidak ditemukan
 *       500:
 *         description: Server error
 *   delete:
 *     tags:
 *       - Admin
 *     summary: Hapus user
 *     description: Admin menghapus user dengan Audit Log tracking
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID user yang akan dihapus
 *     responses:
 *       200:
 *         description: User berhasil dihapus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User dengan ID xxx berhasil dihapus"
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: Akses ditolak
 *       404:
 *         description: User tidak ditemukan
 *       500:
 *         description: Server error
 *
 * /api/admin/stats:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Ambil statistik sistem
 *     description: Mendapatkan statistik lengkap sistem untuk dashboard admin (Total User, Dokumen, etc)
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Statistik dashboard berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                       example: 150
 *                     totalDocuments:
 *                       type: integer
 *                       example: 1250
 *                     totalSignatures:
 *                       type: integer
 *                       example: 3500
 *                     activeSubscriptions:
 *                       type: integer
 *                       example: 45
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: Akses ditolak (bukan admin)
 *       500:
 *         description: Server error
 *
 * /api/admin/audit-logs:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Ambil log audit sistem
 *     description: Mendapatkan riwayat semua aktivitas penting di sistem dengan pagination
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Halaman untuk pagination
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Jumlah record per halaman
 *     responses:
 *       200:
 *         description: Log audit berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       action:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: Akses ditolak
 *       500:
 *         description: Server error
 *
 * /api/admin/documents:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Ambil semua dokumen
 *     description: Mendapatkan daftar semua dokumen di sistem untuk moderasi content
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Daftar dokumen berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 150
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: Akses ditolak (bukan admin)
 *       500:
 *         description: Server error
 *
 * /api/admin/documents/{documentId}:
 *   delete:
 *     tags:
 *       - Admin
 *     summary: Hapus dokumen secara paksa
 *     description: Admin menghapus dokumen untuk content moderation/keamanan
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dokumen yang akan dihapus
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Konten berbahaya/melanggar TOS"
 *                 description: Alasan penghapusan dokumen
 *     responses:
 *       200:
 *         description: Dokumen berhasil dihapus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Dokumen berhasil dihapus secara paksa demi keamanan/moderasi."
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: Akses ditolak
 *       404:
 *         description: Dokumen tidak ditemukan
 *       500:
 *         description: Server error
 *
 * /api/admin/cron/premium-expiry:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Manual trigger Premium Expiry Check
 *     description: Admin manually trigger cron job untuk mengecek dan expire premium subscriptions (untuk testing)
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Premium expiry check berhasil dijalankan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Premium expiry check executed successfully."
 *                 data:
 *                   type: object
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: Akses ditolak (bukan admin)
 *       500:
 *         description: Server error
 */

export default {};
