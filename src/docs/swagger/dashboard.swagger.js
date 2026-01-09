/**
 * @swagger
 * tags:
 *   - name: Dashboard
 *     description: Endpoint untuk dashboard user
 *
 * /api/dashboard:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Ambil ringkasan data dashboard
 *     description: Mendapatkan ringkasan statistik dan data terbaru untuk dashboard user
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Data dashboard berhasil diambil
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
 *                   example: "Data dashboard berhasil dimuat."
 *                 data:
 *                   type: object
 *                   properties:
 *                     recentDocuments:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pendingSignatures:
 *                       type: array
 *                       items:
 *                         type: object
 *                     statistics:
 *                       type: object
 *       401:
 *         description: User tidak authenticated atau cookie tidak valid
 *       500:
 *         description: Server error
 */

export default {};
