import midtransClient from "midtrans-client";
import crypto from "crypto";
import CommonError from "../errors/CommonError.js";
import prisma from "../config/prismaClient.js";
import PaymentError from "../errors/PaymentError.js";

export class PaymentService {
  constructor() {
    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
    });
    console.log(`[PaymentService] Initialized. Production Mode: ${process.env.MIDTRANS_IS_PRODUCTION}`);
  }

  /**
   * Membuat transaksi pembayaran baru (Upgrade ke PREMIUM).
   */
  async createSubscription(userId, planType, groupId = null) {
    console.log(`[PaymentService] Creating subscription for User: ${userId}, Plan: ${planType}, GroupContext: ${groupId || "None"}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw CommonError.NotFound("User tidak ditemukan.");

    let amount = 0;
    let productName = "";

    if (planType === "PREMIUM_MONTHLY") {
      amount = 10000;
      productName = "WESIGN Pro Tier (Bulanan)";
    } else if (planType === "PREMIUM_YEARLY") {
      amount = 100000;
      productName = "WESIGN Pro Tier (Tahunan)";
    } else {
      throw CommonError.BadRequest("Paket langganan tidak valid.");
    }

    if (groupId) {
      productName += " - Group Upgrade";
    }

    const orderId = `ORDER-${userId.substring(0, 5)}-${Date.now()}`;
    console.log(`[PaymentService] Generated Order ID: ${orderId} | Amount: ${amount}`);

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      item_details: [
        {
          id: planType,
          price: amount,
          quantity: 1,
          name: productName,
        },
      ],
      customer_details: {
        first_name: user.name,
        email: user.email,
        phone: user.phoneNumber || undefined,
      },

      custom_field1: userId,
      custom_field2: planType,
      custom_field3: groupId ? String(groupId) : undefined,
    };

    try {
      const transaction = await this.snap.createTransaction(parameter);
      console.log(`[PaymentService] Snap Token Created: ${transaction.token}`);

      const transactionData = {
        orderId: orderId,
        amount: amount,
        status: "PENDING",
        planType: planType,
        snapToken: transaction.token,
        snapUrl: transaction.redirect_url,
        userId: userId,
      };

      await prisma.transaction.create({
        data: transactionData,
      });

      return {
        orderId,
        snapToken: transaction.token,
        snapUrl: transaction.redirect_url,
        amount,
      };
    } catch (error) {
      console.error(`[PaymentService] Error creating transaction: ${error.message}`);
      throw new PaymentError("Gagal menghubungi Midtrans.", 500);
    }
  }

  /**
   * Menangani feedback (webhook) dari Midtrans.
   * [UPDATED] Menambahkan Security Check & Idempotency Check
   */
  async handleWebhook(notification) {
    try {
      console.log(`[PaymentService] Webhook Received.`);

      const statusResponse = await this.snap.transaction.notification(notification);
      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;
      const statusCode = statusResponse.status_code;
      const grossAmount = statusResponse.gross_amount;
      const signatureKey = statusResponse.signature_key;

      console.log(`[PaymentService] Processing Order ID: ${orderId} | Status: ${transactionStatus}`);

      const serverKey = process.env.MIDTRANS_SERVER_KEY;
      const inputString = orderId + statusCode + grossAmount + serverKey;
      const mySignature = crypto.createHash("sha512").update(inputString).digest("hex");

      if (mySignature !== signatureKey) {
        console.error(`[PaymentService] ⛔ Invalid Signature! Potential Fake Request.`);
        throw new Error("Invalid Signature Key");
      }

      const transaction = await prisma.transaction.findUnique({
        where: { orderId: orderId },
        include: { user: true },
      });

      if (!transaction) {
        console.warn(`[PaymentService] Transaction with Order ID ${orderId} not found in DB.`);
        return { success: false, message: "Transaction not found" };
      }

      if (transaction.status === "SUCCESS") {
        console.log(`[PaymentService] Transaction ${orderId} already SUCCESS. Ignoring duplicate webhook.`);
        return { success: true, message: "Already processed" };
      }

      let newStatus = transaction.status;
      let updateTier = false;

      if (transactionStatus === "capture") {
        if (fraudStatus === "challenge") {
          newStatus = "CHALLENGE";
        } else if (fraudStatus === "accept") {
          newStatus = "SUCCESS";
          updateTier = true;
        }
      } else if (transactionStatus === "settlement") {
        newStatus = "SUCCESS";
        updateTier = true;
      } else if (transactionStatus === "cancel" || transactionStatus === "deny" || transactionStatus === "expire") {
        newStatus = "FAILED";
      } else if (transactionStatus === "pending") {
        newStatus = "PENDING";
      }

      console.log(`[PaymentService] Determined New Status: ${newStatus} | Update Tier: ${updateTier}`);

      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { orderId: orderId },
          data: { status: newStatus },
        });

        if (updateTier) {
          const durationDays = transaction.planType === "PREMIUM_YEARLY" ? 365 : 30;

          let currentPremiumUntil = transaction.user.premiumUntil ? new Date(transaction.user.premiumUntil) : new Date();

          if (currentPremiumUntil < new Date()) {
            currentPremiumUntil = new Date();
          }

          const newPremiumUntil = new Date(currentPremiumUntil);
          newPremiumUntil.setDate(newPremiumUntil.getDate() + durationDays);

          console.log(`[PaymentService] Upgrading User ${transaction.userId} until ${newPremiumUntil.toISOString()}`);

          await tx.user.update({
            where: { id: transaction.userId },
            data: {
              userStatus: "PREMIUM",
              premiumUntil: newPremiumUntil,
            },
          });

          await tx.auditLog.create({
            data: {
              action: "TRANSACTION_SUCCESS",
              actorId: transaction.userId,
              description: `User upgraded to PREMIUM via ${transaction.planType}. Order ID: ${orderId}`,
              ipAddress: "System Webhook",
              userAgent: "Midtrans",
            },
          });
        }
      });

      console.log(`[PaymentService] Webhook processing completed successfully.`);
      return { success: true };
    } catch (error) {
      console.error("[PaymentService] Webhook processing error:", error.message);

      return { success: false, message: error.message };
    }
  }

  async getTransactionByOrderId(orderId) {
    return await prisma.transaction.findUnique({
      where: { orderId },
    });
  }

  /**
   * Membatalkan transaksi.
   */
  /**
   * Membatalkan transaksi.
   */
  async cancelTransaction(orderId, userId) {
    console.log(`[PaymentService] Request to cancel Order ID: ${orderId} by User: ${userId}`);

    try {
      const transaction = await prisma.transaction.findUnique({
        where: { orderId: orderId },
      });

      if (!transaction) throw CommonError.NotFound("Transaksi tidak ditemukan.");
      if (transaction.userId !== userId) throw CommonError.Forbidden("Anda tidak memiliki akses ke transaksi ini.");

      if (transaction.status !== "PENDING") {
        console.warn(`[PaymentService] Cannot cancel transaction. Current status: ${transaction.status}`);
        throw new PaymentError("Hanya transaksi PENDING yang bisa dibatalkan.", 400);
      }

      try {
        await this.snap.transaction.cancel(orderId);
        console.log(`[PaymentService] Midtrans API cancel success for Order ID: ${orderId}`);
      } catch (midtransError) {
        if (midtransError.httpStatusCode == 404) {
          console.warn(`[PaymentService] Midtrans transaction not found (404), proceeding to local cancel.`);
        } else {
          console.error("[PaymentService] Midtrans Cancel Error:", midtransError.message);
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { orderId: orderId },
          data: { status: "CANCELLED" },
        });

        await tx.auditLog.create({
          data: {
            action: "TRANSACTION_CANCELLED",
            actorId: userId,
            description: `User cancelled transaction Order ID: ${orderId}`,
            ipAddress: "Client Request",
            userAgent: "Web App",
          },
        });
      });

      console.log(`[PaymentService] Transaction ${orderId} cancelled locally.`);
      return { success: true, message: "Transaksi berhasil dibatalkan." };
    } catch (error) {
      if (error instanceof CommonError || error instanceof PaymentError) {
        throw error;
      }

      console.error("[PaymentService] Cancel Transaction General Error:", error);
      throw new PaymentError("Gagal membatalkan transaksi.", 500);
    }
  }
}
