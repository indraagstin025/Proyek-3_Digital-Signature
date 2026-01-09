/**
 * @swagger
 * tags:
 *   - name: History
 *     description: Endpoint untuk riwayat aktivitas dan audit trail user
 *
 * /api/history:
 *   get:
 *     tags:
 *       - History
 *     summary: Ambil riwayat aktivitas tanda tangan user
 *     description: |
 *       Mendapatkan riwayat lengkap semua aktivitas tanda tangan user:
 *       - Personal signing history
 *       - Group signing history
 *       - Package signing history
 *       - Semua aktivitas diurutkan berdasarkan waktu terbaru
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Riwayat aktivitas berhasil diambil
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
 *                       type:
 *                         type: string
 *                         enum: [personal, group, package]
 *                         description: Tipe aktivitas tanda tangan
 *                       documentName:
 *                         type: string
 *                       action:
 *                         type: string
 *                         enum: [created, signed, rejected, completed]
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         example: "completed"
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 */

export default {};
