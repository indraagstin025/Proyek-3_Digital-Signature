import { PaymentService } from "../../src/services/paymentService"; // Sesuaikan path
import prisma from "../../src/config/prismaClient";
import midtransClient from "midtrans-client";
import crypto from "crypto";
import CommonError from "../../src/errors/CommonError";
import PaymentError from "../../src/errors/PaymentError";

// --- MOCKS ---
jest.mock("../../src/config/prismaClient", () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(), // Opsional
  },
  auditLog: {
    create: jest.fn(),
  },
  // Mock $transaction agar langsung mengeksekusi callback dengan instance prisma mock
  $transaction: jest.fn((callback) => callback(require("../../src/config/prismaClient"))),
}));

jest.mock("midtrans-client", () => {
  const mSnap = {
    createTransaction: jest.fn(),
    transaction: {
      notification: jest.fn(),
      cancel: jest.fn(),
    },
  };
  return {
    Snap: jest.fn(() => mSnap),
  };
});

describe("PaymentService", () => {
  let paymentService;
  let mockSnapInstance;

  // Setup Env Vars Dummy
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, MIDTRANS_SERVER_KEY: "SB-Mid-server-TEST-KEY" };

    paymentService = new PaymentService();
    // Ambil instance mock snap yang dibuat di constructor
    mockSnapInstance = new midtransClient.Snap();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  // ==========================================================
  // 1. TEST CREATE SUBSCRIPTION
  // ==========================================================
  describe("createSubscription", () => {
    const userId = "user-123";
    const mockUser = { id: userId, name: "Test User", email: "test@mail.com", phoneNumber: "08123" };

    it("should create a monthly subscription successfully", async () => {
      // Mock User Found
      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock Midtrans Response
      const mockMidtransResponse = { token: "snap-token-123", redirect_url: "http://redirect" };
      mockSnapInstance.createTransaction.mockResolvedValue(mockMidtransResponse);

      // Mock DB Transaction Create
      prisma.transaction.create.mockResolvedValue({ id: 1 });

      const result = await paymentService.createSubscription(userId, "PREMIUM_MONTHLY");

      // Assertions
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: userId } });

      // Cek parameter ke Midtrans
      expect(mockSnapInstance.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_details: expect.objectContaining({ gross_amount: 10000 }),
          item_details: expect.arrayContaining([expect.objectContaining({ id: "PREMIUM_MONTHLY", price: 10000 })]),
          custom_field1: userId,
        })
      );

      // Cek simpan ke DB Local
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            status: "PENDING",
            planType: "PREMIUM_MONTHLY",
            snapToken: "snap-token-123",
          }),
        })
      );

      expect(result).toHaveProperty("snapToken", "snap-token-123");
    });

    it("should throw CommonError if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(paymentService.createSubscription(userId, "PREMIUM_MONTHLY")).rejects.toThrow(CommonError);
    });

    it("should throw PaymentError if Midtrans fails", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockSnapInstance.createTransaction.mockRejectedValue(new Error("Midtrans down"));

      await expect(paymentService.createSubscription(userId, "PREMIUM_MONTHLY")).rejects.toThrow(PaymentError);
    });

    it("should create a yearly subscription successfully", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const mockMidtransResponse = { token: "snap-token-yearly", redirect_url: "http://redirect" };
      mockSnapInstance.createTransaction.mockResolvedValue(mockMidtransResponse);
      prisma.transaction.create.mockResolvedValue({ id: 2 });

      const result = await paymentService.createSubscription(userId, "PREMIUM_YEARLY");

      expect(mockSnapInstance.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_details: expect.objectContaining({ gross_amount: 100000 }),
          item_details: expect.arrayContaining([expect.objectContaining({ id: "PREMIUM_YEARLY", price: 100000 })]),
        })
      );

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planType: "PREMIUM_YEARLY",
          }),
        })
      );

      expect(result.amount).toBe(100000);
    });

    it("should create subscription with groupId and include it in custom field", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const mockMidtransResponse = { token: "snap-token-group", redirect_url: "http://redirect" };
      mockSnapInstance.createTransaction.mockResolvedValue(mockMidtransResponse);
      prisma.transaction.create.mockResolvedValue({ id: 3 });

      const groupId = "group-123";
      const result = await paymentService.createSubscription(userId, "PREMIUM_MONTHLY", groupId);

      expect(mockSnapInstance.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_field3: groupId,
        })
      );

      expect(result.snapToken).toBe("snap-token-group");
    });

    it("should throw CommonError for invalid plan type", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(paymentService.createSubscription(userId, "INVALID_PLAN")).rejects.toThrow(CommonError);
    });

    it("should handle user without phoneNumber", async () => {
      const userNoPhone = { id: userId, name: "Test User", email: "test@mail.com" };
      prisma.user.findUnique.mockResolvedValue(userNoPhone);
      const mockMidtransResponse = { token: "snap-token-123", redirect_url: "http://redirect" };
      mockSnapInstance.createTransaction.mockResolvedValue(mockMidtransResponse);
      prisma.transaction.create.mockResolvedValue({ id: 4 });

      const result = await paymentService.createSubscription(userId, "PREMIUM_MONTHLY");

      expect(mockSnapInstance.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_details: expect.objectContaining({
            phone: undefined,
          }),
        })
      );

      expect(result.snapToken).toBe("snap-token-123");
    });
  });

  // ==========================================================
  // 2. TEST HANDLE WEBHOOK
  // ==========================================================
  describe("handleWebhook", () => {
    const orderId = "ORDER-123";
    const grossAmount = "10000.00";
    const statusCode = "200";
    const serverKey = "SB-Mid-server-TEST-KEY";

    // Helper untuk generate signature yang valid
    const generateValidSignature = () => {
      const input = orderId + statusCode + grossAmount + serverKey;
      return crypto.createHash("sha512").update(input).digest("hex");
    };

    const mockNotification = {
      order_id: orderId,
      transaction_status: "settlement",
      fraud_status: "accept",
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: generateValidSignature(), // Signature valid
    };

    it("should throw Error if Signature is Invalid (Security Check)", async () => {
      const fakeNotification = { ...mockNotification, signature_key: "fake-signature" };
      mockSnapInstance.transaction.notification.mockResolvedValue(fakeNotification);

      const result = await paymentService.handleWebhook(fakeNotification);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid Signature Key");
    });

    it("should return error if Transaction not found in DB", async () => {
      mockSnapInstance.transaction.notification.mockResolvedValue(mockNotification);
      prisma.transaction.findUnique.mockResolvedValue(null); // Not found

      const result = await paymentService.handleWebhook(mockNotification);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Transaction not found");
    });

    it("should return success immediately if transaction already SUCCESS (Idempotency)", async () => {
      mockSnapInstance.transaction.notification.mockResolvedValue(mockNotification);
      prisma.transaction.findUnique.mockResolvedValue({ status: "SUCCESS" });

      const result = await paymentService.handleWebhook(mockNotification);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Already processed");
      // Pastikan tidak ada update database lagi
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it("should handle SETTLEMENT: update transaction, upgrade user, create audit log", async () => {
      // 1. Mock Midtrans response
      mockSnapInstance.transaction.notification.mockResolvedValue(mockNotification);

      // 2. Mock DB Transaction Found (Status PENDING)
      const mockDbTransaction = {
        orderId,
        userId: "user-1",
        status: "PENDING",
        planType: "PREMIUM_MONTHLY", // 30 Hari
        user: { premiumUntil: null }, // User belum premium
      };
      prisma.transaction.findUnique.mockResolvedValue(mockDbTransaction);

      // 3. Run
      const result = await paymentService.handleWebhook(mockNotification);

      // 4. Assertions
      expect(result.success).toBe(true);

      // Cek update status transaksi
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { orderId },
        data: { status: "SUCCESS" },
      });

      // Cek User Upgrade (30 Hari dari sekarang karena premiumUntil null)
      // Kita tidak bisa cek tanggal exact karena new Date(), jadi kita cek properti
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            userStatus: "PREMIUM",
            // premiumUntil harus ada (objek Date)
          }),
        })
      );

      // Cek Audit Log
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it("should stack duration correctly if user is already PREMIUM", async () => {
      mockSnapInstance.transaction.notification.mockResolvedValue(mockNotification);

      // User masih premium sampai besok
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const mockDbTransaction = {
        orderId,
        userId: "user-1",
        status: "PENDING",
        planType: "PREMIUM_MONTHLY",
        user: { premiumUntil: tomorrow }, // Masih aktif
      };
      prisma.transaction.findUnique.mockResolvedValue(mockDbTransaction);

      await paymentService.handleWebhook(mockNotification);

      // Ambil argumen panggilan update user
      const updateCall = prisma.user.update.mock.calls[0][0];
      const newExpiry = updateCall.data.premiumUntil;

      // Logika: Besok + 30 Hari = 31 Hari dari sekarang
      // Kita cek selisih waktu kasar (approx)
      const diffDays = (newExpiry - new Date()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(30);
    });

    it("should handle EXPIRE/CANCEL status correctly", async () => {
      const expireNotification = { ...mockNotification, transaction_status: "expire" };
      // Regenerate signature karena status berubah
      const input = orderId + statusCode + grossAmount + serverKey;
      expireNotification.signature_key = crypto.createHash("sha512").update(input).digest("hex");

      mockSnapInstance.transaction.notification.mockResolvedValue(expireNotification);
      prisma.transaction.findUnique.mockResolvedValue({ orderId, status: "PENDING", user: {} });

      await paymentService.handleWebhook(expireNotification);

      // Status harus jadi FAILED
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { orderId },
        data: { status: "FAILED" },
      });
      // User TIDAK boleh diupdate
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("should handle CAPTURE with fraud_accept (fraud_status)", async () => {
      const captureNotification = { ...mockNotification, transaction_status: "capture", fraud_status: "accept" };
      const input = orderId + statusCode + grossAmount + serverKey;
      captureNotification.signature_key = crypto.createHash("sha512").update(input).digest("hex");

      mockSnapInstance.transaction.notification.mockResolvedValue(captureNotification);
      const mockDbTransaction = {
        orderId,
        userId: "user-1",
        status: "PENDING",
        planType: "PREMIUM_YEARLY",
        user: { premiumUntil: null },
      };
      prisma.transaction.findUnique.mockResolvedValue(mockDbTransaction);

      const result = await paymentService.handleWebhook(captureNotification);

      expect(result.success).toBe(true);
      // Harus upgrade user untuk CAPTURE dengan fraud_accept
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it("should handle CAPTURE with fraud_challenge (no upgrade)", async () => {
      const challengeNotification = { ...mockNotification, transaction_status: "capture", fraud_status: "challenge" };
      const input = orderId + statusCode + grossAmount + serverKey;
      challengeNotification.signature_key = crypto.createHash("sha512").update(input).digest("hex");

      mockSnapInstance.transaction.notification.mockResolvedValue(challengeNotification);
      prisma.transaction.findUnique.mockResolvedValue({ orderId, status: "PENDING", user: {} });

      const result = await paymentService.handleWebhook(challengeNotification);

      expect(result.success).toBe(true);
      // Status jadi CHALLENGE tapi tidak upgrade
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { orderId },
        data: { status: "CHALLENGE" },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("should handle PENDING status", async () => {
      const pendingNotification = { ...mockNotification, transaction_status: "pending" };
      const input = orderId + statusCode + grossAmount + serverKey;
      pendingNotification.signature_key = crypto.createHash("sha512").update(input).digest("hex");

      mockSnapInstance.transaction.notification.mockResolvedValue(pendingNotification);
      prisma.transaction.findUnique.mockResolvedValue({ orderId, status: "PENDING", user: {} });

      const result = await paymentService.handleWebhook(pendingNotification);

      expect(result.success).toBe(true);
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { orderId },
        data: { status: "PENDING" },
      });
    });

    it("should handle DENY status", async () => {
      const denyNotification = { ...mockNotification, transaction_status: "deny" };
      const input = orderId + statusCode + grossAmount + serverKey;
      denyNotification.signature_key = crypto.createHash("sha512").update(input).digest("hex");

      mockSnapInstance.transaction.notification.mockResolvedValue(denyNotification);
      prisma.transaction.findUnique.mockResolvedValue({ orderId, status: "PENDING", user: {} });

      const result = await paymentService.handleWebhook(denyNotification);

      expect(result.success).toBe(true);
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { orderId },
        data: { status: "FAILED" },
      });
    });

    it("should reset premiumUntil if it is in the past (restart fresh)", async () => {
      mockSnapInstance.transaction.notification.mockResolvedValue(mockNotification);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10); // 10 hari yang lalu

      const mockDbTransaction = {
        orderId,
        userId: "user-1",
        status: "PENDING",
        planType: "PREMIUM_YEARLY",
        user: { premiumUntil: pastDate },
      };
      prisma.transaction.findUnique.mockResolvedValue(mockDbTransaction);

      const result = await paymentService.handleWebhook(mockNotification);

      expect(result.success).toBe(true);

      const updateCall = prisma.user.update.mock.calls[0][0];
      const newExpiry = updateCall.data.premiumUntil;

      // Harus dihitung dari hari ini, tidak dari 10 hari yang lalu
      const diffDays = (newExpiry - new Date()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(364); // Hampir 365 hari untuk YEARLY
    });
  });

  // ==========================================================
  // 3. TEST CANCEL TRANSACTION
  // ==========================================================
  describe("cancelTransaction", () => {
    const orderId = "ORDER-CANCEL";
    const userId = "user-1";

    it("should cancel successfully locally and on Midtrans", async () => {
      // Mock DB Transaction Found
      prisma.transaction.findUnique.mockResolvedValue({
        orderId,
        userId: userId,
        status: "PENDING",
      });

      // Mock Midtrans Cancel Success
      mockSnapInstance.transaction.cancel.mockResolvedValue({});

      const result = await paymentService.cancelTransaction(orderId, userId);

      expect(mockSnapInstance.transaction.cancel).toHaveBeenCalledWith(orderId);
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { orderId },
        data: { status: "CANCELLED" },
      });
      expect(result.success).toBe(true);
    });

    it("should proceed to local cancel if Midtrans returns 404", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        orderId,
        userId: userId,
        status: "PENDING",
      });

      // Mock Midtrans Error 404
      const error404 = new Error("Not Found");
      error404.httpStatusCode = 404;
      mockSnapInstance.transaction.cancel.mockRejectedValue(error404);

      const result = await paymentService.cancelTransaction(orderId, userId);

      // Tetap harus update DB lokal jadi CANCELLED
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { orderId },
        data: { status: "CANCELLED" },
      });
      expect(result.success).toBe(true);
    });

    it("should throw Forbidden if user is not owner", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        orderId,
        userId: "other-user", // Beda user
        status: "PENDING",
      });

      await expect(paymentService.cancelTransaction(orderId, userId)).rejects.toThrow(CommonError); // Atau message "Forbidden"
    });

    it("should throw BadRequest if transaction is not PENDING", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        orderId,
        userId: userId,
        status: "SUCCESS", // Sudah sukses, tidak bisa cancel
      });

      await expect(paymentService.cancelTransaction(orderId, userId)).rejects.toThrow(PaymentError);
    });

    it("should throw NotFound if transaction does not exist", async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(paymentService.cancelTransaction(orderId, userId)).rejects.toThrow(CommonError);
    });

    it("should log Midtrans cancel error but continue local cancel for non-404 errors", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        orderId,
        userId: userId,
        status: "PENDING",
      });

      const errorOther = new Error("Server Error");
      errorOther.httpStatusCode = 500;
      mockSnapInstance.transaction.cancel.mockRejectedValue(errorOther);

      const result = await paymentService.cancelTransaction(orderId, userId);

      // Tetap berhasil di local meskipun Midtrans error (non-404)
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { orderId },
        data: { status: "CANCELLED" },
      });
      expect(result.success).toBe(true);
    });

    it("should handle CANCELLED status in cancelTransaction", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        orderId,
        userId: userId,
        status: "CANCELLED",
      });

      await expect(paymentService.cancelTransaction(orderId, userId)).rejects.toThrow(PaymentError);
    });

    it("should handle CHALLENGE status in cancelTransaction", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        orderId,
        userId: userId,
        status: "CHALLENGE",
      });

      await expect(paymentService.cancelTransaction(orderId, userId)).rejects.toThrow(PaymentError);
    });

    it("should handle FAILED status in cancelTransaction", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        orderId,
        userId: userId,
        status: "FAILED",
      });

      await expect(paymentService.cancelTransaction(orderId, userId)).rejects.toThrow(PaymentError);
    });
  });
});
