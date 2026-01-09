/**
 * @swagger
 * tags:
 *   - name: Signatures
 *     description: Endpoint untuk signing dan verifikasi tanda tangan digital (personal, group, package)
 *
 * /api/signatures/personal:
 *   post:
 *     tags:
 *       - Signatures
 *     summary: Tanda tangani dokumen secara personal
 *     description: |
 *       Menambahkan tanda tangan digital ke dokumen secara mandiri (personal signature).
 *       Support single atau batch signatures untuk multiple documents.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required:
 *                   - documentVersionId
 *                   - signatureImageUrl
 *                   - positionX
 *                   - positionY
 *                   - pageNumber
 *                 properties:
 *                   documentVersionId:
 *                     type: string
 *                     description: ID versi dokumen (untuk single signature)
 *                   method:
 *                     type: string
 *                     enum: [draw, upload, typed]
 *                     description: Metode tanda tangan
 *                   signatureImageUrl:
 *                     type: string
 *                     format: uri
 *                     description: Base64 atau URL gambar tanda tangan
 *                   positionX:
 *                     type: number
 *                   positionY:
 *                     type: number
 *                   pageNumber:
 *                     type: integer
 *                   width:
 *                     type: number
 *                   height:
 *                     type: number
 *                   displayQrCode:
 *                     type: boolean
 *                     default: true
 *               - type: object
 *                 required:
 *                   - signatures
 *                 properties:
 *                   signatures:
 *                     type: array
 *                     minItems: 1
 *                     items:
 *                       type: object
 *                       required:
 *                         - documentVersionId
 *                         - signatureImageUrl
 *                         - positionX
 *                         - positionY
 *                         - pageNumber
 *                       properties:
 *                         documentVersionId:
 *                           type: string
 *                         method:
 *                           type: string
 *                           enum: [draw, upload, typed]
 *                         signatureImageUrl:
 *                           type: string
 *                           format: uri
 *                         positionX:
 *                           type: number
 *                         positionY:
 *                           type: number
 *                         pageNumber:
 *                           type: integer
 *                         width:
 *                           type: number
 *                         height:
 *                           type: number
 *                         displayQrCode:
 *                           type: boolean
 *                           default: true
 *     responses:
 *       200:
 *         description: Dokumen berhasil ditandatangani
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
 *                   example: "Dokumen berhasil ditandatangani."
 *                 data:
 *                   type: object
 *                   description: Updated document dengan signature yang ditambahkan
 *       400:
 *         description: Validasi gagal (data tanda tangan tidak lengkap)
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/signatures/verify/{signatureId}:
 *   get:
 *     tags:
 *       - Signatures
 *     summary: Verifikasi tanda tangan (Scan QR) - PUBLIC
 *     description: |
 *       Endpoint PUBLIC untuk verifikasi tanda tangan dengan QR Code scanning.
 *       Cek apakah signature terdaftar di sistem. Support personal, package, dan group signatures.
 *       Jika dokumen terkunci (PIN), return status isLocked: true.
 *     parameters:
 *       - name: signatureId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tanda tangan dari QR Code
 *     responses:
 *       200:
 *         description: Verifikasi berhasil diproses
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
 *                     isLocked:
 *                       type: boolean
 *                       description: Apakah dokumen dilindungi PIN
 *                     signatureId:
 *                       type: string
 *                     documentTitle:
 *                       type: string
 *                     requireUpload:
 *                       type: boolean
 *                     verificationStatus:
 *                       type: string
 *       404:
 *         description: Signature tidak ditemukan
 *       500:
 *         description: Server error
 *
 * /api/signatures/verify/{signatureId}/unlock:
 *   post:
 *     tags:
 *       - Signatures
 *     summary: Buka kunci dokumen dengan PIN - PUBLIC
 *     description: |
 *       Endpoint PUBLIC untuk membuka kunci dokumen yang dilindungi dengan PIN/access code.
 *       Support personal, package, dan group signatures.
 *     parameters:
 *       - name: signatureId
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
 *             required:
 *               - accessCode
 *             properties:
 *               accessCode:
 *                 type: string
 *                 example: "123456"
 *                 description: PIN/Kode Akses untuk membuka dokumen
 *     responses:
 *       200:
 *         description: Dokumen berhasil dibuka kunci
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
 *                   example: "Akses diberikan."
 *                 data:
 *                   type: object
 *                   properties:
 *                     isLocked:
 *                       type: boolean
 *                       example: false
 *                     requireUpload:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Kode Akses salah atau tidak diisi
 *       401:
 *         description: Dokumen tidak ditemukan atau akses ditolak
 *       403:
 *         description: Akses ditolak (PIN salah)
 *       500:
 *         description: Server error
 *
 * /api/signatures/verify-file:
 *   post:
 *     tags:
 *       - Signatures
 *     summary: Verifikasi file PDF manual - PUBLIC
 *     description: |
 *       Endpoint PUBLIC untuk verifikasi dengan upload file PDF fisik.
 *       Membandingkan hash dokumen uploaded dengan arsip di sistem untuk validasi authenticity.
 *       Support personal, package, dan group signatures.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - signatureId
 *               - file
 *             properties:
 *               signatureId:
 *                 type: string
 *                 description: ID tanda tangan dari QR Code
 *               accessCode:
 *                 type: string
 *                 description: PIN/Kode Akses (jika dokumen terkunci)
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File PDF untuk diverifikasi
 *     responses:
 *       200:
 *         description: Verifikasi file berhasil
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     isValid:
 *                       type: boolean
 *                       description: Apakah file cocok dengan arsip sistem
 *                     isLocked:
 *                       type: boolean
 *                     verificationStatus:
 *                       type: string
 *                       enum: [VALID, INVALID]
 *                     documentTitle:
 *                       type: string
 *       400:
 *         description: Validasi gagal (signatureId atau file tidak ada)
 *       404:
 *         description: Signature atau dokumen tidak ditemukan
 *       500:
 *         description: Server error
 */

export default {};
