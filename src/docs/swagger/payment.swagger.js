/**
 * @swagger
 * tags:
 *   - name: Payments
 *     description: Endpoint untuk manajemen pembayaran dan subscription
 *
 * /api/payments/subscribe:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Inisiasi pembayaran subscription
 *     description: |
 *       Membuat transaksi pembayaran untuk subscription plan.
 *       Mengembalikan Snap Token dari Midtrans untuk melakukan pembayaran.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planType
 *             properties:
 *               planType:
 *                 type: string
 *                 enum: [starter, professional, enterprise]
 *                 example: "professional"
 *                 description: Jenis paket subscription
 *     responses:
 *       201:
 *         description: Transaksi berhasil dibuat dengan Snap Token
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
 *                   example: "Transaksi berhasil dibuat."
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       description: ID order dari Midtrans
 *                     snapToken:
 *                       type: string
 *                       description: Token untuk Snap payment gateway Midtrans
 *                     snapUrl:
 *                       type: string
 *                       format: uri
 *                       description: URL redirect ke payment page Midtrans
 *                     amount:
 *                       type: number
 *                       description: Nominal pembayaran dalam rupiah
 *       400:
 *         description: Validasi gagal (planType tidak valid atau format salah)
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/payments/webhook:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Webhook notifikasi pembayaran dari Midtrans
 *     description: |
 *       Endpoint untuk menerima callback/notifikasi dari Midtrans.
 *       Digunakan untuk update status pembayaran secara real-time.
 *       **Catatan:** Endpoint ini TIDAK memerlukan authentication.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - order_id
 *               - transaction_status
 *             properties:
 *               order_id:
 *                 type: string
 *               transaction_id:
 *                 type: string
 *               transaction_status:
 *                 type: string
 *                 enum: [capture, settlement, pending, deny, cancel, expire, refund]
 *               payment_type:
 *                 type: string
 *               gross_amount:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook berhasil diproses
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
 *                   example: "Webhook processed successfully."
 *       500:
 *         description: Server error
 *
 * /api/payments/status/{orderId}:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Ambil status transaksi pembayaran
 *     description: Mendapatkan status transaksi berdasarkan Order ID dari Midtrans
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID dari Midtrans
 *     responses:
 *       200:
 *         description: Status transaksi berhasil diambil
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
 *                     orderId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, completed, cancelled, expired]
 *                     amount:
 *                       type: number
 *                     planType:
 *                       type: string
 *       404:
 *         description: Transaksi tidak ditemukan
 *       401:
 *         description: User tidak authenticated
 *       500:
 *         description: Server error
 *
 * /api/payments/cancel:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Batalkan transaksi pembayaran
 *     description: Membatalkan transaksi pembayaran yang pending atau belum selesai
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 example: "ORDER-123456"
 *                 description: Order ID yang ingin dibatalkan
 *     responses:
 *       200:
 *         description: Transaksi berhasil dibatalkan
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
 *       400:
 *         description: Validasi gagal (Order ID harus diisi)
 *       401:
 *         description: User tidak authenticated
 *       404:
 *         description: Transaksi tidak ditemukan
 *       500:
 *         description: Server error
 */

export default {};
