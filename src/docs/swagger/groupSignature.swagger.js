/**
 * @swagger
 * tags:
 *   - name: Group Signatures
 *     description: Endpoint untuk manajemen tanda tangan dokumen grup
 *
 * /api/group-signatures/{documentId}/sign:
 *   post:
 *     tags:
 *       - Group Signatures
 *     summary: Tanda tangani dokumen grup
 *     description: User menandatangani dokumen grup (Draft -> Final)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dokumen yang akan ditandatangani
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signatureImageUrl
 *               - positionX
 *               - positionY
 *               - pageNumber
 *             properties:
 *               id:
 *                 type: string
 *                 description: Signature UUID
 *               signatureImageUrl:
 *                 type: string
 *                 format: uri
 *                 example: "data:image/png;base64,..."
 *                 description: Base64 atau URL gambar tanda tangan
 *               positionX:
 *                 type: number
 *                 example: 100
 *               positionY:
 *                 type: number
 *                 example: 50
 *               pageNumber:
 *                 type: integer
 *                 example: 1
 *               width:
 *                 type: number
 *                 example: 150
 *               height:
 *                 type: number
 *                 example: 75
 *               method:
 *                 type: string
 *                 example: "draw"
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     isComplete:
 *                       type: boolean
 *                       description: Apakah semua penandatangan sudah selesai
 *                     remainingSigners:
 *                       type: integer
 *                       description: Jumlah penandatangan yang masih pending
 *                     readyToFinalize:
 *                       type: boolean
 *                       description: Siap untuk finalisasi
 *       400:
 *         description: Validasi gagal atau data tidak valid
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: User tidak authorized untuk menandatangani dokumen ini
 *       500:
 *         description: Server error
 *
 * /api/group-signatures/draft/{documentId}:
 *   post:
 *     tags:
 *       - Group Signatures
 *     summary: Simpan draft tanda tangan
 *     description: Menyimpan draft tanda tangan (drop awal sebelum finalisasi)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: documentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dokumen
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signatureImageUrl
 *               - positionX
 *               - positionY
 *               - pageNumber
 *             properties:
 *               id:
 *                 type: string
 *                 description: Signature UUID
 *               signatureImageUrl:
 *                 type: string
 *                 format: uri
 *               pageNumber:
 *                 type: integer
 *               positionX:
 *                 type: number
 *               positionY:
 *                 type: number
 *               width:
 *                 type: number
 *               height:
 *                 type: number
 *               method:
 *                 type: string
 *     responses:
 *       201:
 *         description: Draft tanda tangan berhasil disimpan
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
 *                   example: "Draft tanda tangan tersimpan."
 *                 data:
 *                   type: object
 *       400:
 *         description: Document ID tidak valid atau validasi gagal
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/group-signatures/{signatureId}/position:
 *   patch:
 *     tags:
 *       - Group Signatures
 *     summary: Update posisi tanda tangan
 *     description: Update posisi draft tanda tangan (saat di-drag atau di-resize)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: signatureId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID signature draft
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               positionX:
 *                 type: number
 *                 example: 150
 *               positionY:
 *                 type: number
 *                 example: 100
 *               width:
 *                 type: number
 *                 example: 180
 *               height:
 *                 type: number
 *                 example: 90
 *               pageNumber:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Posisi tanda tangan berhasil diupdate
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
 *                   example: "Posisi tanda tangan diperbarui."
 *                 data:
 *                   type: object
 *       400:
 *         description: Signature ID tidak valid atau validasi gagal
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/group-signatures/{signatureId}:
 *   delete:
 *     tags:
 *       - Group Signatures
 *     summary: Hapus draft tanda tangan
 *     description: Menghapus draft tanda tangan
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: signatureId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID signature draft yang akan dihapus
 *     responses:
 *       200:
 *         description: Draft tanda tangan berhasil dihapus
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
 *                   example: "Draft tanda tangan dihapus."
 *       400:
 *         description: Signature ID tidak valid
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/group-signatures/finalize:
 *   post:
 *     tags:
 *       - Group Signatures
 *     summary: Finalisasi dokumen grup
 *     description: Admin/owner grup menyelesaikan dokumen grup (semua tanda tangan selesai)
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - groupId
 *               - documentId
 *             properties:
 *               groupId:
 *                 type: string
 *                 example: "group_123"
 *                 description: ID grup yang memiliki dokumen
 *               documentId:
 *                 type: string
 *                 example: "doc_456"
 *                 description: ID dokumen yang akan difinalisasi
 *     responses:
 *       200:
 *         description: Dokumen grup berhasil difinalisasi
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
 *                     url:
 *                       type: string
 *                       format: uri
 *                       description: URL dokumen yang sudah difinalisasi
 *                     accessCode:
 *                       type: string
 *                       description: PIN keamanan untuk akses dokumen
 *       400:
 *         description: Group ID atau Document ID tidak valid
 *       401:
 *         description: User tidak authenticated
 *       403:
 *         description: User tidak authorized (bukan admin grup)
 *       500:
 *         description: Server error
 */

export default {};
