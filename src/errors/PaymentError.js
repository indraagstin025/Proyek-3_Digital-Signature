import BaseError from "./BaseError.js";

/**
 * @description Kelas error khusus untuk masalah pembayaran dan pembatasan fitur premium.
 */
class PaymentError extends BaseError {
    constructor(message, statusCode = 403, errorCode = "PAYMENT_ERROR") {
        // [PERBAIKAN] TUKAR POSISI ARGUMEN (Sesuai BaseError Anda)
        // Urutan: (errorCode, statusCode, message)
        super(errorCode, statusCode, message);
    }

    // --- [BARU] Tambahkan Method Ini ---
    static BadRequest(message = "Permintaan pembayaran tidak valid.") {
        return new PaymentError(message, 400, "BAD_REQUEST");
    }

    static PremiumRequired(message = "Fitur ini hanya tersedia untuk pengguna Premium. Silakan upgrade akun Anda.") {
        return new PaymentError(message, 403, "PREMIUM_REQUIRED");
    }

    static TransactionCancelled(message = "Transaksi telah dibatalkan.") {
        return new PaymentError(message, 400, "TRANSACTION_CANCELLED");
    }

    static TransactionFailed(message = "Transaksi gagal diproses.") {
        return new PaymentError(message, 400, "TRANSACTION_FAILED");
    }

    static PaymentTimeout(message = "Waktu pembayaran telah habis.") {
        return new PaymentError(message, 408, "PAYMENT_TIMEOUT");
    }

    static InvalidPlan(message = "Paket yang pilih tidak valid.") {
        return new PaymentError(message, 400, "INVALID_PLAN");
    }

    static VerificationFailed(message = "Verifikasi pembayaran gagal.") {
        return new PaymentError(message, 400, "VERIFICATION_FAILED");
    }

    static TransactionNotFound(message = "Data transaksi tidak ditemukan.") {
        return new PaymentError(message, 404, "TRANSACTION_NOT_FOUND");
    }

    static InternalServerError(message = "Terjadi kesalahan internal pada layanan pembayaran.") {
        return new PaymentError(message, 500, "INTERNAL_SERVER_ERROR");
    }
}

export default PaymentError;