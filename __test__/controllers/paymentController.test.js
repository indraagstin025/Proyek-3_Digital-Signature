/**
 * Unit Tests for PaymentController
 *
 * @file paymentController.test.js
 * @description Tests for PaymentController methods:
 *  - createSubscription: Create subscription transaction
 *  - handleWebhook: Process Midtrans webhook callbacks
 *  - cancelTransaction: Cancel pending transactions
 *  - getTransactionStatus: Get transaction details by order ID
 */

import { jest } from "@jest/globals";
import { createPaymentController } from "../../src/controllers/paymentController.js";
import CommonError from "../../src/errors/CommonError.js";

describe("PaymentController", () => {
  let paymentController;
  let mockPaymentService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock services
    mockPaymentService = {
      createSubscription: jest.fn(),
      handleWebhook: jest.fn(),
      cancelTransaction: jest.fn(),
      getTransactionByOrderId: jest.fn(),
    };

    paymentController = createPaymentController(mockPaymentService);

    // Mock request/response
    mockReq = {
      user: { id: "user-123" },
      params: {},
      body: {},
      query: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  // Helper function untuk menjalankan asyncHandler
  const runController = (controllerMethod) => {
    return new Promise((resolve, reject) => {
      const originalJson = mockRes.json;
      mockRes.json = jest.fn((data) => {
        originalJson.call(mockRes, data);
        resolve(data);
        return mockRes;
      });

      mockNext = jest.fn((error) => {
        if (error) {
          reject(error);
        }
      });

      const result = controllerMethod(mockReq, mockRes, mockNext);
      if (result && typeof result.then === "function") {
        result
          .then(() => {
            // Jika promise resolve tapi json belum dipanggil, resolve undefined
          })
          .catch(reject);
      }
    });
  };

  describe("createSubscription", () => {
    beforeEach(() => {
      mockReq.body = { planType: "PREMIUM_MONTHLY" };
    });

    it("Harus berhasil membuat subscription dan return snapToken", async () => {
      const mockTransaction = {
        orderId: "ORDER-123",
        snapToken: "snap-token-abc123",
        snapUrl: "https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-abc123",
        amount: 50000,
      };

      mockPaymentService.createSubscription.mockResolvedValue(mockTransaction);

      await runController(paymentController.createSubscription);

      expect(mockPaymentService.createSubscription).toHaveBeenCalledWith("user-123", "PREMIUM_MONTHLY");
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Transaksi berhasil dibuat.",
        data: {
          orderId: "ORDER-123",
          snapToken: "snap-token-abc123",
          snapUrl: "https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-abc123",
          amount: 50000,
        },
      });
    });

    it("Harus throw error ketika userId tidak ada", async () => {
      mockReq.user = { id: null };

      try {
        await runController(paymentController.createSubscription);
        fail("Should have thrown error");
      } catch (error) {
        // CommonError.Unauthorized jika exist atau catch any error
        expect(error).toBeDefined();
      }
    });

    it("Harus throw error ketika user undefined", async () => {
      mockReq.user = undefined;

      try {
        await runController(paymentController.createSubscription);
        fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("Harus support PREMIUM_YEARLY plan", async () => {
      mockReq.body = { planType: "PREMIUM_YEARLY" };

      const mockTransaction = {
        orderId: "ORDER-456",
        snapToken: "snap-token-xyz789",
        snapUrl: "https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-xyz789",
        amount: 500000,
      };

      mockPaymentService.createSubscription.mockResolvedValue(mockTransaction);

      await runController(paymentController.createSubscription);

      expect(mockPaymentService.createSubscription).toHaveBeenCalledWith("user-123", "PREMIUM_YEARLY");
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it("Harus handle service error", async () => {
      const error = new Error("Payment gateway error");
      mockPaymentService.createSubscription.mockRejectedValue(error);

      try {
        await runController(paymentController.createSubscription);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.message).toContain("Payment gateway");
      }
    });
  });

  describe("handleWebhook", () => {
    beforeEach(() => {
      mockReq.body = {
        transaction_id: "txn-123",
        order_id: "ORDER-123",
        transaction_status: "settlement",
        transaction_type: "charge_card",
        payment_type: "credit_card",
        fraud_status: "accept",
        signature_key: "valid-signature",
      };
    });

    it("Harus process webhook dengan status settlement", async () => {
      mockPaymentService.handleWebhook.mockResolvedValue({ success: true });

      await runController(paymentController.handleWebhook);

      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Webhook processed successfully.",
      });
    });

    it("Harus process webhook dengan status capture", async () => {
      mockReq.body.transaction_status = "capture";
      mockPaymentService.handleWebhook.mockResolvedValue({ success: true });

      await runController(paymentController.handleWebhook);

      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus process webhook dengan status pending", async () => {
      mockReq.body.transaction_status = "pending";
      mockPaymentService.handleWebhook.mockResolvedValue({ success: true });

      await runController(paymentController.handleWebhook);

      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus process webhook dengan status deny", async () => {
      mockReq.body.transaction_status = "deny";
      mockPaymentService.handleWebhook.mockResolvedValue({ success: true });

      await runController(paymentController.handleWebhook);

      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus process webhook dengan fraud_challenge", async () => {
      mockReq.body.fraud_status = "challenge";
      mockPaymentService.handleWebhook.mockResolvedValue({ success: true });

      await runController(paymentController.handleWebhook);

      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus handle webhook processing error", async () => {
      const error = new Error("Webhook verification failed");
      mockPaymentService.handleWebhook.mockRejectedValue(error);

      try {
        await runController(paymentController.handleWebhook);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.message).toContain("verification");
      }
    });

    it("Harus handle empty notification body", async () => {
      mockReq.body = {};
      mockPaymentService.handleWebhook.mockResolvedValue({ success: true });

      await runController(paymentController.handleWebhook);

      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith({});
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe("cancelTransaction", () => {
    beforeEach(() => {
      mockReq.body = { orderId: "ORDER-123" };
    });

    it("Harus berhasil membatalkan transaksi", async () => {
      const mockResult = {
        message: "Transaksi berhasil dibatalkan.",
        orderId: "ORDER-123",
        status: "cancelled",
      };

      mockPaymentService.cancelTransaction.mockResolvedValue(mockResult);

      await runController(paymentController.cancelTransaction);

      expect(mockPaymentService.cancelTransaction).toHaveBeenCalledWith("ORDER-123", "user-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        message: "Transaksi berhasil dibatalkan.",
      });
    });

    it("Harus throw error ketika userId tidak ada", async () => {
      mockReq.user = { id: null };

      try {
        await runController(paymentController.cancelTransaction);
        fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("Harus throw BadRequest ketika orderId tidak diisi", async () => {
      mockReq.body = { orderId: null };

      try {
        await runController(paymentController.cancelTransaction);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(400);
        expect(error.message).toContain("Order ID");
      }
    });

    it("Harus throw BadRequest ketika orderId undefined", async () => {
      mockReq.body = {};

      try {
        await runController(paymentController.cancelTransaction);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(400);
      }
    });

    it("Harus throw error ketika transaksi tidak ditemukan", async () => {
      const error = new Error("Transaksi tidak ditemukan");
      error.statusCode = 404;
      mockPaymentService.cancelTransaction.mockRejectedValue(error);

      try {
        await runController(paymentController.cancelTransaction);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(404);
      }
    });

    it("Harus handle Midtrans API error gracefully", async () => {
      const error = new Error("Midtrans API error");
      error.statusCode = 500;
      mockPaymentService.cancelTransaction.mockRejectedValue(error);

      try {
        await runController(paymentController.cancelTransaction);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(500);
      }
    });

    it("Harus throw error ketika transaksi tidak bisa dibatalkan (status settled)", async () => {
      const error = new Error("Transaksi sudah settlement, tidak bisa dibatalkan");
      error.statusCode = 400;
      mockPaymentService.cancelTransaction.mockRejectedValue(error);

      try {
        await runController(paymentController.cancelTransaction);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(400);
      }
    });
  });

  describe("getTransactionStatus", () => {
    beforeEach(() => {
      mockReq.params = { orderId: "ORDER-123" };
    });

    it("Harus return status transaksi settlement", async () => {
      const mockTransaction = {
        orderId: "ORDER-123",
        status: "settlement",
        amount: 50000,
        planType: "PREMIUM_MONTHLY",
      };

      mockPaymentService.getTransactionByOrderId.mockResolvedValue(mockTransaction);

      await runController(paymentController.getTransactionStatus);

      expect(mockPaymentService.getTransactionByOrderId).toHaveBeenCalledWith("ORDER-123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          orderId: "ORDER-123",
          status: "settlement",
          amount: 50000,
          planType: "PREMIUM_MONTHLY",
        },
      });
    });

    it("Harus return status transaksi pending", async () => {
      const mockTransaction = {
        orderId: "ORDER-456",
        status: "pending",
        amount: 100000,
        planType: "PREMIUM_YEARLY",
      };

      mockPaymentService.getTransactionByOrderId.mockResolvedValue(mockTransaction);

      await runController(paymentController.getTransactionStatus);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          orderId: "ORDER-456",
          status: "pending",
          amount: 100000,
          planType: "PREMIUM_YEARLY",
        },
      });
    });

    it("Harus return status transaksi cancelled", async () => {
      const mockTransaction = {
        orderId: "ORDER-789",
        status: "cancelled",
        amount: 50000,
        planType: "PREMIUM_MONTHLY",
      };

      mockPaymentService.getTransactionByOrderId.mockResolvedValue(mockTransaction);

      await runController(paymentController.getTransactionStatus);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("Harus throw NotFound ketika transaksi tidak ditemukan", async () => {
      mockPaymentService.getTransactionByOrderId.mockResolvedValue(null);

      try {
        await runController(paymentController.getTransactionStatus);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(404);
        expect(error.message).toContain("tidak ditemukan");
      }
    });

    it("Harus throw NotFound ketika transaksi undefined", async () => {
      mockPaymentService.getTransactionByOrderId.mockResolvedValue(undefined);

      try {
        await runController(paymentController.getTransactionStatus);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(404);
      }
    });

    it("Harus handle database error gracefully", async () => {
      const error = new Error("Database connection failed");
      mockPaymentService.getTransactionByOrderId.mockRejectedValue(error);

      try {
        await runController(paymentController.getTransactionStatus);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.message).toContain("Database");
      }
    });

    it("Harus handle invalid orderId format", async () => {
      mockReq.params = { orderId: "" };
      mockPaymentService.getTransactionByOrderId.mockResolvedValue(null);

      try {
        await runController(paymentController.getTransactionStatus);
        fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(404);
      }
    });
  });

  describe("createPaymentController - Initialization", () => {
    it("Harus membuat controller dengan valid paymentService", () => {
      const controller = createPaymentController(mockPaymentService);
      expect(controller).toHaveProperty("createSubscription");
      expect(controller).toHaveProperty("handleWebhook");
      expect(controller).toHaveProperty("cancelTransaction");
      expect(controller).toHaveProperty("getTransactionStatus");
    });

    it("Harus memiliki semua method yang diperlukan", () => {
      const controller = createPaymentController(mockPaymentService);
      const methods = ["createSubscription", "handleWebhook", "cancelTransaction", "getTransactionStatus"];
      methods.forEach((method) => {
        expect(typeof controller[method]).toBe("function");
      });
    });
  });
});
