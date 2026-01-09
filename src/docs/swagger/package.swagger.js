/**
 * @swagger
 * tags:
 *   - name: Packages
 *     description: Endpoint untuk manajemen paket dokumen tanda tangan
 *
 * /api/packages:
 *   post:
 *     tags:
 *       - Packages
 *     summary: Buat paket dokumen baru
 *     description: |
 *       Membuat paket (envelope) baru yang berisi beberapa dokumen untuk ditandatangani sekaligus.
 *       Paket memungkinkan user mengelompokkan multiple dokumen untuk proses signing yang efisien.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentIds
 *               - title
 *             properties:
 *               documentIds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                 example: ["doc_123", "doc_456", "doc_789"]
 *                 description: Array ID dokumen yang akan dimasukkan ke paket (required)
 *               title:
 *                 type: string
 *                 example: "Paket Kontrak 2024"
 *                 description: Judul/nama paket (optional)
 *     responses:
 *       201:
 *         description: Paket berhasil dibuat
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
 *                   example: "Paket berhasil dibuat."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     documentIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validasi gagal (documentIds harus array dan tidak kosong)
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/packages/{packageId}:
 *   get:
 *     tags:
 *       - Packages
 *     summary: Ambil detail paket
 *     description: Mendapatkan detail lengkap paket beserta list dokumen di dalamnya
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: packageId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID paket dokumen
 *     responses:
 *       200:
 *         description: Detail paket berhasil diambil
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
 *                     title:
 *                       type: string
 *                     ownerId:
 *                       type: string
 *                     documents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           status:
 *                             type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: Akses ditolak (bukan owner paket)
 *       404:
 *         description: Paket tidak ditemukan
 *       500:
 *         description: Server error
 *
 * /api/packages/{packageId}/sign:
 *   post:
 *     tags:
 *       - Packages
 *     summary: Tanda tangani semua dokumen dalam paket
 *     description: |
 *       Memproses tanda tangan untuk semua dokumen di dalam paket sekaligus.
 *       Mendukung multiple signatures untuk setiap dokumen dalam paket.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: packageId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID paket dokumen
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signatures
 *             properties:
 *               signatures:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - documentId
 *                     - signatureImageUrl
 *                     - positionX
 *                     - positionY
 *                     - pageNumber
 *                   properties:
 *                     documentId:
 *                       type: string
 *                       description: ID dokumen dalam paket
 *                     signatureImageUrl:
 *                       type: string
 *                       format: uri
 *                       description: Base64 atau URL gambar tanda tangan
 *                     positionX:
 *                       type: number
 *                     positionY:
 *                       type: number
 *                     pageNumber:
 *                       type: integer
 *                     width:
 *                       type: number
 *                     height:
 *                       type: number
 *     responses:
 *       200:
 *         description: Semua dokumen paket berhasil ditandatangani
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
 *                   example: "Paket berhasil ditandatangani."
 *                 data:
 *                   type: object
 *                   properties:
 *                     packageId:
 *                       type: string
 *                     completedDocuments:
 *                       type: integer
 *                     totalDocuments:
 *                       type: integer
 *       400:
 *         description: Validasi gagal (signatures harus array dan tidak kosong)
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: Akses ditolak
 *       404:
 *         description: Paket tidak ditemukan
 *       500:
 *         description: Server error
 */

export default {};
