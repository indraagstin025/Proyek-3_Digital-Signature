import BaseError from "./BaseError.js";

class CommonError extends BaseError {
    /**
     *
     * @param code
     * @param statusCode
     * @param message
     */
    constructor(code, statusCode = 500, message = "Terjadi kesalahan umum") {
        super(code, statusCode, message);
    }


    static NotFound(message = "Sumber daya yang dicari tidak ditemukan.") {
        return new CommonError("NOT_FOUND", 404, message);
    }


    static BadRequest(message = "Permintaan tidak valid atau format data salah.") {
        return new CommonError("BAD_REQUEST", 400, message);
    }

    static SupabaseError(message = "Terjadi kesalahan pada layanan Supabase.") {
        return new CommonError("SUPABASE_ERROR", 502, message);
    }

    static DatabaseError(message = "Terjadi kesalahan pada database.") {
        return new CommonError("DATABASE_ERROR", 500, message);
    }

    static NetworkError(message = "Koneksi ke server lambat atau tidak stabil, Silahkan coba lagi beberapa saat.") {
        return new CommonError("NETWORK_ERROR", 503, message);
    }

    static InternalServerError(message = "Terjadi kesalahan internal pada server.") {
        return new CommonError("INTERNAL_SERVER_ERROR", 500, message);
    }

    static ServiceUnavailable(message = "Layanan sementara tidak tersedia.") {
        return new CommonError("SERVICE_UNAVAILABLE", 503, message);
    }

    static Forbidden(message = "Akses ditolak. Anda tidak memiliki hak akses") {
        return new CommonError("FORBIDDEN", 403, message);
    }
}

export default CommonError;