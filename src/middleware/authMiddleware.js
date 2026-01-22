
import supabaseAuth from "../config/supabaseAuth.js";
import prisma from "../config/prismaClient.js";
import AuthError from "../errors/AuthError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { serialize } from "cookie";

// ============================================================
// USER CACHE - Mengurangi API calls ke Supabase
// ============================================================
// Cache hasil getUser untuk menghindari network call berulang
// TTL: 5 menit (300000ms) - cukup untuk mengurangi load tanpa risiko stale data
const userCache = new Map();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 menit

/**
 * Membersihkan cache yang expired
 */
const cleanupExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of userCache.entries()) {
    if (now - value.timestamp > USER_CACHE_TTL) {
      userCache.delete(key);
    }
  }
};

/**
 * Mendapatkan user dari cache atau Supabase
 * @returns {Promise<{user: object, fromCache: boolean}>}
 */
const getUserWithCache = async (accessToken) => {
  // Gunakan hash sederhana dari token sebagai cache key
  const cacheKey = accessToken.substring(accessToken.length - 32);

  // Cek cache dulu
  if (userCache.has(cacheKey)) {
    const cached = userCache.get(cacheKey);
    const age = Date.now() - cached.timestamp;

    if (age < USER_CACHE_TTL) {
      return { user: cached.user, fromCache: true, error: null };
    }
  }

  // Cache miss - panggil Supabase
  const { data, error } = await supabaseAuth.auth.getUser(accessToken);

  if (!error && data?.user) {
    // Simpan ke cache
    userCache.set(cacheKey, {
      user: data.user,
      timestamp: Date.now(),
    });
  }

  return { user: data?.user, fromCache: false, error };
};

// ============================================================
// REFRESH TOKEN LOCK - Mencegah Race Condition
// ============================================================
// Ketika multiple request datang bersamaan dengan access token expired,
// hanya SATU yang akan melakukan refresh. Request lainnya akan menunggu
// hasil dari refresh yang pertama.
const refreshLocks = new Map();

/**
 * Membersihkan lock yang sudah expired (lebih dari 30 detik)
 * Dipanggil setiap kali ada request baru
 */
const cleanupExpiredLocks = () => {
  const now = Date.now();
  for (const [key, value] of refreshLocks.entries()) {
    if (now - value.timestamp > 30000) {
      refreshLocks.delete(key);
    }
  }
};

/**
 * Mendapatkan opsi cookie yang konsisten
 */
const getCookieOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieDomain = process.env.COOKIE_DOMAIN;

  return {
    httpOnly: true,
    path: "/",
    secure: isProduction,
    sameSite: "lax",
    domain: isProduction && cookieDomain ? cookieDomain : undefined,
    maxAge,
  };
};

/**
 * Set cookies untuk session baru
 */
const setSessionCookies = (res, session) => {
  res.setHeader("Set-Cookie", [
    serialize("sb-access-token", session.access_token, getCookieOptions(session.expires_in)),
    serialize("sb-refresh-token", session.refresh_token, getCookieOptions(60 * 60 * 24 * 7)), // 7 hari
  ]);
};

/**
 * Hapus cookies saat session invalid
 */
const clearSessionCookies = (res) => {
  res.setHeader("Set-Cookie", [
    serialize("sb-access-token", "", { maxAge: -1, path: "/" }),
    serialize("sb-refresh-token", "", { maxAge: -1, path: "/" }),
  ]);
};

/**
 * Melakukan refresh session dengan lock mechanism
 * @param {string} refreshToken - Refresh token dari cookie
 * @param {object} res - Express response object untuk set cookie
 * @returns {Promise<{user: object, accessToken: string}>}
 */
const refreshSessionWithLock = async (refreshToken, res) => {
  // Gunakan prefix refresh token sebagai lock key (lebih aman dari collision)
  const lockKey = refreshToken.substring(0, 32);

  // Cek apakah sudah ada proses refresh yang sedang berjalan untuk token ini
  if (refreshLocks.has(lockKey)) {
    const existingLock = refreshLocks.get(lockKey);
    console.log(`⏳ [Auth] Request menunggu refresh yang sedang berjalan... (Lock: ${lockKey.substring(0, 8)}...)`);

    try {
      // Tunggu hasil dari refresh yang sedang berjalan
      const result = await existingLock.promise;

      // Return hasil yang sama (user & token sudah di-refresh oleh request pertama)
      return result;
    } catch (error) {
      // Jika refresh pertama gagal, lempar error yang sama
      throw error;
    }
  }

  // Buat promise untuk refresh dan simpan di lock
  let resolveRefresh, rejectRefresh;
  const refreshPromise = new Promise((resolve, reject) => {
    resolveRefresh = resolve;
    rejectRefresh = reject;
  });

  // PENTING: Tambahkan catch handler kosong untuk mencegah unhandled rejection crash
  // Error akan tetap di-throw oleh caller, tapi ini mencegah Node crash
  refreshPromise.catch(() => { });

  // Set lock dengan timestamp untuk cleanup
  refreshLocks.set(lockKey, {
    promise: refreshPromise,
    timestamp: Date.now(),
  });

  console.log(`🔄 [Auth] Memulai refresh session... (Lock: ${lockKey.substring(0, 8)}...)`);

  try {
    // Panggil Supabase untuk refresh session
    const { data, error } = await supabaseAuth.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      const errorMsg = error?.message || "Gagal memperbarui sesi";
      console.error(`❌ [Auth] Refresh gagal: ${errorMsg}`);

      // Hapus cookies karena refresh gagal
      clearSessionCookies(res);

      const authError = AuthError.SessionExpired("Sesi berakhir. Silakan login kembali.");
      rejectRefresh(authError);
      throw authError;
    }

    console.log(`✅ [Auth] Refresh berhasil! Token baru diterbitkan.`);

    // Set cookies baru
    setSessionCookies(res, data.session);

    const result = {
      user: data.user,
      accessToken: data.session.access_token,
    };

    // Resolve promise agar request lain yang menunggu bisa lanjut
    resolveRefresh(result);

    return result;
  } catch (error) {
    // Pastikan reject dipanggil jika belum
    if (rejectRefresh) {
      rejectRefresh(error);
    }
    throw error;
  } finally {
    // Hapus lock setelah delay singkat
    // Delay ini memastikan request yang datang hampir bersamaan masih bisa
    // mendapatkan hasil dari refresh yang baru selesai
    setTimeout(() => {
      refreshLocks.delete(lockKey);
      console.log(`🧹 [Auth] Lock dibersihkan: ${lockKey.substring(0, 8)}...`);
    }, 2000);
  }
};

/**
 * Middleware untuk memproteksi rute privat.
 * Melakukan verifikasi token JWT Supabase, sinkronisasi dengan database lokal,
 * dan otomatis memperbarui token (Auto-Refresh) jika token akses kadaluwarsa.
 * 
 * FITUR:
 * - Validasi access token dari cookie
 * - Auto-refresh dengan mutex lock (mencegah race condition)
 * - Sinkronisasi user dengan database lokal (Prisma)
 * - Proper error handling dan cookie management
 */
const authMiddleware = asyncHandler(async (req, res, next) => {
  // Cleanup expired locks setiap request
  cleanupExpiredLocks();

  let accessToken = req.cookies["sb-access-token"];
  const refreshToken = req.cookies["sb-refresh-token"];

  // 1. Cek Kelengkapan Token
  if (!accessToken && !refreshToken) {
    throw AuthError.MissingToken("Sesi tidak ditemukan. Silakan login.");
  }

  let supabaseUser = null;
  let needsRefresh = false;

  // 2. Validasi Access Token (Jika ada)
  if (accessToken) {
    try {
      // 🚀 OPTIMIZED: Menggunakan cache untuk menghindari network call berulang
      cleanupExpiredCache();
      const { user, fromCache, error } = await getUserWithCache(accessToken);

      if (!error && user) {
        supabaseUser = user;
      } else if (error) {
        const errorMsg = error.message?.toLowerCase() || "";

        // Cek apakah token expired (bukan invalid/malformed)
        const isExpired =
          errorMsg.includes("jwt expired") ||
          errorMsg.includes("token is expired") ||
          errorMsg.includes("token has expired");

        if (isExpired) {
          console.log(`⚠️ [Auth] Access token expired, akan mencoba refresh...`);
          needsRefresh = true;
        } else {
          // Token invalid/malformed - tidak perlu coba refresh
          console.error(`❌ [Auth] Token invalid: ${errorMsg}`);
          clearSessionCookies(res);
          throw AuthError.InvalidToken("Token otentikasi tidak valid.");
        }
      }
    } catch (error) {
      // Jika error bukan dari AuthError kita, anggap token invalid
      if (!(error instanceof AuthError)) {
        console.error(`❌ [Auth] Error validasi token:`, error.message);
        needsRefresh = true;
      } else {
        throw error;
      }
    }
  } else {
    // Tidak ada access token, perlu refresh
    needsRefresh = true;
  }

  // 3. Auto-Refresh dengan Lock Mechanism
  if (!supabaseUser && needsRefresh && refreshToken) {
    try {
      const refreshResult = await refreshSessionWithLock(refreshToken, res);
      supabaseUser = refreshResult.user;
      accessToken = refreshResult.accessToken;
    } catch (error) {
      // Error sudah di-handle di dalam refreshSessionWithLock
      throw error;
    }
  }

  // 4. Final Check - Pastikan user valid
  if (!supabaseUser) {
    clearSessionCookies(res);
    throw AuthError.InvalidToken("Gagal memverifikasi identitas pengguna.");
  }

  // 5. Sinkronisasi dengan Database Lokal (Prisma)
  let localUser;
  try {
    localUser = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        userStatus: true,
      },
    });
  } catch (dbError) {
    console.error(`❌ [Auth] Database error:`, dbError.message);
    throw AuthError.ServerError("Terjadi kesalahan saat memverifikasi akun.");
  }

  if (!localUser) {
    console.warn(`⚠️ [Auth] User ${supabaseUser.id} tidak ditemukan di database lokal`);
    throw AuthError.UserNotFound(
      "Akun pengguna valid, namun data tidak ditemukan di sistem kami."
    );
  }

  // 6. Attach user ke Request Object
  req.user = {
    id: localUser.id,
    email: localUser.email,
    name: localUser.name,
    role: localUser.isSuperAdmin ? "super_admin" : "basic_user",
    userStatus: localUser.userStatus || "FREE",
    token: accessToken, // Opsional: untuk diteruskan ke service lain
  };

  next();
});

export default authMiddleware;
