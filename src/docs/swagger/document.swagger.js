/**
 * @swagger
 * tags:
 *   - name: Documents
 *     description: Endpoint untuk manajemen dokumen, versi, dan analisis
 *
 * /api/documents:
 *   post:
 *     tags:
 *       - Documents
 *     summary: Upload dokumen baru
 *     description: Upload dan buat dokumen baru untuk ditandatangani
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - documentFile
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Kontrak Kerja"
 *               type:
 *                 type: string
 *                 example: "application/pdf"
 *                 description: Tipe MIME dokumen
 *               documentFile:
 *                 type: string
 *                 format: binary
 *                 description: File dokumen (PDF/DOC, max 50MB)
 *     responses:
 *       201:
 *         description: Dokumen berhasil dibuat
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
 *                   example: "Dokumen berhasil diunggah."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     type:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validasi gagal atau file tidak valid
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 *   get:
 *     tags:
 *       - Documents
 *     summary: Ambil daftar dokumen user
 *     description: Mendapatkan daftar semua dokumen milik user dengan search filter
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search dokumen berdasarkan title
 *     responses:
 *       200:
 *         description: Daftar dokumen berhasil diambil
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
 *                         type: string
 *                       title:
 *                         type: string
 *                       type:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/documents/{id}:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Ambil detail dokumen
 *     description: Mendapatkan detail lengkap satu dokumen beserta metadata
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dokumen
 *     responses:
 *       200:
 *         description: Detail dokumen berhasil diambil
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
 *       404:
 *         description: Dokumen tidak ditemukan
 *       401:
 *         description: User tidak authenticated atau akses ditolak
 *       500:
 *         description: Server error
 *
 *   put:
 *     tags:
 *       - Documents
 *     summary: Perbarui metadata dokumen
 *     description: Memperbarui metadata dokumen (judul, tipe, dll)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Kontrak Kerja (Revisi)"
 *               type:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dokumen berhasil diperbarui
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
 *                   example: "Dokumen berhasil diperbaharui."
 *       404:
 *         description: Dokumen tidak ditemukan
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 *   delete:
 *     tags:
 *       - Documents
 *     summary: Hapus dokumen
 *     description: Menghapus dokumen dan semua versi serta riwayatnya
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dokumen berhasil dihapus
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
 *                   example: "Dokumen dan semua riwayatnya berhasil dihapus."
 *       404:
 *         description: Dokumen tidak ditemukan
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/documents/{documentId}/history:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Ambil riwayat versi dokumen
 *     description: Mendapatkan daftar semua versi/revisi dari dokumen
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dokumen
 *     responses:
 *       200:
 *         description: Riwayat versi berhasil diambil
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
 *                       versionId:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       createdBy:
 *                         type: string
 *       404:
 *         description: Dokumen tidak ditemukan
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/documents/{documentId}/versions/{versionId}/restore:
 *   post:
 *     tags:
 *       - Documents
 *     summary: Restore ke versi lama
 *     description: Mengembalikan dokumen ke versi sebelumnya (Rollback)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: versionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Versi dokumen berhasil diganti
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
 *                   example: "Versi dokumen berhasil diganti."
 *                 data:
 *                   type: object
 *       404:
 *         description: Dokumen atau versi tidak ditemukan
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/documents/{documentId}/versions/{versionId}:
 *   delete:
 *     tags:
 *       - Documents
 *     summary: Hapus versi spesifik
 *     description: Menghapus satu versi tertentu dari riwayat dokumen
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: versionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Versi dokumen berhasil dihapus
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
 *                   example: "Versi dokumen berhasil dihapus."
 *       404:
 *         description: Dokumen atau versi tidak ditemukan
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/documents/{documentId}/file:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Ambil file dokumen aktif
 *     description: Mendapatkan Signed URL untuk melihat atau mengunduh dokumen aktif (current version)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: purpose
 *         in: query
 *         schema:
 *           type: string
 *           enum: [view, download]
 *           default: "view"
 *         description: Tujuan akses (view di browser atau download file)
 *     responses:
 *       200:
 *         description: Signed URL berhasil dibuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 url:
 *                   type: string
 *                   example: "https://storage.example.com/doc.pdf?token=xyz"
 *                 mode:
 *                   type: string
 *                   enum: [view, download]
 *       404:
 *         description: Dokumen tidak ditemukan
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/documents/{documentId}/versions/{versionId}/file:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Ambil file versi lama
 *     description: Mendapatkan Signed URL untuk mengunduh versi lama dokumen
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: versionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Signed URL versi lama berhasil dibuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 url:
 *                   type: string
 *                 expiresIn:
 *                   type: integer
 *                   example: 60
 *                   description: URL berlaku selama X detik
 *                 mode:
 *                   type: string
 *                   example: "download"
 *       404:
 *         description: Dokumen atau versi tidak ditemukan
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/documents/{documentId}/analyze:
 *   post:
 *     tags:
 *       - Documents
 *     summary: Analisis dokumen dengan AI
 *     description: Menganalisis konten dokumen menggunakan AI (ringkasan, insight, dll)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dokumen yang akan dianalisis
 *     responses:
 *       200:
 *         description: Analisis AI berhasil dilakukan
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
 *                     summary:
 *                       type: string
 *                       description: Ringkasan konten dokumen
 *                     insights:
 *                       type: array
 *                       description: Insight penting dari dokumen
 *       404:
 *         description: Dokumen tidak ditemukan
 *       400:
 *         description: Analisis gagal (AI error atau dokumen tidak valid)
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 */

export default {};
