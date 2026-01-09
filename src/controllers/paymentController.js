import asyncHandler from "../utils/asyncHandler.js";
import CommonError from "../errors/CommonError.js";

export const createPaymentController = (paymentService) => {
  return {
    /**
     * @description Inisiasi pembayaran subscription dengan Midtrans Snap.
     * * **Proses Kode:**
     * 1. Menerima `planType` dari body request (starter, professional, atau enterprise).
     * 2. Memvalidasi bahwa user sudah authenticated.
     * 3. Memanggil `paymentService.createSubscription` untuk membuat transaksi di Midtrans.
     * 4. Mengembalikan Snap Token dan URL redirect untuk pembayaran.
     * * @route   POST /api/payments/subscribe
     * @param {import("express").Request} req - Body: planType (string).
     * @param {import("express").Response} res - Response object.
     * @throws {CommonError.Unauthorized} Jika user tidak authenticated.
     */
    createSubscription: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const { planType } = req.body;

      if (!userId) throw CommonError.Unauthorized("Sesi berakhir, silakan login kembali.");

      const transaction = await paymentService.createSubscription(userId, planType);

      return res.status(201).json({
        status: "success",
        message: "Transaksi berhasil dibuat.",
        data: {
          orderId: transaction.orderId,
          snapToken: transaction.snapToken,
          snapUrl: transaction.snapUrl,
          amount: transaction.amount,
        },
      });
    }),

    /**
     * @description Callback Webhook dari Midtrans untuk notifikasi status pembayaran.
     * * **Proses Kode:**
     * 1. Menerima notification object dari Midtrans sebagai request body.
     * 2. Memanggil `paymentService.handleWebhook` untuk memproses dan update status transaksi.
     * 3. Update database dengan status pembayaran terbaru (pending, settlement, cancelled, dll).
     * 4. Melakukan aktivitas terkait (misal: grant subscription akses, update user profile).
     * * @route   POST /api/payments/webhook
     * @param {import("express").Request} req - Body: Midtrans notification object.
     * @param {import("express").Response} res - Response object.
     * @note Endpoint ini PUBLIC dan tidak memerlukan authentication cookie.
     */
    handleWebhook: asyncHandler(async (req, res, next) => {
      const notification = req.body;

      await paymentService.handleWebhook(notification);

      return res.status(200).json({
        status: "success",
        message: "Webhook processed successfully.",
      });
    }),

    /**
     * @description Mendapatkan detail transaksi berdasarkan Order ID.
     * @route   GET /api/payments/status/:orderId
     */

    /**
     * @description Membatalkan transaksi pembayaran yang pending atau belum selesai.
     * * **Proses Kode:**
     * 1. Menerima `orderId` dari body request.
     * 2. Memvalidasi bahwa user sudah authenticated dan orderId valid.
     * 3. Memanggil `paymentService.cancelTransaction` untuk:
     * - Batalkan transaksi di Midtrans.
     * - Update status di database menjadi 'cancelled'.
     * - Rollback subscription jika sudah ter-apply.
     * 4. Mengembalikan status keberhasilan.
     * * @route   POST /api/payments/cancel
     * @param {import("express").Request} req - Body: orderId (string).
     * @param {import("express").Response} res - Response object.
     * @throws {CommonError.Unauthorized} Jika user tidak authenticated.
     * @throws {CommonError.BadRequest} Jika orderId tidak valid.
     * @throws {CommonError.NotFound} Jika transaksi tidak ditemukan.
     */
    cancelTransaction: asyncHandler(async (req, res, next) => {
      const userId = req.user?.id;
      const { orderId } = req.body;

      if (!userId) throw CommonError.Unauthorized("Unauthorized");
      if (!orderId) throw CommonError.BadRequest("Order ID is required");

      const result = await paymentService.cancelTransaction(orderId, userId);

      return res.status(200).json({
        status: "success",
        message: result.message,
      });
    }),

    /**
     * @description Mendapatkan status transaksi pembayaran berdasarkan Order ID.
     * * **Proses Kode:**
     * 1. Menerima `orderId` dari parameter URL.
     * 2. Memanggil `paymentService.getTransactionByOrderId` untuk ambil data transaksi dari database.
     * 3. Memvalidasi bahwa transaksi ditemukan, jika tidak throw NotFound error.
     * 4. Mengembalikan detail transaksi: orderId, status, amount, planType.
     * * @route   GET /api/payments/status/:orderId
     * @param {import("express").Request} req - Params: orderId (string).
     * @param {import("express").Response} res - Response object.
     * @throws {CommonError.NotFound} Jika transaksi tidak ditemukan.
     */
    getTransactionStatus: asyncHandler(async (req, res, next) => {
      const { orderId } = req.params;
      const transaction = await paymentService.getTransactionByOrderId(orderId);

      if (!transaction) throw CommonError.NotFound("Transaksi tidak ditemukan.");

      return res.status(200).json({
        status: "success",
        data: {
          orderId: transaction.orderId,
          status: transaction.status,
          amount: transaction.amount,
          planType: transaction.planType,
        },
      });
    }),
  };
};
